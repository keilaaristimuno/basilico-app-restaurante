import { Component, Input, OnInit } from '@angular/core';
import { IonTabBar, IonTabButton, IonLabel} from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { PushNotificationsService } from '../../services/push-notifications.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  imports: [RouterLink, IonTabBar, IonTabButton,IonLabel],
})
export class NavbarComponent implements OnInit {

  @Input() rutaInicio: string = '/';

  nombre: string | null = null;
  constructor(
    private supabase: Supabase, 
    private router: Router,
    private pushNotifications: PushNotificationsService
  ) { }
  
  ngOnInit(){
    this.nombre = localStorage.getItem('nombre')?.toUpperCase() || null;
  }

  /* Cerrar sesion  */
  async cerrarSesion() {
    try {
      await this.pushNotifications.desasociarToken();
    } catch (err) {
      console.warn('Error al desasociar token:', err);
    }

    const { error } = await this.supabase.cerrarSesion();

    if (error) {
      console.error('Error al cerrar sesión:', error.message);
      return;
    }
    const fcmToken = localStorage.getItem('fcm_device_token');
    localStorage.clear();
    if (fcmToken) {
      localStorage.setItem('fcm_device_token', fcmToken);
    }

    await this.router.navigate(['/login'], {
      replaceUrl: true
    });

  }
}
