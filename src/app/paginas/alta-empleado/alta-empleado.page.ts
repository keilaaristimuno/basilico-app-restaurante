import { Component, OnInit, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from "@angular/forms";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonItem, IonInput, IonButton, IonNote, IonSelect, IonSelectOption, IonCard, IonCardHeader, IonCardTitle, IonCardContent } from "@ionic/angular";

@Component({
  selector: "app-alta-empleado",
  templateUrl: "./alta-empleado.page.html",
  styleUrls: ["./alta-empleado.page.scss"],
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, IonContent, IonHeader, IonTitle, IonToolbar, IonButtons, IonBackButton, IonItem, IonInput, IonButton, IonNote, IonSelect, IonSelectOption, IonCard, IonCardHeader, IonCardTitle, IonCardContent]
})
export class AltaEmpleadoPage implements OnInit {

  private constructorFormulario = inject(FormBuilder);
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

  // Captura de foto obligatoria exclusivamente desde la cámara directa
  async tomarFoto() {
    try {
      const imagen = await Camera.getPhoto({
        quality: 90,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera // Forzamos cámara física sin acceso a galería
      });

      this.fotoEmpleado.set(imagen.dataUrl ?? "");
      this.errorFoto.set(false);
    } catch (error) {
      console.log("Captura de foto cancelada o error:", error);
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
