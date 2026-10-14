import { Injectable, computed, signal } from '@angular/core';
import { Supabase } from './supabase';
import { PushNotificationsService } from './push-notifications.service';
import { VibracionService } from './vibracion';
import { Producto } from '../interfaces/producto';
import {
  ItemCarritoPedido,
  PedidoClienteUI,
  PedidoPendienteMozoUI
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
      if (!dataRaw) {
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

      const pedidoUI: PedidoClienteUI = {
        id: dataRaw.id,
        mesa_id: dataRaw.mesa_id,
        numeroMesa,
        cliente_id: dataRaw.cliente_id,
        estado: dataRaw.estado,
        importe_total: dataRaw.importe_total,
        tiempo_estimado: dataRaw.tiempo_estimado,
        created_at: dataRaw.created_at,
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
}
