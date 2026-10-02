import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastController } from '@ionic/angular';
import { Supabase } from '../../../services/supabase';
import { Carga } from '../../../services/carga';
import { VibracionService } from '../../../services/vibracion';
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
  IonIcon
} from '@ionic/angular';

@Component({
  selector: 'app-pedidos-cocina',
  standalone: true,
  imports: [CommonModule, IonHeader, IonToolbar, IonButtons, IonBackButton, IonTitle, IonContent, IonIcon],
  templateUrl: './pedidos-cocina.page.html',
  styleUrls: ['./pedidos-cocina.page.scss']
})
export class PedidosCocinaPage {
  /**
   * Estado reactivo que contiene los pedidos confirmados agrupados por número de mesa.
   */
  pedidosPorMesa = signal<MesaConPedidosCocinaUI[]>([]);

  /**
   * Mensaje de error en caso de que falle la carga de pedidos.
   */
  mensajeError = signal<string | null>(null);

  constructor(
    private supabase: Supabase,
    public carga: Carga,
    private vibracion: VibracionService,
    private toastCtrl: ToastController
  ) {}

  async ionViewWillEnter(): Promise<void> {
    await this.cargarPedidos();
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
}
