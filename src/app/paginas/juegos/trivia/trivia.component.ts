import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  IonContent,
  IonButton,
  IonIcon,
  IonProgressBar,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  trophyOutline,
  refreshOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  sparklesOutline,
  playCircleOutline,
  helpCircleOutline,
  restaurantOutline,
  bulbOutline,
  arrowForwardOutline
} from 'ionicons/icons';
import { NavbarComponent } from '../../../components/navbar/navbar.component';
import { JuegosService, ResultadoIntentoJuego } from '../../../services/juegos.service';
import { Supabase } from '../../../services/supabase';
import { VibracionService } from '../../../services/vibracion';

export interface PreguntaTrivia {
  id: number;
  pregunta: string;
  categoria: 'Pastas' | 'Pizzas' | 'Postres' | 'Tradición' | 'Salsas' | 'Ingredientes';
  opciones: string[];
  indiceCorrecto: number;
  curiosidad: string;
}

@Component({
  selector: 'app-trivia',
  templateUrl: './trivia.component.html',
  styleUrls: ['./trivia.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    IonContent,
    IonButton,
    IonIcon,
    IonProgressBar
  ]
})
export class TriviaComponent implements OnInit {
  public juegosService = inject(JuegosService);
  private supabase = inject(Supabase);
  private vibracion = inject(VibracionService);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);

  readonly DESCUENTO_JUEGO = 20;
  readonly JUEGO_ID = 'trivia';
  readonly TOTAL_PREGUNTAS_RONDA = 5;
  readonly ACIERTOS_MINIMOS_PARA_GANAR = 4;

  // Banco de preguntas culinarias auténticas sobre gastronomía italiana
  readonly BANCO_PREGUNTAS: PreguntaTrivia[] = [
    {
      id: 1,
      pregunta: '¿De qué región italiana es originaria la auténtica Pizza Margherita?',
      categoria: 'Pizzas',
      opciones: ['Campania (Nápoles)', 'Lazio (Roma)', 'Lombardía (Milán)', 'Toscana (Florencia)'],
      indiceCorrecto: 0,
      curiosidad: 'Fue creada en 1889 en honor a la reina Margherita con los colores de la bandera italiana.'
    },
    {
      id: 2,
      pregunta: '¿Cuál es el ingrediente protagonista del clásico Pesto Genovés además de los piñones y ajo?',
      categoria: 'Salsas',
      opciones: ['Albahaca fresca (Basílico)', 'Orégano silvestre', 'Perejil rizado', 'Romero aromático'],
      indiceCorrecto: 0,
      curiosidad: 'La albahaca de Génova (Il Basilico) posee Denominación de Origen Protegida por su aroma suave.'
    },
    {
      id: 3,
      pregunta: '¿Qué queso italiano es conocido internacionalmente como el "Rey de los Quesos"?',
      categoria: 'Ingredientes',
      opciones: ['Gorgonzola', 'Parmigiano Reggiano', 'Provolone Piccante', 'Mozzarella di Bufala'],
      indiceCorrecto: 1,
      curiosidad: 'Madura entre 12 y 36 meses y cuenta con estrictos controles artesanales.'
    },
    {
      id: 4,
      pregunta: '¿Qué ingrediente tradicional da su distintivo color dorado al Risotto alla Milanese?',
      categoria: 'Tradición',
      opciones: ['Cúrcuma molida', 'Azafrán en hebras', 'Pimentón dulce', 'Yema de huevo batida'],
      indiceCorrecto: 1,
      curiosidad: 'La leyenda dice que un maestro vidriero lo usó para imitar los vitrales de la catedral de Milán.'
    },
    {
      id: 5,
      pregunta: '¿En qué postre italiano los bizcochos savoiardi se humedecen en café y crema de mascarpone?',
      categoria: 'Postres',
      opciones: ['Panna Cotta', 'Tiramisú', 'Cannoli Siciliani', 'Zabaione'],
      indiceCorrecto: 1,
      curiosidad: 'Su nombre significa literalmente "tírame hacia arriba", en alusión a la energía del café y cacao.'
    },
    {
      id: 6,
      pregunta: '¿Cómo se elabora la auténtica salsa Carbonara tradicional de Roma?',
      categoria: 'Pastas',
      opciones: ['Yemas de huevo, guanciale y pecorino', 'Crema de leche, jamón y queso', 'Salsa de tomate con albahaca', 'Mantequilla, champiñones y ajo'],
      indiceCorrecto: 0,
      curiosidad: 'La receta clásica nunca lleva crema de leche ni cebolla; la cremosidad surge de la yema con queso.'
    },
    {
      id: 7,
      pregunta: '¿Qué variedad de grano de arroz es la preferida por los chefs para un risotto cremoso?',
      categoria: 'Tradición',
      opciones: ['Arborio o Carnaroli', 'Arroz Basmati', 'Arroz Doble Carolina', 'Arroz Jazmín'],
      indiceCorrecto: 0,
      curiosidad: 'El grano Carnaroli libera el almidón justo manteniendo su corazón "al dente".'
    },
    {
      id: 8,
      pregunta: '¿Qué dulce frito siciliano consiste en un tubo crujiente relleno de crema de ricotta?',
      categoria: 'Postres',
      opciones: ['Cannoli', 'Sfogliatella', 'Panettone', 'Bomboloni'],
      indiceCorrecto: 0,
      curiosidad: 'Nació en la ciudad de Caltanissetta y es el postre insignia de la isla de Sicilia.'
    },
    {
      id: 9,
      pregunta: '¿Qué tipo de queso fresco de pasta hilada encierra un corazón cremoso de stracciatella?',
      categoria: 'Ingredientes',
      opciones: ['Burrata', 'Ricotta', 'Mascarpone', 'Pecorino Romano'],
      indiceCorrecto: 0,
      curiosidad: 'Originario de la región de Puglia, su nombre deriva de "burro" (mantequilla en italiano).'
    },
    {
      id: 10,
      pregunta: '¿Cuál es la característica principal de la salsa Arrabbiata?',
      categoria: 'Salsas',
      opciones: ['Es picante con peperoncino y ajo', 'Lleva frutos de mar surtidos', 'Se cocina con carne de ternera molida', 'Es dulce con higos y vino tinto'],
      indiceCorrecto: 0,
      curiosidad: 'En italiano "arrabbiato" significa enojado, haciendo alusión al calor del picante en el rostro.'
    },
    {
      id: 11,
      pregunta: '¿De qué ciudad del norte de Italia proviene la clásica salsa Ragù alla Bolognese?',
      categoria: 'Pastas',
      opciones: ['Bolonia', 'Venecia', 'Turín', 'Florencia'],
      indiceCorrecto: 0,
      curiosidad: 'En Italia se sirve tradicionalmente con tagliatelle al huevo, no con espaguetis finos.'
    },
    {
      id: 12,
      pregunta: '¿Qué preparación consiste en verter un shot de café espresso caliente sobre helado de vainilla?',
      categoria: 'Postres',
      opciones: ['Affogato', 'Capuchino', 'Macchiato', 'Corretto'],
      indiceCorrecto: 0,
      curiosidad: 'Significa "ahogado", por la manera en que el helado artesanal se funde con el café recién tirado.'
    },
    {
      id: 13,
      pregunta: '¿Qué pan plano aromatizado con aceite de oliva virgen extra y romero es típico de Liguria?',
      categoria: 'Tradición',
      opciones: ['Focaccia', 'Ciabatta', 'Grissini', 'Panettone'],
      indiceCorrecto: 0,
      curiosidad: 'Los marineros ligures la consumían en sus viajes gracias a su excelente conservación.'
    },
    {
      id: 14,
      pregunta: '¿Qué licor digestivo tradicional italiano se prepara macerando cáscaras de limón?',
      categoria: 'Ingredientes',
      opciones: ['Limoncello', 'Amaretto', 'Grappa', 'Sambuca'],
      indiceCorrecto: 0,
      curiosidad: 'Los limones de la Costa Amalfitana y Sorrento son los más reconocidos para su elaboración.'
    },
    {
      id: 15,
      pregunta: '¿Qué pasta tiene forma de pequeños paquetitos cerrados con bordes dentados y relleno?',
      categoria: 'Pastas',
      opciones: ['Ravioli', 'Gnocchi', 'Penne Rigate', 'Farfalle'],
      indiceCorrecto: 0,
      curiosidad: 'Las primeras menciones históricas datan de las cartas del comerciante Francesco di Marco en el siglo XIV.'
    }
  ];

  // Estado del juego
  preguntasPartida = signal<PreguntaTrivia[]>([]);
  indicePreguntaActual = signal<number>(0);
  aciertos = signal<number>(0);
  opcionSeleccionada = signal<number | null>(null);
  respondido = signal<boolean>(false);
  estadoJuego = signal<'jugando' | 'ganado' | 'perdido'>('jugando');
  resultadoPromo = signal<ResultadoIntentoJuego | null>(null);
  puedeGanarDescuento = signal<boolean>(false);

  get preguntaActual(): PreguntaTrivia {
    const lista = this.preguntasPartida();
    return lista[this.indicePreguntaActual()] || this.BANCO_PREGUNTAS[0];
  }

  get progresoRonda(): number {
    return (this.indicePreguntaActual() + 1) / this.TOTAL_PREGUNTAS_RONDA;
  }

  constructor() {
    addIcons({
      trophyOutline,
      refreshOutline,
      checkmarkCircleOutline,
      closeCircleOutline,
      sparklesOutline,
      playCircleOutline,
      helpCircleOutline,
      restaurantOutline,
      bulbOutline,
      arrowForwardOutline
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
    // Selecciona 5 preguntas al azar sin repetición
    const barajadas = [...this.BANCO_PREGUNTAS].sort(() => Math.random() - 0.5);
    this.preguntasPartida.set(barajadas.slice(0, this.TOTAL_PREGUNTAS_RONDA));

    this.indicePreguntaActual.set(0);
    this.aciertos.set(0);
    this.opcionSeleccionada.set(null);
    this.respondido.set(false);
    this.estadoJuego.set('jugando');
    this.resultadoPromo.set(null);
  }

  async responder(indice: number) {
    if (this.respondido() || this.estadoJuego() !== 'jugando') {
      return;
    }

    this.respondido.set(true);
    this.opcionSeleccionada.set(indice);

    const esCorrecto = indice === this.preguntaActual.indiceCorrecto;

    if (esCorrecto) {
      await this.vibracion.toque();
      this.aciertos.update(a => a + 1);
    } else {
      await this.vibracion.error();
    }
  }

  async avanzarSiguientePregunta() {
    const siguienteIndice = this.indicePreguntaActual() + 1;

    if (siguienteIndice < this.TOTAL_PREGUNTAS_RONDA) {
      this.indicePreguntaActual.set(siguienteIndice);
      this.opcionSeleccionada.set(null);
      this.respondido.set(false);
    } else {
      // Fin de la ronda
      const gano = this.aciertos() >= this.ACIERTOS_MINIMOS_PARA_GANAR;
      await this.finalizarPartida(gano);
    }
  }

  private async finalizarPartida(gano: boolean) {
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
      console.warn('No se pudo guardar partida de Trivia en Supabase:', e);
    }

    if (gano) {
      await this.vibracion.toque();
      await this.mostrarToast(
        resultado.exito
          ? `¡ESPECTACULAR! Acertaste ${this.aciertos()}/${this.TOTAL_PREGUNTAS_RONDA}. Ganaste ${this.DESCUENTO_JUEGO}% de descuento.`
          : `¡Gran sabiduría culinaria! Lograste ${this.aciertos()}/${this.TOTAL_PREGUNTAS_RONDA} aciertos.`,
        'success'
      );
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast(
        `Obtuviste ${this.aciertos()}/${this.TOTAL_PREGUNTAS_RONDA} aciertos. ¡Se necesitaban ${this.ACIERTOS_MINIMOS_PARA_GANAR} para ganar!`,
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
