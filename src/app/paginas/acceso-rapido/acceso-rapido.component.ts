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

  seleccionarPerfil(mail: string, clave: string) {
    this.router.navigate(['/login'], {
      queryParams: { mail, clave },
      state: { mail, clave }
    });
  }

  ingresar(mail: string, clave: string) {   
    this.seleccionarPerfil(mail, clave);
  }
}
