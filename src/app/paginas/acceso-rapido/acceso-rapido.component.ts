import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText, IonHeader, IonToolbar, IonButtons, IonBackButton
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
  imports: [ IonContent, IonGrid, IonRow, IonCol, IonButton, RouterLink,
    IonHeader, IonToolbar, IonButtons, IonBackButton
   ],
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

      const cliente = await this.supabase.obtenerClientePorCorreo(mail);

      if (cliente) {
        if (cliente.estado !== 'aprobado') {
          await this.supabase.cerrarSesion();
          console.warn('El cliente no puede ingresar. Estado:', cliente.estado);
          return;
        }

        localStorage.setItem('nombre', `${cliente.nombres} ${cliente.apellidos}`);
        localStorage.setItem('perfil', 'cliente');

        await this.router.navigate(['/clienteInicio']);
        return;
      }

      /* OBTIENE EL PERFIL */
      const dataUsuarioLogueado =  await this.supabase.obtenerPerfilUsuarioLogueado();
      console.log('nombre del usuario:', dataUsuarioLogueado?.nombres);
      if(dataUsuarioLogueado){
        localStorage.setItem('nombre', dataUsuarioLogueado?.nombres);
        localStorage.setItem('perfil', dataUsuarioLogueado?.perfil);
        this.perfil.set(dataUsuarioLogueado?.perfil);
      }
      if(this.perfil() === 'cocinero'){
        this.router.navigate(['/inicio-cocinero']);
      }
      if(this.perfil() === 'cantinero'){
        this.router.navigate(['/cantinero-inicio']);
      }
      if(this.perfil() === 'mozo'){
        this.router.navigate(['/mozoInicio']);
      }
      if(this.perfil() === 'cliente'){
        const navego = await this.router.navigate(['/clienteInicio']);
        console.log('¿Navegó a clienteInicio?', navego);
      }
      if(this.perfil() === 'metre'){
        this.router.navigate(['/metreInicio']);
      }
      if(this.perfil() === 'duenio'){
        this.router.navigate(['/duenioInicio']);
      }
      if(this.perfil() === 'supervisor'){
        this.router.navigate(['/supervisorInicio']);
      }
    }
  }
}
