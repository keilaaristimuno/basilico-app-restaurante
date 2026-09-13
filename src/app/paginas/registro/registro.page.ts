import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { EmailService } from '../../services/email';

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
  IonSelectOption
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
    RouterLink
  ],
  templateUrl: './registro.page.html',
  styleUrl: './registro.page.scss',
})
export class RegistroPage implements OnInit {

  miFormulario!: FormGroup;

  constructor(
    private router: Router,
    private fb: FormBuilder,
    private supabase: Supabase,
    private emailService: EmailService
  ) { }

  ngOnInit(): void {
    this.miFormulario = this.fb.group({
      apellidos: ['', {
        validators: [Validators.required, Validators.pattern(/^[a-zA-Z0-9]+$/)],
        //asyncValidators: [datoExisteAsyncValidator(this.supabase, 'usuario')],
        updateOn: 'blur'
      }],
      nombres: ['', [Validators.required, Validators.pattern(/^[a-zA-Z]+$/)]],
      dni: ['', [Validators.required]],
      cuil: ['', [Validators.required]],
      correo: ['', {
        validators: [Validators.required, Validators.email],
        updateOn: 'blur'
      }],
      clave: ['', [Validators.required, Validators.minLength(6)]],
      repetirClave: [null, [Validators.required]],
      perfil: ['', [Validators.required]],
      fotoPerfil: [''],
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
  get cuil() {
    return this.miFormulario.get('cuil');
  }
  get correo() {
    return this.miFormulario.get('correo');
  }
  get clave() {
    return this.miFormulario.get('clave');
  }

  enviarFormulario() {
    this.miFormulario.markAllAsTouched();

    if (this.miFormulario.invalid) {
      console.log("Formulario inválido");
      return;
    }

    this.registrarEmpleado();
  }

  resetearForm() {
    this.miFormulario.reset();
  }
  /*   onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
  
    if (input.files && input.files.length > 0) {
      const file = input.files[0];
      
      // Guardas el archivo en el FormControl para validar y enviar a Supabase
      this.miFormulario.patchValue({
        foto: file
      });
      this.miFormulario.get('foto')?.updateValueAndValidity();
    }
  } */
  async registrarEmpleado() {
    const apellidos = this.miFormulario.get('apellidos')?.value;
    const nombres = this.miFormulario.get('nombres')?.value;
    const dni = this.miFormulario.get('dni')?.value;
    const cuil = this.miFormulario.get('cuil')?.value;
    const correo = this.miFormulario.get('correo')?.value;
    const clave = this.miFormulario.get('clave')?.value;
    const perfil = this.miFormulario.get('perfil')?.value;
    const foto_url = "foto";

    //Llamo al metodo de Supabase para registrar el usuario, le paso el email y la clave
    const { data, error } = await this.supabase.registrar(correo, clave);



    if (error) {
      console.error('Error: ', error.message);
      return;
    }

    //console.log('User registrado:', data.user);
    await this.supabase.guardarDatosEmpleados(apellidos, nombres, dni, cuil, correo, clave, perfil, foto_url);

    // 3. Envío asincrónico del correo de confirmación
    this.emailService.sendEmail({
      to: correo,
      category: 'notificaciones',
      subject: 'Solicitud de registro recibida - Resto Basílico',
      title: 'Solicitud en Revisión',
      messageHtml: `Hola <strong>${nombres} ${apellidos}</strong>,<br><br>Hemos recibido correctamente tu solicitud de registro para el perfil de <strong>${perfil}</strong>. La administración revisará tu solicitud a la brevedad.`
    }).subscribe({
      next: () => {
        console.log('Notificación de registro enviada con éxito.');
      },
      error: (err) => {
        console.error('Error al enviar el correo de registro:', err);
      }
    });

    //localStorage.setItem('nickname', usuarioValido);
    //this.router.navigate(['/bienvenido']);
  }
}
import { from } from 'rxjs';
