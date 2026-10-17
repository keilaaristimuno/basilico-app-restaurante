import { Component, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastController } from '@ionic/angular';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Supabase } from '../../../services/supabase';
import { Carga } from '../../../services/carga';
import { VibracionService } from '../../../services/vibracion';
import { PedidoService } from '../../../services/pedido.service';
import {
  PedidoSupabaseRelacional,
  MesaConPedidosCocinaUI,
  PedidoMesaCocinaUI,
  ItemPlatoCocinaUI
} from '../../../interfaces/pedido';
import {
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonContent,
  IonIcon,
  IonRefresher,
  IonRefresherContent
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  checkmarkDoneCircleOutline,
  checkmarkCircleOutline,
  restaurantOutline,
  timeOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-pedidos-cocina',
  standalone: true,
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
  ],
  templateUrl: './pedidos-cocina.page.html',
  styleUrls: ['./pedidos-cocina.page.scss']
})
export class PedidosCocinaPage implements OnDestroy {
  /**
   * Estado reactivo que contiene los pedidos confirmados agrupados por número de mesa.
   */
  pedidosPorMesa = signal<MesaConPedidosCocinaUI[]>([]);

  /**
   * Mensaje de error en caso de que falle la carga de pedidos.
   */
  mensajeError = signal<string | null>(null);

  /**
   * Id del pedido que se está marcando como listo (evita doble toque).
   */
  procesandoId = signal<string | null>(null);

  /**
   * Canal activo de Supabase Realtime para escuchar eventos de la tabla 'pedidos'.
   */
  private canalRealtime: RealtimeChannel | null = null;

  constructor(
    private supabase: Supabase,
    public carga: Carga,
    private vibracion: VibracionService,
    private pedidoService: PedidoService,
    private toastCtrl: ToastController
  ) {
    addIcons({
      alertCircleOutline,
      checkmarkDoneCircleOutline,
      checkmarkCircleOutline,
      restaurantOutline,
      timeOutline
    });
  }

  async ionViewWillEnter(): Promise<void> {
    this.iniciarSuscripcionRealtime();
    await this.cargarPedidos();
  }

  ionViewWillLeave(): void {
    this.detenerSuscripcionRealtime();
  }

  ngOnDestroy(): void {
    this.detenerSuscripcionRealtime();
  }

  /**
   * Refresco manual de pedidos accionado mediante ion-refresher (swipe-down).
   * Reutiliza cargarPedidos() y asegura la finalización visual del refresher (complete)
   * tanto en caso de éxito como ante cualquier excepción.
   */
  async refrescarPedidos(event: any): Promise<void> {
    try {
      await this.cargarPedidos();
    } finally {
      event?.target?.complete();
    }
  }

  /**
   * Obtiene los pedidos confirmados desde Supabase usando el servicio Carga
   * para el spinner visual con logo institucional y maneja posibles errores.
   */
  async cargarPedidos(): Promise<void> {
    this.mensajeError.set(null);

    try {
      const pedidosRaw = await this.carga.ejecutar(
        'Cargando pedidos de cocina...',
        () => this.supabase.obtenerPedidosConfirmadosCocina()
      );

      const pedidosAgrupados = this.procesarYAgruparPedidos(pedidosRaw);
      this.pedidosPorMesa.set(pedidosAgrupados);
    } catch (error: any) {
      console.error('Error al cargar pedidos de cocina:', error);
      const detalleError = error?.message || 'Error al obtener los pedidos pendientes.';
      this.mensajeError.set(detalleError);

      await this.vibracion.errorFuerte();
      await this.mostrarToast('No se pudieron cargar los pedidos de cocina.', 'danger');
    }
  }

  /**
   * El sector Cocina avisa que terminó su parte del pedido (Punto 18).
   * Si con esto el pedido queda completo, el servicio notifica al mozo por push.
   */
  async marcarListo(pedido: PedidoMesaCocinaUI): Promise<void> {
    if (this.procesandoId()) return;
    this.procesandoId.set(pedido.pedidoId);

    try {
      const pedidoCompleto = await this.carga.ejecutar(
        'Marcando platos como listos...',
        () => this.pedidoService.marcarSectorListo(pedido.pedidoId, 'cocina', pedido.numeroMesa)
      );

      await this.mostrarToast(
        pedidoCompleto
          ? `¡Pedido de Mesa ${pedido.numeroMesa} completo! Se avisó al mozo para entregarlo.`
          : `Platos de Mesa ${pedido.numeroMesa} listos. Falta que termine el otro sector.`,
        'success'
      );
      await this.cargarPedidos();
    } catch (error: any) {
      console.error('Error al marcar pedido listo:', error);
      await this.vibracion.errorFuerte();
      await this.mostrarToast('No se pudo marcar el pedido como listo.', 'danger');
    } finally {
      this.procesandoId.set(null);
    }
  }

  /**
   * Transforma la respuesta relacional de Supabase:
   * 1. Ignora pedidos sin mesa válida.
   * 2. Filtra pedido_items dejando únicamente los platos (tipo === 'plato').
   * 3. Descarta pedidos que no contengan ningún plato de cocina.
   * 4. Mapea cada plato a { nombre, cantidad }.
   * 5. Formatea created_at a fecha, hora y minutos en español.
   * 6. Agrupa los pedidos cronológicamente bajo su número de mesa correspondiente.
   */
  procesarYAgruparPedidos(pedidosRaw: PedidoSupabaseRelacional[]): MesaConPedidosCocinaUI[] {
    const mapaMesas = new Map<number, PedidoMesaCocinaUI[]>();

    for (const pedido of pedidosRaw) {
      // 1. Validar mesa existente y con número válido
      const numeroMesa = pedido.mesas?.numero;
      if (numeroMesa === undefined || numeroMesa === null || isNaN(numeroMesa)) {
        continue;
      }

      // 2. Filtrar exclusivamente productos de Cocina (tipo === 'plato')
      const itemsPlato = (pedido.pedido_items ?? []).filter(
        (item) => item.productos?.tipo === 'plato'
      );

      // 3. Descartar pedidos sin platos para cocina (ej. solo bebidas de bar)
      if (itemsPlato.length === 0) {
        continue;
      }

      // 4. Mapear cada plato a nombre y cantidad
      const platos: ItemPlatoCocinaUI[] = itemsPlato.map((item) => ({
        nombre: item.productos?.nombre?.trim() || 'Plato sin nombre',
        cantidad: item.cantidad
      }));

      // 5. Formatear fecha y hora
      const fechaHora = this.formatearFechaHora(pedido.created_at);

      const pedidoUI: PedidoMesaCocinaUI = {
        pedidoId: pedido.id,
        numeroMesa,
        fechaHora,
        platos
      };

      // 6. Agrupar por número de mesa manteniendo el orden cronológico
      if (!mapaMesas.has(numeroMesa)) {
        mapaMesas.set(numeroMesa, []);
      }
      mapaMesas.get(numeroMesa)!.push(pedidoUI);
    }

    // Convertir el Map a array ordenado por número de mesa
    const resultado: MesaConPedidosCocinaUI[] = Array.from(mapaMesas.entries()).map(
      ([numeroMesa, pedidos]) => ({
        numeroMesa,
        pedidos
      })
    );

    resultado.sort((a, b) => a.numeroMesa - b.numeroMesa);

    return resultado;
  }

  /**
   * Formatea un timestamp ISO a fecha, hora y minutos en español (ej. "01/10/2026 - 21:45 hs").
   */
  formatearFechaHora(fechaIso: string): string {
    if (!fechaIso) return '';
    const fecha = new Date(fechaIso);
    if (isNaN(fecha.getTime())) return '';

    const fechaFormateada = fecha.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });

    const horaFormateada = fecha.toLocaleTimeString('es-AR', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });

    return `${fechaFormateada} - ${horaFormateada} hs`;
  }

  /**
   * Notificación mediante Toast de Ionic (sin alert) respetando los lineamientos del TFI.
   */
  private async mostrarToast(mensaje: string, color: 'danger' | 'warning' | 'success'): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  /**
   * Inicia la suscripción de Supabase Realtime sobre la tabla 'pedidos' para escuchar
   * eventos INSERT y UPDATE. Reutiliza cargarPedidos() ante cualquier cambio.
   * Cancela cualquier suscripción previa antes de crear una nueva para evitar duplicados.
   */
  private iniciarSuscripcionRealtime(): void {
    this.detenerSuscripcionRealtime();

    this.canalRealtime = this.supabase.clienteSupabase
      .channel('pedidos-cocina-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pedidos' },
        () => {
          void this.cargarPedidos();
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos' },
        () => {
          void this.cargarPedidos();
        }
      )
      .subscribe();
  }

  /**
   * Remueve y cancela la suscripción del canal Realtime activo en Supabase
   * para prevenir fugas de memoria o llamadas duplicadas al salir de la pantalla.
   */
  private detenerSuscripcionRealtime(): void {
    if (this.canalRealtime) {
      void this.supabase.clienteSupabase.removeChannel(this.canalRealtime);
      this.canalRealtime = null;
    }
  }
}
