import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Camera } from "@capacitor/camera";
import { ToastController } from "@ionic/angular";
import { IonContent, IonHeader, IonSpinner, IonTitle, IonToolbar, IonButtons, IonBackButton, IonItem, IonInput, IonButton, IonNote, IonSelect, IonSelectOption, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from "@ionic/angular";
import { QrService } from "../../services/qr.service";
import { Supabase } from "../../services/supabase";
import { PushNotificationsService } from "../../services/push-notifications.service";

@Component({
  selector: "app-alta-empleado",
  templateUrl: "./alta-empleado.page.html",
  styleUrls: ["./alta-empleado.page.scss"],
  imports: [CommonModule, IonSpinner, FormsModule, ReactiveFormsModule, IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonItem, IonInput, IonButton, IonNote, IonSelect, IonSelectOption, IonCard, IonCardHeader, IonCardTitle, IonCardContent]
})
export class AltaEmpleadoPage implements OnInit {

  private constructorFormulario = inject(FormBuilder);
  private servicioQr = inject(QrService);
  private servicioSupabase = inject(Supabase);
  private servicioPush = inject(PushNotificationsService);
  private toastCtrl = inject(ToastController);

  formularioEmpleado!: FormGroup;

  fotoEmpleado = signal<string>("");
  errorFoto = signal<boolean>(false);
  cargando = signal<boolean>(false);

  ngOnInit() {
    this.inicializarFormulario();
  }

  inicializarFormulario() {
    this.formularioEmpleado = this.constructorFormulario.group({
      apellidos: ["", [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      nombres: ["", [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      dni: ["", [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
      cuil: ["", [Validators.required, Validators.pattern(/^[0-9]{11}$/)]],
      correo: ["", [Validators.required, Validators.email]],
      clave: ["", [Validators.required, Validators.minLength(6)]],
      repetirClave: ["", [Validators.required]],
      perfil: ["", [Validators.required]]
    });
  }

  async tomarFoto() {
    try {
      const imagen = await Camera.takePhoto({ quality: 90 });
      const ruta = imagen.webPath ?? imagen.uri ?? "";
      this.fotoEmpleado.set(ruta);
      this.errorFoto.set(false);
    } catch (error) {
      console.log("Captura de foto cancelada o error:", error);
    }
  }

  async escanearDni() {
    try {
      const codigoLeido = await this.servicioQr.leerQR();
      if (codigoLeido) {
        this.procesarDatosDni(codigoLeido);
      }
    } catch (error) {
      console.log("Error al escanear el DNI:", error);
    }
  }

  procesarDatosDni(texto: string) {
    const partes = texto.split("@");
    if (partes.length >= 5) {
      const apellidos = partes[1]?.trim() || "";
      const nombres = partes[2]?.trim() || "";
      const dni = partes[4]?.trim() || "";
      this.formularioEmpleado.patchValue({ apellidos, nombres, dni });
    }
  }

  clavesCoinciden(): boolean {
    const clave = this.formularioEmpleado.get("clave")?.value;
    const repetir = this.formularioEmpleado.get("repetirClave")?.value;
    return clave === repetir;
  }

  dniEstaEnCuil(): boolean {
    const dni = String(this.formularioEmpleado.get("dni")?.value || "");
    const cuil = String(this.formularioEmpleado.get("cuil")?.value || "");
    if (!dni || !cuil) return true;
    return cuil.includes(dni);
  }

  get apellidos() { return this.formularioEmpleado.get("apellidos"); }
  get nombres() { return this.formularioEmpleado.get("nombres"); }
  get dni() { return this.formularioEmpleado.get("dni"); }
  get cuil() { return this.formularioEmpleado.get("cuil"); }
  get correo() { return this.formularioEmpleado.get("correo"); }
  get clave() { return this.formularioEmpleado.get("clave"); }
  get repetirClave() { return this.formularioEmpleado.get("repetirClave"); }
  get perfil() { return this.formularioEmpleado.get("perfil"); }


  perfilSelectOptions = {
    header: 'Seleccioná un perfil',
    subHeader: 'Elegí el puesto del empleado',
    cssClass: 'perfil-alert'
  };

  private async mostrarToast(mensaje: string, color: "success" | "danger") {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3000,
      color,
      position: "bottom"
    });
    await toast.present();
  }

  async guardarEmpleado() {
    this.formularioEmpleado.markAllAsTouched();

    if (!this.fotoEmpleado()) {
      this.errorFoto.set(true);
    }

    if (this.formularioEmpleado.invalid || !this.clavesCoinciden() || !this.dniEstaEnCuil() || !this.fotoEmpleado()) {
      return;
    }

    try {
      this.cargando.set(true);

      const { error: errorAuth } = await this.servicioSupabase.registrar(
        this.formularioEmpleado.get("correo")?.value,
        this.formularioEmpleado.get("clave")?.value
      );

      if (errorAuth) {
        throw new Error(errorAuth.message);
      }

      await this.servicioPush.inicializar();
      await this.servicioPush.asociarTokenDelUsuarioActual();

      const nombreArchivo = `empleados/${Date.now()}.jpg`;
      const resultado = await this.servicioSupabase.subirFotoEmpleado(this.fotoEmpleado(), nombreArchivo);
      const urlFoto = this.servicioSupabase.obtenerUrlFotoEmpleado(resultado.path);

      const { apellidos, nombres, dni, cuil, correo, clave, perfil } = this.formularioEmpleado.value;

      await this.servicioSupabase.guardarDatosEmpleados(
        apellidos,
        nombres,
        Number(dni),
        Number(cuil),
        correo,
        clave,
        perfil,
        urlFoto
      );

      await this.mostrarToast("Empleado registrado con éxito.", "success");
      this.limpiarFormulario();
    } catch (error: any) {
      console.error("Error al guardar el empleado:", error);
      await this.mostrarToast(`Error: ${error?.message ?? "No se pudo guardar."}`, "danger");
    } finally {
      this.cargando.set(false);
    }
  }

  limpiarFormulario() {
    this.formularioEmpleado.reset();
    this.fotoEmpleado.set("");
    this.errorFoto.set(false);
  }

}
