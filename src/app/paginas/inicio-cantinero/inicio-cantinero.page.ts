import { Component, OnDestroy, signal } from '@angular/core';
import {
  IonContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonHeader
} from '@ionic/angular';

import { RouterLink } from '@angular/router';
import { RealtimeChannel } from '@supabase/supabase-js';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { Supabase } from '../../services/supabase';

import { addIcons } from 'ionicons';
import {
  wineOutline,
  bookOutline,
  receiptOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-inicio-cantinero',
  templateUrl: './inicio-cantinero.page.html',
  styleUrls: ['./inicio-cantinero.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonCard,
    IonCardContent,
    IonIcon,
    IonHeader,
    RouterLink,
    NavbarComponent
  ]
})
export class InicioCantineroPage implements OnDestroy {

  /**
   * Cantidad de pedidos confirmados con bebidas pendientes de preparar en el bar
   */
  pedidosPendientes = signal<number>(0);

  private canalRealtime: RealtimeChannel | null = null;

  constructor(private supabase: Supabase) {
    addIcons({
      wineOutline,
      bookOutline,
      receiptOutline
    });
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
   * Cuenta los pedidos confirmados que tienen al menos una bebida y el bar aún no marcó como listos
   */
  private async contarPedidosPendientes(): Promise<void> {
    try {
      const pedidos = await this.supabase.obtenerPedidosConfirmadosBar();
      const cantidad = pedidos.filter((pedido) =>
        (pedido.pedido_items ?? []).some((item) => item.productos?.tipo === 'bebida')
      ).length;
      this.pedidosPendientes.set(cantidad);
    } catch (error) {
      console.error('Error al contar pedidos pendientes del bar:', error);
    }
  }

  /**
   * Escucha cambios en la tabla 'pedidos' para actualizar el contador sin salir de la pantalla
   */
  private iniciarSuscripcionRealtime(): void {
    this.detenerSuscripcionRealtime();

    this.canalRealtime = this.supabase.clienteSupabase
      .channel('inicio-cantinero-realtime')
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
