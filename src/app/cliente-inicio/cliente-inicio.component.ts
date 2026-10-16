import { Component } from '@angular/core';
import {
  IonContent,
  IonIcon,
  IonButton,
  ToastController,
  IonModal,
  IonToolbar,
  IonHeader,
  IonItem,
  IonButtons,
  IonTitle,
  IonInput
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { qrCodeOutline, gameControllerOutline } from 'ionicons/icons';
import { QrService } from '../services/qr.service';
import { Supabase } from '../services/supabase';
import { VibracionService } from '../services/vibracion';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { signal } from '@angular/core';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-cliente-inicio',
  standalone: true,
  templateUrl: './cliente-inicio.component.html',
  styleUrls: ['./cliente-inicio.component.scss'],
  imports: [
    NavbarComponent,
    IonContent,
    IonIcon,
    IonButton,
    IonModal,
    IonToolbar,
    IonHeader,
    IonItem,
    IonButtons,
    IonTitle,
    FormsModule,
    IonInput
  ],
})
export class ClienteInicioComponent {
  cantidadComensales = signal<string>('');
  comensalesValidados = signal<number>(0);
  abrirInputComensales = signal<boolean>(false);
  codigoQrIngreso = signal<boolean>(false);
  numeroMesa = signal<string>('');
  clienteId = signal<string>('');

  /** true cuando el metre ya asigno una mesa y el cliente aun no escaneo el QR de la mesa */
  mesaAsignada = signal<boolean>(false);

  private canalRealtimeMesas: any = null;

  constructor(
    private qrService: QrService,
    private supabase: Supabase,
    private toastCtrl: ToastController,
    private vibracion: VibracionService
  ) {
    addIcons({ qrCodeOutline, gameControllerOutline });
  }

  async ionViewWillEnter() {
    await this.inicializarClienteId();
  }

  ionViewWillLeave() {
    this.detenerSuscripcionMesas();
  }

  /**
   * Carga el clienteId desde Supabase Auth al entrar a la vista,
   * verifica si ya tiene mesa asignada y arranca la suscripcion Realtime.
   */
  private async inicializarClienteId() {
    const { data: { user } } = await this.supabase.clienteSupabase.auth.getUser();
    if (!user?.email) return;

    const cliente = await this.supabase.obtenerClientePorCorreo(user.email);
    if (!cliente || cliente.estado !== 'aprobado') return;

    this.clienteId.set(cliente.id);

    // Verificar si ya hay una mesa asignada (por si el metre actuo antes de que llegara aqui)
    await this.verificarMesaAsignada();

    // Escuchar cambios en 'mesas' en tiempo real
    this.suscribirseACambiosMesas();
  }

  /**
   * Consulta la tabla mesas y actualiza los signals si hay una mesa
   * en estado 'asignada' vinculada a este cliente.
   */
  private async verificarMesaAsignada() {
    if (!this.clienteId()) return;

    const mesas = await this.supabase.obtenerMesas();
    const mesaDelCliente = mesas.find(
      (m: any) => m.cliente_id === this.clienteId() && m.disponibilidad === 'asignada'
    );

    if (mesaDelCliente) {
      this.numeroMesa.set(String(mesaDelCliente.numero));
      this.mesaAsignada.set(true);
      this.codigoQrIngreso.set(true);
    }
  }

  /**
   * Suscripcion Realtime a la tabla 'mesas'.
   * Cuando el metre asigna la mesa (UPDATE a 'asignada'), la UI del cliente
   * se actualiza automaticamente sin necesidad de recargar.
   */
  private suscribirseACambiosMesas() {
    this.detenerSuscripcionMesas();

    this.canalRealtimeMesas = this.supabase.clienteSupabase
      .channel('cliente-mesas-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'mesas' },
        async (payload: any) => {
          const mesa = payload.new;

          if (mesa.cliente_id !== this.clienteId()) return;

          if (mesa.disponibilidad === 'asignada') {
            this.numeroMesa.set(String(mesa.numero));
            this.mesaAsignada.set(true);
            await this.mostrarToast(
              `El metre te asigno la Mesa N ${mesa.numero}. Escanea el QR de la mesa.`,
              'success'
            );
          } else if (mesa.disponibilidad === 'vacia') {
            this.numeroMesa.set('');
            this.mesaAsignada.set(false);
          }
        }
      )
      .subscribe();
  }

  private detenerSuscripcionMesas() {
    if (this.canalRealtimeMesas) {
      void this.supabase.clienteSupabase.removeChannel(this.canalRealtimeMesas);
      this.canalRealtimeMesas = null;
    }
  }

  async escanearIngreso() {
    const codigoEscaneado = await this.qrService.leerQR();

    if (!codigoEscaneado) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Se cancelo la lectura o no se pudo acceder a la camara.', 'warning');
      return;
    }

    if (codigoEscaneado === 'BASILICO_INGRESO_LISTA_ESPERA') {
      this.codigoQrIngreso.set(true);
      this.abrirInputComensales.set(true);
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('El codigo QR no corresponde al ingreso del local.', 'danger');
    }
  }

  confirmarComensales() {
    const comensalesNum = parseInt(this.cantidadComensales(), 10);
    if (!isNaN(comensalesNum) && comensalesNum > 0) {
      this.comensalesValidados.set(comensalesNum);
      this.cerrarModuleComensales();
      this.agregarAListaDeEspera();
      this.cantidadComensales.set('');
    } else {
      this.mostrarToast('Por favor, ingrese un numero valido de comensales.', 'warning');
    }
  }

  cerrarModuleComensales() {
    this.abrirInputComensales.set(false);
  }

  async agregarAListaDeEspera() {
    const { data: { user } } = await this.supabase.clienteSupabase.auth.getUser();

    if (!user?.email) {
      await this.mostrarToast('Iniciá sesion para anotarte.', 'warning');
      return;
    }

    const cliente = await this.supabase.obtenerClientePorCorreo(user.email);

    if (!cliente || cliente.estado !== 'aprobado') {
      await this.mostrarToast('No se encontro una cuenta de cliente aprobada.', 'warning');
      return;
    }

    const nombreCliente = `${cliente.nombres} ${cliente.apellidos}`.trim();
    this.clienteId.set(cliente.id);

    const { error } = await this.supabase.clienteSupabase
      .from('lista_espera')
      .insert({
        cliente_id: cliente.id,
        nombre: nombreCliente,
        comensales: this.comensalesValidados(),
      });

    if (error) {
      console.error('Error al anotarse:', error.message);
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Error al anotarse en la lista de espera.', 'danger');
      return;
    }

    await this.mostrarToast(`Te anotaste con exito en la lista de espera como "${nombreCliente}".`, 'success');
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

  async escanearQrMesa() {
    const codigoEscaneado = await this.qrService.leerQR();

    if (!codigoEscaneado) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Se cancelo la lectura o no se pudo acceder a la camara.', 'warning');
      return;
    }

    if (codigoEscaneado === `mesa_numero:${this.numeroMesa()}`) {
      await this.confirmarOcupacionMesa();
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('El codigo QR no corresponde a la mesa asignada.', 'danger');
    }
  }

  /**
   * Cambia la disponibilidad de la mesa de 'asignada' a 'ocupada'
   * cuando el cliente escanea fisicamente el QR de la mesa.
   */
  private async confirmarOcupacionMesa() {
    try {
      const mesas = await this.supabase.obtenerMesas();
      const mesaDelCliente = mesas.find(
        (m: any) => String(m.numero) === this.numeroMesa() && m.cliente_id === this.clienteId()
      );

      if (!mesaDelCliente) {
        await this.mostrarToast('No se encontro la mesa asignada.', 'danger');
        return;
      }

      await this.supabase.actualizarDisponibilidadMesa(mesaDelCliente.id, 'ocupada');
      this.mesaAsignada.set(false);
      await this.mostrarToast(`Bienvenido a la Mesa N ${this.numeroMesa()}.`, 'success');

    } catch (error: any) {
      console.error('Error al confirmar ocupacion de mesa:', error);
      await this.mostrarToast('Error al confirmar la mesa. Intenta de nuevo.', 'danger');
    }
  }
}
