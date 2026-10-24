import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  closeCircleOutline,
  restaurantOutline,
  timeOutline,
  alertCircleOutline,
  wineOutline,
  receiptOutline,
  hourglassOutline,
  checkmarkDoneCircleOutline
} from 'ionicons/icons';
import { RealtimeChannel } from '@supabase/supabase-js';

import { Supabase } from '../../services/supabase';
import { Carga } from '../../services/carga';
import { VibracionService } from '../../services/vibracion';
import { PedidoService } from '../../services/pedido.service';
import { PedidoPendienteMozoUI } from '../../interfaces/pedido';

@Component({
  selector: 'app-pedidos-mozo',
  standalone: true,
  templateUrl: './pedidos-mozo.page.html',
  styleUrls: ['./pedidos-mozo.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonContent,
    IonIcon,
    IonRefresher,
    IonRefresherContent
  ]
})
export class PedidosMozoPage implements OnInit, OnDestroy {
  pedidosPendientes = signal<PedidoPendienteMozoUI[]>([]);

  /**
   * Pedidos confirmados que están en preparación en los sectores o ya listos para entregar (Punto 15)
   */
  pedidosEnCurso = signal<PedidoPendienteMozoUI[]>([]);
  procesandoId = signal<string | null>(null);

  private canalRealtime: RealtimeChannel | null = null;

  constructor(
    private supabase: Supabase,
    public carga: Carga,
    private vibracion: VibracionService,
    private pedidoService: PedidoService,
    private toastCtrl: ToastController
  ) {
    addIcons({
      checkmarkCircleOutline,
      closeCircleOutline,
      restaurantOutline,
      timeOutline,
      alertCircleOutline,
      wineOutline,
      receiptOutline,
      hourglassOutline,
      checkmarkDoneCircleOutline
    });
  }

  async ngOnInit() {
    await this.cargarPedidos();
    this.iniciarSuscripcionRealtime();
  }

  async ionViewWillEnter() {
    await this.cargarPedidos();
  }

  ngOnDestroy() {
    this.detenerSuscripcionRealtime();
  }

  async refrescar(event: any) {
    try {
      await this.cargarPedidos();
    } finally {
      event?.target?.complete();
    }
  }

  async cargarPedidos() {
    try {
      const [pendientesRaw, enCursoRaw] = (await this.carga.ejecutar(
        'Cargando pedidos...',
        () => Promise.all([
          this.supabase.obtenerPedidosPendientesMozo(['enviado']),
          this.supabase.obtenerPedidosPendientesMozo(['confirmado', 'listo'])
        ])
      )) as [any[], any[]];

      this.pedidosPendientes.set(pendientesRaw.map((p) => this.mapearPedido(p)));

      // Los pedidos completos (listos para entregar) se muestran primero
      const enCurso = enCursoRaw.map((p) => this.mapearPedido(p));
      enCurso.sort((a, b) => Number(b.estado === 'listo') - Number(a.estado === 'listo'));
      this.pedidosEnCurso.set(enCurso);
    } catch (error) {
      console.error('Error al cargar pedidos para mozo:', error);
      await this.vibracion.errorFuerte();
      await this.mostrarToast('No se pudieron obtener los pedidos pendientes.', 'danger');
    }
  }

  private mapearPedido(p: any): PedidoPendienteMozoUI {
    const mesasObj: any = p.mesas;
    const numeroMesa = Array.isArray(mesasObj)
      ? (mesasObj[0]?.numero ?? 0)
      : (mesasObj?.numero ?? 0);

    const clienteNombre = p.clientes
      ? `${p.clientes.nombres || ''} ${p.clientes.apellidos || ''}`.trim()
      : (numeroMesa ? `Comensal Mesa N° ${numeroMesa}` : 'Cliente');

    const items = (p.pedido_items || []).map((it: any) => ({
      nombre: it.productos?.nombre || 'Producto',
      tipo: it.productos?.tipo || 'plato',
      cantidad: it.cantidad,
      precio_unitario: it.precio_unitario
    }));

    return {
      id: p.id,
      mesa_id: p.mesa_id,
      numeroMesa,
      cliente_id: p.cliente_id,
      clienteNombre,
      estado: p.estado,
      importe_total: p.importe_total,
      tiempo_estimado: p.tiempo_estimado,
      created_at: p.created_at,
      fechaHora: this.formatearFechaHora(p.created_at),
      cocina_listo: !!p.cocina_listo,
      bar_listo: !!p.bar_listo,
      items
    };
  }

  /**
   * Indica si el pedido tiene productos de un sector (cocina: platos, bar: bebidas),
   * para mostrar solo el estado de los sectores intervinientes (Punto 15)
   */
  tieneProductosDe(pedido: PedidoPendienteMozoUI, tipo: 'plato' | 'bebida'): boolean {
    return pedido.items.some((it) => it.tipo === tipo);
  }

  /**
   * El Mozo confirma el pedido (Punto 14):
   * Deriva a sectores (cocina y bar) y notifica al cliente para acceder a juegos
   */
  async confirmarPedido(pedido: PedidoPendienteMozoUI) {
    if (this.procesandoId()) return;
    this.procesandoId.set(pedido.id);

    try {
      await this.carga.ejecutar(
        'Confirmando pedido...',
        async () => {
          await this.pedidoService.confirmarPedidoPorMozo(pedido);
        }
      );

      await this.mostrarToast(`¡Pedido de Mesa N° ${pedido.numeroMesa} confirmado y derivado a sectores!`, 'success');
      await this.cargarPedidos();
    } catch (error: any) {
      console.error('Error al confirmar pedido:', error);
      await this.vibracion.errorFuerte();
      await this.mostrarToast('No se pudo confirmar el pedido.', 'danger');
    } finally {
      this.procesandoId.set(null);
    }
  }

  /**
   * El Mozo rechaza el pedido (Punto 13):
   * Notifica al cliente para que agregue, quite o modifique productos
   */
  async rechazarPedido(pedido: PedidoPendienteMozoUI) {
    if (this.procesandoId()) return;
    this.procesandoId.set(pedido.id);

    try {
      await this.carga.ejecutar(
        'Rechazando pedido para modificación...',
        async () => {
          await this.pedidoService.rechazarPedidoPorMozo(pedido);
        }
      );

      await this.mostrarToast(`Pedido de Mesa N° ${pedido.numeroMesa} rechazado. El cliente fue notificado para modificarlo.`, 'warning');
      await this.cargarPedidos();
    } catch (error: any) {
      console.error('Error al rechazar pedido:', error);
      await this.vibracion.errorFuerte();
      await this.mostrarToast('No se pudo rechazar el pedido.', 'danger');
    } finally {
      this.procesandoId.set(null);
    }
  }

  /**
   * El Mozo entrega el pedido completo en la mesa del cliente (Punto 18)
   */
  async entregarPedido(pedido: PedidoPendienteMozoUI) {
    if (this.procesandoId()) return;
    this.procesandoId.set(pedido.id);

    try {
      await this.carga.ejecutar(
        'Entregando pedido en la mesa...',
        async () => {
          await this.pedidoService.entregarPedidoPorMozo(pedido);
        }
      );

      await this.mostrarToast(`¡Pedido entregado en la Mesa N° ${pedido.numeroMesa}!`, 'success');
      await this.cargarPedidos();
    } catch (error: any) {
      console.error('Error al entregar pedido:', error);
      await this.vibracion.errorFuerte();
      await this.mostrarToast('No se pudo registrar la entrega del pedido.', 'danger');
    } finally {
      this.procesandoId.set(null);
    }
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR').format(precio);
  }

  formatearFechaHora(fechaIso: string): string {
    if (!fechaIso) return '';
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return '';

    const dia = fecha.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit'
    });
    const hora = fecha.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    return `${dia} - ${hora} hs`;
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  private iniciarSuscripcionRealtime(): void {
    this.detenerSuscripcionRealtime();

    this.canalRealtime = this.supabase.clienteSupabase
      .channel('pedidos-mozo-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          void this.cargarPedidos();
        }
      )
      .subscribe();
  }

  private detenerSuscripcionRealtime(): void {
    if (this.canalRealtime) {
      void this.supabase.clienteSupabase.removeChannel(this.canalRealtime);
      this.canalRealtime = null;
    }
  }
}
