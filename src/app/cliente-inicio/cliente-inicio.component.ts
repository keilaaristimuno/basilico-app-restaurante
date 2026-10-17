import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
import {
  qrCodeOutline,
  gameControllerOutline,
  restaurantOutline,
  cartOutline,
  timeOutline,
  checkmarkCircleOutline,
  alertCircleOutline,
  createOutline,
  chatbubblesOutline,
  peopleOutline,
  closeOutline,
  refreshOutline,
  wineOutline,
  checkmarkDoneCircleOutline,
  hourglassOutline,
  clipboardOutline,
  barChartOutline,
  receiptOutline
} from 'ionicons/icons';
import { RealtimeChannel } from '@supabase/supabase-js';

import { QrService } from '../services/qr.service';
import { Supabase } from '../services/supabase';
import { VibracionService } from '../services/vibracion';
import { PedidoService } from '../services/pedido.service';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { PedidoClienteUI } from '../interfaces/pedido';

@Component({
  selector: 'app-cliente-inicio',
  standalone: true,
  templateUrl: './cliente-inicio.component.html',
  styleUrls: ['./cliente-inicio.component.scss'],
  imports: [
    CommonModule,
    RouterLink,
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
export class ClienteInicioComponent implements OnInit, OnDestroy {
  cantidadComensales = signal<string>("");
  comensalesValidados = signal<number>(0);
  abrirInputComensales = signal<boolean>(false);
  codigoQrIngreso = signal<boolean>(false);
  numeroMesa = signal<string>("");
  mesaId = signal<string>("");
  clienteId = signal<string>("");
  nombreCliente = signal<string>("Cliente");
  enListaEspera = signal<boolean>(false);
  mesaEscaneada = signal<boolean>(false);
  encuestaCompletada = signal<boolean>(false);

  /**
   * Canal activo de Supabase Realtime para cambios en pedidos y mesas
   */
  private canalRealtime: RealtimeChannel | null = null;

  constructor(
    private qrService: QrService,
    private supabase: Supabase,
    private toastCtrl: ToastController,
    private vibracion: VibracionService,
    public pedidoService: PedidoService,
    private router: Router
  ) {
    addIcons({
      qrCodeOutline,
      gameControllerOutline,
      restaurantOutline,
      cartOutline,
      timeOutline,
      checkmarkCircleOutline,
      alertCircleOutline,
      createOutline,
      chatbubblesOutline,
      peopleOutline,
      closeOutline,
      refreshOutline,
      wineOutline,
      checkmarkDoneCircleOutline,
      hourglassOutline,
      clipboardOutline,
      barChartOutline,
      receiptOutline
    });
  }

  async ngOnInit() {
    await this.cargarDatosClienteYEstado();
    this.iniciarSuscripcionRealtime();
    
  }

  async ionViewWillEnter() {
    await this.cargarDatosClienteYEstado();
  }

  ngOnDestroy() {
    this.detenerSuscripcionRealtime();
  }

  /**
   * Identifica al cliente actual, su lista de espera, la mesa asignada y su pedido activo
   */
  async cargarDatosClienteYEstado() {
    try {
      const { data: { user } } = await this.supabase.clienteSupabase.auth.getUser();

      if (user?.email) {
        const cliente = await this.supabase.obtenerClientePorCorreo(user.email);
        if (cliente) {
          this.clienteId.set(cliente.id);
          this.nombreCliente.set(`${cliente.nombres} ${cliente.apellidos}`.trim());
        }
      } else {
        const nombreGuardado = localStorage.getItem('nombre');
        if (nombreGuardado) {
          this.nombreCliente.set(nombreGuardado);
          const { data: anonimo } = await this.supabase.clienteSupabase
            .from('clientes')
            .select('*')
            .ilike('nombres', nombreGuardado)
            .order('created_at', { ascending: false })
            .limit(1);
          if (anonimo && anonimo.length > 0) {
            this.clienteId.set(anonimo[0].id);
          }
        }
      }

      const idCliente = this.clienteId();
      if (!idCliente) return;


      // 1. Verificar si está en lista de espera
      const lista = await this.supabase.obtenerListaDeEspera();
      const enEspera = lista.some((it: any) => it.cliente_id === idCliente);
      this.enListaEspera.set(enEspera);
      if (enEspera) {
        this.codigoQrIngreso.set(true);
      }

      // 2. Buscar si el metre ya le asignó mesa
      await this.buscarMesaAsignada();

      // 3. Consultar pedido activo
      if (this.numeroMesa()) {
        const pedido = await this.pedidoService.consultarPedidoActivo(idCliente);
        if (pedido) {
          this.mesaEscaneada.set(true);
        }
      }

      // 4. Verificar si ya completó la encuesta en la estadía actual (Punto 20)
      const pedidoActual = this.pedidoService.pedidoActivo();
      const desdeFecha = pedidoActual?.created_at ?? null;
      const encuestaPrevia = await this.supabase.obtenerEncuestaEstadiaActual(
        idCliente,
        this.mesaId() || null,
        desdeFecha
      );
      this.encuestaCompletada.set(!!encuestaPrevia);
    } catch (error) {
      console.warn('Error al cargar datos del cliente y estado:', error);
    }
  }

  async escanearIngreso() {
    const codigoEscaneado = await this.qrService.leerQR();

    if (!codigoEscaneado) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Se canceló la lectura o no se pudo acceder a la cámara.', 'warning');
      return;
    }

    if (codigoEscaneado === 'BASILICO_INGRESO_LISTA_ESPERA') {
      this.codigoQrIngreso.set(true);
      this.abrirInputComensales.set(true);
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('El código QR no corresponde al ingreso del local.', 'danger');
    }
  }

  confirmarComensales() {
    const comensalesNum = parseInt(this.cantidadComensales(), 10);
    if (!isNaN(comensalesNum) && comensalesNum > 0) {
      this.comensalesValidados.set(comensalesNum);
      this.cerrarModuleComensales();
      this.agregarAListaDeEspera();
      this.cantidadComensales.set("");
    } else {
      this.mostrarToast('Por favor, ingrese un número válido de comensales.', 'warning');
    }
  }

  cerrarModuleComensales() {
    this.abrirInputComensales.set(false);
  }

  async agregarAListaDeEspera() {
    const idCliente = this.clienteId();
    if (!idCliente) {
      await this.mostrarToast('Iniciá sesión o ingresá como cliente.', 'warning');
      return;
    }

    const { error } = await this.supabase.clienteSupabase
      .from('lista_espera')
      .insert({
        cliente_id: idCliente,
        nombre: this.nombreCliente(),
        comensales: this.comensalesValidados(),
      });

    if (error) {
      console.error('Error al anotarse:', error.message);
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Error al anotarse en la lista de espera.', 'danger');
      return;
    }

    this.enListaEspera.set(true);
    await this.mostrarToast(`¡Te anotaste con éxito en la lista de espera como "${this.nombreCliente()}"!`, 'success');
  }

  async buscarMesaAsignada() {
    const idCliente = this.clienteId();
    if (!idCliente) return;

    const mesas = await this.supabase.obtenerMesas();
    const mesaEncontrada = mesas.find((m: any) => m.cliente_id === idCliente);

    if (mesaEncontrada) {
      // Seteamos el número y la ID de la mesa, pero NO mesaEscaneada todavía
      this.numeroMesa.set(String(mesaEncontrada.numero));
      this.mesaId.set(mesaEncontrada.id);
      this.codigoQrIngreso.set(true);

      // Verificamos si el cliente YA HABÍA escaneado esta mesa antes (guardado en localStorage)
      const guardada = localStorage.getItem(`mesa_escaneada_${mesaEncontrada.numero}`);
      if (mesaEncontrada.disponibilidad === 'ocupada' || guardada === 'true') {
        this.mesaEscaneada.set(true); // Solo si ya fue escaneada previamente
      }

      this.pedidoService.setMesa(mesaEncontrada.id, mesaEncontrada.numero);
      this.pedidoService.setCliente(idCliente, this.nombreCliente());
    }
  }

  async escanearQrMesa() {
    const codigoEscaneado = await this.qrService.leerQR();
    await this.buscarMesaAsignada();

    if (!codigoEscaneado) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Se canceló la lectura o no se pudo acceder a la cámara.', 'warning');
      return;
    }

    const nro = this.numeroMesa();
    if (!nro) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Todavía no tenés una mesa asignada por el metre.', 'warning');
      return;
    }

    // Acepta formato mesa_numero:X y mesa_numer:X
    const valido = codigoEscaneado.trim() === `mesa_numero:${nro}` ||
                  codigoEscaneado.trim() === `mesa_numer:${nro}`;

    if (valido) {
      this.mesaEscaneada.set(true);
      localStorage.setItem(`mesa_escaneada_${nro}`, 'true');

      if (this.mesaId()) {
        try {
          await this.supabase.actualizarDisponibilidadMesa(this.mesaId(), 'ocupada');
        } catch (e) {
          console.warn('No se pudo actualizar disponibilidad a ocupada:', e);
        }
      }

      await this.mostrarToast(`¡Mesa N° ${nro} vinculada con éxito! Ya podés hacer tu pedido.`, 'success');
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast(`El código QR no corresponde a tu mesa asignada (Mesa N° ${nro}).`, 'danger');
    }
  }

  /**
   * Navega hacia la carta para que el cliente arme su pedido (Punto 11 y 12)
   */
  async irACarta() {
    if (!this.numeroMesa()) {
      await this.mostrarToast('Debés tener una mesa asignada para hacer un pedido.', 'warning');
      return;
    }
    this.pedidoService.setMesa(this.mesaId(), Number(this.numeroMesa()));
    this.pedidoService.setCliente(this.clienteId(), this.nombreCliente());
    await this.router.navigate(['/carta']);
  }

  /**
   * Permite al cliente modificar el pedido rechazado por el mozo (Punto 13)
   */
  async modificarPedido() {
    const pedido = this.pedidoService.pedidoActivo();
    if (!pedido) return;

    this.pedidoService.cargarPedidoParaModificar(pedido);
    await this.router.navigate(['/carta']);
  }

  /**
   * Simula consulta rápida al mozo (Punto 11)
   */
  async consultarMozo() {
    await this.mostrarToast(`Consulta enviada al mozo para la Mesa N° ${this.numeroMesa()}.`, 'success');
  }

  /**
   * El cliente confirma que recibió el pedido en su mesa (Punto 19)
   */
  async confirmarRecepcionPedido() {
    const pedido = this.pedidoService.pedidoActivo();
    if (!pedido) return;

    try {
      await this.pedidoService.confirmarRecepcionPorCliente(pedido.id);
      await this.mostrarToast('¡Recepción confirmada! Que disfrutes tu comida.', 'success');
    } catch (error) {
      console.error('Error al confirmar recepción del pedido:', error);
      await this.vibracion.errorFuerte();
      await this.mostrarToast('No se pudo confirmar la recepción del pedido.', 'danger');
    }
  }

  /**
   * Solicita la cuenta al mozo para cerrar la mesa
   */
  async pedirLaCuenta() {
    await this.mostrarToast(`¡Solicitud de cuenta enviada al mozo para la Mesa N° ${this.numeroMesa()}!`, 'success');
  }

  /**
   * Reinicia la estadía y el pedido actual para que el cliente vuelva al botón de escanear QR de ingreso
   * y pueda realizar otro pedido desde cero.
   */
  async realizarOtroPedido() {
    const pedido = this.pedidoService.pedidoActivo();
    const idCliente = this.clienteId();
    const idMesa = this.mesaId();
    const nroMesa = this.numeroMesa();

    if (idCliente) {
      try {
        await this.supabase.eliminarClienteDeListaDeEspera(idCliente);
      } catch (e) {
        console.warn('Error limpiando lista de espera al reiniciar:', e);
      }
    }

    await this.pedidoService.finalizarEstadiaParaOtroPedido(pedido?.id, idMesa, nroMesa);

    this.mesaEscaneada.set(false);
    this.numeroMesa.set('');
    this.mesaId.set('');
    this.enListaEspera.set(false);
    this.codigoQrIngreso.set(false);
    this.encuestaCompletada.set(false);

    await this.mostrarToast('¡Estadía reiniciada! Podés escanear el QR de ingreso para un nuevo pedido.', 'success');
  }

  /**
   * Navega a la encuesta de satisfacción o directamente a los gráficos si ya la completó en esta estadía (Punto 20)
   */
  async irAEncuesta() {
    if (this.encuestaCompletada()) {
      await this.mostrarToast('Ya completaste la encuesta en esta estadía. Mostrando gráficos.', 'warning');
      await this.router.navigate(['/graficos-encuesta']);
      return;
    }
    await this.router.navigate(['/encuesta-cliente']);
  }

  /**
   * Indica si el pedido tiene productos de un sector (cocina: platos, bar: bebidas),
   * para mostrar el avance solo de los sectores intervinientes (Punto 15)
   */
  tieneProductosDe(pedido: PedidoClienteUI, tipo: 'plato' | 'bebida'): boolean {
    return pedido.items.some((it) => it.producto?.tipo === tipo);
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR').format(precio);
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

  private iniciarSuscripcionRealtime(): void {
    this.detenerSuscripcionRealtime();

    const idCliente = this.clienteId();
    if (!idCliente) return;

    this.canalRealtime = this.supabase.clienteSupabase
      .channel('cliente-inicio-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          void this.cargarDatosClienteYEstado();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'mesas' },
        async (payload: any) => {
          const mesaModificada = payload.new;
          
          // Si la mesa modificada nos involucra
          if (mesaModificada && mesaModificada.cliente_id === idCliente) {
            await this.buscarMesaAsignada();
          }
        }
      )
      .subscribe();
  }

  private detenerSuscripcionRealtime(): void {
    if (this.canalRealtime) {
      void this.supabase.clienteSupabase.removeChannel(this.canalRealtime);
      this.canalRealtime = null;
    }
  }
}
