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
      id: 'juego-2',
      titulo: 'Memoria del Chef',
      subtitulo: 'Parejas de Ingredientes',
      descuento: 15,
      icono: 'restaurant-outline',
      colorIcono: 'icono-terracota',
      descripcion: 'Encontrá los pares de platos e ingredientes típicos antes de que se agote el tiempo.',
      disponibleParaDescuento: true
    },
    {
      id: 'juego-3',
      titulo: 'Reflejos en la Cocina',
      subtitulo: 'Atrapá el Ingrediente',
      descuento: 20,
      icono: 'sparkles-outline',
      colorIcono: 'icono-dorado',
      descripcion: 'Poné a prueba tu velocidad atrapando los ingredientes frescos sin dejar caer ninguno.',
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
    await this.mostrarToast(
      `Seleccionaste: ${juego.titulo}. ¡Próximamente disponible para jugar!`,
      'warning'
    );
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
