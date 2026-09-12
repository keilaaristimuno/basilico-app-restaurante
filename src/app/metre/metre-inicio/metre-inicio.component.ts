import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText, IonCard, IonCardHeader, IonCardTitle, IonCardContent
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../navbar/navbar.component';

@Component({
  selector: 'app-metre-inicio',
  standalone: true,
  templateUrl: './metre-inicio.component.html',
  styleUrls: ['./metre-inicio.component.scss'],
  imports: [IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonButton, RouterLink, NavbarComponent, IonList, IonItem, IonInput, IonText],
})
export class MetreInicioComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
