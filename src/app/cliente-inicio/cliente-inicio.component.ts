import { Component, OnInit, OnDestroy, computed, signal } from '@angular/core';
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
  IonInput,
  IonSpinner
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
  receiptOutline,
  walletOutline,
  homeOutline
} from 'ionicons/icons';
import { RealtimeChannel } from '@supabase/supabase-js';

import { QrService } from '../services/qr.service';
import { Supabase } from '../services/supabase';
import { VibracionService } from '../services/vibracion';
import { PedidoService } from '../services/pedido.service';
import { PushNotificationsService } from '../services/push-notifications.service';
import { NavbarComponent } from '../components/navbar/navbar.component';
import { PedidoClienteUI } from '../interfaces/pedido';
import { ChatComponent } from '../components/chat/chat.component';
import { CuentaService } from '../services/cuenta.service';
import { Carga } from '../services/carga';
import { EstadoCuenta } from '../interfaces/cuenta';
import { formatearMoneda } from '../utils/calculo-cuenta';

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
    IonInput,
    IonSpinner,
    ChatComponent,
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
  fotoUrlCliente = signal<string>("");
  abrirChatModal = signal<boolean>(false);
  /**
   * Evita mostrar por un instante la pantalla de ingreso mientras se resuelve el estado real del cliente
   */
  cargandoInicial = signal<boolean>(true);
  private temporizadorCargaInicial: any = null;
  private escaneandoQr = false;

  /**
   * Cuenta de la estadía (Punto 21)
   */
  readonly cuentaCliente = this.cuentaService.cuentaCliente;
  readonly cuentaConfirmada = computed(() => this.cuentaCliente()?.estado === 'pago_confirmado');
  readonly formatearMoneda = formatearMoneda;
  private solicitandoCuenta = false;
  private subEstadiaFinalizada: any = null;

  /**
   * Canal activo de Supabase Realtime para cambios en pedidos y mesas
   */
  private canalRealtime: RealtimeChannel | null = null;
  private intervaloEspera: any = null;
  private subPush: any = null;
  private cargandoEstado = false;

  constructor(
    private qrService: QrService,
    private supabase: Supabase,
    private toastCtrl: ToastController,
    private vibracion: VibracionService,
    public pedidoService: PedidoService,
    private pushNotifications: PushNotificationsService,
    private router: Router,
    private cuentaService: CuentaService,
    private carga: Carga
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
      receiptOutline,
      walletOutline,
      homeOutline
    });
  }

  async ngOnInit() {
    // Seguridad: si la carga inicial tarda demasiado o falla, nunca dejar la pantalla en blanco
    this.temporizadorCargaInicial = setTimeout(() => this.cargandoInicial.set(false), 4000);
    void this.pushNotifications.inicializar().then(() =>
      this.pushNotifications.asociarTokenDelUsuarioActual()
    );
    await this.cargarDatosClienteYEstado();
    this.iniciarSuscripcionRealtime();
    this.iniciarPollingEspera();
    this.subPush = this.pushNotifications.notificacionRecibida$.subscribe(() => {
      void this.cargarDatosClienteYEstado();
    });
    this.subEstadiaFinalizada = this.cuentaService.estadiaFinalizada$.subscribe(() => {
      this.reiniciarVistaTrasPago();
    });
  }

  async ionViewWillEnter() {
    if (this.escaneandoQr || this.abrirInputComensales()) {
      return;
    }
    void this.pushNotifications.inicializar().then(() =>
      this.pushNotifications.asociarTokenDelUsuarioActual()
    );
    await this.cargarDatosClienteYEstado();
    this.iniciarSuscripcionRealtime();
    this.iniciarPollingEspera();
  }

  ngOnDestroy() {
    if (this.temporizadorCargaInicial) {
      clearTimeout(this.temporizadorCargaInicial);
      this.temporizadorCargaInicial = null;
    }
    this.detenerSuscripcionRealtime();
    this.detenerPollingEspera();
    if (this.subPush) {
      this.subPush.unsubscribe();
      this.subPush = null;
    }
    if (this.subEstadiaFinalizada) {
      this.subEstadiaFinalizada.unsubscribe();
      this.subEstadiaFinalizada = null;
    }
  }

  /**
   * Si el cliente ingresó como anónimo en una sesión previa sin Auth, crea/recupera su sesión Auth
   * y asocia su correo en la tabla clientes para que funcionen las notificaciones push bidireccionales.
   */
  private async asegurarSesionPushAnonimo(cliAnon: any): Promise<void> {
    try {
      const correoAnon =
        cliAnon.correo ||
        `anonimo_${String(cliAnon.id).replace(/-/g, '').slice(0, 12)}@basilico.com`;
      const claveAnon = 'anonimo123';

      if (!cliAnon.correo) {
        await this.supabase.clienteSupabase
          .from('clientes')
          .update({ correo: correoAnon })
          .eq('id', cliAnon.id);
      }

      const { error: loginErr } = await this.supabase.iniciarSesion(correoAnon, claveAnon);
      if (loginErr) {
        await this.supabase.registrar(correoAnon, claveAnon);
      }

      await this.pushNotifications.inicializar();
      await this.pushNotifications.asociarTokenDelUsuarioActual();
    } catch (e) {
      console.warn('No se pudo asegurar sesión push para cliente anónimo:', e);
    }
  }

  /**
   * Identifica al cliente actual, su lista de espera, la mesa asignada y su pedido activo
   */
  async cargarDatosClienteYEstado() {
    if (this.escaneandoQr || this.abrirInputComensales() || this.cargandoEstado) {
      return;
    }

    this.cargandoEstado = true;
    try {
      const { data: { user } } = await this.supabase.clienteSupabase.auth.getUser();

      if (user?.email) {
        const cliente = await this.supabase.obtenerClientePorCorreo(user.email);
        if (cliente) {
          this.clienteId.set(cliente.id);
          this.nombreCliente.set(`${cliente.nombres} ${cliente.apellidos || ''}`.trim());
          this.fotoUrlCliente.set(cliente.foto_url || "");
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
            const cliAnon = anonimo[0];
            this.clienteId.set(cliAnon.id);
            await this.asegurarSesionPushAnonimo(cliAnon);
          }
        }
      }

      const idCliente = this.clienteId();
      if (!idCliente) return;

      // Si entramos en modal de comensales o escáner mientras esperábamos las llamadas async, no pisar la UI
      if (this.escaneandoQr || this.abrirInputComensales()) {
        return;
      }

      // 1. Verificar si está en lista de espera
      const lista = await this.supabase.obtenerListaDeEspera();
      const enEspera = lista.some((it: any) => it.cliente_id === idCliente);
      const estabaEnEspera =
        this.enListaEspera() || localStorage.getItem(`en_lista_espera_${idCliente}`) === 'true';

      this.enListaEspera.set(enEspera);
      if (enEspera) {
        // Si el cliente está actualmente en la lista de espera, el metre todavía no le asignó mesa
        // para esta nueva estadía, por lo que permanece en la vista de espera.
        localStorage.setItem(`en_lista_espera_${idCliente}`, 'true');
        this.codigoQrIngreso.set(true);
        this.numeroMesa.set('');
        this.mesaId.set('');
        this.mesaEscaneada.set(false);
        this.pedidoService.pedidoActivo.set(null);
        return;
      }

      // 2. Buscar si el metre ya le asignó mesa
      const tieneMesaEnBd = await this.buscarMesaAsignada();

      // Si estaba en lista de espera, ya no está en lista_espera y tampoco tiene mesa asignada -> fue rechazado por el metre
      if (estabaEnEspera && !this.numeroMesa()) {
        localStorage.removeItem(`en_lista_espera_${idCliente}`);
        this.enListaEspera.set(false);
        this.codigoQrIngreso.set(false);
        this.mesaEscaneada.set(false);
        await this.vibracion.errorFuerte();
        await this.mostrarToast('Tu solicitud en la lista de espera fue rechazada por el metre.', 'danger');
        return;
      }

      // Si estaba en lista de espera y el metre le acaba de asignar mesa -> transición en tiempo real a Escanear QR de Mesa
      if (estabaEnEspera && this.numeroMesa() && !this.mesaEscaneada()) {
        localStorage.removeItem(`en_lista_espera_${idCliente}`);
        localStorage.removeItem(`mesa_escaneada_${this.numeroMesa()}`);
        this.enListaEspera.set(false);
        this.codigoQrIngreso.set(true);
        this.mesaEscaneada.set(false);
        await this.mostrarToast(`¡Mesa N° ${this.numeroMesa()} asignada! Escaneá el código QR de tu mesa.`, 'success');
        return;
      }

      if (this.numeroMesa()) {
        localStorage.removeItem(`en_lista_espera_${idCliente}`);
      } else if (!this.abrirInputComensales()) {
        // No está en lista de espera ni tiene mesa asignada -> pantalla inicial de escanear QR de ingreso
        this.codigoQrIngreso.set(false);
        this.mesaEscaneada.set(false);
      }

      // 3. Consultar pedido activo
      if (this.numeroMesa()) {
        const pedido = await this.pedidoService.consultarPedidoActivo(idCliente, this.mesaId());
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

      // 5. Cuenta de la estadía (Punto 21): se recupera desde Supabase para mantener el estado
      try {
        await this.cuentaService.obtenerCuentaCliente(idCliente, !!tieneMesaEnBd);
      } catch (errorCuenta) {
        console.warn('No se pudo consultar la cuenta del cliente:', errorCuenta);
      }
    } catch (error) {
      console.warn('Error al cargar datos del cliente y estado:', error);
    } finally {
      this.cargandoEstado = false;
      this.cargandoInicial.set(false);
    }
  }

  async escanearIngreso() {
    this.escaneandoQr = true;
    try {
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
    } finally {
      setTimeout(() => {
        this.escaneandoQr = false;
      }, 600);
    }
  }

  async confirmarComensales() {
    const comensalesNum = parseInt(this.cantidadComensales(), 10);
    if (!isNaN(comensalesNum) && comensalesNum > 0) {
      this.comensalesValidados.set(comensalesNum);
      this.enListaEspera.set(true);
      this.codigoQrIngreso.set(true);
      this.abrirInputComensales.set(false);
      await this.agregarAListaDeEspera();
      this.cantidadComensales.set("");
    } else {
      await this.mostrarToast('Por favor, ingrese un número válido de comensales.', 'warning');
    }
  }

  cerrarModuleComensales() {
    this.abrirInputComensales.set(false);
    if (!this.enListaEspera() && !this.numeroMesa()) {
      this.codigoQrIngreso.set(false);
    }
  }

  async agregarAListaDeEspera() {
    const idCliente = this.clienteId();
    if (!idCliente) {
      this.enListaEspera.set(false);
      this.codigoQrIngreso.set(false);
      await this.mostrarToast('Iniciá sesión o ingresá como cliente.', 'warning');
      return;
    }

    const { error } = await this.supabase.clienteSupabase
      .from('lista_espera')
      .insert({
        cliente_id: idCliente,
        nombre: this.nombreCliente(),
        comensales: this.comensalesValidados(),
        foto_url: this.fotoUrlCliente(),
      });

    if (error) {
      console.error('Error al anotarse:', error.message);
      this.enListaEspera.set(false);
      this.codigoQrIngreso.set(false);
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Error al anotarse en la lista de espera.', 'danger');
      return;
    }

    // Si quedó una cuenta anterior en pago_confirmado de una visita previa sin tocar "Finalizar visita", se da por cerrada
    const cuentaPrevia = this.cuentaCliente();
    if (cuentaPrevia && cuentaPrevia.estado === 'pago_confirmado') {
      this.cuentaService.marcarCierreVisto(cuentaPrevia.id);
    }

    localStorage.setItem(`en_lista_espera_${idCliente}`, 'true');
    this.enListaEspera.set(true);
    this.codigoQrIngreso.set(true);

    // Notificación push al Metre (Punto 9)
    try {
      await this.pushNotifications.enviarNotificacion(
        '¡Nuevo Cliente en Lista de Espera!',
        `${this.nombreCliente()} (${this.comensalesValidados()} comensales) espera asignación de mesa.`,
        { profiles: ['metre'] },
        { ruta: '/listaEspera' }
      );
    } catch (pushErr) {
      console.warn('[Push] Error al enviar notificación al metre por lista de espera:', pushErr);
    }

    await this.mostrarToast(`¡Te anotaste con éxito en la lista de espera como "${this.nombreCliente()}"!`, 'success');
  }

  async buscarMesaAsignada(): Promise<boolean | void> {
    const idCliente = this.clienteId();
    if (!idCliente) return;

    const mesas = await this.supabase.obtenerMesas();
    const mesasDelCliente = mesas.filter((m: any) => m.cliente_id === idCliente);
    const mesaEncontrada =
      mesasDelCliente.find((m: any) => m.disponibilidad === 'ocupada') ||
      mesasDelCliente.find((m: any) => m.disponibilidad === 'asignada') ||
      mesasDelCliente[0];

    if (mesaEncontrada) {
      // Seteamos el número y la ID de la mesa, pero NO mesaEscaneada todavía
      this.numeroMesa.set(String(mesaEncontrada.numero));
      this.mesaId.set(mesaEncontrada.id);
      this.codigoQrIngreso.set(true);
      localStorage.setItem('identificador', `Mesa ${mesaEncontrada.numero}`);

      // Verificamos si el cliente YA HABÍA escaneado esta mesa antes (guardado en localStorage)
      const guardada = localStorage.getItem(`mesa_escaneada_${mesaEncontrada.numero}`);
      if (mesaEncontrada.disponibilidad === 'ocupada' && guardada === 'true') {
        localStorage.setItem(`mesa_escaneada_${mesaEncontrada.numero}`, 'true');
        this.mesaEscaneada.set(true); // Solo si ya fue escaneada previamente en esta estadía
      } else {
        this.mesaEscaneada.set(false);
      }

      this.pedidoService.setMesa(mesaEncontrada.id, mesaEncontrada.numero);
      this.pedidoService.setCliente(idCliente, this.nombreCliente());
      return true;
    }
  }

  async escanearQrMesa() {
    this.escaneandoQr = true;
    try {
      const codigoEscaneado = await this.qrService.leerQR();
      const tieneMesaEnBd = await this.buscarMesaAsignada();

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
        // Al vincular exitosamente la mesa para una nueva estadía, cerrar cuenta anterior si quedó en pago_confirmado
        const cuentaPrevia = this.cuentaCliente();
        if (cuentaPrevia && cuentaPrevia.estado === 'pago_confirmado') {
          this.cuentaService.marcarCierreVisto(cuentaPrevia.id);
        }

        this.mesaEscaneada.set(true);
        localStorage.setItem(`mesa_escaneada_${nro}`, 'true');

        if (this.mesaId()) {
          try {
            await this.supabase.actualizarDisponibilidadMesa(this.mesaId(), 'ocupada');
          } catch (e) {
            console.warn('No se pudo actualizar disponibilidad a ocupada:', e);
          }
        }

        // SEGURIDAD: Archivar pedidos anteriores no finalizados para arrancar siempre limpio
        try {
          if (this.mesaId()) {
            await this.supabase.clienteSupabase
              .from('pedidos')
              .update({ estado: 'finalizado' })
              .eq('mesa_id', this.mesaId())
              .not('estado', 'in', '("finalizado","pagado")');
          }
          if (this.clienteId()) {
            await this.supabase.clienteSupabase
              .from('pedidos')
              .update({ estado: 'finalizado' })
              .eq('cliente_id', this.clienteId())
              .not('estado', 'in', '("finalizado","pagado")');
          }
        } catch (e) {
          console.warn('Error al archivar pedidos anteriores:', e);
        }

        // Iniciar siempre desde 0
        this.pedidoService.limpiarCarrito();
        this.pedidoService.pedidoActivo.set(null);
        this.pedidoService.setMesa(this.mesaId(), Number(nro));
        this.pedidoService.setCliente(this.clienteId(), this.nombreCliente());

        await this.mostrarToast(`¡Mesa N° ${nro} vinculada con éxito! Ya podés hacer tu pedido.`, 'success');
      } else {
        await this.vibracion.errorFuerte();
        await this.mostrarToast(`El código QR no corresponde a tu mesa asignada (Mesa N° ${nro}).`, 'danger');
      }
    } finally {
      setTimeout(() => {
        this.escaneandoQr = false;
      }, 600);
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
    if (!this.pedidoService.pedidoActivo()) {
      this.pedidoService.limpiarCarrito();
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
   * Punto 21 — El cliente solicita la cuenta al mozo.
   * Se valida mesa y pedido recibido, se persiste la solicitud en Supabase (idempotente)
   * y se envía la notificación push a los mozos. Luego se pasa a la pantalla de la cuenta.
   */
  async pedirLaCuenta() {
    if (this.solicitandoCuenta) return;

    const cuentaExistente = this.cuentaCliente();
    if (cuentaExistente && cuentaExistente.estado !== 'pago_confirmado') {
      await this.router.navigate(['/cuenta']);
      return;
    }

    const pedido = this.pedidoService.pedidoActivo();
    if (!this.mesaId() || !this.numeroMesa() || !this.mesaEscaneada()) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Necesitás tener tu mesa asignada y vinculada para pedir la cuenta.', 'danger');
      return;
    }
    if (!pedido || pedido.estado !== 'recibido') {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Primero tenés que confirmar la recepción de tu pedido.', 'danger');
      return;
    }

    this.solicitandoCuenta = true;
    try {
      const { yaExistia, avisoEnviado } = await this.carga.ejecutar('Solicitando la cuenta...', () =>
        this.cuentaService.solicitarCuenta(this.mesaId(), Number(this.numeroMesa()), pedido.id)
      );

      if (yaExistia) {
        await this.mostrarToast('Ya habías solicitado la cuenta. Te mostramos su estado.', 'warning');
      } else if (avisoEnviado) {
        await this.mostrarToast(`¡Cuenta solicitada! El mozo de la Mesa N° ${this.numeroMesa()} ya fue notificado.`, 'success');
      } else {
        await this.vibracion.error();
        await this.mostrarToast('La cuenta quedó solicitada, pero no pudimos avisar al mozo. Podés reintentar desde tu cuenta.', 'warning');
      }

      await this.router.navigate(['/cuenta']);
    } catch (error: any) {
      console.error('Error al solicitar la cuenta:', error);
      await this.vibracion.errorFuerte();
      await this.mostrarToast(error?.message ?? 'No se pudo solicitar la cuenta.', 'danger');
    } finally {
      this.solicitandoCuenta = false;
    }
  }

  async irACuenta() {
    await this.router.navigate(['/cuenta']);
  }

  /**
   * Texto del estado de la cuenta para el botón de la pantalla de la mesa
   */
  descripcionEstadoCuenta(estado: EstadoCuenta): string {
    switch (estado) {
      case 'pendiente_propina': return 'Falta escanear el QR de propina';
      case 'lista_para_pagar': return 'Lista para pagar';
      case 'pago_pendiente_confirmacion': return 'Pago enviado, esperando al mozo';
      default: return 'Pago confirmado';
    }
  }

  /**
   * Cierre de la visita luego de que el mozo confirmó el pago
   */
  async finalizarVisitaTrasPago() {
    const cuenta = this.cuentaCliente();
    if (!cuenta) return;

    localStorage.removeItem(`mesa_escaneada_${cuenta.numero_mesa}`);
    this.pedidoService.limpiarCarrito();
    this.pedidoService.pedidoActivo.set(null);
    this.pedidoService.mesaActual.set(null);
    this.cuentaService.marcarCierreVisto(cuenta.id);
    await this.mostrarToast('¡Gracias por visitar Basílico! Te esperamos pronto.', 'success');
  }

  private reiniciarVistaTrasPago(): void {
    this.mesaEscaneada.set(false);
    this.numeroMesa.set('');
    this.mesaId.set('');
    this.enListaEspera.set(false);
    this.codigoQrIngreso.set(false);
    this.encuestaCompletada.set(false);
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
      .channel(`cliente-inicio-realtime-${Date.now()}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pedidos' },
        () => {
          void this.cargarDatosClienteYEstado();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cuentas' },
        () => {
          void this.cargarDatosClienteYEstado();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lista_espera' },
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
            await this.cargarDatosClienteYEstado();
            localStorage.setItem("identificador", `Mesa ${mesaModificada.numero}`);
          }
        }
      )
      .subscribe();
  }

  private iniciarPollingEspera(): void {
    this.detenerPollingEspera();
    this.intervaloEspera = setInterval(() => {
      // Mientras el cliente no tenga la mesa escaneada (pantalla de ingreso, lista de espera o mesa asignada),
      // verificamos cada 2.5s por si la tabla lista_espera no tiene habilitado Realtime en Supabase.
      // Así otro dispositivo del mismo cliente también refleja el cambio sin recargar.
      if (
        this.clienteId() &&
        !this.mesaEscaneada() &&
        !this.escaneandoQr &&
        !this.abrirInputComensales() &&
        !document.hidden
      ) {
        void this.cargarDatosClienteYEstado();
      }
    }, 2500);
  }

  private detenerPollingEspera(): void {
    if (this.intervaloEspera) {
      clearInterval(this.intervaloEspera);
      this.intervaloEspera = null;
    }
  }

  alternarChat() {
    this.abrirChatModal.set(!this.abrirChatModal());  
  } 

  private detenerSuscripcionRealtime(): void {
    if (this.canalRealtime) {
      void this.supabase.clienteSupabase.removeChannel(this.canalRealtime);
      this.canalRealtime = null;
    }
  }
}
