import { Component, OnInit } from '@angular/core';
import { IonContent, IonCard, IonCardContent, IonIcon, IonHeader } from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../../components/navbar/navbar.component';

@Component({
  selector: 'app-inicio-cocinero',
  templateUrl: './inicio-cocinero.page.html',
  styleUrls: ['./inicio-cocinero.page.scss'],
  standalone: true,
  imports: [IonContent, IonCard, IonCardContent, IonIcon, RouterLink, NavbarComponent, IonHeader]
})
export class InicioCocineroPage {

  constructor() { }

}
