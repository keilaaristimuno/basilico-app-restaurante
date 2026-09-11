import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonInput, IonButton, IonItem, IonNote } from '@ionic/angular';

@Component({
  selector: 'app-alta-plato',
  templateUrl: './alta-plato.page.html',
  styleUrls: ['./alta-plato.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonInput, IonButton,IonItem, IonNote, CommonModule, FormsModule]
})
export class AltaPlatoPage implements OnInit {
  nombre:string = '';
  descripcion:string = '';
  tiempoElaboracion:number = 0;
  precio:number = 0;
  errorNombre:boolean = false;
  errorDescripcion:boolean = false
  errorTiempoElaboracion:boolean = false;
  errorPrecio:boolean = false
  fotoSeleccionada: File | null = null;

  constructor() { }

  ngOnInit() {
  }

  altaPlato() {
//validación de campos
    this.errorNombre = this.nombre.trim().length < 3;
    this.errorDescripcion = this.descripcion.trim().length < 10;
    this.errorTiempoElaboracion = this.tiempoElaboracion <= 0;
    this.errorPrecio = this.precio <= 0;

    if(this.errorNombre || this.errorDescripcion || this.errorTiempoElaboracion || this.errorPrecio) {
      return;  
    }
    console.log('Formulario valido');
  }

  //funcion que llamara a camera para tomar la foto del plato y guardarla en la variable fotoSeleccionada
  seleccionarFoto() {
    console.log('Entré a seleccionarFoto');
    Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt
    })
    .then((image) => {
      // Procesar la imagen seleccionada
      console.log('Imagen seleccionada:', image);
    })
    .catch((error) => {
      console.error('Error al seleccionar la foto:', error);
    });
  }


}
