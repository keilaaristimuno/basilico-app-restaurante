import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { Router } from '@angular/router';
import { WritableSignal, signal } from '@angular/core';

@Component({
  selector: 'app-acceso-rapido',
  templateUrl: './acceso-rapido.component.html',
  standalone: true,
  styleUrls: ['./acceso-rapido.component.scss'],
  imports: [ IonContent, IonGrid, IonRow, IonCol, IonButton, RouterLink ],
})
export class AccesoRapidoComponent {
    ingresoIncorrecto: WritableSignal<boolean> = signal(false);
    perfil: WritableSignal<string> = signal("");

  constructor(private supabase: Supabase, private router: Router) { }

  async ingresar(mail:string, clave:string){   
    const { data, error } = await this.supabase.iniciarSesion(mail,clave);
    if (error){
      console.error('Error: ',error?.message);

    }else{
      const dataUsuarioLogueado =  await this.supabase.obtenerPerfilUsuarioLogueado();
      console.log('nombre del usuario:', dataUsuarioLogueado?.nombres);
      if(dataUsuarioLogueado){
        localStorage.setItem('nombre', dataUsuarioLogueado?.nombres);
        localStorage.setItem('perfil', dataUsuarioLogueado?.perfil);
        this.perfil.set(dataUsuarioLogueado?.perfil);
      }
      if(this.perfil() === 'cocinero'){
        this.router.navigate(['/cocinero-inicio']);
      }
      if(this.perfil() === 'cantinero'){
        this.router.navigate(['/cantinero-inicio']);
      }
      if(this.perfil() === 'mozo'){
        this.router.navigate(['/mozoInicio']);
      }
      if(this.perfil() === 'cliente'){
        this.router.navigate(['/clienteInicio']);
      }
      if(this.perfil() === 'metre'){
        this.router.navigate(['/metreInicio']);
      }
      if(this.perfil() === 'dueño'){
        this.router.navigate(['/dueñoInicio']);
      }
      if(this.perfil() === 'supervisor'){
        this.router.navigate(['/supervisorInicio']);
      }
    }
  }
}
