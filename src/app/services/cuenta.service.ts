import { Injectable, signal } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Subject } from 'rxjs';
import { Supabase } from './supabase';
import { PushNotificationsService } from './push-notifications.service';
import { JuegosService } from './juegos.service';
import {
  Cuenta,
  ResultadoConfirmacionPago,
  ResultadoPagoCuenta
} from '../interfaces/cuenta';
import { formatearMoneda, obtenerOpcionPropina } from '../utils/calculo-cuenta';

/**
 * Error de negocio de la cuenta con mensaje listo para mostrar al usuario.
 */
export class ErrorCuenta extends Error {
  constructor(public readonly codigo: string, mensaje: string) {
    super(mensaje);
  }
}

const MENSAJES_ERROR: Record<string, string> = {
  CLIENTE_NO_IDENTIFICADO: 'No pudimos identificar tu sesión. Volvé a ingresar a la aplicación.',
  MESA_INEXISTENTE: 'La mesa indicada no existe.',
  MESA_NO_ASIGNADA: 'Esta mesa no está asignada a tu usuario.',
  CUENTA_DE_OTRO_CLIENTE: 'Esta cuenta pertenece a otra mesa o a otro cliente.',
  PEDIDO_INEXISTENTE: 'No encontramos tu pedido.',
  PEDIDO_AJENO: 'El pedido no corresponde a tu mesa.',
  PEDIDO_NO_RECIBIDO: 'Primero tenés que recibir y confirmar tu pedido.',
  PEDIDO_YA_FACTURADO: 'Ese pedido ya forma parte de otra cuenta.',
  PEDIDOS_EN_CURSO: 'Tenés pedidos que todavía no fueron entregados.',
  SIN_PEDIDOS_RECIBIDOS: 'No hay consumos recibidos para facturar.',
  CUENTA_INEXISTENTE: 'No encontramos la cuenta.',
  CUENTA_YA_PAGADA: 'La cuenta ya fue pagada y no puede modificarse.',
  QR_PROPINA_INVALIDO: 'El código escaneado no es un QR de propina de Basílico.',
  PROPINA_REQUERIDA: 'Escaneá un QR de propina antes de pagar.',
  SOLO_MOZO: 'Solo un mozo puede confirmar el pago.',
  PAGO_NO_REALIZADO: 'El cliente todavía no realizó el pago.'
};

@Injectable({
  providedIn: 'root'
})
export class CuentaService {
  /**
   * Cuenta vigente del cliente (abierta o recién confirmada y todavía no cerrada en pantalla)
   */
  readonly cuentaCliente = signal<Cuenta | null>(null);

  /**
   * Se emite cuando el cliente cierra su estadía luego de la confirmación del pago
   */
  readonly estadiaFinalizada$ = new Subject<string>();

  private readonly SELECT_CUENTA = `
    *,
    cuenta_items ( id, cuenta_id, pedido_id, producto_id, nombre, tipo, cantidad, precio_unitario, importe ),
    clientes ( nombres, apellidos, perfil )
  `;

  constructor(
    private supabase: Supabase,
    private pushNotifications: PushNotificationsService,
    private juegosService: JuegosService
  ) {}

  /* ============================================================
     LECTURAS
  ============================================================ */

  /**
   * Devuelve la cuenta vigente del cliente. Una cuenta con pago confirmado se sigue
   * mostrando hasta que el cliente cierra la pantalla de agradecimiento.
   */
  async obtenerCuentaCliente(clienteId: string, tieneMesaActivaEnBd?: boolean): Promise<Cuenta | null> {
    // Sin sesión (por ejemplo, justo después de cerrar sesión) no se consulta:
    // la tabla cuentas no es accesible para el rol anónimo.
    if (!(await this.haySesion())) {
      this.cuentaCliente.set(null);
      return null;
    }

    const { data, error } = await this.supabase.clienteSupabase
      .from('cuentas')
      .select(this.SELECT_CUENTA)
      .eq('cliente_id', clienteId)
      .order('solicitada_at', { ascending: false })
      .limit(1);

    if (error) {
      throw this.traducirError(error, 'No se pudo consultar tu cuenta.');
    }

    const cuenta = data && data.length > 0 ? this.normalizar(data[0]) : null;
    if (cuenta && cuenta.estado === 'pago_confirmado' && !this.cierreVisto(cuenta.id)) {
      let mesaActiva = tieneMesaActivaEnBd;
      if (mesaActiva === undefined) {
        const { data: mesas } = await this.supabase.clienteSupabase
          .from('mesas')
          .select('id')
          .eq('cliente_id', clienteId)
          .limit(1);
        mesaActiva = !!(mesas && mesas.length > 0);
      }
      if (mesaActiva) {
        try {
          localStorage.setItem(`cuenta_cerrada_vista_${cuenta.id}`, 'true');
        } catch {}
      }
    }
    const vigente = cuenta && (cuenta.estado !== 'pago_confirmado' || !this.cierreVisto(cuenta.id))
      ? cuenta
      : null;

    this.cuentaCliente.set(vigente);
    return vigente;
  }

  async obtenerCuentaPorId(cuentaId: string): Promise<Cuenta | null> {
    const { data, error } = await this.supabase.clienteSupabase
      .from('cuentas')
      .select(this.SELECT_CUENTA)
      .eq('id', cuentaId)
      .maybeSingle();

    if (error) {
      throw this.traducirError(error, 'No se pudo consultar la cuenta.');
    }
    return data ? this.normalizar(data) : null;
  }

  /**
   * Cuentas visibles para mozo, dueño y supervisor: todas las abiertas y las confirmadas en las últimas 12 horas.
   */
  async obtenerCuentasPersonal(): Promise<Cuenta[]> {
    const desde = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    const { data, error } = await this.supabase.clienteSupabase
      .from('cuentas')
      .select(this.SELECT_CUENTA)
      .or(`estado.neq.pago_confirmado,confirmada_at.gte.${desde}`)
      .order('solicitada_at', { ascending: true });

    if (error) {
      throw this.traducirError(error, 'No se pudieron obtener las cuentas.');
    }
    return (data ?? []).map((c: any) => this.normalizar(c));
  }

  async contarPagosPendientes(): Promise<number> {
    if (!(await this.haySesion())) {
      return 0;
    }

    const { count, error } = await this.supabase.clienteSupabase
      .from('cuentas')
      .select('id', { count: 'exact', head: true })
      .eq('estado', 'pago_pendiente_confirmacion');

    if (error) {
      console.warn('[Cuenta] No se pudo contar los pagos pendientes:', error.message);
      return 0;
    }
    return count ?? 0;
  }

  escucharCambios(nombreCanal: string, callback: () => void): RealtimeChannel {
    return this.supabase.clienteSupabase
      .channel(`${nombreCanal}-${Date.now()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cuentas' }, () => callback())
      .subscribe();
  }

  dejarDeEscuchar(canal: RealtimeChannel | null): void {
    if (canal) {
      void this.supabase.clienteSupabase.removeChannel(canal);
    }
  }

  /* ============================================================
     CLIENTE
  ============================================================ */

  /**
   * Paso A: el cliente solicita la cuenta. Es idempotente (la base devuelve la cuenta
   * abierta si ya existía) y la push al mozo solo se envía cuando se crea por primera vez.
   */
  async solicitarCuenta(mesaId: string, numeroMesa: number, pedidoId: string): Promise<{ cuenta: Cuenta; yaExistia: boolean; avisoEnviado: boolean }> {
    const descuento = this.descuentoDeJuegos();
    const { data, error } = await this.supabase.clienteSupabase.rpc('solicitar_cuenta', {
      p_mesa_id: mesaId,
      p_pedido_id: pedidoId,
      p_descuento_porcentaje: descuento.porcentaje,
      p_descuento_juego: descuento.juego
    });

    if (error) {
      throw this.traducirError(error, 'No se pudo solicitar la cuenta.');
    }

    const cuentaId = (data as any)?.cuenta_id as string;
    const yaExistia = !!(data as any)?.ya_existia;

    let avisoEnviado = true;
    if (!yaExistia) {
      avisoEnviado = await this.avisarSolicitud(cuentaId, numeroMesa);
    }

    const cuenta = await this.obtenerCuentaPorId(cuentaId);
    if (!cuenta) {
      throw new ErrorCuenta('CUENTA_INEXISTENTE', MENSAJES_ERROR['CUENTA_INEXISTENTE']);
    }
    this.cuentaCliente.set(cuenta);
    return { cuenta, yaExistia, avisoEnviado };
  }

  /**
   * Paso B: registra la propina a partir del contenido del QR escaneado.
   * El servidor vuelve a validar el código y define el porcentaje.
   */
  async registrarPropina(cuentaId: string, codigoQr: string): Promise<Cuenta> {
    const descuento = this.descuentoDeJuegos();
    const { error } = await this.supabase.clienteSupabase.rpc('registrar_propina_cuenta', {
      p_cuenta_id: cuentaId,
      p_codigo_qr: codigoQr,
      p_descuento_porcentaje: descuento.porcentaje,
      p_descuento_juego: descuento.juego
    });

    if (error) {
      throw this.traducirError(error, 'No se pudo registrar la propina.');
    }

    const cuenta = await this.obtenerCuentaPorId(cuentaId);
    if (!cuenta) {
      throw new ErrorCuenta('CUENTA_INEXISTENTE', MENSAJES_ERROR['CUENTA_INEXISTENTE']);
    }
    this.cuentaCliente.set(cuenta);
    return cuenta;
  }

  /**
   * Paso E: pago simulado. El pago queda guardado aunque falle la notificación.
   */
  async pagarCuenta(cuenta: Cuenta): Promise<{ resultado: ResultadoPagoCuenta; avisoEnviado: boolean }> {
    const { data, error } = await this.supabase.clienteSupabase.rpc('pagar_cuenta', {
      p_cuenta_id: cuenta.id,
      p_total_esperado: cuenta.total
    });

    if (error) {
      throw this.traducirError(error, 'No se pudo registrar el pago.');
    }

    const resultado = data as ResultadoPagoCuenta;
    let avisoEnviado = true;
    if (resultado.ok && !resultado.ya_pagada) {
      avisoEnviado = await this.avisarPago(cuenta.id, cuenta.numero_mesa, Number(resultado.total));
    }

    const actualizada = await this.obtenerCuentaPorId(cuenta.id);
    if (actualizada) {
      this.cuentaCliente.set(actualizada);
    }
    return { resultado, avisoEnviado };
  }

  /**
   * Reintenta la push que no pudo enviarse (sin volver a crear la cuenta ni a cobrar).
   */
  async reintentarAviso(cuenta: Cuenta): Promise<boolean> {
    const enviado = cuenta.estado === 'pendiente_propina' || cuenta.estado === 'lista_para_pagar'
      ? await this.avisarSolicitud(cuenta.id, cuenta.numero_mesa)
      : await this.avisarPago(cuenta.id, cuenta.numero_mesa, Number(cuenta.total));

    const actualizada = await this.obtenerCuentaPorId(cuenta.id);
    if (actualizada) {
      this.cuentaCliente.set(actualizada);
    }
    return enviado;
  }

  /**
   * El cliente cierra la pantalla de pago confirmado: se termina la estadía en el dispositivo.
   */
  marcarCierreVisto(cuentaId: string): void {
    try {
      localStorage.setItem(`cuenta_cerrada_vista_${cuentaId}`, 'true');
    } catch {
      /* almacenamiento no disponible */
    }
    this.juegosService.resetearDescuentos();
    this.cuentaCliente.set(null);
    this.estadiaFinalizada$.next(cuentaId);
  }

  /* ============================================================
     MOZO
  ============================================================ */

  /**
   * El mozo confirma el pago (separado del pago del cliente e idempotente).
   * Libera la mesa en la base; la factura PDF queda para el Punto 22.
   */
  async confirmarPago(cuenta: Cuenta): Promise<ResultadoConfirmacionPago> {
    const { data, error } = await this.supabase.clienteSupabase.rpc('confirmar_pago_cuenta', {
      p_cuenta_id: cuenta.id
    });

    if (error) {
      throw this.traducirError(error, 'No se pudo confirmar el pago.');
    }

    const resultado = data as ResultadoConfirmacionPago;
    if (!resultado.ya_confirmada) {
      try {
        await this.pushNotifications.enviarNotificacion(
          '¡Pago confirmado!',
          `El mozo confirmó el pago de la mesa N.º ${cuenta.numero_mesa}. ¡Gracias por visitar Basílico!`,
          { userIds: [cuenta.cliente_id] },
          { ruta: '/cuenta' }
        );
      } catch (err) {
        console.warn('[Push] Error notificando al cliente la confirmación del pago:', err);
      }

      try {
        await this.pushNotifications.enviarNotificacion(
          'Pago confirmado por el mozo',
          `Mesa N.º ${cuenta.numero_mesa}: pago de ${formatearMoneda(cuenta.total)} confirmado. La mesa quedó libre.`,
          { profiles: ['duenio', 'supervisor'] },
          { ruta: '/cuentas-mozo' }
        );
      } catch (err) {
        console.warn('[Push] Error notificando a dueño y supervisor la confirmación del pago:', err);
      }
    }
    return resultado;
  }

  /* ============================================================
     AUXILIARES
  ============================================================ */

  /**
   * Descuento obtenido en los juegos durante la estadía. Solo se envía si el cliente es
   * registrado; igualmente el servidor rechaza descuentos a clientes anónimos.
   */
  private descuentoDeJuegos(): { porcentaje: number; juego: string | null } {
    const porcentaje = this.juegosService.descuentoAplicado();
    const juego = this.juegosService.juegoPremiado();
    if (!this.juegosService.esClienteRegistrado() || !porcentaje || !juego) {
      return { porcentaje: 0, juego: null };
    }
    return { porcentaje, juego };
  }

  private async avisarSolicitud(cuentaId: string, numeroMesa: number): Promise<boolean> {
    try {
      const respuesta: any = await this.pushNotifications.enviarNotificacion(
        'Nueva solicitud de cuenta',
        `La mesa N.º ${numeroMesa} solicitó la cuenta. Revisá los consumos pendientes.`,
        { profiles: ['mozo'] },
        { ruta: '/cuentas-mozo' }
      );
      if (respuesta?.error) {
        throw new Error(String(respuesta.error));
      }
      await this.registrarNotificacion(cuentaId, 'solicitud', true);
      return true;
    } catch (err: any) {
      console.warn('[Push] Error al avisar la solicitud de cuenta:', err);
      await this.registrarNotificacion(cuentaId, 'solicitud', false, err?.message);
      return false;
    }
  }

  private async avisarPago(cuentaId: string, numeroMesa: number, total: number): Promise<boolean> {
    try {
      const respuesta: any = await this.pushNotifications.enviarNotificacion(
        'Pago pendiente de confirmación',
        `La mesa N.º ${numeroMesa} realizó un pago simulado de ${formatearMoneda(total)}. Pendiente de confirmación del mozo.`,
        { profiles: ['mozo', 'duenio', 'supervisor'] },
        { ruta: '/cuentas-mozo' }
      );
      if (respuesta?.error) {
        throw new Error(String(respuesta.error));
      }
      await this.registrarNotificacion(cuentaId, 'pago', true);
      return true;
    } catch (err: any) {
      console.warn('[Push] Error al avisar el pago simulado:', err);
      await this.registrarNotificacion(cuentaId, 'pago', false, err?.message);
      return false;
    }
  }

  private async registrarNotificacion(cuentaId: string, evento: 'solicitud' | 'pago', ok: boolean, detalle?: string) {
    const { error } = await this.supabase.clienteSupabase.rpc('marcar_notificacion_cuenta', {
      p_cuenta_id: cuentaId,
      p_evento: evento,
      p_ok: ok,
      p_error: detalle ?? null
    });
    if (error) {
      console.warn('[Cuenta] No se pudo registrar el estado de la notificación:', error.message);
    }
  }

  /**
   * Lee la sesión guardada en el dispositivo (no hace una petición de red)
   */
  private async haySesion(): Promise<boolean> {
    const { data } = await this.supabase.clienteSupabase.auth.getSession();
    return !!data.session;
  }

  private cierreVisto(cuentaId: string): boolean {
    try {
      return localStorage.getItem(`cuenta_cerrada_vista_${cuentaId}`) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * PostgREST devuelve los numeric como número o como texto según el tamaño: se normalizan.
   */
  private normalizar(fila: any): Cuenta {
    const items = (fila.cuenta_items ?? [])
      .map((it: any) => ({
        ...it,
        cantidad: Number(it.cantidad),
        precio_unitario: Number(it.precio_unitario),
        importe: Number(it.importe)
      }))
      .sort((a: any, b: any) => String(a.nombre).localeCompare(String(b.nombre), 'es'));

    return {
      ...fila,
      numero: Number(fila.numero),
      numero_mesa: Number(fila.numero_mesa),
      subtotal: Number(fila.subtotal),
      descuento_porcentaje: Number(fila.descuento_porcentaje),
      descuento_importe: Number(fila.descuento_importe),
      propina_porcentaje: fila.propina_porcentaje === null ? null : Number(fila.propina_porcentaje),
      propina_importe: Number(fila.propina_importe),
      total: Number(fila.total),
      clientes: Array.isArray(fila.clientes) ? (fila.clientes[0] ?? null) : (fila.clientes ?? null),
      cuenta_items: items
    } as Cuenta;
  }

  etiquetaPropina(cuenta: Cuenta): string {
    return obtenerOpcionPropina(cuenta.propina_nivel)?.etiqueta ?? 'Sin elegir';
  }

  traducirError(error: any, mensajePorDefecto: string): ErrorCuenta {
    const texto: string = error?.message ?? '';
    const codigo = Object.keys(MENSAJES_ERROR).find((c) => texto.includes(c));
    if (codigo) {
      return new ErrorCuenta(codigo, MENSAJES_ERROR[codigo]);
    }
    if (error?.code === '42501' || /JWT expired/i.test(texto)) {
      return new ErrorCuenta('SESION_CERRADA', 'Tu sesión se cerró. Volvé a ingresar a la aplicación.');
    }
    if (/Failed to fetch|NetworkError|network/i.test(texto)) {
      return new ErrorCuenta('SIN_CONEXION', 'Sin conexión a internet. Revisá tu red y volvé a intentar.');
    }
    if (/function .* does not exist|relation .*cuentas.* does not exist|PGRST202|PGRST205/i.test(texto + ' ' + (error?.code ?? ''))) {
      return new ErrorCuenta('MIGRACION_PENDIENTE', 'El sistema de cuentas todavía no está habilitado en la base de datos.');
    }
    console.error('[Cuenta] Error de Supabase:', error);
    const detalle = error?.code ? ` (código ${error.code})` : '';
    return new ErrorCuenta('ERROR_SUPABASE', `${mensajePorDefecto}${detalle} Avisá al personal del restaurante.`);
  }
}
