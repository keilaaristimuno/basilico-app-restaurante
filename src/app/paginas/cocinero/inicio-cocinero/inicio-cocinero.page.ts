import { Component, OnDestroy, signal } from '@angular/core';
import { IonContent, IonCard, IonCardContent, IonIcon, IonHeader } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { Supabase } from '../../../services/supabase';
import { addIcons } from 'ionicons';
import { restaurantOutline, bookOutline, receiptOutline} from 'ionicons/icons';

@Component({
  selector: 'app-inicio-cocinero',
  templateUrl: './inicio-cocinero.page.html',
  styleUrls: ['./inicio-cocinero.page.scss'],
  standalone: true,
  imports: [IonContent, IonCard, IonCardContent, IonIcon, RouterLink, NavbarComponent, IonHeader]
})
export class InicioCocineroPage implements OnDestroy {

  /**
   * Cantidad de pedidos confirmados con platos pendientes de preparar en cocina
   */
  pedidosPendientes = signal<number>(0);

  private canalRealtime: RealtimeChannel | null = null;

  constructor(private supabase: Supabase) {
    addIcons({ restaurantOutline, bookOutline, receiptOutline});
  }

  async ionViewWillEnter(): Promise<void> {
    this.iniciarSuscripcionRealtime();
    await this.contarPedidosPendientes();
  }

  ionViewWillLeave(): void {
    this.detenerSuscripcionRealtime();
  }

  ngOnDestroy(): void {
    this.detenerSuscripcionRealtime();
  }

  /**
   * Cuenta los pedidos confirmados que tienen al menos un plato y cocina aún no marcó como listos
   */
  private async contarPedidosPendientes(): Promise<void> {
    try {
      const pedidos = await this.supabase.obtenerPedidosConfirmadosCocina();
      const cantidad = pedidos.filter((pedido) =>
        (pedido.pedido_items ?? []).some((item) => item.productos?.tipo === 'plato')
      ).length;
      this.pedidosPendientes.set(cantidad);
    } catch (error) {
      console.error('Error al contar pedidos pendientes de cocina:', error);
    }
  }

  /**
   * Escucha cambios en la tabla 'pedidos' para actualizar el contador sin salir de la pantalla
   */
  private iniciarSuscripcionRealtime(): void {
    this.detenerSuscripcionRealtime();

    this.canalRealtime = this.supabase.clienteSupabase
      .channel('inicio-cocinero-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          void this.contarPedidosPendientes();
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
