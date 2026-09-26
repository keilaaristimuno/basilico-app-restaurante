import { Component, OnInit, OnDestroy, signal, computed } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
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
  ToastController,
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
} from "ionicons/icons";
import { Supabase } from "../../services/supabase";
import { EmailService } from "../../services/email";
import { generarHtmlAprobacion, generarHtmlRechazo } from "../../utils/plantillas-email";

interface ClientePendiente {
  id: string | number;
  apellidos: string;
  nombres: string;
  dni: number;
  correo: string;
  foto_url: string;
  estado: string;
  created_at?: string;
}

@Component({
  selector: "app-clientes-pendientes",
  templateUrl: "./clientes-pendientes.page.html",
  styleUrls: ["./clientes-pendientes.page.scss"],
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
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
  ]
})
export class ClientesPendientesPage implements OnInit, OnDestroy {
  clientes = signal<ClientePendiente[]>([]);
  cargando = signal<boolean>(true);
  procesandoId = signal<string | number | null>(null);

  // Índice de la solicitud actual (navegación lateral)
  indiceClienteActual = signal<number>(0);

  // Cliente actualmente visible
  clienteActual = computed(() => {
    const list = this.clientes();
    const idx = this.indiceClienteActual();
    return list[idx] ?? null;
  });

  private canalRealtime: any = null;
  private timerAutoRefresco: any = null;

  // Detección de swipe lateral en móviles
  private touchStartX = 0;
  private touchEndX = 0;

  constructor(
    private supabase: Supabase,
    private emailService: EmailService,
    private toastCtrl: ToastController
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
    });
  }

  ngOnInit() {
    void this.cargarClientes();
    this.iniciarSuscripcionRealtime();
    this.iniciarAutoRefresco();
  }

  ionViewWillEnter() {
    void this.cargarClientes(false);
    this.iniciarSuscripcionRealtime();
    this.iniciarAutoRefresco();
  }

  ionViewWillLeave() {
    this.detenerSuscripcionRealtime();
    this.detenerAutoRefresco();
  }

  ngOnDestroy() {
    this.detenerSuscripcionRealtime();
    this.detenerAutoRefresco();
  }

  private iniciarAutoRefresco() {
    this.detenerAutoRefresco();
    this.timerAutoRefresco = setInterval(() => {
      void this.cargarClientes(false);
    }, 2500);
  }

  private detenerAutoRefresco() {
    if (this.timerAutoRefresco) {
      clearInterval(this.timerAutoRefresco);
      this.timerAutoRefresco = null;
    }
  }

  private iniciarSuscripcionRealtime() {
    this.detenerSuscripcionRealtime();

    this.canalRealtime = this.supabase.clienteSupabase
      .channel('clientes-pendientes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clientes' },
        () => {
          void this.cargarClientes(false);
        }
      )
      .subscribe();
  }

  private detenerSuscripcionRealtime() {
    if (this.canalRealtime) {
      void this.supabase.clienteSupabase.removeChannel(this.canalRealtime);
      this.canalRealtime = null;
    }
  }

  async refrescarManual(event: any) {
    await this.cargarClientes(false);
    event?.target?.complete();
  }

  async cargarClientes(mostrarSpinner = true) {
    if (mostrarSpinner) {
      this.cargando.set(true);
    }
    try {
      const data = await this.supabase.obtenerClientesPendientes();
      const list = (data as ClientePendiente[]) || [];
      this.clientes.set(list);

      // Si el índice actual quedó fuera de rango tras refrescar, ajustarlo
      if (this.indiceClienteActual() >= list.length && list.length > 0) {
        this.indiceClienteActual.set(list.length - 1);
      }
    } catch (error: any) {
      console.error("Error al cargar clientes pendientes:", error);
      await this.mostrarToast(error?.message ?? "Error al obtener lista de clientes", "danger");
    } finally {
      if (mostrarSpinner) {
        this.cargando.set(false);
      }
    }
  }

  anteriorCliente() {
    if (this.indiceClienteActual() > 0) {
      this.indiceClienteActual.update(i => i - 1);
    }
  }

  siguienteCliente() {
    if (this.indiceClienteActual() < this.clientes().length - 1) {
      this.indiceClienteActual.update(i => i + 1);
    }
  }

  irACliente(indice: number) {
    if (indice >= 0 && indice < this.clientes().length) {
      this.indiceClienteActual.set(indice);
    }
  }

  onTouchStart(event: TouchEvent) {
    this.touchStartX = event.changedTouches[0].screenX;
  }

  onTouchEnd(event: TouchEvent) {
    this.touchEndX = event.changedTouches[0].screenX;
    const diff = this.touchEndX - this.touchStartX;
    if (Math.abs(diff) > 45) {
      if (diff < 0) {
        this.siguienteCliente();
      } else {
        this.anteriorCliente();
      }
    }
  }

  async responderSolicitud(cliente: ClientePendiente, nuevoEstado: "aprobado" | "rechazado") {
    this.procesandoId.set(cliente.id);
    try {
      // 1. Actualizar estado en Supabase
      await this.supabase.cambiarEstadoCliente(cliente.id, nuevoEstado);

      // 2. Enviar correo electrónico automático personalizado
      this.enviarCorreoEstado(cliente, nuevoEstado);

      const accion = nuevoEstado === "aprobado" ? "aprobado" : "rechazado";
      await this.mostrarToast(`Cliente ${cliente.nombres} ${cliente.apellidos} ${accion} con éxito.`, "success");

      // Actualizar lista y ajustar puntero
      this.clientes.update(lista => {
        const nueva = lista.filter(c => c.id !== cliente.id);
        if (this.indiceClienteActual() >= nueva.length && nueva.length > 0) {
          this.indiceClienteActual.set(nueva.length - 1);
        }
        return nueva;
      });
    } catch (error: any) {
      console.error("Error al actualizar estado:", error);
      await this.mostrarToast(error?.message ?? "No se pudo actualizar el estado", "danger");
    } finally {
      this.procesandoId.set(null);
    }
  }

  private enviarCorreoEstado(cliente: ClientePendiente, estado: "aprobado" | "rechazado") {
    if (!cliente.correo) return;

    const esAprobado = estado === "aprobado";
    const subject = esAprobado
      ? "¡Bienvenido a Basílico! Tu cuenta ha sido aprobada"
      : "Información sobre tu solicitud de registro - Basílico";
    const title = esAprobado ? "Cuenta Aprobada" : "Solicitud No Aprobada";
    const htmlContent = esAprobado
      ? generarHtmlAprobacion(cliente)
      : generarHtmlRechazo(cliente);

    this.emailService.sendEmail({
      to: cliente.correo,
      category: "notificaciones",
      subject: subject,
      title: title,
      messageHtml: htmlContent,
      nombreCliente: `${cliente.nombres} ${cliente.apellidos}`,
      tipo: estado
    }).subscribe({
      next: (res) => console.log(`Correo de ${estado} enviado exitosamente:`, res),
      error: (err) => console.error(`Error al enviar correo de ${estado}:`, err)
    });
  }

  private async mostrarToast(mensaje: string, color: "success" | "danger") {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3000,
      color,
      position: "bottom"
    });
    await toast.present();
  }

  /**
   * Formatea la fecha y la hora en formato dd/MM/yyyy - hh:mm hs
   */
  formatearFechaHora(fechaStr?: string): string {
    if (!fechaStr) return '';
    try {
      const fecha = new Date(fechaStr);
      if (isNaN(fecha.getTime())) return fechaStr;

      const dia = String(fecha.getDate()).padStart(2, '0');
      const mes = String(fecha.getMonth() + 1).padStart(2, '0');
      const anio = fecha.getFullYear();
      const horas = String(fecha.getHours()).padStart(2, '0');
      const minutos = String(fecha.getMinutes()).padStart(2, '0');

      return `${dia}/${mes}/${anio} - ${horas}:${minutos} hs`;
    } catch {
      return fechaStr;
    }
  }

  onFotoError(event: any) {
    event.target.src = 'assets/icon/favicon.png';
  }
}
