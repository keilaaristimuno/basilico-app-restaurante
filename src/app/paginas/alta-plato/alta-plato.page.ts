import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonInput, IonButton, IonItem, IonNote } from '@ionic/angular';
import { Supabase } from '../../services/supabase';

@Component({
  selector: 'app-alta-plato',
  templateUrl: './alta-plato.page.html',
  styleUrls: ['./alta-plato.page.scss'],
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonInput, IonButton,IonItem, IonNote, CommonModule, FormsModule ]
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
  fotos: string[] = ['', '', ''];
  errorFotos: boolean = false;
  urlsFotos: string[] =[];
  errorPlatoExistente: boolean = false;

  constructor(private cdr: ChangeDetectorRef, private supabase: Supabase) {}

  ngOnInit() {
  }

  async altaPlato() {
//validación de campos
    this.errorNombre = this.nombre.trim().length < 3;
    this.errorDescripcion = this.descripcion.trim().length < 10;
    this.errorTiempoElaboracion = this.tiempoElaboracion <= 0;
    this.errorPrecio = this.precio <= 0;
    this.errorFotos = this.fotos.some(foto => foto === ''); // Verifica si alguna foto está vacía

    if(this.errorNombre || 
      this.errorDescripcion || 
      this.errorTiempoElaboracion || 
      this.errorPrecio || 
      this.errorFotos
    ) {
      return;  
    }
    // Verificar si el plato ya existe antes de intentar guardarlo
    const existePlato = await this.supabase.platoExiste(this.nombre);
    console.log('¿Existe el plato?', existePlato);
    if (existePlato) {
      this.errorPlatoExistente = true;
      return;
    }
    this.errorPlatoExistente = false; // Resetear el error si el plato no existe
    try{
      const urls = await this.subirFotos();
      await this.supabase.guardarPlato(
        this.nombre,
        this.descripcion,
        this.tiempoElaboracion,
        this.precio,
        urls
      );
      console.log('Plato guardado exitosamente');
    } catch (error) {
      console.error('Error al guardar el plato:', error);
    }
  }

  // Función para seleccionar una foto usando la cámara o la galería
  seleccionarFoto(indice: number) {
    console.log('Entré a seleccionarFoto');
    Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt
    })
    .then((image) => {
      // Procesar la imagen seleccionada
      console.log('FOTO_DEBUG_INDICE:', indice);
      this.fotos[indice] = image.webPath ?? '';  
      this.cdr.detectChanges(); // Forzar la detección de cambios para actualizar la vista
      console.log('FOTO_DEBUG_RUTA:', this.fotos[indice]);
      console.log('FOTO_DEBUG_ARRAY:', this.fotos);
    })
    .catch((error) => {
      console.error('Error al seleccionar la foto:', error);
    });
  }

  // Función para subir las fotos a Supabase Storage y obtener sus URLs
  async subirFotos() {
  this.urlsFotos = [];
  const idFotos = Date.now();
  for (let i = 0; i < this.fotos.length; i++) {
    const nombreArchivo = `platos/${idFotos}-${i}.jpg`;
    const resultado = await this.supabase.subirFotoProducto(
      this.fotos[i],
      nombreArchivo
    );

    const url = this.supabase.obtenerUrlFotoProducto(resultado.path);
    this.urlsFotos.push(url);
  }
  console.log('URLs DE LAS FOTOS:', this.urlsFotos);
  return this.urlsFotos;
}

  



  // Función para subir la foto a Supabase Storage
  async probarSubidaFoto() {
  const webPath = this.fotos[0];

  if (!webPath) {
    console.log('No hay foto 1');
    return;
  }
  const nombreArchivo = `platos/${Date.now()}-0.jpg`;

  try {

    const resultado = await this.supabase.subirFotoProducto(
      webPath,
      nombreArchivo
    );
    console.log('FOTO SUBIDA:', resultado);
  } catch (error) {
    console.error('ERROR AL SUBIR:', error);
  }
}


}
