import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { PantallaCargaComponent } from './components/pantalla-carga/pantalla-carga.component';
import { PushNotificationsService } from './services/push-notifications.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, PantallaCargaComponent],
})
export class AppComponent {
  constructor(pushNotifications: PushNotificationsService) {
    void pushNotifications.inicializar();
  }
}
