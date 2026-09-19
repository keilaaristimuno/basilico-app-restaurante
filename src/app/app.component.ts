import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular';
import { PantallaCargaComponent } from './components/pantalla-carga/pantalla-carga.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, PantallaCargaComponent],
})
export class AppComponent {
  constructor() {}
}
