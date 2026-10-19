import { NivelPropina, OpcionPropina } from '../interfaces/cuenta';

/**
 * Punto 21 — Reglas de la cuenta, compartidas con la base de datos.
 *
 * Regla monetaria (idéntica a fn_recalcular_cuenta en
 * supabase/migrations/20261019120000_punto21_cuentas.sql):
 *   subtotal               = Σ cantidad × precio_unitario
 *   descuento              = redondeo(subtotal × %descuento / 100)
 *   subtotal_con_descuento = subtotal − descuento
 *   propina                = redondeo(subtotal_con_descuento × %propina / 100)
 *   total                  = subtotal_con_descuento + propina
 *
 * Para evitar errores de coma flotante se opera en centavos enteros y se redondea
 * al centavo más cercano (mitades hacia arriba, igual que round(numeric, 2) en PostgreSQL
 * para importes positivos). Los importes que se muestran salen siempre de Supabase;
 * esta función se usa para validar coherencia y en las pruebas unitarias.
 */

export const PORCENTAJES_PROPINA_VALIDOS = [0, 5, 10, 15, 20] as const;
export const PORCENTAJES_DESCUENTO_VALIDOS = [0, 10, 15, 20] as const;

export const OPCIONES_PROPINA: readonly OpcionPropina[] = [
  { nivel: 'excelente', etiqueta: 'Excelente', porcentaje: 20, codigoQr: 'BASILICO:PROPINA:EXCELENTE:20', icono: 'happy-outline' },
  { nivel: 'muy_bueno', etiqueta: 'Muy bueno', porcentaje: 15, codigoQr: 'BASILICO:PROPINA:MUY_BUENO:15', icono: 'thumbs-up-outline' },
  { nivel: 'bueno', etiqueta: 'Bueno', porcentaje: 10, codigoQr: 'BASILICO:PROPINA:BUENO:10', icono: 'checkmark-circle-outline' },
  { nivel: 'regular', etiqueta: 'Regular', porcentaje: 5, codigoQr: 'BASILICO:PROPINA:REGULAR:5', icono: 'remove-circle-outline' },
  { nivel: 'malo', etiqueta: 'Malo', porcentaje: 0, codigoQr: 'BASILICO:PROPINA:MALO:0', icono: 'sad-outline' }
];

export interface LineaCalculo {
  cantidad: number;
  precio_unitario: number;
}

export interface TotalesCuenta {
  subtotal: number;
  descuento: number;
  subtotalConDescuento: number;
  propina: number;
  total: number;
}

const aCentavos = (importe: number): number => Math.round(Number(importe) * 100);
const aPesos = (centavos: number): number => centavos / 100;

export function calcularTotalesCuenta(
  lineas: LineaCalculo[],
  porcentajeDescuento: number,
  porcentajePropina: number
): TotalesCuenta {
  if (!(PORCENTAJES_DESCUENTO_VALIDOS as readonly number[]).includes(porcentajeDescuento)) {
    throw new Error(`Porcentaje de descuento inválido: ${porcentajeDescuento}`);
  }
  if (!(PORCENTAJES_PROPINA_VALIDOS as readonly number[]).includes(porcentajePropina)) {
    throw new Error(`Porcentaje de propina inválido: ${porcentajePropina}`);
  }

  const subtotalC = lineas.reduce((acum, linea) => {
    if (!Number.isInteger(linea.cantidad) || linea.cantidad <= 0) {
      throw new Error(`Cantidad inválida: ${linea.cantidad}`);
    }
    return acum + linea.cantidad * aCentavos(linea.precio_unitario);
  }, 0);

  const descuentoC = Math.round((subtotalC * porcentajeDescuento) / 100);
  const baseC = subtotalC - descuentoC;
  const propinaC = Math.round((baseC * porcentajePropina) / 100);

  return {
    subtotal: aPesos(subtotalC),
    descuento: aPesos(descuentoC),
    subtotalConDescuento: aPesos(baseC),
    propina: aPesos(propinaC),
    total: aPesos(baseC + propinaC)
  };
}

export type TipoQrDetectado = 'mesa' | 'ingreso' | 'dni' | 'propina_mal_formada' | 'desconocido';

export type ResultadoQrPropina =
  | { valido: true; opcion: OpcionPropina }
  | { valido: false; tipo: TipoQrDetectado; mensaje: string };

/**
 * Valida estrictamente el contenido de un QR de propina. Solo se aceptan los cinco
 * códigos oficiales; el servidor vuelve a validarlo (la app nunca envía un porcentaje).
 */
export function interpretarQrPropina(contenido: string | null | undefined): ResultadoQrPropina {
  const texto = (contenido ?? '').trim();
  const normalizado = texto.toUpperCase();

  const opcion = OPCIONES_PROPINA.find((op) => op.codigoQr === normalizado);
  if (opcion) {
    return { valido: true, opcion };
  }

  if (/^mesa_numer(o)?:/i.test(texto)) {
    return { valido: false, tipo: 'mesa', mensaje: 'Escaneaste el QR de una mesa. Buscá uno de los cinco QR de propina.' };
  }
  if (normalizado === 'BASILICO_INGRESO_LISTA_ESPERA') {
    return { valido: false, tipo: 'ingreso', mensaje: 'Ese es el QR de ingreso al local, no un QR de propina.' };
  }
  if ((texto.match(/@/g) ?? []).length >= 4) {
    return { valido: false, tipo: 'dni', mensaje: 'Escaneaste un documento. Buscá uno de los cinco QR de propina.' };
  }
  if (normalizado.startsWith('BASILICO:PROPINA:')) {
    return { valido: false, tipo: 'propina_mal_formada', mensaje: 'El QR de propina no es válido. Usá los códigos oficiales de Basílico.' };
  }
  return { valido: false, tipo: 'desconocido', mensaje: 'El código escaneado no corresponde a un QR de propina de Basílico.' };
}

export function obtenerOpcionPropina(nivel: NivelPropina | null | undefined): OpcionPropina | null {
  return OPCIONES_PROPINA.find((op) => op.nivel === nivel) ?? null;
}

/**
 * Formato monetario argentino con dos decimales solo cuando hacen falta: $ 25.350 o $ 25.350,50
 */
export function formatearMoneda(importe: number | null | undefined): string {
  const valor = Number(importe ?? 0);
  const tieneCentavos = Math.round(valor * 100) % 100 !== 0;
  return '$ ' + new Intl.NumberFormat('es-AR', {
    minimumFractionDigits: tieneCentavos ? 2 : 0,
    maximumFractionDigits: 2
  }).format(valor);
}
