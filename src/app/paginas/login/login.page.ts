import { Component, WritableSignal, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText, AlertController, ToastController, IonSpinner 
} from "@ionic/angular";
import { Supabase } from "../../services/supabase";
import { PushNotificationsService } from "../../services/push-notifications.service";

@Component({
  selector: "app-login",
  templateUrl: "./login.page.html",
  styleUrls: ["./login.page.scss"],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent, IonGrid, IonRow, IonCol, 
    IonList, IonItem, IonInput, IonButton, 
    IonText, IonSpinner
  ]
})
export class LoginPage {
  mail = "";
  clave = "";
  cargando: WritableSignal<boolean> = signal(false);
  ingresoIncorrecto: WritableSignal<boolean> = signal(false);
  mensajeError: WritableSignal<string> = signal("");
  perfil: WritableSignal<string> = signal("");

  constructor(
    private supabase: Supabase,
    private router: Router,
    private pushNotifications: PushNotificationsService,
    private alertController: AlertController,
    private toastController: ToastController
  ) { }

  ionViewDidEnter() {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  async ingresar() {
    if (!this.validarCampos()) return;

    this.cargando.set(true);

    try {
      const autenticado = await this.autenticarUsuario();
      if (!autenticado) return;

      // Verificar si el usuario es un Cliente
      const datosCliente = await this.supabase.obtenerClientePorCorreo(this.mail);
      if (datosCliente) {
        await this.procesarAccesoCliente(datosCliente);
        return;
      }

      // Si no es cliente procesar acceso de empleado
      await this.procesarAccesoEmpleado();

    } catch (err: any) {
      console.error("Error durante el ingreso:", err);
      this.mensajeError.set(err?.message ?? "Ocurrió un error al ingresar.");
      this.ingresoIncorrecto.set(true);
    } finally {
      this.cargando.set(false);
    }
  }

  private validarCampos(): boolean {
    this.ingresoIncorrecto.set(false);
    this.mensajeError.set("");

    if (!this.mail.trim() || !this.clave.trim()) {
      this.mensajeError.set("Por favor, ingrese correo y contraseña.");
      this.ingresoIncorrecto.set(true);
      return false;
    }
    return true;
  }

  private async autenticarUsuario(): Promise<boolean> {
    const { error } = await this.supabase.iniciarSesion(this.mail.trim(), this.clave);
    if (error) {
      console.error("Error al iniciar sesión:", error.message);
      this.mensajeError.set("Correo o contraseña incorrectos.");
      this.ingresoIncorrecto.set(true);
      return false;
    }
    return true;
  }

  private async procesarAccesoCliente(cliente: any) {
    if (cliente.estado === "rechazado") {
      await this.supabase.cerrarSesion();
      await this.mostrarAlerta(
        "Acceso Denegado",
        "Tu solicitud de registro ha sido rechazada por la administración de Basílico."
      );
      this.mensajeError.set("Tu solicitud de registro fue rechazada.");
      this.ingresoIncorrecto.set(true);
      return;
    }

    if (cliente.estado === "pendiente") {
      await this.supabase.cerrarSesion();
      await this.mostrarAlerta(
        "Cuenta en Revisión",
        "Tu cuenta aún se encuentra pendiente de aprobación por el dueño o supervisor."
      );
      this.mensajeError.set("Tu cuenta está pendiente de aprobación.");
      this.ingresoIncorrecto.set(true);
      return;
    }

    if (cliente.estado === "aprobado") {
      localStorage.setItem("nombre", `${cliente.nombres} ${cliente.apellidos}`);
      localStorage.setItem("perfil", "cliente");
      this.perfil.set("cliente");

      await this.inicializarNotificaciones();
      await this.mostrarToast(`¡Bienvenido/a, ${cliente.nombres}!`, "success");
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      await this.router.navigate(["/clienteInicio"]);
    }
  }

  private async procesarAccesoEmpleado() {
    await this.inicializarNotificaciones();

    const dataUsuario = await this.supabase.obtenerPerfilUsuarioLogueado();
    console.log("Perfil logueado:", dataUsuario);

    if (dataUsuario) {
      localStorage.setItem("nombre", dataUsuario?.nombres ?? "");
      localStorage.setItem("perfil", dataUsuario?.perfil ?? "");
      this.perfil.set(dataUsuario?.perfil ?? "");
    }

    await this.redirigirSegunRol(this.perfil());
  }

  private async redirigirSegunRol(rol: string) {
    switch (rol) {
      case "duenio":
      case "dueño":
      case "supervisor":
        await this.router.navigate(["/clientes-pendientes"]);
        break;
      case "metre":
        await this.router.navigate(["/metreInicio"]);
        break;
      case "cocinero":
        await this.router.navigate(["/"]);
        break;
      case "cliente":
        await this.router.navigate(["/clienteInicio"]);
        break;
      default:
        await this.router.navigate(["/inicio"]);
        break;
    }
  }

  private async inicializarNotificaciones() {
    try {
      await this.pushNotifications.inicializar();
      await this.pushNotifications.asociarTokenDelUsuarioActual();
    } catch (error) {
      console.warn("No se pudieron inicializar las notificaciones:", error);
    }
  }

  private async mostrarAlerta(titulo: string, mensaje: string) {
    const alert = await this.alertController.create({
      header: titulo,
      message: mensaje,
      buttons: ["Entendido"]
    });
    await alert.present();
  }

  private async mostrarToast(mensaje: string, color: "success" | "danger") {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 3000,
      color,
      position: "bottom"
    });
    await toast.present();
  }

  resetear() {
    this.mail = "";
    this.clave = "";
    this.ingresoIncorrecto.set(false);
    this.mensajeError.set("");
  }
}
