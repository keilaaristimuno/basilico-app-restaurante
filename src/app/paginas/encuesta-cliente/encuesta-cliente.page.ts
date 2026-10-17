import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonBackButton,
  IonButton,
  IonIcon,
  IonRange,
  IonSegment,
  IonSegmentButton,
  IonLabel,
  IonRadioGroup,
  IonRadio,
  IonSpinner,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  restaurantOutline,
  peopleOutline,
  sparklesOutline,
  heartOutline,
  checkmarkCircleOutline,
  barChartOutline,
  removeCircleOutline,
  addCircleOutline,
  star,
  starOutline,
  chevronForwardOutline,
  chevronBackOutline
} from 'ionicons/icons';

import { Supabase } from '../../services/supabase';
import { PedidoService } from '../../services/pedido.service';
import { VibracionService } from '../../services/vibracion';
import { RespuestasEncuesta } from '../../interfaces/encuesta';

@Component({
  selector: 'app-encuesta-cliente',
  standalone: true,
  templateUrl: './encuesta-cliente.page.html',
  styleUrls: ['./encuesta-cliente.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    IonContent,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonBackButton,
    IonButton,
    IonIcon,
    IonRange,
    IonSegment,
    IonSegmentButton,
    IonLabel,
    IonRadioGroup,
    IonRadio,
    IonSpinner
  ]
})
export class EncuestaClientePage implements OnInit {
  // Controla cuál de las 2 pantallas de preguntas se muestra (1: preguntas 1 y 2 | 2: preguntas 3 y 4)
  pasoActual = signal<1 | 2>(1);

  // Control 1: Slider (ion-range) -> 1 a 10
  comida = signal<number>(8);

  // Control 2: Radio Group (ion-radio-group) -> 1 a 10
  atencion = signal<number>(8);
  opcionesAtencion = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  // Control 3: Stepper interactivo (+/-) con indicador de estrellas -> 1 a 10
  ambiente = signal<number>(9);

  // Control 4: Segmento (ion-segment) -> 2 (Malo), 4 (Regular), 6 (Bueno), 8 (Muy Bueno), 10 (Excelente)
  recomienda = signal<number>(8);

  clienteId = signal<string>('');
  mesaId = signal<string | null>(null);
  cargando = signal<boolean>(true);
  enviando = signal<boolean>(false);
  yaRespondio = signal<boolean>(false);

  constructor(
    private supabase: Supabase,
    private pedidoService: PedidoService,
    private vibracion: VibracionService,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    addIcons({
      restaurantOutline,
      peopleOutline,
      sparklesOutline,
      heartOutline,
      checkmarkCircleOutline,
      barChartOutline,
      removeCircleOutline,
      addCircleOutline,
      star,
      starOutline,
      chevronForwardOutline,
      chevronBackOutline
    });
  }

  irAPaso(paso: 1 | 2) {
    this.pasoActual.set(paso);
  }

  async ngOnInit() {
    await this.inicializarDatosYVerificarEstadia();
  }

  async ionViewWillEnter() {
    await this.inicializarDatosYVerificarEstadia();
  }

  private async inicializarDatosYVerificarEstadia() {
    this.cargando.set(true);
    try {
      // 1. Identificar cliente actual
      let idCliente = '';
      const { data: { user } } = await this.supabase.clienteSupabase.auth.getUser();

      if (user?.email) {
        const cliente = await this.supabase.obtenerClientePorCorreo(user.email);
        if (cliente) {
          idCliente = cliente.id;
        }
      } else {
        const nombreGuardado = localStorage.getItem('nombre');
        if (nombreGuardado) {
          const { data: anonimo } = await this.supabase.clienteSupabase
            .from('clientes')
            .select('id')
            .ilike('nombres', nombreGuardado)
            .order('created_at', { ascending: false })
            .limit(1);
          if (anonimo && anonimo.length > 0) {
            idCliente = anonimo[0].id;
          }
        }
      }

      this.clienteId.set(idCliente);

      if (!idCliente) {
        await this.mostrarToast('Debés ingresar como cliente para acceder a la encuesta.', 'warning');
        await this.router.navigate(['/clienteInicio'], { replaceUrl: true });
        return;
      }

      // 2. Identificar mesa asignada y fecha de inicio de la estadía
      const mesas = await this.supabase.obtenerMesas();
      const mesaAsignada = mesas.find((m: any) => m.cliente_id === idCliente);
      const idMesaActual = mesaAsignada ? mesaAsignada.id : null;
      this.mesaId.set(idMesaActual);

      const pedidoActivo = this.pedidoService.pedidoActivo();
      const desdeFecha = pedidoActivo?.created_at ?? null;

      // 3. Verificar si ya completó la encuesta en esta estadía
      const encuestaPrevia = await this.supabase.obtenerEncuestaEstadiaActual(
        idCliente,
        idMesaActual,
        desdeFecha
      );

      if (encuestaPrevia) {
        this.yaRespondio.set(true);
        await this.mostrarToast('Ya completaste la encuesta en esta estadía. Te mostramos los resultados.', 'warning');
        await this.router.navigate(['/graficos-encuesta'], { replaceUrl: true });
        return;
      }
    } catch (error) {
      console.error('Error al verificar estado de encuesta:', error);
    } finally {
      this.cargando.set(false);
    }
  }

  cambiarComida(ev: any) {
    const val = Number(ev?.detail?.value ?? 8);
    this.comida.set(val);
  }

  cambiarAtencion(ev: any) {
    const val = Number(ev?.detail?.value ?? 8);
    this.atencion.set(val);
  }

  ajustarAmbiente(delta: number) {
    const actual = this.ambiente();
    const nuevo = Math.min(10, Math.max(1, actual + delta));
    this.ambiente.set(nuevo);
  }

  fijarAmbiente(valor: number) {
    this.ambiente.set(valor);
  }

  cambiarExperiencia(ev: any) {
    const val = Number(ev?.detail?.value ?? 8);
    this.recomienda.set(val);
  }

  async enviarEncuesta() {
    if (this.enviando() || this.yaRespondio()) return;

    const idCliente = this.clienteId();
    if (!idCliente) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('No se pudo identificar al cliente.', 'danger');
      return;
    }

    this.enviando.set(true);

    try {
      const respuestas: RespuestasEncuesta = {
        comida: this.comida(),
        atencion: this.atencion(),
        ambiente: this.ambiente(),
        recomienda: this.recomienda()
      };

      await this.supabase.guardarEncuesta(
        idCliente,
        this.mesaId(),
        respuestas
      );

      this.yaRespondio.set(true);
      await this.mostrarToast('¡Muchas gracias por tu opinión!', 'success');
      await this.router.navigate(['/graficos-encuesta'], { replaceUrl: true });
    } catch (error: any) {
      console.error('Error al enviar encuesta:', error);
      await this.vibracion.errorFuerte();
      await this.mostrarToast(error?.message || 'Error al guardar la encuesta.', 'danger');
    } finally {
      this.enviando.set(false);
    }
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'warning' | 'danger'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2800,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}

