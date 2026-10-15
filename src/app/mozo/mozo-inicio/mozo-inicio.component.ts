import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, IonIcon,
  IonList, IonItem, IonInput, IonButton, IonHeader,
  IonText, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonToolbar, IonTitle, IonButtons, IonBackButton
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { addIcons } from 'ionicons';
import { listOutline } from 'ionicons/icons';
@Component({
  selector: 'app-mozo-inicio',
  templateUrl: './mozo-inicio.component.html',
  styleUrls: ['./mozo-inicio.component.scss'],
  imports: [IonContent, IonCard,  IonIcon, IonHeader, IonCardHeader, IonCardTitle, IonCardContent, IonGrid, IonRow, IonCol, IonButton, RouterLink, NavbarComponent, IonList, IonItem, IonInput, IonText,
      IonToolbar, IonTitle, IonButtons, IonBackButton],
})
export class MozoInicioComponent  implements OnInit {

  constructor() { 
    addIcons({ listOutline });
  }

  ngOnInit() {}
}
