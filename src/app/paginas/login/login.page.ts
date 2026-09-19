import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WritableSignal, signal } from '@angular/core';
import { Router } from '@angular/router';
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText 
} from '@ionic/angular';
import { Supabase } from '../../services/supabase';
import { PushNotificationsService } from '../../services/push-notifications.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    IonContent, IonGrid, IonRow, IonCol, 
    IonList, IonItem, IonInput, IonButton, 
    IonText
  ]
})
export class LoginPage {
  mail = '';
  clave = '';
  ingresoIncorrecto: WritableSignal<boolean> = signal(false);
  perfil: WritableSignal<string> = signal("");
  constructor(
    private supabase: Supabase,
    private router: Router,
    private pushNotifications: PushNotificationsService
  ) { }

  async ingresar(){
    this.ingresoIncorrecto.set(false); // Reiniciar el estado de error antes de intentar iniciar sesión
    const { data, error } = await this.supabase.iniciarSesion(this.mail,this.clave);
    if (error){
      console.error('Error: ',error?.message);
      this.ingresoIncorrecto.set(true);
    }else{
      await this.pushNotifications.inicializar();
      await this.pushNotifications.asociarTokenDelUsuarioActual();
      const dataUsuarioLogueado =  await this.supabase.obtenerPerfilUsuarioLogueado();
      console.log('nombre del usuario:', dataUsuarioLogueado?.nombres);
      if(dataUsuarioLogueado){
        localStorage.setItem('nombre', dataUsuarioLogueado?.nombres);
        localStorage.setItem('perfil', dataUsuarioLogueado?.perfil);
        this.perfil.set(dataUsuarioLogueado?.perfil);
      }
      if(this.perfil() === 'cocinero'){
        this.router.navigate(['/']);
      }
      if(this.perfil() === 'cocinero'){
        this.router.navigate(['/']);
      }
       if(this.perfil() === 'cliente'){
        this.router.navigate(['/']);
      }
      //Agregar a donde dirigir segun el perfil del usuario logueado
    }
  }

  resetear() {
  this.mail = '';          
  this.clave = '';        
  this.ingresoIncorrecto.set(false);

  }

}
