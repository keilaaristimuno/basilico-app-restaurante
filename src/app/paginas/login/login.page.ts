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
  constructor(private supabase: Supabase, private router: Router) { }

  async ingresar(){
    this.ingresoIncorrecto.set(false); // Reiniciar el estado de error antes de intentar iniciar sesión
    const { data, error } = await this.supabase.iniciarSesion(this.mail,this.clave);
    if (error){
      console.error('Error: ',error?.message);
      this.ingresoIncorrecto.set(true);
    }else{
      const nicknameUsuario = "guchy";
      console.log('Nickname del usuario:', nicknameUsuario);
      if(nicknameUsuario){
        localStorage.setItem('nickname', nicknameUsuario);
      }
      this.router.navigate(['/bienvenido']);
    }
  }

  resetear() {
  this.mail = '';          
  this.clave = '';        
  this.ingresoIncorrecto.set(false);

  }

  accederRapido(){
    this.mail = 'admin@gmail.com';
    this.clave = 'admin1';

  }

}
