import { Component, OnInit } from '@angular/core';
import {IonContent, IonCard, IonHeader, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonButton, IonList, IonItem, IonInput, IonText,
      IonToolbar, IonTitle, IonButtons, IonBackButton} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
@Component({
  selector: 'app-inicio-duenio',
  standalone: true,
  templateUrl: './inicio-duenio.component.html',
  styleUrls: ['./inicio-duenio.component.scss'],
  imports: [RouterLink, NavbarComponent, IonContent, IonCard, IonCardContent, IonGrid, IonRow, IonCol, IonButton, IonList, IonItem, IonInput, IonText,
      IonToolbar, IonTitle, IonButtons, IonBackButton, IonHeader, IonCardHeader, IonCardTitle],
})
export class InicioDuenioComponent implements OnInit {

  constructor() { }

  ngOnInit() {}

}
