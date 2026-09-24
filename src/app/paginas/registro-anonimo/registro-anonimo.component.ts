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
  selector: 'app-registro-anonimo',
  standalone: true,
  templateUrl: './registro-anonimo.component.html',
  styleUrls: ['./registro-anonimo.component.scss'],
  imports: [RouterModule,
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
    IonSpinner],
})
export class RegistroAnonimoComponent  implements OnInit {


  miFormulario!: FormGroup;
  fotoCliente = signal<string>('');
  errorFoto = signal<boolean>(false);
  cargando = signal<boolean>(false);

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private toastCtrl: ToastController,
  ) { }

  ngOnInit(): void {
    this.miFormulario = this.fb.group({
      nombres: ['', [Validators.required, Validators.pattern(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/)]],
    })
  }

 
  get nombres() {
    return this.miFormulario.get('nombres');
  }

  enviarFormulario() {
    //Guardar solo en local storage
    this.miFormulario.markAllAsTouched();
    this.errorFoto.set(!this.fotoCliente());

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
    //Agregar a localstorage unicamnete
  }
}

