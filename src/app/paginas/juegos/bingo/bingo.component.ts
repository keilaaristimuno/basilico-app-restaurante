import { Component, OnInit, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonSpinner,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  trophyOutline,
  refreshOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  arrowBackOutline,
  sparklesOutline,
  ribbonOutline,
  playCircleOutline,
  alertCircleOutline,
  timeOutline,
  starOutline
} from 'ionicons/icons';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { JuegosService, ResultadoIntentoJuego } from '../../../services/juegos.service';
import { Supabase } from '../../../services/supabase';
import { VibracionService } from '../../../services/vibracion';

@Component({
  selector: 'app-bingo',
  templateUrl: './bingo.component.html',
  styleUrls: ['./bingo.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    IonContent,
    IonButton,
    IonIcon,
    IonSpinner
  ]
})
export class BingoComponent implements OnInit {
  public juegosService = inject(JuegosService);
  private supabase = inject(Supabase);
  private vibracion = inject(VibracionService);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);

  // Porcentaje de descuento asignado a este juego (1 de los 3 juegos)
  readonly DESCUENTO_JUEGO = 10;
  readonly JUEGO_ID = 'bingo';

  // Reglas de promoción
  puedeGanarDescuento: WritableSignal<boolean> = signal(false);

  // Estado del juego
  chances: WritableSignal<number> = signal(15);
  numeroActual: WritableSignal<number> = signal(0);
  cartonActual: WritableSignal<number[]> = signal([]);
  numerosAcertados: WritableSignal<number[]> = signal([]);
  ultimasBolillas: WritableSignal<number[]> = signal([]);
  girandoBolillero: WritableSignal<boolean> = signal(false);

  // Estado: 'jugando' | 'ganado' | 'perdido'
  estadoJuego: WritableSignal<'jugando' | 'ganado' | 'perdido'> = signal('jugando');
  resultadoPromo: WritableSignal<ResultadoIntentoJuego | null> = signal(null);

  // Bolillero
  private numerosBolillero: number[] = [];
  private bolillasExtraidas: number[] = [];

  // Cartones predefinidos del restaurante Basílico
  private cartonesPreset: number[][] = [
    [1, 12, 20, 22, 30],
    [3, 9, 15, 20, 28],
    [5, 7, 12, 19, 22],
    [9, 14, 16, 23, 26],
    [2, 5, 17, 21, 29],
    [4, 11, 18, 24, 27],
    [6, 10, 13, 25, 30]
  ];

  constructor() {
    addIcons({
      trophyOutline,
      refreshOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      arrowBackOutline,
      sparklesOutline,
      ribbonOutline,
      playCircleOutline,
      alertCircleOutline,
      timeOutline,
      starOutline
    });
  }

  ngOnInit() {
    this.verificarReglasDescuento();
    this.iniciarJuego();
  }

  ionViewWillEnter() {
    this.verificarReglasDescuento();
  }

  verificarReglasDescuento() {
    this.puedeGanarDescuento.set(
      this.juegosService.puedeObtenerDescuentoEn(this.JUEGO_ID)
    );
  }

  iniciarJuego() {
    this.numeroActual.set(0);
    this.chances.set(15);
    this.numerosAcertados.set([]);
    this.ultimasBolillas.set([]);
    this.bolillasExtraidas = [];
    this.estadoJuego.set('jugando');
    this.girandoBolillero.set(false);
    this.resultadoPromo.set(null);

    // Bolillero con 30 números (1 a 30)
    this.numerosBolillero = Array.from({ length: 30 }, (_, i) => i + 1);

    this.cargarCarton();
  }

  cargarCarton() {
    const indice = Math.floor(Math.random() * this.cartonesPreset.length);
    this.cartonActual.set([...this.cartonesPreset[indice]]);
  }

  async cargarBolillero() {
    if (this.girandoBolillero() || this.chances() === 0 || this.estadoJuego() !== 'jugando') {
      return;
    }

    if (this.numerosBolillero.length === 0) {
      await this.evaluarFinPorChances();
      return;
    }

    this.girandoBolillero.set(true);
    await this.vibracion.toque();

    // Simula giro de bolillero
    setTimeout(async () => {
      const indice = Math.floor(Math.random() * this.numerosBolillero.length);
      const numeroSacado = this.numerosBolillero.splice(indice, 1)[0];

      this.numeroActual.set(numeroSacado);
      this.bolillasExtraidas.push(numeroSacado);
      this.ultimasBolillas.update(prev => [numeroSacado, ...prev.slice(0, 4)]);
      this.chances.update(c => Math.max(0, c - 1));
      this.girandoBolillero.set(false);

      // Si el número coincide directamente con una casilla del cartón, avisar sutilmente
      if (this.cartonActual().includes(numeroSacado) && !this.numerosAcertados().includes(numeroSacado)) {
        await this.vibracion.toque();
      }

      // Si se consumieron todas las chances, chequear si no ganó
      if (this.chances() === 0) {
        // Breve espera para que el usuario pueda marcar la última bolilla si salió en su cartón
        setTimeout(() => {
          this.evaluarFinPorChances();
        }, 1200);
      }
    }, 350);
  }

  async validarNumero(numero: number) {
    if (this.estadoJuego() !== 'jugando') {
      return;
    }

    // Ya acertado
    if (this.numerosAcertados().includes(numero)) {
      return;
    }

    // Verifica si el número ya fue extraído por el bolillero
    if (this.bolillasExtraidas.includes(numero)) {
      this.numerosAcertados.update(lista => [...lista, numero]);
      await this.vibracion.toque();

      // ¿Completó las 5 casillas del cartón? ¡BINGO!
      if (this.numerosAcertados().length === 5) {
        await this.finalizarPartida(true);
      }
    } else {
      // Número presionado que aún no salió en el bolillero
      await this.vibracion.error();
      await this.mostrarToast(
        `El número ${numero} todavía no salió en el bolillero. ¡Esperá a que salga!`,
        'warning'
      );
    }
  }

  private async evaluarFinPorChances() {
    if (this.estadoJuego() === 'jugando' && this.numerosAcertados().length < 5) {
      await this.finalizarPartida(false);
    }
  }

  private async finalizarPartida(gano: boolean) {
    if (this.estadoJuego() !== 'jugando') return;

    this.estadoJuego.set(gano ? 'ganado' : 'perdido');

    // 1. Registra el intento y descuento en JuegosService (Reglas UTN)
    const resultado = this.juegosService.registrarResultado(
      this.JUEGO_ID,
      gano,
      this.DESCUENTO_JUEGO
    );
    this.resultadoPromo.set(resultado);
    this.verificarReglasDescuento();

    // 2. Persiste en la tabla juegos_resultados de Supabase según el schema exacto
    try {
      await this.supabase.guardarResultadoJuego(
        this.JUEGO_ID,
        resultado.exito,
        resultado.exito ? this.DESCUENTO_JUEGO : null
      );
    } catch (e) {
      console.warn('No se pudo guardar partida de Bingo en Supabase:', e);
    }

    // 3. Feedback háptico y Toast
    if (gano) {
      await this.vibracion.toque();
      await this.mostrarToast(
        resultado.exito
          ? `¡BINGO BASÍLICO! Ganaste ${this.DESCUENTO_JUEGO}% de descuento.`
          : '¡BINGO! Completaste el cartón con éxito.',
        'success'
      );
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast(
        'Se agotaron las chances. ¡Mejor suerte en la próxima!',
        'danger'
      );
    }
  }

  volverAJuegos() {
    this.router.navigate(['/juegos']);
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3200,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
