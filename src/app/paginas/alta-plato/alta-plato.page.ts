import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonInput, IonButton, IonItem } from '@ionic/angular';

@Component({
  selector: 'app-alta-plato',
  templateUrl: './alta-plato.page.html',
  styleUrls: ['./alta-plato.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonInput, IonButton,IonItem,CommonModule, FormsModule]
})
export class AltaPlatoPage implements OnInit {
  nombre:string = '';
  descripcion:string = '';
  tiempoElaboracion:number = 0;
  precio:number = 0;

  constructor() { }

  ngOnInit() {
  }

  altaPlato() {
    console.log('Nombre del plato:', this.nombre);
    console.log('Descripción del plato:', this.descripcion);
    console.log('Tiempo de elaboración:', this.tiempoElaboracion);
    console.log('Precio del plato:', this.precio);
  }
}
