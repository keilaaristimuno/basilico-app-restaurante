import { Component, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton
} from '@ionic/angular';

import { Supabase } from '../../services/supabase';
import { Carga } from '../../services/carga';
import { VibracionService } from '../../services/vibracion';
import { Producto } from '../../interfaces/producto';

@Component({
  selector: 'app-carta',
  templateUrl: './carta.page.html',
  styleUrls: ['./carta.page.scss'],
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton
  ]
})
export class CartaPage {

  @ViewChild(IonContent) ionContent?: IonContent;

  productos: Producto[] = [];

  get platos(): Producto[] {
    return this.productos.filter(producto => producto.tipo === 'plato');
  }

  get bebidas(): Producto[] {
    return this.productos.filter(producto => producto.tipo === 'bebida');
  }

  constructor(
    private supabase: Supabase,
    private vibracion: VibracionService,
    public carga: Carga,
    private cdr: ChangeDetectorRef
  ) {}

  async ionViewWillEnter() {
    await this.cargarProductos();
  }

  async cargarProductos() {
    try {
      this.productos = await this.carga.ejecutar(
        'Cargando carta...',
        () => this.supabase.obtenerProductos()
      );

      // Fuerza a Angular a refrescar el HTML
      this.cdr.detectChanges();

    } catch (error) {
      await this.vibracion.errorFuerte();
      console.error(
        'Error al cargar la carta:',
        error
      );
    }
  }

  indiceFoto: Record<string, number> = {};

  fotosVerticales: Record<string, boolean> = {};

  descripcionExpandida: Record<string, boolean> = {};

  /**
   * Detecta la orientación natural de la imagen al cargarse en el DOM.
   * Si naturalHeight > naturalWidth se marca como vertical para aplicar object-fit: contain.
   */
  detectarOrientacion(event: Event, urlFoto?: string): void {
    const img = event.target as HTMLImageElement;
    if (img && img.naturalHeight && img.naturalWidth) {
      const esVertical = img.naturalHeight > img.naturalWidth;
      if (urlFoto) {
        this.fotosVerticales[urlFoto] = esVertical;
      }
      if (esVertical) {
        img.classList.add('imagen-vertical');
      } else {
        img.classList.remove('imagen-vertical');
      }
    }
  }

  /**
   * Realiza un desplazamiento suave hacia la sección solicitada dentro del ion-content.
   */
  async scrollASeccion(idSeccion: string): Promise<void> {
    const elemento = document.getElementById(idSeccion);
    if (!elemento) {
      return;
    }

    if (this.ionContent) {
      try {
        const scrollEl = await this.ionContent.getScrollElement();
        const elementoRect = elemento.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();
        const destinoY = elementoRect.top - scrollRect.top + scrollEl.scrollTop;
        const posicionFinal = Math.max(0, destinoY - 12);

        await this.ionContent.scrollToPoint(0, posicionFinal, 450);
        return;
      } catch {
        // Fallback suave en caso de que scrollToPoint no responda
      }
    }

    elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  alternarDescripcion(producto: Producto): void {
    this.descripcionExpandida[producto.id] = !this.descripcionExpandida[producto.id];
  }
  
  /* ======================
          CARROSUEL
  ========================= */
  anteriorFoto(producto: Producto): void {

    const indiceActual =
      this.indiceFoto[producto.id] ?? 0;

    if (indiceActual === 0) {

      this.indiceFoto[producto.id] =
        producto.fotos.length - 1;

    } else {

      this.indiceFoto[producto.id] =
        indiceActual - 1;

    }
  }

  siguienteFoto(producto: Producto): void {

    const indiceActual =
      this.indiceFoto[producto.id] ?? 0;

    if (
      indiceActual ===
      producto.fotos.length - 1
    ) {

      this.indiceFoto[producto.id] = 0;

    } else {

      this.indiceFoto[producto.id] =
        indiceActual + 1;
    }
  }

  irAFoto(
    producto: Producto,
    indice: number
  ): void {
    this.indiceFoto[producto.id] = indice;
  }

  formatearPrecio(
    precio: number
  ): string {

    return new Intl.NumberFormat(
      'es-AR'
    ).format(precio);

  }
}