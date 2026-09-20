import { Component, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonSpinner,
  IonBadge,
  ToastController
} from "@ionic/angular";
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
    IonTitle,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonButton,
    IonSpinner,
    IonBadge
  ]
})
export class ClientesPendientesPage implements OnInit {
  clientes = signal<ClientePendiente[]>([]);
  cargando = signal<boolean>(true);
  procesandoId = signal<string | number | null>(null);

  constructor(
    private supabase: Supabase,
    private emailService: EmailService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    void this.cargarClientes();
  }

  async cargarClientes() {
    this.cargando.set(true);
    try {
      const data = await this.supabase.obtenerClientesPendientes();
      this.clientes.set(data as ClientePendiente[]);
    } catch (error: any) {
      console.error("Error al cargar clientes pendientes:", error);
      await this.mostrarToast(error?.message ?? "Error al obtener lista de clientes", "danger");
    } finally {
      this.cargando.set(false);
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
      this.clientes.update(lista => lista.filter(c => c.id !== cliente.id));
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
}
