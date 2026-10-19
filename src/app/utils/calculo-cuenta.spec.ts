import {
  OPCIONES_PROPINA,
  calcularTotalesCuenta,
  formatearMoneda,
  interpretarQrPropina
} from './calculo-cuenta';

describe('Punto 21 — QR de propina', () => {
  it('acepta el QR Excelente y devuelve 20 %', () => {
    const resultado = interpretarQrPropina('BASILICO:PROPINA:EXCELENTE:20');
    expect(resultado.valido).toBe(true);
    if (resultado.valido) {
      expect(resultado.opcion.nivel).toBe('excelente');
      expect(resultado.opcion.porcentaje).toBe(20);
    }
  });

  it('acepta el QR Malo como selección explícita del 0 %', () => {
    const resultado = interpretarQrPropina('  basilico:propina:malo:0 ');
    expect(resultado.valido).toBe(true);
    if (resultado.valido) {
      expect(resultado.opcion.nivel).toBe('malo');
      expect(resultado.opcion.porcentaje).toBe(0);
    }
  });

  it('rechaza el QR de una mesa', () => {
    const resultado = interpretarQrPropina('mesa_numero:4');
    expect(resultado.valido).toBe(false);
    if (!resultado.valido) expect(resultado.tipo).toBe('mesa');
  });

  it('rechaza el QR de ingreso al local y el de un DNI', () => {
    const ingreso = interpretarQrPropina('BASILICO_INGRESO_LISTA_ESPERA');
    const dni = interpretarQrPropina('00123456789@PEREZ@JUAN@M@30123456@A@01/01/1990@01/01/2020');
    expect(ingreso.valido).toBe(false);
    expect(dni.valido).toBe(false);
    if (!ingreso.valido) expect(ingreso.tipo).toBe('ingreso');
    if (!dni.valido) expect(dni.tipo).toBe('dni');
  });

  it('rechaza porcentajes arbitrarios o códigos alterados', () => {
    expect(interpretarQrPropina('BASILICO:PROPINA:EXCELENTE:50').valido).toBe(false);
    expect(interpretarQrPropina('BASILICO:PROPINA:BUENO:15').valido).toBe(false);
    expect(interpretarQrPropina('').valido).toBe(false);
    expect(interpretarQrPropina(null).valido).toBe(false);
  });

  it('tiene exactamente los cinco niveles del enunciado', () => {
    expect(OPCIONES_PROPINA.map((o) => o.porcentaje)).toEqual([20, 15, 10, 5, 0]);
    expect(new Set(OPCIONES_PROPINA.map((o) => o.codigoQr)).size).toBe(5);
  });
});

describe('Punto 21 — Cálculo de la cuenta', () => {
  const lineas = [
    { cantidad: 2, precio_unitario: 6500 },
    { cantidad: 3, precio_unitario: 1999.99 },
    { cantidad: 1, precio_unitario: 12350.5 }
  ];

  it('calcula subtotal, descuento, propina y total con varios productos', () => {
    // subtotal = 13000 + 5999,97 + 12350,50 = 31350,47
    // descuento 15 % = 4702,5705 → 4702,57 ; base = 26647,90
    // propina 10 % = 2664,79 ; total = 29312,69
    const t = calcularTotalesCuenta(lineas, 15, 10);
    expect(t.subtotal).toBe(31350.47);
    expect(t.descuento).toBe(4702.57);
    expect(t.subtotalConDescuento).toBe(26647.9);
    expect(t.propina).toBe(2664.79);
    expect(t.total).toBe(29312.69);
  });

  it('sin descuento y con propina 0 % el total es el subtotal', () => {
    const t = calcularTotalesCuenta(lineas, 0, 0);
    expect(t.descuento).toBe(0);
    expect(t.propina).toBe(0);
    expect(t.total).toBe(t.subtotal);
  });

  it('aplica la propina sobre el subtotal con descuento', () => {
    const t = calcularTotalesCuenta([{ cantidad: 1, precio_unitario: 10000 }], 20, 20);
    expect(t.descuento).toBe(2000);
    expect(t.propina).toBe(1600);
    expect(t.total).toBe(9600);
  });

  it('redondea los centavos hacia arriba en la mitad, igual que PostgreSQL', () => {
    // 0,10 × 5 % = 0,005 → 0,01
    const t = calcularTotalesCuenta([{ cantidad: 1, precio_unitario: 0.1 }], 0, 5);
    expect(t.propina).toBe(0.01);
  });

  it('rechaza porcentajes fuera de las reglas', () => {
    expect(() => calcularTotalesCuenta(lineas, 25, 10)).toThrow();
    expect(() => calcularTotalesCuenta(lineas, 0, 7)).toThrow();
    expect(() => calcularTotalesCuenta([{ cantidad: 0, precio_unitario: 100 }], 0, 0)).toThrow();
  });

  it('formatea importes en pesos argentinos', () => {
    expect(formatearMoneda(25350)).toBe('$ 25.350');
    expect(formatearMoneda(29312.69)).toBe('$ 29.312,69');
  });
});
