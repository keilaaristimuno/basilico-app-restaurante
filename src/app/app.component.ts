import { Component, OnInit } from '@angular/core';
import { IonApp, IonRouterOutlet, Platform } from '@ionic/angular';
import { Router } from '@angular/router';
import { PantallaCargaComponent } from './components/pantalla-carga/pantalla-carga.component';
import { PushNotificationsService } from './services/push-notifications.service';
import { App } from '@capacitor/app';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  imports: [IonApp, IonRouterOutlet, PantallaCargaComponent],
})
export class AppComponent implements OnInit {
  constructor(
    private pushNotifications: PushNotificationsService,
    private platform: Platform,
    private router: Router
  ) {}

  async ngOnInit() {
    this.configurarBotonAtrasAndroid();
    void this.pushNotifications.inicializar();
  }

  private configurarBotonAtrasAndroid() {
    this.platform.backButton.subscribeWithPriority(9999, (processNextHandler) => {
      const rutaActual = this.router.url.split('?')[0];

      // Pantallas principales de rol autenticado
      const pantallasPrincipalesLogueado = [
        '/clienteInicio',
        '/duenioInicio',
        '/metreInicio',
        '/mozoInicio',
        '/inicio-cocinero',
        '/inicio-cantinero'
      ];

      // Pantallas públicas
      const pantallasPublicas = ['/inicio', '/login'];

      // En el dashboard del rol autenticado, no permite volver a login ni a inicio.
      // Minimiza la aplicación (comportamiento estándar de Android).
      if (pantallasPrincipalesLogueado.includes(rutaActual)) {
        void App.minimizeApp();
        return;
      }

      // En login o inicio público, minimiza la aplicación
      if (pantallasPublicas.includes(rutaActual)) {
        void App.minimizeApp();
        return;
      }

      // En subpáginas (ej. alta-mesa, carta, juegos): permite navegar hacia atrás
      processNextHandler();
    });
  }
}
