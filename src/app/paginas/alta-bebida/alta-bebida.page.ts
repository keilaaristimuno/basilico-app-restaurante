import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { IonContent, IonHeader, IonTitle, IonToolbar, IonList, IonInput, IonButton, IonItem, IonNote, IonSpinner, IonButtons, IonBackButton} from '@ionic/angular';
import { Supabase } from '../../services/supabase';
import { VibracionService } from '../../services/vibracion';
import { Carga } from '../../services/carga';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-alta-bebida',
  templateUrl: './alta-bebida.page.html',
  styleUrls: ['./alta-bebida.page.scss'],
  imports: [IonContent, IonInput, IonButton,IonItem, IonNote, IonSpinner, CommonModule, FormsModule,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    RouterLink
   ]
})
export class AltaBebidaPage implements OnInit {
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
  errorBebidaExistente: boolean = false;
  mensajeExito: boolean = false;

  constructor(
    private cdr: ChangeDetectorRef, 
    private supabase: Supabase,
    private vibracion: VibracionService,
    public carga: Carga
  ) {}

  ngOnInit() {
  }

  async altaBebida() {
//validación de campos
    this.errorNombre = this.nombre.trim().length < 3;
    this.errorDescripcion = this.descripcion.trim().length < 10;
    this.errorTiempoElaboracion = this.tiempoElaboracion === null || this.tiempoElaboracion <= 0;
    this.errorPrecio = this.precio === null || this.precio <= 0;
    // Verifica si alguna foto está vacía:
    this.errorFotos = this.fotos.some(foto => foto === ''); 

    //SI HAY ERRORES, NO CONTINUA
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

    try{
    // Verificar si el plato ya existe antes de intentar guardarlo
    const existePlato = await this.carga.ejecutar(
      'Verificando bebida...',
      () => this.supabase.bebidaExiste(
      this.nombre
      )
    );
    
    if (existePlato) {
      this.errorBebidaExistente = true;
      // Forzamos actualización visual
      this.cdr.detectChanges();

      await this.vibracion.errorFuerte();
      return;
    }
    this.errorBebidaExistente = false; // Resetear el error si el plato no existe
    
      //OPERACION QUE REQUIERE ESPERA
        await this.carga.ejecutar(
          'Guardando bebida...',
          async () => {

            const urls = await this.subirFotos();

            await this.supabase.guardarBebida(
              this.nombre,
              this.descripcion,
              this.tiempoElaboracion!, //el ! avisa a ts que ya valido que NO es null:
              this.precio!,
              urls
            );
          }
        );

    //EXITOOOO

      this.mensajeExito = true;
      this.cdr.detectChanges();

      setTimeout(() => {
        this.mensajeExito = false;
        this.cdr.detectChanges(); // Forzar la detección de cambios para actualizar la vista
      }, 3000);

      //LIMPIA FORMULARIO
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
      this.errorBebidaExistente = false;

    } catch (error) {
      await this.vibracion.errorFuerte();
      console.error('Error al guardar la bebida:', error);
    };
  }

  limpiarErrorBebidaExistente(): void {
    if (this.errorBebidaExistente) {
      this.errorBebidaExistente = false;
    }

  }

  // Función para seleccionar una foto usando la cámara o la galería
  seleccionarFoto(indice: number) {
    Camera.getPhoto({
      quality: 90,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Prompt,
      webUseInput: true
    })
    .then((image) => {
      // Procesar la imagen seleccionada
      this.fotos[indice] = image.webPath ?? '';  
      this.cdr.detectChanges(); // Forzar la detección de cambios para actualizar la vista
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
    const nombreArchivo = `bebidas/${idFotos}-${i}.jpg`;
    const resultado = await this.supabase.subirFotoProducto(
      this.fotos[i],
      nombreArchivo
    );

    const url = this.supabase.obtenerUrlFotoProducto(resultado.path);
    this.urlsFotos.push(url);
  }
  return this.urlsFotos;
}

}
