import { Component, OnInit } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText
} from '@ionic/angular';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  standalone: true,
  styleUrls: ['./inicio.component.scss'],
  imports: [ IonContent, IonGrid, IonRow, IonCol, IonButton, RouterLink ],
})
export class InicioComponent  implements OnInit {

  constructor() { }

  ngOnInit() {}

}
