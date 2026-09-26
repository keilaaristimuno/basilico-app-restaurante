import { Component, ChangeDetectorRef } from '@angular/core';
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

  descripcionExpandida: Record<string, boolean> = {};

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