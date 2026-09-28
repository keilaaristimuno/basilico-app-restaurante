import { Component, WritableSignal, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { RouterLink } from "@angular/router";
import { FormsModule } from "@angular/forms";
import { VibracionService } from '../../services/vibracion';
import { Router } from "@angular/router";
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText, ToastController, IonSpinner, IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton 
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
    IonText, IonSpinner, IonHeader, IonToolbar,IonButtons,
    IonBackButton
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
    private vibracion: VibracionService,
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
      await this.vibracion.errorFuerte();
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
      this.vibracion.errorFuerte();
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
      this.vibracion.errorFuerte();
      return false;
    }
    return true;
  }

  private async procesarAccesoCliente(cliente: any) {
    if (cliente.estado === "rechazado") {
      await this.supabase.cerrarSesion();
      await this.mostrarToast(
        "Acceso Denegado: Su solicitud de registro ha sido rechazada. Revise su correo para más información.",
        "danger"
      );
      this.mensajeError.set("Su solicitud de registro fue rechazada. Revise su correo para más información.");
      this.ingresoIncorrecto.set(true);
      return;
    }

    if (cliente.estado === "pendiente") {
      await this.supabase.cerrarSesion();
      await this.mostrarToast(
        "Cuenta en Revisión: Su solicitud se encuentra pendiente de aprobación. Revise su correo para más información.",
        "warning"
      );
      this.mensajeError.set("Su cuenta está pendiente de aprobación. Revise su correo para más información.");
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
        await this.router.navigate(["/duenioInicio"]);
        break;
      case "supervisor":
        await this.router.navigate(["/duenioInicio"]);
        break;
      case "metre":
        await this.router.navigate(["/metreInicio"]);
        break;
      case "cocinero":
        await this.router.navigate(["/inicio-cocinero"]);
        break;
      case "cliente":
        await this.router.navigate(["/clienteInicio"]);
        break;
      case "cantinero":
        await this.router.navigate(["/inicio-cantinero"]);
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

  private async mostrarToast(mensaje: string, color: "success" | "danger" | "warning") {
    const toast = await this.toastController.create({
      message: mensaje,
      duration: 5000,
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
