import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent, IonIcon, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  arrowForwardOutline,
  calendarOutline,
  checkmarkCircle,
  checkmarkCircleOutline,
  checkmarkDoneCircle,
  giftOutline,
  happyOutline,
  heartOutline,
  homeOutline,
  lockClosedOutline,
  notificationsOutline,
  qrCodeOutline,
  receiptOutline,
  refreshOutline,
  remove,
  removeCircleOutline,
  restaurantOutline,
  sadOutline,
  shieldCheckmarkOutline,
  swapHorizontalOutline,
  thumbsUpOutline,
  timeOutline,
  walletOutline
} from 'ionicons/icons';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';

import { NavbarComponent } from '../../components/navbar/navbar.component';
import { Supabase } from '../../services/supabase';
import { Carga } from '../../services/carga';
import { VibracionService } from '../../services/vibracion';
import { QrService } from '../../services/qr.service';
import { PedidoService } from '../../services/pedido.service';
import { PushNotificationsService } from '../../services/push-notifications.service';
import { CuentaService, ErrorCuenta } from '../../services/cuenta.service';
import { Cuenta } from '../../interfaces/cuenta';
import {
  OPCIONES_PROPINA,
  formatearMoneda,
  interpretarQrPropina,
  obtenerOpcionPropina
} from '../../utils/calculo-cuenta';

type TipoAviso = 'error' | 'info' | 'exito';

/**
 * Punto 21 — Pantalla de la cuenta del cliente (estilo billetera virtual):
 * propina por QR, detalle de consumos, descuentos, total y pago simulado.
 */
@Component({
  selector: 'app-cuenta-cliente',
  standalone: true,
  templateUrl: './cuenta-cliente.page.html',
  styleUrls: ['./cuenta-cliente.page.scss'],
  imports: [CommonModule, IonContent, IonIcon, NavbarComponent]
})
export class CuentaClientePage implements OnInit, OnDestroy {
  readonly opcionesPropina = OPCIONES_PROPINA;
  readonly formatear = formatearMoneda;

  readonly cuenta = this.cuentaService.cuentaCliente;
  readonly cargandoInicial = signal(true);
  readonly procesando = signal(false);
  readonly mostrarConfirmacionPago = signal(false);
  readonly aviso = signal<{ tipo: TipoAviso; texto: string } | null>(null);
  readonly esAnonimo = signal(false);

  readonly opcionElegida = computed(() => obtenerOpcionPropina(this.cuenta()?.propina_nivel));
  readonly cantidadUnidades = computed(() =>
    (this.cuenta()?.cuenta_items ?? []).reduce((total, it) => total + it.cantidad, 0)
  );
  readonly avisoPendiente = computed(() => {
    const c = this.cuenta();
    if (!c) return false;
    if (c.estado === 'pago_pendiente_confirmacion') return c.notif_pago_ok === false;
    if (c.estado === 'pendiente_propina' || c.estado === 'lista_para_pagar') return c.notif_solicitud_ok === false;
    return false;
  });
  readonly nombreJuego = computed(() => {
    switch (this.cuenta()?.descuento_juego) {
      case 'bingo': return 'Bingo';
      case 'mayor-menor': return 'Mayor o Menor';
      case 'trivia': return 'Trivia';
      default: return '';
    }
  });

  private clienteId = '';
  private canal: RealtimeChannel | null = null;
  private subPush: Subscription | null = null;

  constructor(
    private supabase: Supabase,
    private cuentaService: CuentaService,
    private pedidoService: PedidoService,
    private pushNotifications: PushNotificationsService,
    private qrService: QrService,
    private carga: Carga,
    private vibracion: VibracionService,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    addIcons({
      alertCircleOutline, arrowForwardOutline, calendarOutline, checkmarkCircle, checkmarkCircleOutline,
      checkmarkDoneCircle, giftOutline, happyOutline, heartOutline, homeOutline, lockClosedOutline,
      notificationsOutline, qrCodeOutline, receiptOutline, refreshOutline, remove, removeCircleOutline,
      restaurantOutline, sadOutline, shieldCheckmarkOutline, swapHorizontalOutline, thumbsUpOutline,
      timeOutline, walletOutline
    });
  }

  async ngOnInit() {
    await this.cargar(true);
    this.canal = this.cuentaService.escucharCambios('cuenta-cliente', () => void this.cargar(false));
    this.subPush = this.pushNotifications.notificacionRecibida$.subscribe(() => void this.cargar(false));
  }

  async ionViewWillEnter() {
    if (!this.cargandoInicial()) {
      await this.cargar(false);
    }
  }

  ngOnDestroy() {
    this.cuentaService.dejarDeEscuchar(this.canal);
    this.canal = null;
    this.subPush?.unsubscribe();
  }

  /**
   * Identifica al cliente por su sesión y recupera su cuenta desde Supabase,
   * de modo que el estado se mantiene aunque cierre y vuelva a abrir la aplicación.
   */
  async cargar(conSpinner: boolean) {
    const accion = async () => {
      if (!this.clienteId) {
        const { data: { user } } = await this.supabase.clienteSupabase.auth.getUser();
        if (!user?.email) {
          throw new ErrorCuenta('CLIENTE_NO_IDENTIFICADO', 'No pudimos identificar tu sesión. Volvé a ingresar a la aplicación.');
        }
        const cliente = await this.supabase.obtenerClientePorCorreo(user.email);
        if (!cliente) {
          throw new ErrorCuenta('CLIENTE_NO_IDENTIFICADO', 'No encontramos tus datos de cliente.');
        }
        this.clienteId = cliente.id;
        this.esAnonimo.set(String(cliente.perfil ?? '').toLowerCase() === 'anonimo');
      }
      await this.cuentaService.obtenerCuentaCliente(this.clienteId);
    };

    try {
      if (conSpinner) {
        await this.carga.ejecutar('Cargando tu cuenta...', accion);
      } else {
        await accion();
      }
    } catch (error: any) {
      await this.mostrarError(error?.message ?? 'No se pudo cargar tu cuenta.');
    } finally {
      this.cargandoInicial.set(false);
    }
  }

  /**
   * Paso B: escaneo obligatorio de uno de los cinco QR de propina.
   */
  async escanearPropina() {
    const cuenta = this.cuenta();
    if (!cuenta || this.procesando()) return;

    if (cuenta.estado === 'pago_pendiente_confirmacion' || cuenta.estado === 'pago_confirmado') {
      await this.mostrarError('La cuenta ya fue pagada: no se puede modificar la propina.');
      return;
    }

    this.aviso.set(null);
    let contenido: string | null = null;
    try {
      contenido = await this.qrService.leerQR();
    } catch (error: any) {
      await this.mostrarError(error?.message || 'No se pudo abrir el lector de códigos QR.');
      return;
    }

    if (!contenido) {
      await this.mostrarError('No se leyó ningún código. Verificá que la aplicación tenga permiso para usar la cámara y volvé a intentar.');
      return;
    }

    const interpretado = interpretarQrPropina(contenido);
    if (!interpretado.valido) {
      await this.mostrarError(interpretado.mensaje);
      return;
    }

    this.procesando.set(true);
    try {
      const actualizada = await this.carga.ejecutar('Registrando tu propina...', () =>
        this.cuentaService.registrarPropina(cuenta.id, interpretado.opcion.codigoQr)
      );
      const opcion = obtenerOpcionPropina(actualizada.propina_nivel);
      this.aviso.set({
        tipo: 'exito',
        texto: `Satisfacción registrada: ${opcion?.etiqueta} (${actualizada.propina_porcentaje} % de propina).`
      });
      await this.mostrarToast('¡Propina registrada! Ya podés revisar y pagar tu cuenta.', 'success');
    } catch (error: any) {
      await this.mostrarError(error?.message ?? 'No se pudo registrar la propina.');
    } finally {
      this.procesando.set(false);
    }
  }

  abrirConfirmacionPago() {
    const cuenta = this.cuenta();
    if (!cuenta) return;
    if (cuenta.estado !== 'lista_para_pagar' || cuenta.propina_porcentaje === null) {
      void this.mostrarError('Escaneá un QR de propina antes de pagar.');
      return;
    }
    this.mostrarConfirmacionPago.set(true);
  }

  cerrarConfirmacionPago() {
    if (!this.procesando()) {
      this.mostrarConfirmacionPago.set(false);
    }
  }

  /**
   * Paso E: pago simulado.
   */
  async confirmarPago() {
    const cuenta = this.cuenta();
    if (!cuenta || this.procesando()) return;

    this.procesando.set(true);
    try {
      const { resultado, avisoEnviado } = await this.carga.ejecutar('Procesando el pago...', () =>
        this.cuentaService.pagarCuenta(cuenta)
      );
      this.mostrarConfirmacionPago.set(false);

      if (!resultado.ok) {
        await this.mostrarError(`El total de tu cuenta se actualizó a ${formatearMoneda(resultado.total)}. Revisalo antes de pagar.`);
        return;
      }

      if (resultado.ya_pagada) {
        this.aviso.set({ tipo: 'info', texto: 'Esta cuenta ya estaba pagada. No se realizó un nuevo cobro.' });
        return;
      }

      if (!avisoEnviado) {
        await this.vibracion.error();
        this.aviso.set({ tipo: 'error', texto: 'El pago quedó registrado, pero no pudimos avisar al mozo. Tocá "Reintentar aviso".' });
      } else {
        await this.vibracion.toque();
      }
    } catch (error: any) {
      this.mostrarConfirmacionPago.set(false);
      await this.mostrarError(error?.message ?? 'No se pudo registrar el pago.');
    } finally {
      this.procesando.set(false);
    }
  }

  async reintentarAviso() {
    const cuenta = this.cuenta();
    if (!cuenta || this.procesando()) return;

    this.procesando.set(true);
    try {
      const enviado = await this.carga.ejecutar('Avisando al mozo...', () => this.cuentaService.reintentarAviso(cuenta));
      if (enviado) {
        this.aviso.set({ tipo: 'exito', texto: '¡Listo! El mozo recibió el aviso.' });
      } else {
        await this.mostrarError('Todavía no pudimos avisar al mozo. Revisá tu conexión y volvé a intentar.');
      }
    } catch (error: any) {
      await this.mostrarError(error?.message ?? 'No se pudo avisar al mozo.');
    } finally {
      this.procesando.set(false);
    }
  }

  /**
   * Luego de la confirmación del mozo, el cliente cierra su visita en el dispositivo.
   */
  async finalizarVisita() {
    const cuenta = this.cuenta();
    if (!cuenta) return;

    localStorage.removeItem(`mesa_escaneada_${cuenta.numero_mesa}`);
    this.pedidoService.limpiarCarrito();
    this.pedidoService.pedidoActivo.set(null);
    this.pedidoService.mesaActual.set(null);
    this.cuentaService.marcarCierreVisto(cuenta.id);

    await this.mostrarToast('¡Gracias por visitar Basílico! Te esperamos pronto.', 'success');
    await this.router.navigate(['/clienteInicio'], { replaceUrl: true });
  }

  async volverAlInicio() {
    await this.router.navigate(['/clienteInicio']);
  }

  pasoActual(cuenta: Cuenta): number {
    switch (cuenta.estado) {
      case 'pendiente_propina': return 1;
      case 'lista_para_pagar': return 2;
      case 'pago_pendiente_confirmacion': return 3;
      default: return 4;
    }
  }

  fechaHora(iso: string | null | undefined): string {
    if (!iso) return '';
    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return '';
    const dia = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dia} · ${hora} h`;
  }

  numeroCuenta(cuenta: Cuenta): string {
    return String(cuenta.numero).padStart(6, '0');
  }

  private async mostrarError(texto: string) {
    await this.vibracion.errorFuerte();
    this.aviso.set({ tipo: 'error', texto });
    await this.mostrarToast(texto, 'danger');
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 3500,
      color,
      position: 'top'
    });
    await toast.present();
  }
}
