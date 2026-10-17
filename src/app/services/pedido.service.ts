import { Injectable, computed, signal } from '@angular/core';
import { Supabase } from './supabase';
import { PushNotificationsService } from './push-notifications.service';
import { VibracionService } from './vibracion';
import { Producto } from '../interfaces/producto';
import {
  ItemCarritoPedido,
  PedidoClienteUI,
  PedidoPendienteMozoUI,
  SectorPedido
} from '../interfaces/pedido';

@Injectable({
  providedIn: 'root'
})
export class PedidoService {
  /**
   * Estado reactivo del carrito de compras para el pedido actual
   */
  readonly carrito = signal<ItemCarritoPedido[]>([]);

  /**
   * Identificador y número de la mesa asignada al cliente
   */
  readonly mesaActual = signal<{ id: string; numero: number } | null>(null);

  /**
   * Datos del cliente autenticado o anónimo actual
   */
  readonly clienteActual = signal<{ id: string; nombre: string; authUserId?: string } | null>(null);

  /**
   * Pedido activo actual del cliente (en estado pendiente, rechazado, confirmado, etc.)
   */
  readonly pedidoActivo = signal<PedidoClienteUI | null>(null);

  /**
   * Flag para indicar si el cliente está modificando un pedido rechazado por el mozo (Punto 13)
   */
  readonly modoEdicion = signal<boolean>(false);

  /**
   * Cantidad total acumulada de unidades de productos en el pedido
   */
  readonly cantidadTotal = computed(() => {
    return this.carrito().reduce((total, item) => total + item.cantidad, 0);
  });

  /**
   * Importe acumulado en pesos para todo el pedido (Punto 12: visible en todo momento con buen tamaño)
   */
  readonly importeTotal = computed(() => {
    return this.carrito().reduce((total, item) => total + item.producto.precio * item.cantidad, 0);
  });

  /**
   * Tiempo estimado total de elaboración en minutos (el tiempo del plato/bebida más demorado del pedido)
   */
  readonly tiempoEstimado = computed(() => {
    const items = this.carrito();
    if (items.length === 0) return 0;
    return Math.max(...items.map((it) => it.producto.tiempo_elaboracion || 0));
  });

  constructor(
    private supabase: Supabase,
    private pushNotifications: PushNotificationsService,
    private vibracion: VibracionService
  ) {}

  /**
   * Asocia la mesa actual del cliente
   */
  setMesa(id: string, numero: number): void {
    this.mesaActual.set({ id, numero });
  }

  /**
   * Asocia los datos del cliente actual
   */
  setCliente(id: string, nombre: string, authUserId?: string): void {
    this.clienteActual.set({ id, nombre, authUserId });
  }

  /**
   * Devuelve la cantidad elegida para un producto determinado
   */
  obtenerCantidad(productoId: string): number {
    const item = this.carrito().find((it) => it.producto.id === productoId);
    return item ? item.cantidad : 0;
  }

  /**
   * Agrega una unidad de un producto al carrito
   */
  agregarProducto(producto: Producto, cantidad: number = 1): void {
    const actual = [...this.carrito()];
    const index = actual.findIndex((it) => it.producto.id === producto.id);

    if (index >= 0) {
      actual[index] = {
        ...actual[index],
        cantidad: actual[index].cantidad + cantidad
      };
    } else {
      actual.push({ producto, cantidad });
    }

    this.carrito.set(actual);
  }

  /**
   * Decrementa una unidad de un producto en el carrito (o lo quita si llega a 0)
   */
  decrementarProducto(productoId: string): void {
    const actual = [...this.carrito()];
    const index = actual.findIndex((it) => it.producto.id === productoId);

    if (index >= 0) {
      if (actual[index].cantidad > 1) {
        actual[index] = {
          ...actual[index],
          cantidad: actual[index].cantidad - 1
        };
        this.carrito.set(actual);
      } else {
        this.eliminarProducto(productoId);
      }
    }
  }

  /**
   * Quita por completo un producto del carrito
   */
  eliminarProducto(productoId: string): void {
    const actual = this.carrito().filter((it) => it.producto.id !== productoId);
    this.carrito.set(actual);
  }

  /**
   * Vacía el carrito
   */
  limpiarCarrito(): void {
    this.carrito.set([]);
    this.modoEdicion.set(false);
  }

  /**
   * Pre-carga el carrito con los productos del pedido rechazado para permitir su modificación (Punto 13)
   */
  cargarPedidoParaModificar(pedido: PedidoClienteUI): void {
    const itemsCarrito: ItemCarritoPedido[] = pedido.items.map((it) => ({
      producto: it.producto,
      cantidad: it.cantidad
    }));

    this.carrito.set(itemsCarrito);
    this.modoEdicion.set(true);
    this.pedidoActivo.set(pedido);
  }

  /**
   * Guarda o actualiza el pedido en Supabase y dispara las notificaciones push pertinentes (Puntos 12 y 13)
   */
  async enviarPedido(): Promise<boolean> {
    const mesa = this.mesaActual();
    const cliente = this.clienteActual();
    const items = this.carrito();

    if (!mesa || !cliente || items.length === 0) {
      await this.vibracion.errorFuerte();
      throw new Error('Faltan datos para realizar el pedido (mesa, cliente o productos).');
    }

    const itemsDb = items.map((it) => ({
      producto_id: it.producto.id,
      cantidad: it.cantidad,
      precio_unitario: it.producto.precio
    }));

    const total = this.importeTotal();
    const tiempo = this.tiempoEstimado();

    try {
      if (this.modoEdicion() && this.pedidoActivo()) {
        // Modificación de pedido existente rechazado por el mozo (Punto 13)
        const pedidoId = this.pedidoActivo()!.id;
        await this.supabase.modificarPedidoExistente(pedidoId, total, tiempo);
        await this.supabase.reemplazarItemsPedido(pedidoId, itemsDb);

        // Notificación push a todos los mozos
        try {
          await this.pushNotifications.enviarNotificacion(
            '¡Pedido Modificado!',
            `Mesa N° ${mesa.numero} ha modificado y reenviado su pedido ($${total}).`,
            { profiles: ['mozo'] },
            { ruta: '/pedidos-mozo' }
          );
        } catch (pushErr) {
          console.warn('[Push] Error al enviar push a mozos tras modificar:', pushErr);
        }

        await this.consultarPedidoActivo(cliente.id, mesa.id);
        this.limpiarCarrito();
        return true;
      } else {
        // Nuevo pedido (Punto 12)
        const nuevoPedido = await this.supabase.guardarNuevoPedido(mesa.id, cliente.id, total, tiempo);
        await this.supabase.guardarItemsPedido(nuevoPedido.id, itemsDb);

        // Notificación push a todos los mozos
        try {
          await this.pushNotifications.enviarNotificacion(
            '¡Nuevo Pedido!',
            `Mesa N° ${mesa.numero} ha realizado un nuevo pedido ($${total}). Espera tu confirmación.`,
            { profiles: ['mozo'] },
            { ruta: '/pedidos-mozo' }
          );
        } catch (pushErr) {
          console.warn('[Push] Error al enviar push a mozos tras nuevo pedido:', pushErr);
        }

        await this.consultarPedidoActivo(cliente.id, mesa.id);
        this.limpiarCarrito();
        return true;
      }
    } catch (error: any) {
      console.error('Error al guardar/modificar pedido en Supabase:', error);
      await this.vibracion.errorFuerte();
      throw error;
    }
  }

  /**
   * Consulta en Supabase el pedido activo del cliente o de la mesa
   */
  async consultarPedidoActivo(clienteId?: string, mesaId?: string): Promise<PedidoClienteUI | null> {
    try {
      const idMesa = mesaId || this.mesaActual()?.id;
      const idCliente = clienteId || this.clienteActual()?.id;
      const dataRaw = await this.supabase.obtenerPedidoActivoPorCliente(idCliente, idMesa);
      if (!dataRaw || localStorage.getItem(`pedido_finalizado_${dataRaw.id}`) === 'true') {
        this.pedidoActivo.set(null);
        return null;
      }

      const resetTimestamp = idCliente ? localStorage.getItem(`estadia_reiniciada_at_${idCliente}`) : null;
      if (resetTimestamp && dataRaw.created_at && new Date(dataRaw.created_at).getTime() <= Number(resetTimestamp)) {
        this.pedidoActivo.set(null);
        return null;
      }

      const items: any[] = (dataRaw.pedido_items || []).map((it: any) => ({
        id: it.id,
        producto: it.productos,
        cantidad: it.cantidad,
        precio_unitario: it.precio_unitario
      }));

      const mesasObj: any = dataRaw.mesas;
      const numeroMesa = Array.isArray(mesasObj)
        ? (mesasObj[0]?.numero ?? 0)
        : (mesasObj?.numero ?? 0);

      const recepcionLocal = localStorage.getItem(`recepcion_confirmada_${dataRaw.id}`) === 'true';
      const estadoEfectivo = (dataRaw.estado === 'entregado' && recepcionLocal)
        ? 'recibido'
        : dataRaw.estado;

      const pedidoUI: PedidoClienteUI = {
        id: dataRaw.id,
        mesa_id: dataRaw.mesa_id,
        numeroMesa,
        cliente_id: dataRaw.cliente_id,
        estado: estadoEfectivo,
        importe_total: dataRaw.importe_total,
        tiempo_estimado: dataRaw.tiempo_estimado,
        created_at: dataRaw.created_at,
        cocina_listo: !!dataRaw.cocina_listo,
        bar_listo: !!dataRaw.bar_listo,
        items
      };

      this.pedidoActivo.set(pedidoUI);
      return pedidoUI;
    } catch (error) {
      console.error('Error al consultar pedido activo:', error);
      return null;
    }
  }

  /**
   * El Mozo rechaza el pedido (Punto 13)
   */
  async rechazarPedidoPorMozo(pedido: PedidoPendienteMozoUI): Promise<void> {
    await this.supabase.actualizarEstadoPedido(pedido.id, 'rechazado');

    // Notificación push al cliente
    try {
      const destinatarios: { userIds?: string[]; profiles?: string[] } = {};
      if (pedido.cliente_id) {
        destinatarios.userIds = [pedido.cliente_id];
      }
      destinatarios.profiles = ['cliente'];

      await this.pushNotifications.enviarNotificacion(
        'Pedido Rechazado por el Mozo',
        `Tu pedido en la Mesa N° ${pedido.numeroMesa} fue rechazado para revisión. Modificá los productos y reenviálo.`,
        destinatarios,
        { ruta: '/clienteInicio' }
      );
    } catch (pushErr) {
      console.warn('[Push] Error al enviar notificación al cliente tras rechazo:', pushErr);
    }
  }

  /**
   * El Mozo confirma el pedido y lo deriva a cocina y bar (Punto 14)
   */
  async confirmarPedidoPorMozo(pedido: PedidoPendienteMozoUI): Promise<void> {
    await this.supabase.actualizarEstadoPedido(pedido.id, 'confirmado');

    const tienePlatos = pedido.items.some((it) => it.tipo === 'plato');
    const tieneBebidas = pedido.items.some((it) => it.tipo === 'bebida');

    // Push a Cocina si hay platos
    if (tienePlatos) {
      try {
        await this.pushNotifications.enviarNotificacion(
          '¡Nuevo Pedido en Cocina!',
          `Mesa N° ${pedido.numeroMesa}: Nuevos platos pendientes de preparación.`,
          { profiles: ['cocinero'] },
          { ruta: '/pedidos-cocina' }
        );
      } catch (err) {
        console.warn('[Push] Error notificando a cocinero:', err);
      }
    }

    // Push a Bar si hay bebidas
    if (tieneBebidas) {
      try {
        await this.pushNotifications.enviarNotificacion(
          '¡Nuevo Pedido en Bar!',
          `Mesa N° ${pedido.numeroMesa}: Nuevas bebidas pendientes de preparación.`,
          { profiles: ['cantinero'] },
          { ruta: '/pedidos-bar' }
        );
      } catch (err) {
        console.warn('[Push] Error notificando a cantinero:', err);
      }
    }

    // Push al Cliente: puede acceder a juegos y seguir su estado
    try {
      const destinatarios: { userIds?: string[]; profiles?: string[] } = {};
      if (pedido.cliente_id) {
        destinatarios.userIds = [pedido.cliente_id];
      }
      destinatarios.profiles = ['cliente'];

      await this.pushNotifications.enviarNotificacion(
        '¡Pedido Confirmado!',
        `Tu pedido de la Mesa N° ${pedido.numeroMesa} fue aceptado y ya se está preparando. ¡Ya podés acceder a los juegos y descuentos!`,
        destinatarios,
        { ruta: '/clienteInicio' }
      );
    } catch (err) {
      console.warn('[Push] Error notificando al cliente tras confirmación:', err);
    }
  }

  /**
   * Cocina o Bar avisan que su parte del pedido está lista (Punto 15).
   * Solo cuando el pedido queda completo en todos los sectores intervinientes
   * se envía la notificación push al mozo para que lo entregue.
   * Devuelve true si con esta acción el pedido quedó completo.
   */
  async marcarSectorListo(pedidoId: string, sector: SectorPedido, numeroMesa: number): Promise<boolean> {
    const estadoFinal = await this.supabase.marcarSectorListo(pedidoId, sector);
    const pedidoCompleto = estadoFinal === 'listo';

    if (pedidoCompleto) {
      try {
        await this.pushNotifications.enviarNotificacion(
          '¡Pedido Listo para Entregar!',
          `Mesa N° ${numeroMesa}: todos los productos del pedido están listos. Pasá a retirarlo.`,
          { profiles: ['mozo'] },
          { ruta: '/pedidos-mozo' }
        );
      } catch (err) {
        console.warn('[Push] Error notificando al mozo pedido completo:', err);
      }
    }

    return pedidoCompleto;
  }

  /**
   * El Mozo entrega el pedido completo en la mesa del cliente (Punto 18 / habilita encuesta Punto 20)
   */
  async entregarPedidoPorMozo(pedido: PedidoPendienteMozoUI): Promise<void> {
    await this.supabase.actualizarEstadoPedido(pedido.id, 'entregado');

    try {
      const destinatarios: { userIds?: string[]; profiles?: string[] } = {};
      if (pedido.cliente_id) {
        destinatarios.userIds = [pedido.cliente_id];
      }
      destinatarios.profiles = ['cliente'];

      await this.pushNotifications.enviarNotificacion(
        '¡Pedido Entregado!',
        `El mozo entregó el pedido en tu Mesa N° ${pedido.numeroMesa}. Confirmá su recepción desde tu pantalla.`,
        destinatarios,
        { ruta: '/clienteInicio' }
      );
    } catch (err) {
      console.warn('[Push] Error notificando al cliente entrega de pedido:', err);
    }
  }

  /**
   * El Cliente confirma la recepción del pedido entregado por el mozo (Punto 19).
   * Habilita acceso completo a juegos, encuesta de satisfacción, resultados y pedir la cuenta.
   */
  async confirmarRecepcionPorCliente(pedidoId: string): Promise<void> {
    localStorage.setItem(`recepcion_confirmada_${pedidoId}`, 'true');

    try {
      await this.supabase.actualizarEstadoPedido(pedidoId, 'recibido');
    } catch (err) {
      console.warn('[PedidoService] No se pudo persistir estado "recibido" en DB (posible check constraint o RLS), manteniendo confirmación local:', err);
    }

    await this.consultarPedidoActivo();
  }

  /**
   * Reinicia el pedido actual y libera la mesa para que el cliente pueda realizar otro pedido
   * comenzando nuevamente desde el escaneo del QR de lista de espera.
   */
  async finalizarEstadiaParaOtroPedido(
    pedidoId?: string,
    mesaId?: string,
    numeroMesa?: string,
    clienteId?: string
  ): Promise<void> {
    if (clienteId) {
      localStorage.setItem(`estadia_reiniciada_at_${clienteId}`, String(Date.now()));
    }

    if (pedidoId) {
      localStorage.setItem(`pedido_finalizado_${pedidoId}`, 'true');
      localStorage.removeItem(`recepcion_confirmada_${pedidoId}`);
      try {
        await this.supabase.eliminarPedidoCompleto(pedidoId);
      } catch (err) {
        console.warn('[PedidoService] No se pudo eliminar pedido en DB, manteniendo marca local:', err);
      }
    }

    if (mesaId) {
      try {
        await this.supabase.liberarMesa(mesaId);
      } catch (err) {
        console.warn('[PedidoService] No se pudo liberar la mesa en DB:', err);
      }
    }

    if (numeroMesa) {
      localStorage.removeItem(`mesa_escaneada_${numeroMesa}`);
    }

    this.limpiarCarrito();
    this.pedidoActivo.set(null);
    this.mesaActual.set(null);
  }
}

