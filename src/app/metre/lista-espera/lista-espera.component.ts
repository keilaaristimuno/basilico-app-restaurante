import { Component, OnDestroy, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { PushNotificationsService } from "../../services/push-notifications.service";
import { RealtimeChannel } from '@supabase/supabase-js';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonButton,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  IonIcon,
  IonModal,
  IonTitle,
  IonList,
  IonLabel,
  IonItem,
} from "@ionic/angular";
import { addIcons } from "ionicons";
import {
  peopleOutline,
  personOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  mailOutline,
  timeOutline,
  chevronBackOutline,
  chevronForwardOutline,
  checkmarkDoneCircleOutline,
  arrowBackOutline,
  restaurantOutline,
  hourglassOutline,
} from "ionicons/icons";
import { Supabase } from "../../services/supabase";

@Component({
  selector: 'app-lista-espera',
  standalone: true,
  templateUrl: './lista-espera.component.html',
  styleUrls: ['./lista-espera.component.scss'],
  imports: [
    IonBackButton,
    IonButtons,
    IonButton,
    IonContent,
    IonHeader,
    IonToolbar,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    IonIcon,
    RouterLink,
    CommonModule,
    IonModal,
    IonTitle,
    IonList,
     IonLabel,
  IonItem,
  ],
})
export class ListaEsperaComponent implements OnInit, OnDestroy {
  listaEspera = signal<any[]>([]);
  listaMesas = signal<any[]>([]);
  mostrarMesas = signal<boolean>(false);
  idSeleccionadoCliente = signal<string>('');

  // Control del carrusel y estados de carga
  indiceClienteActual = signal<number>(0);
  procesandoId = signal<string | null>(null);

  // Variables para detección de swipe
  private touchStartX = 0;
  private touchEndX = 0;  

  private canalListaEspera: RealtimeChannel | null = null;

  constructor(
    private supabase: Supabase,
    private pushNotificationsService: PushNotificationsService
  ) {
    addIcons({
      peopleOutline,
      personOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      mailOutline,
      timeOutline,
      chevronBackOutline,
      chevronForwardOutline,
      checkmarkDoneCircleOutline,
      arrowBackOutline,
      restaurantOutline,
      hourglassOutline,
    });
  }

  ngOnInit() {
    this.obtenerListaEspera();
    this.iniciarSuscripcionRealtime();
  }

  async obtenerListaEspera() {
    try {
      const lista = await this.supabase.obtenerListaDeEspera();
      this.listaEspera.set(lista || []);

      // Ajustar el índice si la lista cambió y quedamos fuera de rango
      if (this.indiceClienteActual() >= this.listaEspera().length && this.listaEspera().length > 0) {
        this.indiceClienteActual.set(this.listaEspera().length - 1);
      }
    } catch (error) {
      console.error('Error al obtener la lista de espera:', error);
    }
  }

  ngOnDestroy() {
    this.detenerSuscripcionRealtime();
  }

  private iniciarSuscripcionRealtime() {
    this.detenerSuscripcionRealtime();

    // Nombre único por instancia: si el canal anterior todavía se está cerrando,
    // supabase devolvería el mismo canal ya suscripto y .on() lanzaría error.
    this.canalListaEspera = this.supabase.clienteSupabase
      .channel(`cambios-lista-espera-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lista_espera' },
        () => {
          // Cada vez que entra, sale o cambia alguien en la lista de espera,
          // volvemos a pedir los datos actualizados:
          void this.obtenerListaEspera();
        }
      )
      .subscribe();
  }

  private detenerSuscripcionRealtime() {
    if (this.canalListaEspera) {
      void this.supabase.clienteSupabase.removeChannel(this.canalListaEspera);
      this.canalListaEspera = null;
    }
  }

  // NAVEGACIÓN DEL CARRUSEL
  siguienteCliente() {
    if (this.indiceClienteActual() < this.listaEspera().length - 1) {
      this.indiceClienteActual.update((i) => i + 1);
    }
  }

  anteriorCliente() {
    if (this.indiceClienteActual() > 0) {
      this.indiceClienteActual.update((i) => i - 1);
    }
  }

  irACliente(index: number) {
    this.indiceClienteActual.set(index);
  }

  // GESTOS TOUCH (SWIPE)
  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].clientX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].clientX;
    this.evaluarSwipe();
  }

  private evaluarSwipe() {
    const umbral = 50; // Desplazamiento mínimo en px
    const diferencia = this.touchStartX - this.touchEndX;

    if (diferencia > umbral) {
      this.siguienteCliente();
    } else if (diferencia < -umbral) {
      this.anteriorCliente();
    }
  }

  // ACCIONES
  async rechazarCliente(cliente: any) {
    this.procesandoId.set(cliente.id);
    try {
      await this.supabase.eliminarDeListaDeEspera(cliente.id);
      await this.pushNotificationsService.enviarNotificacion(
        '¡Solicitud rechazada!',
        'El metre te ha rechazado su solicitud de mesa.',
        { userIds: [cliente.cliente_id || cliente.id] },
        { ruta: '/clienteInicio' }
      );
      await this.obtenerListaEspera();
    } catch (error) {
      console.error('Error al rechazar cliente:', error);
    } finally {
      this.procesandoId.set(null);
    }
  }

  async asignarMesaCliente(idCliente: string, numeroMesa: string) {
    this.procesandoId.set(idCliente);
    try {
      await this.supabase.asignarMesaACliente(idCliente, numeroMesa);

      await this.pushNotificationsService.enviarNotificacion(
        '¡Mesa Asignada!',
        `El metre te ha asignado la Mesa N° ${numeroMesa}. Ya puedes escanear el código QR correspondiente.`,
        { userIds: [idCliente] },
        { ruta: '/clienteInicio' }
      );

      this.cerrarModalMesas();
      await this.obtenerListaEspera();
    } catch (error) {
      console.error('Error durante la asignación o envío de push:', error);
    } finally {
      this.procesandoId.set(null);
    }
  }

  async abrirModuleMesas(id: string) {
    this.idSeleccionadoCliente.set(id);
    try {
      const mesas = await this.supabase.obtenerMesas();
      this.listaMesas.set(mesas || []);
    } catch (error) {
      console.error('Error al obtener las mesas:', error);
    }
    this.mostrarMesas.set(true);
  }

  cerrarModalMesas() {
    this.mostrarMesas.set(false);
  }

  onFotoError(event: Event) {
    (event.target as HTMLImageElement).src = 'assets/icon/favicon.png';
  }
}
