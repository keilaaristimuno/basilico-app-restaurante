import { Component, OnInit, AfterViewInit } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { PantallaCargaComponent } from './components/pantalla-carga/pantalla-carga.component';
import { PushNotificationsService } from './services/push-notifications.service';
import { SplashScreen } from '@capacitor/splash-screen';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, PantallaCargaComponent],
})
export class AppComponent implements OnInit, AfterViewInit {
  constructor(private pushNotifications: PushNotificationsService) {}

  async ngOnInit() {
    await this.pushNotifications.inicializar();
  }

  async ngAfterViewInit() {
    try {
      await SplashScreen.hide({ fadeOutDuration: 250 });
    } catch {
      // Ignored in browser
    }
  }
}
