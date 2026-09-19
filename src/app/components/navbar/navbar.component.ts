import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText, IonTabBar, IonTabButton, IonLabel, IonIcon
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  imports: [IonContent, IonGrid, IonRow, IonCol, IonButton, RouterLink, IonTabBar, IonTabButton,IonLabel, IonIcon],
})
export class NavbarComponent  {
  nombre: string | null = null;
  constructor() { }
  async ngOnInit(){
    this.nombre = localStorage.getItem('nombre')?.toUpperCase() || null;
  }
}
