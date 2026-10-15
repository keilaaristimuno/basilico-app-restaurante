import { Component, OnInit, signal } from '@angular/core';
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
export class InicioComponent implements OnInit {
  // Bandera estática para que la animación solo ocurra al abrir la app, no cada vez que se vuelve a inicio
  private static animacionRealizada = false;

  // Signals: la app es zoneless, por lo que los setTimeout no disparan change detection con variables comunes
  mostrarAnimacion = signal(false);
  animacionActiva = signal(false);
  desvanecerAnimacion = signal(false);

  constructor(
    private supabase: Supabase,
    private pushNotifications: PushNotificationsService,
    private router: Router
  ) { }

  ngOnInit() {
    if (!InicioComponent.animacionRealizada) {
      InicioComponent.animacionRealizada = true;
      this.mostrarAnimacion.set(true);

      // 1.65s: inicia la animación del logo y entrada desde la izquierda
      setTimeout(() => this.animacionActiva.set(true), 1650);

      // 5.6s: se desvanece suavemente la capa de presentación
      setTimeout(() => this.desvanecerAnimacion.set(true), 5600);

      // 6.1s: se destruye la capa del DOM y se revelan los botones de inicio
      setTimeout(() => this.mostrarAnimacion.set(false), 6100);
    } else {
      // Si ya se mostró antes (ej. volvió de login), muestra directamente los botones
      this.mostrarAnimacion.set(false);
    }
  }

  async entrarComoInvitado() {
    await this.pushNotifications.desasociarToken();
    await this.supabase.cerrarSesion();
    await this.pushNotifications.inicializar();
    await this.router.navigate(['/carta']);
  }
}
