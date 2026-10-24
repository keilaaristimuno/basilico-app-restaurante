import { Component, OnDestroy, OnInit } from '@angular/core';
import { RealtimeChannel } from '@supabase/supabase-js';
import { 
  IonContent, IonGrid, IonRow, IonCol, IonIcon,
  IonList, IonItem, IonInput, IonButton, IonHeader,
  IonText, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonToolbar, IonTitle, IonButtons, IonBackButton
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { addIcons } from 'ionicons';
import { signal } from '@angular/core';
import {ChatComponent} from '../../components/chat/chat.component';
import { listOutline, receiptOutline, checkmarkDoneOutline, chatbubblesOutline } from 'ionicons/icons';
import { ChatEstadoService } from '../../services/chat-servicio';
import { CuentaService } from '../../services/cuenta.service';
import { Supabase } from '../../services/supabase';
@Component({
  selector: 'app-mozo-inicio',
  templateUrl: './mozo-inicio.component.html',
  styleUrls: ['./mozo-inicio.component.scss'],
  imports: [ChatComponent, IonContent, IonCard,  IonIcon, IonHeader, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonButton, RouterLink, NavbarComponent, IonList, IonItem, IonInput, IonText,
      IonToolbar, IonTitle, IonButtons, IonBackButton],
})
export class MozoInicioComponent  implements OnInit, OnDestroy {
  abrirChatModal = signal<boolean>(false);

  /**
   * Cantidad de pagos simulados pendientes de confirmación (Punto 21)
   */
  pagosPendientes = signal<number>(0);

  private canalCuentas: RealtimeChannel | null = null;

  /**
   * Cantidad de pedidos que requieren atención del mozo:
   * pendientes de autorizar, en preparación y listos para entregar
   */
  pedidosActivos = signal<number>(0);

  private canalPedidos: RealtimeChannel | null = null;

  readonly chatsNoLeidos = this.chatEstado.chatsNoLeidos;
  constructor(private chatEstado: ChatEstadoService, private cuentaService: CuentaService, private supabase: Supabase) { 
    addIcons({ listOutline, receiptOutline, checkmarkDoneOutline, chatbubblesOutline });
  }

  ngOnInit() {
    this.cargarNombreChat();
  }

  async ionViewWillEnter() {
    // Escucha cambios en 'cuentas' para actualizar el contador sin salir de la pantalla
    this.cuentaService.dejarDeEscuchar(this.canalCuentas);
    this.canalCuentas = this.cuentaService.escucharCambios('inicio-mozo', () => {
      void this.contarPagosPendientes();
    });
    this.iniciarSuscripcionPedidos();
    await Promise.all([this.contarPagosPendientes(), this.contarPedidosActivos()]);
  }

  ionViewWillLeave() {
    this.cuentaService.dejarDeEscuchar(this.canalCuentas);
    this.canalCuentas = null;
    this.detenerSuscripcionPedidos();
  }

  ngOnDestroy() {
    this.cuentaService.dejarDeEscuchar(this.canalCuentas);
    this.canalCuentas = null;
    this.detenerSuscripcionPedidos();
  }

  private async contarPedidosActivos() {
    try {
      const pedidos = await this.supabase.obtenerPedidosPendientesMozo(['enviado', 'confirmado', 'listo']);
      this.pedidosActivos.set(pedidos.length);
    } catch (error) {
      console.error('Error al contar pedidos del mozo:', error);
    }
  }

  /**
   * Escucha cambios en 'pedidos' para actualizar el contador sin salir de la pantalla
   */
  private iniciarSuscripcionPedidos() {
    this.detenerSuscripcionPedidos();

    this.canalPedidos = this.supabase.clienteSupabase
      .channel('inicio-mozo-pedidos-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          void this.contarPedidosActivos();
        }
      )
      .subscribe();
  }

  private detenerSuscripcionPedidos() {
    if (this.canalPedidos) {
      void this.supabase.clienteSupabase.removeChannel(this.canalPedidos);
      this.canalPedidos = null;
    }
  }

  private async contarPagosPendientes() {
    this.pagosPendientes.set(await this.cuentaService.contarPagosPendientes());
  }


  alternarChat() {
  this.abrirChatModal.set(!this.abrirChatModal());  
  } 

  cargarNombreChat(){
    const nombre = localStorage.getItem('nombre') || 'Mozo Anónimo';
    const identificador = "Mozo " + nombre;
    localStorage.setItem('identificador', identificador);
  }
}
