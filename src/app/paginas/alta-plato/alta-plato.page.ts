import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Haptics } from '@capacitor/haptics';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonInput, IonButton, IonItem, IonNote, IonSpinner, IonButtons, IonBackButton} from '@ionic/angular';
import { Supabase } from '../../services/supabase';
import { VibracionService } from '../../services/vibracion';

@Component({
  selector: 'app-alta-plato',
  templateUrl: './alta-plato.page.html',
  styleUrls: ['./alta-plato.page.scss'],
  imports: [IonContent, IonInput, IonButton,IonItem, IonNote, IonSpinner, CommonModule, FormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton
   ]
})
export class AltaPlatoPage implements OnInit {
  nombre:string = '';
  descripcion:string = '';
  tiempoElaboracion:number | null = null;
  precio:number | null = null;
  errorNombre:boolean = false;
  errorDescripcion:boolean = false
  errorTiempoElaboracion:boolean = false;
  errorPrecio:boolean = false
  fotos: string[] = ['', '', ''];
  errorFotos: boolean = false;
  urlsFotos: string[] =[];
  errorPlatoExistente: boolean = false;
  cargando: boolean = false;
  mensajeExito: boolean = false;

  constructor(
    private cdr: ChangeDetectorRef, 
    private supabase: Supabase,
    private vibracion: VibracionService
  ) {}

  ngOnInit() {
  }

  async altaPlato() {
//validación de campos
    this.errorNombre = this.nombre.trim().length < 3;
    this.errorDescripcion = this.descripcion.trim().length < 10;
    this.errorTiempoElaboracion = this.tiempoElaboracion === null || this.tiempoElaboracion <= 0;
    this.errorPrecio = this.precio === null || this.precio <= 0;
    // Verifica si alguna foto está vacía:
    this.errorFotos = this.fotos.some(foto => foto === ''); 

    if(this.errorNombre || 
      this.errorDescripcion || 
      this.errorTiempoElaboracion || 
      this.errorPrecio || 
      this.errorFotos
    ) {
      // Si hay algún error, se activa la vibración y se retorna sin continuar
      await this.vibracion.errorFuerte();
      return;  
    }
    // Verificar si el plato ya existe antes de intentar guardarlo
    const existePlato = await this.supabase.platoExiste(this.nombre);
    console.log('¿Existe el plato?', existePlato);
    if (existePlato) {
      this.errorPlatoExistente = true;
      await this.vibracion.errorFuerte();
      return;
    }
    this.errorPlatoExistente = false; // Resetear el error si el plato no existe
    try{
      this.cargando = true;
      this.cdr.detectChanges();

      const urls = await this.subirFotos();
      
      await this.supabase.guardarPlato(
        this.nombre,
        this.descripcion,
        /* el ! le indica a ts que ya fue comprobado que NO es null */
        this.tiempoElaboracion!,
        this.precio!,
        urls
      );
      this.mensajeExito = true;
      this.cdr.detectChanges();

      setTimeout(() => {
        this.mensajeExito = false;
        this.cdr.detectChanges(); // Forzar la detección de cambios para actualizar la vista
      }, 3000);

      this.nombre = '';
      this.descripcion = '';
      this.tiempoElaboracion = null;
      this.precio = null;
      this.fotos = ['', '', ''];
      this.urlsFotos = [];

      this.errorNombre = false;
      this.errorDescripcion = false;
      this.errorTiempoElaboracion = false;
      this.errorPrecio = false;
      this.errorFotos = false;
      this.errorPlatoExistente = false;

    } catch (error) {
      await this.vibracion.errorFuerte();
      console.error('Error al guardar el plato:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
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

}
