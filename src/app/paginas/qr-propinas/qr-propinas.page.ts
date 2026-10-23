import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonContent, IonIcon } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  checkmarkCircleOutline,
  chevronBackOutline,
  chevronForwardOutline,
  happyOutline,
  removeCircleOutline,
  sadOutline,
  thumbsUpOutline
} from 'ionicons/icons';

import { NavbarComponent } from '../../components/navbar/navbar.component';
import { QrService } from '../../services/qr.service';
import { Carga } from '../../services/carga';
import { VibracionService } from '../../services/vibracion';
import { OPCIONES_PROPINA } from '../../utils/calculo-cuenta';

/**
 * Punto 21 — Presentación de los cinco códigos QR de propina (uno por pantalla,
 * en tamaño grande para que se puedan escanear desde otro dispositivo).
 */
@Component({
  selector: 'app-qr-propinas',
  standalone: true,
  templateUrl: './qr-propinas.page.html',
  styleUrls: ['./qr-propinas.page.scss'],
  imports: [CommonModule, IonContent, IonIcon, NavbarComponent]
})
export class QrPropinasPage implements OnInit {
  readonly opciones = OPCIONES_PROPINA;
  readonly indice = signal(0);
  readonly imagenes = signal<string[]>([]);
  readonly error = signal<string | null>(null);
  readonly rutaInicio = this.calcularRutaInicio();

  readonly opcionActual = computed(() => this.opciones[this.indice()]);

  constructor(
    private qrService: QrService,
    private carga: Carga,
    private vibracion: VibracionService
  ) {
    addIcons({
      checkmarkCircleOutline, chevronBackOutline, chevronForwardOutline,
      happyOutline, removeCircleOutline, sadOutline, thumbsUpOutline
    });
  }

  async ngOnInit() {
    try {
      const imagenes = await this.carga.ejecutar('Generando códigos QR...', () =>
        Promise.all(this.opciones.map((op) => this.qrService.generarQR(op.codigoQr)))
      );
      this.imagenes.set(imagenes);
    } catch (error) {
      console.error('Error al generar los QR de propina:', error);
      this.error.set('No se pudieron generar los códigos QR de propina.');
      await this.vibracion.errorFuerte();
    }
  }

  seleccionar(indice: number) {
    this.indice.set(indice);
  }

  anterior() {
    this.indice.set((this.indice() - 1 + this.opciones.length) % this.opciones.length);
  }

  siguiente() {
    this.indice.set((this.indice() + 1) % this.opciones.length);
  }

  private calcularRutaInicio(): string {
    const perfil = (localStorage.getItem('perfil') ?? '').toLowerCase();
    if (perfil === 'mozo') return '/cuentas-mozo';
    if (perfil === 'duenio' || perfil === 'supervisor') return '/duenioInicio';
    if (perfil === 'cliente') return '/cuenta';
    return '/inicio';
  }
}
