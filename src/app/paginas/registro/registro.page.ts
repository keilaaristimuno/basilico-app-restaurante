import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, RouterLink } from '@angular/router';
import { Camera } from '@capacitor/camera';
import { Supabase } from '../../services/supabase';
import { EmailService } from '../../services/email';
import { PushNotificationsService } from '../../services/push-notifications.service';
import { generarHtmlConfirmacion } from '../../utils/plantillas-email';

//import { confirmarClaveValidator, datoExisteAsyncValidator } from '../../validaciones/usuario.validator';

// Componentes UI de Ionic Standalone
import {
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonItem,
  IonInput,
  IonButton,
  IonNote,
  IonLabel,
  IonSelect,
  IonSelectOption, 
  IonContent,
  IonSpinner,
  ToastController
} from '@ionic/angular';

@Component({
  selector: 'app-registro',
  standalone: true,
  imports: [
    RouterModule,
    ReactiveFormsModule,
    FormsModule,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonItem,
    IonInput,
    IonButton,
    IonNote,
    IonLabel,
    IonSelect,
    IonSelectOption,
    RouterLink,
    IonContent,
    IonSpinner
  ],
  templateUrl: './registro.page.html',
  styleUrl: './registro.page.scss',
})
export class RegistroPage implements OnInit {

  miFormulario!: FormGroup;
  fotoCliente = signal<string>('');
  errorFoto = signal<boolean>(false);
  cargando = signal<boolean>(false);

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private supabase: Supabase,
    private emailService: EmailService,
    private toastCtrl: ToastController,
    private pushNotifications: PushNotificationsService
  ) { }

  ngOnInit(): void {
    this.miFormulario = this.fb.group({
      apellidos: ['', {
        validators: [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)],
        //asyncValidators: [datoExisteAsyncValidator(this.supabase, 'usuario')],
        updateOn: 'blur'
      }],
      nombres: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
      dni: ['', [Validators.required, Validators.pattern(/^[0-9]{7,8}$/)]],
      correo: ['', {
        validators: [Validators.required, Validators.email],
        updateOn: 'blur'
      }],
      clave: ['', [Validators.required, Validators.minLength(6)]],
      repetirClave: [null, [Validators.required]],
    }) //{ validators: confirmarClaveValidator() });
  }

  get apellidos() {
    return this.miFormulario.get('apellidos');
  }
  get nombres() {
    return this.miFormulario.get('nombres');
  }
  get dni() {
    return this.miFormulario.get('dni');
  }
  get correo() {
    return this.miFormulario.get('correo');
  }
  get clave() {
    return this.miFormulario.get('clave');
  }

  enviarFormulario() {
    this.miFormulario.markAllAsTouched();
    this.errorFoto.set(!this.fotoCliente());

    if (this.miFormulario.invalid || !this.fotoCliente() || !this.clavesCoinciden()) {
      console.log("Formulario inválido");
      return;
    }

    void this.registrarCliente();
  }

  async tomarFoto() {
    try {
      const imagen = await Camera.takePhoto({ quality: 90 });
      this.fotoCliente.set(imagen.webPath ?? imagen.uri ?? '');
      this.errorFoto.set(false);
    } catch (error) {
      console.error('Error al tomar la foto del cliente:', error);
    }
  }

  clavesCoinciden(): boolean {
    return this.miFormulario.get('clave')?.value === this.miFormulario.get('repetirClave')?.value;
  }

  resetearForm() {
    this.miFormulario.reset();
    this.fotoCliente.set('');
    this.errorFoto.set(false);
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  async registrarCliente() {
    this.cargando.set(true);

    const apellidos = this.miFormulario.get('apellidos')?.value;
    const nombres = this.miFormulario.get('nombres')?.value;
    const dni = this.miFormulario.get('dni')?.value;
    const correo = this.miFormulario.get('correo')?.value;
    const clave = this.miFormulario.get('clave')?.value;

    try {
      const { error } = await this.supabase.registrar(correo, clave);
      if (error) throw new Error(error.message);

      const nombreArchivo = `clientes/${Date.now()}.jpg`;
      const resultado = await this.supabase.subirFotoCliente(this.fotoCliente(), nombreArchivo);
      const fotoUrl = this.supabase.obtenerUrlFotoCliente(resultado.path);

      await this.supabase.guardarDatosClientes(
        apellidos,
        nombres,
        Number(dni),
        correo,
        clave,
        fotoUrl
      );

      try {
        await this.pushNotifications.enviarNotificacion(
          'Nuevo cliente pendiente',
          `${nombres} ${apellidos} solicitó registrarse y espera aprobación.`,
          { profiles: ['duenio', 'dueno', 'dueño', 'supervisor'] },
          { tipo: 'cliente_pendiente', ruta: '/clientes-pendientes' }
        );
      } catch (error) {
        console.error('El cliente se guardó, pero no se pudo enviar la push:', error);
      }

      this.emailService.sendEmail({
        to: correo,
        category: "notificaciones",
        subject: "Solicitud de registro recibida - Basílico",
        title: "Solicitud en revisión",
        messageHtml: generarHtmlConfirmacion({ nombres, apellidos, dni }),
        nombreCliente: `${nombres} ${apellidos}`,
        tipo: "pendiente"
      }).subscribe({
        error: (error) => console.error("Error al enviar el correo:", error)
      });

      await this.mostrarToast('Registro enviado. Quedó pendiente de aprobación.', 'success');
      this.resetearForm();
    } catch (error: any) {
      console.error('Error al registrar cliente:', error);
      await this.mostrarToast(error?.message ?? 'No se pudo completar el registro.', 'danger');
    } finally {
      this.cargando.set(false);
    }
  }
}
