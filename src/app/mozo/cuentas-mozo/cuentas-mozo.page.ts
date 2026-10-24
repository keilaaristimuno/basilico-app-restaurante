import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon, IonRefresher, IonRefresherContent, ToastController } from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertCircleOutline,
  cashOutline,
  checkmarkDoneCircleOutline,
  chevronBackOutline,
  chevronForwardOutline,
  giftOutline,
  heartOutline,
  hourglassOutline,
  personOutline,
  qrCodeOutline,
  receiptOutline,
  restaurantOutline,
  timeOutline,
  walletOutline
} from 'ionicons/icons';
import { RealtimeChannel } from '@supabase/supabase-js';
import { Subscription } from 'rxjs';

import { NavbarComponent } from '../../components/navbar/navbar.component';
import { Carga } from '../../services/carga';
import { VibracionService } from '../../services/vibracion';
import { PushNotificationsService } from '../../services/push-notifications.service';
import { CuentaService } from '../../services/cuenta.service';
import { Cuenta, EstadoCuenta } from '../../interfaces/cuenta';
import { formatearMoneda, obtenerOpcionPropina } from '../../utils/calculo-cuenta';

type Pestania = 'pagos' | 'solicitadas' | 'cerradas';

/**
 * Punto 21 (parte mozo) — Cuentas por mesa: solicitudes, pagos pendientes de
 * confirmación y cuentas cerradas. Dueño y supervisor acceden en modo consulta.
 */
@Component({
  selector: 'app-cuentas-mozo',
  standalone: true,
  templateUrl: './cuentas-mozo.page.html',
  styleUrls: ['./cuentas-mozo.page.scss'],
  imports: [CommonModule, RouterLink, IonContent, IonIcon, IonRefresher, IonRefresherContent, NavbarComponent]
})
export class CuentasMozoPage implements OnInit, OnDestroy {
  readonly formatear = formatearMoneda;
  readonly cuentas = signal<Cuenta[]>([]);
  readonly pestania = signal<Pestania>('pagos');
  readonly procesandoId = signal<string | null>(null);
  readonly confirmandoId = signal<string | null>(null);
  readonly esMozo = (localStorage.getItem('perfil') ?? '').toLowerCase() === 'mozo';
  readonly rutaInicio = this.esMozo ? '/mozoInicio' : '/duenioInicio';

  readonly pagosPendientes = computed(() => this.filtrar(['pago_pendiente_confirmacion']));
  readonly solicitadas = computed(() => this.filtrar(['pendiente_propina', 'lista_para_pagar']));
  readonly cerradas = computed(() => this.filtrar(['pago_confirmado']).reverse());
  readonly listaVisible = computed(() => {
    switch (this.pestania()) {
      case 'pagos': return this.pagosPendientes();
      case 'solicitadas': return this.solicitadas();
      default: return this.cerradas();
    }
  });

  readonly indiceActual = signal<number>(0);
  readonly cuentaActual = computed<Cuenta | null>(() => {
    const lista = this.listaVisible();
    if (lista.length === 0) return null;
    const idx = Math.min(Math.max(0, this.indiceActual()), lista.length - 1);
    return lista[idx] ?? null;
  });

  private canal: RealtimeChannel | null = null;
  private subPush: Subscription | null = null;
  private touchStartX = 0;
  private touchStartY = 0;

  constructor(
    private cuentaService: CuentaService,
    private pushNotifications: PushNotificationsService,
    private carga: Carga,
    private vibracion: VibracionService,
    private toastCtrl: ToastController
  ) {
    addIcons({
      alertCircleOutline, cashOutline, checkmarkDoneCircleOutline, chevronBackOutline,
      chevronForwardOutline, giftOutline, heartOutline, hourglassOutline, personOutline,
      qrCodeOutline, receiptOutline, restaurantOutline, timeOutline, walletOutline
    });
  }

  async ngOnInit() {
    await this.cargar(true);
    this.canal = this.cuentaService.escucharCambios('cuentas-mozo', () => void this.cargar(false));
    this.subPush = this.pushNotifications.notificacionRecibida$.subscribe(() => void this.cargar(false));
  }

  async ionViewWillEnter() {
    await this.cargar(false);
  }

  ngOnDestroy() {
    this.cuentaService.dejarDeEscuchar(this.canal);
    this.canal = null;
    this.subPush?.unsubscribe();
  }

  async refrescar(evento: any) {
    try {
      await this.cargar(false);
    } finally {
      evento?.target?.complete();
    }
  }

  async cargar(conSpinner: boolean) {
    try {
      const cuentas = conSpinner
        ? await this.carga.ejecutar('Cargando cuentas...', () => this.cuentaService.obtenerCuentasPersonal())
        : await this.cuentaService.obtenerCuentasPersonal();
      this.cuentas.set(cuentas);

      if (conSpinner && this.pagosPendientes().length === 0 && this.solicitadas().length > 0) {
        this.pestania.set('solicitadas');
      }

      if (this.indiceActual() >= this.listaVisible().length) {
        this.indiceActual.set(Math.max(0, this.listaVisible().length - 1));
      }
    } catch (error: any) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast(error?.message ?? 'No se pudieron obtener las cuentas.', 'danger');
    }
  }

  cambiarPestania(pestania: Pestania) {
    this.pestania.set(pestania);
    this.confirmandoId.set(null);
    this.indiceActual.set(0);
  }

  cuentaAnterior() {
    if (this.indiceActual() > 0) {
      this.indiceActual.update(i => i - 1);
      this.confirmandoId.set(null);
    }
  }

  cuentaSiguiente() {
    if (this.indiceActual() < this.listaVisible().length - 1) {
      this.indiceActual.update(i => i + 1);
      this.confirmandoId.set(null);
    }
  }

  irACuenta(index: number) {
    this.indiceActual.set(index);
    this.confirmandoId.set(null);
  }

  onTouchStart(event: TouchEvent) {
    if (event.changedTouches?.length > 0) {
      this.touchStartX = event.changedTouches[0].clientX;
      this.touchStartY = event.changedTouches[0].clientY;
    }
  }

  onTouchEnd(event: TouchEvent) {
    if (event.changedTouches?.length > 0) {
      const touchEndX = event.changedTouches[0].clientX;
      const touchEndY = event.changedTouches[0].clientY;
      const difX = this.touchStartX - touchEndX;
      const difY = Math.abs(this.touchStartY - touchEndY);

      if (Math.abs(difX) > 40 && Math.abs(difX) > difY) {
        if (difX > 0) {
          this.cuentaSiguiente();
        } else {
          this.cuentaAnterior();
        }
      }
    }
  }

  pedirConfirmacion(cuenta: Cuenta) {
    this.confirmandoId.set(cuenta.id);
  }

  cancelarConfirmacion() {
    this.confirmandoId.set(null);
  }

  /**
   * El mozo confirma el pago simulado. Operación separada e idempotente: base del Punto 22.
   */
  async confirmarPago(cuenta: Cuenta) {
    if (this.procesandoId()) return;
    if (!this.esMozo) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Solo un mozo puede confirmar el pago.', 'danger');
      return;
    }

    this.procesandoId.set(cuenta.id);
    try {
      const resultado = await this.carga.ejecutar('Confirmando el pago...', () => this.cuentaService.confirmarPago(cuenta));
      this.confirmandoId.set(null);
      await this.mostrarToast(
        resultado.ya_confirmada
          ? `El pago de la mesa N.º ${cuenta.numero_mesa} ya estaba confirmado.`
          : `Pago de la mesa N.º ${cuenta.numero_mesa} confirmado. La mesa quedó libre.`,
        'success'
      );
      await this.cargar(false);
      if (this.indiceActual() >= this.listaVisible().length) {
        this.indiceActual.set(Math.max(0, this.listaVisible().length - 1));
      }
    } catch (error: any) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast(error?.message ?? 'No se pudo confirmar el pago.', 'danger');
    } finally {
      this.procesandoId.set(null);
    }
  }

  nombreCliente(cuenta: Cuenta): string {
    const cli = cuenta.clientes;
    if (!cli) return 'Cliente';
    const perfil = (cli.perfil ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (perfil === 'anonimo') {
      return `${(cli.nombres ?? '').trim()} (Cliente Anónimo)`;
    }
    return `${cli.nombres ?? ''} ${cli.apellidos ?? ''}`.trim() || 'Cliente registrado';
  }

  etiquetaEstado(estado: EstadoCuenta): string {
    switch (estado) {
      case 'pendiente_propina': return 'Esperando propina';
      case 'lista_para_pagar': return 'Lista para pagar';
      case 'pago_pendiente_confirmacion': return 'Pago por confirmar';
      default: return 'Pago confirmado';
    }
  }

  etiquetaPropina(cuenta: Cuenta): string {
    const op = obtenerOpcionPropina(cuenta.propina_nivel);
    return op ? `${op.etiqueta} (${op.porcentaje} %)` : 'Sin escanear';
  }

  unidades(cuenta: Cuenta): number {
    return (cuenta.cuenta_items ?? []).reduce((total, it) => total + it.cantidad, 0);
  }

  cantidadItems(cuenta: Cuenta): number {
    return (cuenta.cuenta_items ?? []).length;
  }

  fechaHora(iso: string | null | undefined): string {
    if (!iso) return '';
    const fecha = new Date(iso);
    if (isNaN(fecha.getTime())) return '';
    const dia = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    const hora = fecha.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${dia} - ${hora} h`;
  }

  private filtrar(estados: EstadoCuenta[]): Cuenta[] {
    return this.cuentas().filter((c) => estados.includes(c.estado));
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'warning' | 'danger') {
    const toast = await this.toastCtrl.create({ message: mensaje, duration: 3500, color, position: 'bottom' });
    await toast.present();
  }
}
