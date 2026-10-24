import { Component, OnInit, inject, signal, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonIcon,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  trophyOutline,
  refreshOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  arrowUpOutline,
  arrowDownOutline,
  sparklesOutline,
  playCircleOutline,
  heart,
  heartOutline,
  restaurantOutline
} from 'ionicons/icons';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { JuegosService, ResultadoIntentoJuego } from '../../../services/juegos.service';
import { Supabase } from '../../../services/supabase';
import { VibracionService } from '../../../services/vibracion';

export interface CartaCulinaria {
  valor: number;
  nombre: string;
  subtitulo: string;
  icono: string;
  categoria: 'Bebida' | 'Entrada' | 'Pasta' | 'Plato Fuerte' | 'Postre';
}

@Component({
  selector: 'app-mayor-menor',
  templateUrl: './mayor-menor.component.html',
  styleUrls: ['./mayor-menor.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    IonContent,
    IonButton,
    IonIcon
  ]
})
export class MayorMenorComponent implements OnInit {
  public juegosService = inject(JuegosService);
  private supabase = inject(Supabase);
  private vibracion = inject(VibracionService);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);

  readonly DESCUENTO_JUEGO = 15;
  readonly JUEGO_ID = 'mayor-menor';
  readonly ACIERTOS_PARA_GANAR = 4;
  readonly VIDAS_INICIALES = 2;

  // Baraja temática de cocina italiana Basílico (Valores del 1 al 12)
  readonly MAZO_CARTAS: CartaCulinaria[] = [
    { valor: 1, nombre: 'Espresso Ristretto', subtitulo: 'Intensidad Pura', icono: '☕', categoria: 'Bebida' },
    { valor: 2, nombre: 'Crostini di Basilico', subtitulo: 'Pan Tostado & Albahaca', icono: '🥖', categoria: 'Entrada' },
    { valor: 3, nombre: 'Bruschetta Pomodoro', subtitulo: 'Tomates Frescos & Ajo', icono: '🍅', categoria: 'Entrada' },
    { valor: 4, nombre: 'Ravioli di Ricotta', subtitulo: 'Relleno Cremoso', icono: '🥟', categoria: 'Pasta' },
    { valor: 5, nombre: 'Pizza Margherita', subtitulo: 'Muzzarella & Albahaca', icono: '🍕', categoria: 'Plato Fuerte' },
    { valor: 6, nombre: 'Risotto ai Funghi', subtitulo: 'Hongos Porcini Silvestres', icono: '🍲', categoria: 'Plato Fuerte' },
    { valor: 7, nombre: 'Lasagna Bolognese', subtitulo: 'Capas de Tradición', icono: '🧀', categoria: 'Pasta' },
    { valor: 8, nombre: 'Calzone Farcito', subtitulo: 'Relleno Tradicional', icono: '🥟', categoria: 'Plato Fuerte' },
    { valor: 9, nombre: 'Tiramisú Veneziano', subtitulo: 'Mascarpone & Cacao', icono: '🍰', categoria: 'Postre' },
    { valor: 10, nombre: 'Bife alla Griglia', subtitulo: 'Corte Especial a las Brasas', icono: '🥩', categoria: 'Plato Fuerte' },
    { valor: 11, nombre: 'Vino Chianti Riserva', subtitulo: 'Cosecha Selección de la Casa', icono: '🍷', categoria: 'Bebida' },
    { valor: 12, nombre: 'Banquete della Nonna', subtitulo: 'La Experiencia Completa', icono: '👑', categoria: 'Plato Fuerte' }
  ];

  // Estado del juego
  cartaActual = signal<CartaCulinaria>(this.MAZO_CARTAS[4]);
  cartaSiguiente = signal<CartaCulinaria | null>(null);
  aciertos = signal<number>(0);
  vidas = signal<number>(this.VIDAS_INICIALES);
  revelando = signal<boolean>(false);
  estadoJuego = signal<'jugando' | 'ganado' | 'perdido'>('jugando');
  resultadoPromo = signal<ResultadoIntentoJuego | null>(null);
  puedeGanarDescuento = signal<boolean>(false);

  // Mazo mezclado de la partida
  private mazoPartida: CartaCulinaria[] = [];

  constructor() {
    addIcons({
      trophyOutline,
      refreshOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      arrowUpOutline,
      arrowDownOutline,
      sparklesOutline,
      playCircleOutline,
      heart,
      heartOutline,
      restaurantOutline
    });
  }

  ngOnInit() {
    this.verificarReglasDescuento();
    this.iniciarPartida();
  }

  ionViewWillEnter() {
    this.verificarReglasDescuento();
  }

  verificarReglasDescuento() {
    this.puedeGanarDescuento.set(
      this.juegosService.puedeObtenerDescuentoEn(this.JUEGO_ID)
    );
  }

  iniciarPartida() {
    // Mezcla aleatoria de la baraja
    this.mazoPartida = [...this.MAZO_CARTAS].sort(() => Math.random() - 0.5);

    // Toma la primera carta para iniciar
    const primera = this.mazoPartida.pop() || this.MAZO_CARTAS[0];
    this.cartaActual.set(primera);
    this.cartaSiguiente.set(null);
    this.aciertos.set(0);
    this.vidas.set(this.VIDAS_INICIALES);
    this.revelando.set(false);
    this.estadoJuego.set('jugando');
    this.resultadoPromo.set(null);
  }

  async adivinar(eleccion: 'mayor' | 'menor') {
    if (this.estadoJuego() !== 'jugando' || this.revelando()) {
      return;
    }

    if (this.mazoPartida.length === 0) {
      // Si se agota el mazo, regenera y mezcla evitando la carta actual
      this.mazoPartida = this.MAZO_CARTAS.filter(c => c.valor !== this.cartaActual().valor).sort(() => Math.random() - 0.5);
    }

    // Extrae la siguiente carta asegurando que no sea de igual valor exacto para evitar empates ambiguos
    let proxima = this.mazoPartida.pop()!;
    if (proxima.valor === this.cartaActual().valor) {
      // Si coincidió el número, buscamos otra diferente
      const opciones = this.MAZO_CARTAS.filter(c => c.valor !== this.cartaActual().valor);
      proxima = opciones[Math.floor(Math.random() * opciones.length)];
    }

    this.revelando.set(true);
    this.cartaSiguiente.set(proxima);

    const valorActual = this.cartaActual().valor;
    const nuevoValor = proxima.valor;

    const acerto = (eleccion === 'mayor' && nuevoValor > valorActual) ||
                   (eleccion === 'menor' && nuevoValor < valorActual);

    // Breve pausa para la animación de revelado de carta
    setTimeout(async () => {
      if (acerto) {
        await this.vibracion.toque();
        const nuevosAciertos = this.aciertos() + 1;
        this.aciertos.set(nuevosAciertos);

        if (nuevosAciertos >= this.ACIERTOS_PARA_GANAR) {
          await this.finalizarPartida(true);
          return;
        } else {
          await this.mostrarToast(
            `¡Correcto! ${proxima.nombre} (${proxima.valor}) es ${eleccion.toUpperCase()} que ${valorActual}.`,
            'success'
          );
        }
      } else {
        await this.vibracion.error();
        const nuevasVidas = Math.max(0, this.vidas() - 1);
        this.vidas.set(nuevasVidas);

        if (nuevasVidas === 0) {
          await this.finalizarPartida(false);
          return;
        } else {
          await this.mostrarToast(
            `¡No era ${eleccion}! Salió ${proxima.nombre} (${proxima.valor}). Te queda ${nuevasVidas} vida.`,
            'warning'
          );
        }
      }

      // La carta siguiente pasa a ser la carta actual para el próximo turno
      this.cartaActual.set(proxima);
      this.cartaSiguiente.set(null);
      this.revelando.set(false);
    }, 700);
  }

  private async finalizarPartida(gano: boolean) {
    this.revelando.set(false);
    this.estadoJuego.set(gano ? 'ganado' : 'perdido');

    // Registra el intento y descuento en JuegosService (Reglas UTN)
    const resultado = this.juegosService.registrarResultado(
      this.JUEGO_ID,
      gano,
      this.DESCUENTO_JUEGO
    );
    this.resultadoPromo.set(resultado);
    this.verificarReglasDescuento();

    // Persiste en Supabase
    try {
      await this.supabase.guardarResultadoJuego(
        this.JUEGO_ID,
        resultado.exito,
        resultado.exito ? this.DESCUENTO_JUEGO : null
      );
    } catch (e) {
      console.warn('No se pudo guardar partida de Mayor o Menor en Supabase:', e);
    }

    if (gano) {
      await this.vibracion.toque();
      await this.mostrarToast(
        resultado.exito
          ? `¡FELICITACIONES! Ganaste ${this.DESCUENTO_JUEGO}% de descuento en tu cuenta.`
          : '¡Excelente juego! Lograste todos los aciertos.',
        'success'
      );
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast(
        'Te quedaste sin vidas. ¡Podés volver a intentarlo por diversión!',
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
      duration: 2800,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
