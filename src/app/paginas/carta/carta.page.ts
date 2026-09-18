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
import { Plato } from '../../interfaces/plato';

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

  platos: Plato[] = [];

  constructor(
    private supabase: Supabase,
    private vibracion: VibracionService,
    public carga: Carga,
    private cdr: ChangeDetectorRef
  ) {}

  async ionViewWillEnter() {
    console.log('Entrando a Carta');
    await this.cargarPlatos();
  }

  async cargarPlatos() {
    try {
      this.platos = await this.carga.ejecutar(
        'Cargando carta...',
        () => this.supabase.obtenerPlatos()
      );

      console.log(
        'Platos obtenidos:',
        this.platos
      );

      console.log(
        'Cantidad de platos:',
        this.platos.length
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
  /* ======================
          CARROSUEL
  ========================= */
  anteriorFoto(plato: Plato): void {

    const indiceActual =
      this.indiceFoto[plato.id] ?? 0;

    if (indiceActual === 0) {

      this.indiceFoto[plato.id] =
        plato.fotos.length - 1;

    } else {

      this.indiceFoto[plato.id] =
        indiceActual - 1;

    }
  }

  siguienteFoto(plato: Plato): void {

    const indiceActual =
      this.indiceFoto[plato.id] ?? 0;

    if (
      indiceActual ===
      plato.fotos.length - 1
    ) {

      this.indiceFoto[plato.id] = 0;

    } else {

      this.indiceFoto[plato.id] =
        indiceActual + 1;
    }
  }

  irAFoto(
    plato: Plato,
    indice: number
  ): void {
    this.indiceFoto[plato.id] = indice;
  }

  formatearPrecio(
    precio: number
  ): string {

    return new Intl.NumberFormat(
      'es-AR'
    ).format(precio);

  }
}