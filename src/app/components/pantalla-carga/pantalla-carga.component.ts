import { Component } from '@angular/core';
import { IonSpinner } from '@ionic/angular';

import { Carga } from '../../services/carga';

@Component({
  selector: 'app-pantalla-carga',
  templateUrl: './pantalla-carga.component.html',
  styleUrls: ['./pantalla-carga.component.scss'],
  imports: [
    IonSpinner
  ]
})
export class PantallaCargaComponent {

  constructor(
    public carga: Carga
  ) {}

}