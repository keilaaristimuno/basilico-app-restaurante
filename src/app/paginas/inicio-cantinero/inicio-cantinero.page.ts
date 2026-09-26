import { Component } from '@angular/core';
import {
  IonContent,
  IonCard,
  IonCardContent,
  IonIcon,
  IonHeader
} from '@ionic/angular';

import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';

import { addIcons } from 'ionicons';
import {
  wineOutline,
  bookOutline,
  receiptOutline
} from 'ionicons/icons';

@Component({
  selector: 'app-inicio-cantinero',
  templateUrl: './inicio-cantinero.page.html',
  styleUrls: ['./inicio-cantinero.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonCard,
    IonCardContent,
    IonIcon,
    IonHeader,
    RouterLink,
    NavbarComponent
  ]
})
export class InicioCantineroPage {

  constructor() {
    addIcons({
      wineOutline,
      bookOutline,
      receiptOutline
    });
  }

}
