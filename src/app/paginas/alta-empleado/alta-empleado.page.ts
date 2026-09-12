import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Camera } from "@capacitor/camera";
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonItem, IonInput, IonButton, IonNote, IonSelect, IonSelectOption, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from "@ionic/angular";
import { QrService } from "../../services/qr.service";

@Component({
  selector: "app-alta-empleado",
  templateUrl: "./alta-empleado.page.html",
  styleUrls: ["./alta-empleado.page.scss"],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonItem, IonInput, IonButton, IonNote, IonSelect, IonSelectOption, IonCard, IonCardHeader, IonCardTitle, IonCardContent]
})
export class AltaEmpleadoPage implements OnInit {

  private constructorFormulario = inject(FormBuilder);
  private servicioQr = inject(QrService);

  formularioEmpleado!: FormGroup;

  // Signals para el manejo reactivo del estado de la foto
  fotoEmpleado = signal<string>("");
  errorFoto = signal<boolean>(false);

  ngOnInit() {
    this.inicializarFormulario();
  }

  // Creación del formulario reactivo con nombres alineados a la tabla de Supabase
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

  // Captura de foto obligatoria con el método moderno takePhoto de Capacitor 8
  async tomarFoto() {
    try {
      const imagen = await Camera.takePhoto({
        quality: 90
      });

      const ruta = imagen.webPath ?? imagen.uri ?? "";
      this.fotoEmpleado.set(ruta);
      this.errorFoto.set(false);
    } catch (error) {
      console.log("Captura de foto cancelada o error:", error);
    }
  }

  // Abre el lector QR para escanear el DNI argentino
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

  // Parsea la cadena del DNI argentino separada por @ y autocompleta el formulario
  procesarDatosDni(texto: string) {
    const partes = texto.split("@");

    // Formato estándar DNI: nro_tramite@apellidos@nombres@sexo@dni@...
    if (partes.length >= 5) {
      const apellidos = partes[1]?.trim() || "";
      const nombres = partes[2]?.trim() || "";
      const dni = partes[4]?.trim() || "";

      this.formularioEmpleado.patchValue({
        apellidos: apellidos,
        nombres: nombres,
        dni: dni
      });
      console.log("Datos del DNI cargados exitosamente:", { apellidos, nombres, dni });
    } else {
      console.log("El formato del código escaneado no coincide con un DNI argentino.");
    }
  }

  // Verifica de forma simple si la contraseña y su repetición son iguales
  clavesCoinciden(): boolean {
    const clave = this.formularioEmpleado.get("clave")?.value;
    const repetir = this.formularioEmpleado.get("repetirClave")?.value;
    return clave === repetir;
  }

  // Verifica con .includes() si el número de DNI está dentro del CUIL
  dniEstaEnCuil(): boolean {
    const dni = String(this.formularioEmpleado.get("dni")?.value || "");
    const cuil = String(this.formularioEmpleado.get("cuil")?.value || "");

    // Si aún no ingresó alguno de los dos, no mostramos error prematuro
    if (!dni || !cuil) {
      return true;
    }
    return cuil.includes(dni);
  }

  // Accesos rápidos (getters) para consultar los campos desde la vista HTML
  get apellidos() { return this.formularioEmpleado.get("apellidos"); }
  get nombres() { return this.formularioEmpleado.get("nombres"); }
  get dni() { return this.formularioEmpleado.get("dni"); }
  get cuil() { return this.formularioEmpleado.get("cuil"); }
  get correo() { return this.formularioEmpleado.get("correo"); }
  get clave() { return this.formularioEmpleado.get("clave"); }
  get repetirClave() { return this.formularioEmpleado.get("repetirClave"); }
  get perfil() { return this.formularioEmpleado.get("perfil"); }

  // Función para procesar el envío del formulario
  guardarEmpleado() {
    this.formularioEmpleado.markAllAsTouched();

    // Verificamos si falta la foto
    if (!this.fotoEmpleado()) {
      this.errorFoto.set(true);
    }

    // Verificamos validaciones de Angular, coincidencia de claves, DNI en CUIL y foto
    if (this.formularioEmpleado.invalid || !this.clavesCoinciden() || !this.dniEstaEnCuil() || !this.fotoEmpleado()) {
      console.log("El formulario contiene errores o falta la foto. Revise los campos.");
      return;
    }

    console.log("Formulario válido listo para guardar:", {
      ...this.formularioEmpleado.value,
      foto: this.fotoEmpleado()
    });
  }

  limpiarFormulario() {
    this.formularioEmpleado.reset();
    this.fotoEmpleado.set("");
    this.errorFoto.set(false);
  }

}
