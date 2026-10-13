import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonButton,
  IonIcon,
  IonBadge,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  gameControllerOutline,
  trophyOutline,
  sparklesOutline,
  timeOutline,
  helpCircleOutline,
  restaurantOutline,
  ribbonOutline,
  playCircleOutline,
  alertCircleOutline,
  checkmarkCircleOutline,
  swapVerticalOutline,
  gridOutline
} from 'ionicons/icons';
import { NavbarComponent } from '../../components/navbar/navbar.component';
import { JuegosService, DefinicionJuego } from '../../services/juegos.service';
import { VibracionService } from '../../services/vibracion';
import { Supabase } from '../../services/supabase';

@Component({
  selector: 'app-juegos',
  templateUrl: './juegos.page.html',
  styleUrls: ['./juegos.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    NavbarComponent,
    IonContent,
    IonButton,
    IonIcon,
    IonBadge
  ]
})
export class JuegosPage implements OnInit {
  public juegosService = inject(JuegosService);
  private supabase = inject(Supabase);
  private vibracion = inject(VibracionService);
  private toastCtrl = inject(ToastController);
  private router = inject(Router);

  // Ruta a donde vuelve la navbar (por defecto al panel de cliente)
  rutaVolver = '/clienteInicio';

  // Modal o juego activo seleccionado
  juegoSeleccionado: DefinicionJuego | null = null;

  juegos: DefinicionJuego[] = [
    {
      id: 'bingo',
      titulo: 'Bingo Basílico',
      subtitulo: 'Llená tu Cartón Culinario',
      descuento: 10,
      icono: 'grid-outline',
      colorIcono: 'icono-verde',
      descripcion: 'Sacá las bolillas del bolillero y completá las 5 casillas de tu cartón antes de agotar las 15 chances.',
      disponibleParaDescuento: true
    },
    {
      id: 'mayor-menor',
      titulo: 'Mayor o Menor',
      subtitulo: 'Cartas de Cocina Italiana',
      descuento: 15,
      icono: 'swap-vertical-outline',
      colorIcono: 'icono-terracota',
      descripcion: 'Adiviná si la siguiente carta gastronómica es mayor o menor y acumulá aciertos sin perder tus vidas.',
      disponibleParaDescuento: true
    },
    {
      id: 'trivia',
      titulo: 'Trivia Culinaria',
      subtitulo: 'Sabores y Tradiciones',
      descuento: 20,
      icono: 'help-circle-outline',
      colorIcono: 'icono-dorado',
      descripcion: 'Respondé preguntas sobre recetas clásicas, orígenes y secretos de la auténtica comida italiana.',
      disponibleParaDescuento: true
    }
  ];

  constructor() {
    addIcons({
      gameControllerOutline,
      trophyOutline,
      sparklesOutline,
      timeOutline,
      helpCircleOutline,
      restaurantOutline,
      ribbonOutline,
      playCircleOutline,
      alertCircleOutline,
      checkmarkCircleOutline,
      swapVerticalOutline,
      gridOutline
    });
  }

  ngOnInit() {
    this.actualizarDisponibilidadJuegos();
  }

  ionViewWillEnter() {
    this.actualizarDisponibilidadJuegos();
  }

  actualizarDisponibilidadJuegos() {
    this.juegos.forEach(j => {
      j.disponibleParaDescuento = this.juegosService.puedeObtenerDescuentoEn(j.id);
    });
  }

  async seleccionarJuego(juego: DefinicionJuego) {
    this.juegoSeleccionado = juego;
    if (juego.id === 'bingo') {
      await this.router.navigate(['/juegos/bingo']);
      return;
    }
    if (juego.id === 'mayor-menor') {
      await this.router.navigate(['/juegos/mayor-menor']);
      return;
    }
    if (juego.id === 'trivia') {
      await this.router.navigate(['/juegos/trivia']);
      return;
    }
  }

  /**
   * Simulador de prueba para validar el sistema de descuentos en desarrollo
   * según las directrices de primer intento y no acumulación del enunciado.
   */
  async simularResultado(juego: DefinicionJuego, gano: boolean) {
    const resultado = this.juegosService.registrarResultado(juego.id, gano, juego.descuento);
    this.actualizarDisponibilidadJuegos();

    // Impactar en la base de datos Supabase igual que al jugar
    try {
      await this.supabase.guardarResultadoJuego(
        juego.id,
        resultado.exito,
        resultado.exito ? juego.descuento : null
      );
    } catch (e) {
      console.warn('Error al guardar simulación en Supabase:', e);
    }

    if (resultado.exito) {
      await this.mostrarToast(resultado.mensaje, 'success');
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast(resultado.mensaje, 'warning');
    }
  }

  async reiniciarSimulacion() {
    this.juegosService.resetearDescuentos();
    this.actualizarDisponibilidadJuegos();
    await this.mostrarToast('Descuentos e intentos reiniciados para la sesión de prueba.', 'success');
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3500,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
