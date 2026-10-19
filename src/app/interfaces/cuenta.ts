/**
 * Punto 21 — Cuenta de la estadía, propina por QR y pago simulado.
 */

/**
 * Estados de la cuenta (tabla `cuentas`):
 * - pendiente_propina: el cliente pidió la cuenta y falta escanear el QR de propina.
 * - lista_para_pagar: propina elegida, detalle generado y pago habilitado.
 * - pago_pendiente_confirmacion: el cliente realizó el pago simulado.
 * - pago_confirmado: el mozo confirmó el pago (base del Punto 22).
 */
export type EstadoCuenta =
  | 'pendiente_propina'
  | 'lista_para_pagar'
  | 'pago_pendiente_confirmacion'
  | 'pago_confirmado';

export type NivelPropina = 'excelente' | 'muy_bueno' | 'bueno' | 'regular' | 'malo';

export interface OpcionPropina {
  nivel: NivelPropina;
  etiqueta: string;
  porcentaje: number;
  /** Contenido exacto del código QR impreso */
  codigoQr: string;
  icono: string;
}

export type JuegoConDescuento = 'bingo' | 'mayor-menor' | 'trivia';

export interface CuentaItem {
  id: string;
  cuenta_id: string;
  pedido_id: string;
  producto_id: string | null;
  nombre: string;
  tipo: string | null;
  cantidad: number;
  precio_unitario: number;
  importe: number;
}

export interface Cuenta {
  id: string;
  numero: number;
  mesa_id: string;
  cliente_id: string;
  numero_mesa: number;
  estado: EstadoCuenta;
  subtotal: number;
  descuento_porcentaje: number;
  descuento_juego: JuegoConDescuento | null;
  descuento_importe: number;
  propina_nivel: NivelPropina | null;
  propina_porcentaje: number | null;
  propina_importe: number;
  total: number;
  pago_referencia: string | null;
  solicitada_at: string;
  propina_at: string | null;
  pagada_at: string | null;
  confirmada_at: string | null;
  confirmada_por: string | null;
  notif_solicitud_ok: boolean | null;
  notif_pago_ok: boolean | null;
  notif_ultimo_error: string | null;
  updated_at: string;
  cuenta_items?: CuentaItem[];
  clientes?: { nombres: string | null; apellidos: string | null; perfil: string | null } | null;
}

export interface ResultadoPagoCuenta {
  ok: boolean;
  ya_pagada?: boolean;
  motivo?: 'TOTAL_DESACTUALIZADO';
  pago_referencia?: string;
  total: number;
}

export interface ResultadoConfirmacionPago {
  cuenta_id: string;
  ya_confirmada: boolean;
  cliente_id: string;
  numero_mesa: number;
  total: number;
}
