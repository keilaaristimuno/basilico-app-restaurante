import { Component, OnInit } from '@angular/core';
import {IonContent, IonCard, IonHeader, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonButton, IonList, IonItem, IonInput, IonText,
      IonToolbar, IonTitle, IonButtons, IonBackButton, IonIcon} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { listOutline, peopleOutline, timeOutline, restaurantOutline, gridOutline, receiptOutline, checkmarkDoneOutline, chatbubblesOutline } from 'ionicons/icons';
@Component({
  selector: 'app-inicio-duenio',
  standalone: true,
  templateUrl: './inicio-duenio.component.html',
  styleUrls: ['./inicio-duenio.component.scss'],
  imports: [RouterLink, IonIcon, NavbarComponent, IonContent, IonCard, IonCardContent, IonGrid, IonRow, IonCol, IonButton, IonList, IonItem, IonInput, IonText,
      IonToolbar, IonTitle, IonButtons, IonBackButton, IonHeader, IonCardHeader, IonCardTitle],
})
export class InicioDuenioComponent implements OnInit {

  constructor() {
    addIcons({ restaurantOutline, timeOutline, gridOutline, peopleOutline, listOutline, receiptOutline, checkmarkDoneOutline, chatbubblesOutline });
   }

  ngOnInit() {}

}
