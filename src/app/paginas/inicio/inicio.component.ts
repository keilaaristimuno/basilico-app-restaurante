import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText
} from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { PushNotificationsService } from '../../services/push-notifications.service';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  standalone: true,
  styleUrls: ['./inicio.component.scss'],
  imports: [ IonContent, IonGrid, IonRow, IonCol, IonButton, RouterLink ],
})
export class InicioComponent  implements OnInit {

  constructor(
    private supabase: Supabase,
    private pushNotifications: PushNotificationsService,
    private router: Router
  ) { }

  ngOnInit() {}

  async entrarComoInvitado() {
    await this.pushNotifications.desasociarToken();
    await this.supabase.cerrarSesion();
    await this.pushNotifications.inicializar();
    await this.router.navigate(['/carta']);
  }

}
