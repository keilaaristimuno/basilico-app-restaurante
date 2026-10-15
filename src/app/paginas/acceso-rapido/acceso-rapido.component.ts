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
import { PushNotificationsService } from '../../services/push-notifications.service';

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

  constructor(
    private supabase: Supabase,
    private router: Router,
    private pushNotifications: PushNotificationsService
  ) { }

  private async inicializarNotificaciones() {
    try {
      await this.pushNotifications.inicializar();
      await this.pushNotifications.asociarTokenDelUsuarioActual();
    } catch (error) {
      console.warn('No se pudieron inicializar las notificaciones:', error);
    }
  }

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

        await this.inicializarNotificaciones();

        await this.router.navigate(['/clienteInicio'], { replaceUrl: true });
        return;
      }

      await this.inicializarNotificaciones();

      /* OBTIENE EL PERFIL */
      const dataUsuarioLogueado =  await this.supabase.obtenerPerfilUsuarioLogueado();
      console.log('nombre del usuario:', dataUsuarioLogueado?.nombres);
      if(dataUsuarioLogueado){
        localStorage.setItem('nombre', dataUsuarioLogueado?.nombres);
        localStorage.setItem('perfil', dataUsuarioLogueado?.perfil);
        this.perfil.set(dataUsuarioLogueado?.perfil);
      }

      const navOptions = { replaceUrl: true };
      if(this.perfil() === 'cocinero'){
        await this.router.navigate(['/inicio-cocinero'], navOptions);
      }
      if(this.perfil() === 'cantinero'){
        await this.router.navigate(['/inicio-cantinero'], navOptions);
      }
      if(this.perfil() === 'mozo'){
        await this.router.navigate(['/mozoInicio'], navOptions);
      }
      if(this.perfil() === 'cliente'){
        await this.router.navigate(['/clienteInicio'], navOptions);
      }
      if(this.perfil() === 'metre'){
        await this.router.navigate(['/metreInicio'], navOptions);
      }
      if(this.perfil() === 'duenio'){
        await this.router.navigate(['/duenioInicio'], navOptions);
      }
      if(this.perfil() === 'supervisor'){
        await this.router.navigate(['/duenioInicio'], navOptions);
      }
    }
  }
}
