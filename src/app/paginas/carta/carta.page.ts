import {
  Component,
  ChangeDetectorRef,
  ViewChild,
  OnInit,
  OnDestroy,
  signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonIcon,
  IonModal,
  IonFooter,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  addOutline,
  removeOutline,
  trashOutline,
  cartOutline,
  timeOutline,
  closeOutline,
  checkmarkCircleOutline,
  restaurantOutline,
  wineOutline,
  arrowForwardOutline,
  alertCircleOutline,
  createOutline,
  saveOutline,
  warningOutline,
  cameraOutline,
  arrowUndoOutline
} from 'ionicons/icons';

import { Supabase } from '../../services/supabase';
import { Carga } from '../../services/carga';
import { VibracionService } from '../../services/vibracion';
import { PedidoService } from '../../services/pedido.service';
import { Producto } from '../../interfaces/producto';

@Component({
  selector: 'app-carta',
  standalone: true,
  templateUrl: './carta.page.html',
  styleUrls: ['./carta.page.scss'],
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonIcon,
    IonModal,
    IonFooter
  ]
})
export class CartaPage implements OnInit, OnDestroy {

  @ViewChild(IonContent) ionContent?: IonContent;

  productos: Producto[] = [];
  cargando: boolean = false;

  // Filtro por categoría: 'todos' | 'plato' | 'bebida'
  categoriaSeleccionada: 'todos' | 'plato' | 'bebida' = 'todos';

  // Índice del producto mostrado a pantalla completa (0 a N-1)
  indiceProductoActual: number = 0;

  // Índice de fotografía activa por producto (id_producto -> 0 | 1 | 2)
  indiceFoto: Record<string, number> = {};

  // Estado de expansión de la descripción por producto
  descripcionExpandida: Record<string, boolean> = {};

  /* =========================================================
     AVANCE AUTOMÁTICO (Cada 6 segundos, desactivado por defecto)
     ========================================================= */
  autoPlayActivo: boolean = false;
  progresoAutoPlay: number = 0; // 0% a 100%
  estaInteractuando: boolean = false;

  private autoPlayInterval: ReturnType<typeof setInterval> | null = null;
  private readonly TICK_MS: number = 100;
  private readonly DURACION_TOTAL_MS: number = 6000;
  private readonly INCREMENTO_TICK: number = (100 / (6000 / 100)); // ~1.666% cada 100ms
  private timeoutInteraccion: ReturnType<typeof setTimeout> | null = null;

  /* =========================================================
     MOTOR DE GESTOS TÁCTILES (Desacopla horizontal y vertical)
     ========================================================= */
  touchStartX: number = 0;
  touchStartY: number = 0;
  touchStartTime: number = 0;
  dragVerticalOffset: number = 0;
  dragHorizontalOffset: number = 0;
  esArrastrando: boolean = false;
  direccionGesto: 'vertical' | 'horizontal' | null = null;

  private readonly UMBRAL_DETECCION_EJE: number = 10;
  private readonly UMBRAL_SWIPE_VERTICAL: number = 55;
  private readonly UMBRAL_SWIPE_HORIZONTAL: number = 45;
  private ultimoWheelTimestamp: number = 0;

  /**
   * Indica si el usuario logueado es un empleado (cocinero, cantinero, mozo, etc.).
   * Los empleados solo consultan la carta: no pueden agregar productos al pedido.
   */
  esEmpleado: boolean = false;
  private readonly PERFILES_EMPLEADO: string[] = ['duenio', 'supervisor', 'metre', 'mozo', 'cocinero', 'cantinero'];

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.detenerAutoPlay();
  }

  async ionViewWillEnter(): Promise<void> {
    const perfil = localStorage.getItem('perfil')?.toLowerCase()?.trim() ?? '';
    this.esEmpleado = this.PERFILES_EMPLEADO.includes(perfil);

    if (!this.esEmpleado) {
      await this.verificarSesionYMesa();
    }
    await this.cargarProductos();
  }

  ionViewWillLeave(): void {
    this.detenerAutoPlay();
  }

  /**
   * Estado reactivo que controla la apertura del modal de confirmación y revisión del pedido
   */
  mostrarModalPedido = signal<boolean>(false);

  /**
   * Estado para indicar si se está procesando el envío a Supabase
   */
  enviandoPedido = signal<boolean>(false);

  get platos(): Producto[] {
    return this.productos.filter(producto => producto.tipo === 'plato');
  }

  get bebidas(): Producto[] {
    return this.productos.filter(producto => producto.tipo === 'bebida');
  }

  get productosVisibles(): Producto[] {
    if (this.categoriaSeleccionada === 'plato') {
      return this.platos;
    }
    if (this.categoriaSeleccionada === 'bebida') {
      return this.bebidas;
    }
    return this.productos;
  }

  get productoActual(): Producto | null {
    if (this.productosVisibles.length === 0) return null;
    return this.productosVisibles[this.indiceProductoActual] ?? null;
  }

  constructor(
    private supabase: Supabase,
    private vibracion: VibracionService,
    public carga: Carga,
    public pedidoService: PedidoService,
    private cdr: ChangeDetectorRef,
    private toastCtrl: ToastController,
    private router: Router
  ) {
    addIcons({
      addOutline,
      removeOutline,
      trashOutline,
      cartOutline,
      timeOutline,
      closeOutline,
      checkmarkCircleOutline,
      restaurantOutline,
      wineOutline,
      arrowForwardOutline,
      alertCircleOutline,
      createOutline,
      saveOutline,
      warningOutline,
      cameraOutline,
      arrowUndoOutline
    });
  }

  /**
   * Asegura que el PedidoService tenga enlazada la mesa y el cliente si se ingresó directamente a la carta
   */
  private async verificarSesionYMesa() {
    try {
      if (!this.pedidoService.clienteActual() || !this.pedidoService.mesaActual()) {
        const { data: { user } } = await this.supabase.clienteSupabase.auth.getUser();
        let clienteId = '';
        let nombre = 'Cliente';

        if (user?.email) {
          const cliente = await this.supabase.obtenerClientePorCorreo(user.email);
          if (cliente) {
            clienteId = cliente.id;
            nombre = `${cliente.nombres} ${cliente.apellidos}`.trim();
          }
        } else {
          // Cliente anónimo desde localStorage o clientes
          const nombreGuardado = localStorage.getItem('nombre');
          if (nombreGuardado) {
            nombre = nombreGuardado;
            const { data: anonimo } = await this.supabase.clienteSupabase
              .from('clientes')
              .select('*')
              .ilike('nombres', nombreGuardado)
              .order('created_at', { ascending: false })
              .limit(1);
            if (anonimo && anonimo.length > 0) {
              clienteId = anonimo[0].id;
            }
          }
        }

        if (clienteId) {
          this.pedidoService.setCliente(clienteId, nombre, user?.id);

          const mesas = await this.supabase.obtenerMesas();
          const mesa = mesas.find((m: any) => m.cliente_id === clienteId);
          if (mesa) {
            this.pedidoService.setMesa(mesa.id, mesa.numero);
          }
        }
      }
    } catch (e) {
      console.warn('Error al verificar sesión y mesa en carta:', e);
    }
  }

  async cargarProductos(): Promise<void> {
    this.cargando = true;
    try {
      this.productos = await this.carga.ejecutar(
        'Cargando carta...',
        () => this.supabase.obtenerProductos()
      );

      this.indiceProductoActual = 0;
      this.progresoAutoPlay = 0;
      this.cdr.detectChanges();
    } catch (error) {
      await this.vibracion.errorFuerte();
      console.error('Error al cargar la carta:', error);
    } finally {
      this.cargando = false;
      this.cdr.detectChanges();
    }
  }

  /* =========================================================
     MÉTODOS PREPARADOS PARA SENSORES (ACELERÓMETRO Y GIROSCOPIO)
     Reutilizables para el Punto 31:
     - Inclinación vertical (hacia adelante/atrás): siguienteProducto() / anteriorProducto()
     - Inclinación lateral (hacia derecha/izquierda): siguienteFoto() / anteriorFoto()
     ========================================================= */

  fotosVerticales: Record<string, boolean> = {};

  /**
   * Avanza al siguiente producto de la carta.
   * Apto para ser llamado por gestos táctiles, botones o giroscopio/acelerómetro.
   */
  public siguienteProducto(esAutomatico: boolean = false): void {
    if (this.productosVisibles.length === 0) return;

    if (this.indiceProductoActual < this.productosVisibles.length - 1) {
      this.indiceProductoActual++;
      this.alCambiarProducto();
    } else if (esAutomatico) {
      // Loop continuo en reproducción automática al llegar al final
      this.indiceProductoActual = 0;
      this.alCambiarProducto();
    }
  }

  /**
   * Retrocede al producto anterior de la carta.
   * Apto para ser llamado por gestos táctiles, botones o giroscopio/acelerómetro.
   */
  public anteriorProducto(): void {
    if (this.productosVisibles.length === 0) return;

    if (this.indiceProductoActual > 0) {
      this.indiceProductoActual--;
      this.alCambiarProducto();
    }
  }

  /**
   * Avanza a la siguiente fotografía del producto (carrusel horizontal).
   * Apto para ser llamado por gestos táctiles, botones o acelerómetro lateral.
   */
  public siguienteFoto(producto?: Producto): void {
    const prod = producto ?? this.productoActual;
    if (!prod || !prod.fotos || prod.fotos.length <= 1) return;

    const actual = this.indiceFoto[prod.id] ?? 0;
    const nuevo = actual >= prod.fotos.length - 1 ? 0 : actual + 1;
    this.indiceFoto[prod.id] = nuevo;

    this.vibracion.toque().catch(() => {});
    this.pausarTemporalmenteAutoPlay();
    this.cdr.detectChanges();
  }

  /**
   * Retrocede a la fotografía anterior del producto (carrusel horizontal).
   * Apto para ser llamado por gestos táctiles, botones o acelerómetro lateral.
   */
  public anteriorFoto(producto?: Producto): void {
    const prod = producto ?? this.productoActual;
    if (!prod || !prod.fotos || prod.fotos.length <= 1) return;

    const actual = this.indiceFoto[prod.id] ?? 0;
    const nuevo = actual <= 0 ? prod.fotos.length - 1 : actual - 1;
    this.indiceFoto[prod.id] = nuevo;

    this.vibracion.toque().catch(() => {});
    this.pausarTemporalmenteAutoPlay();
    this.cdr.detectChanges();
  }

  /**
   * Salta a una foto puntual por índice.
   */
  public irAFoto(indice: number, producto?: Producto): void {
    const prod = producto ?? this.productoActual;
    if (!prod || !prod.fotos) return;
    if (indice >= 0 && indice < prod.fotos.length) {
      this.indiceFoto[prod.id] = indice;
      this.vibracion.toque().catch(() => {});
      this.pausarTemporalmenteAutoPlay();
      this.cdr.detectChanges();
    }
  }

  /**
   * Salta a un producto específico por índice.
   */
  public irAProducto(indice: number): void {
    if (indice >= 0 && indice < this.productosVisibles.length) {
      this.indiceProductoActual = indice;
      this.alCambiarProducto();
    }
  }

  private alCambiarProducto(): void {
    this.progresoAutoPlay = 0;
    this.vibracion.toque().catch(() => {});

    // Reinicia el estado de descripción expandida en el producto anterior
    const prodActual = this.productoActual;
    if (prodActual && this.descripcionExpandida[prodActual.id]) {
      this.descripcionExpandida[prodActual.id] = false;
    }

    this.cdr.detectChanges();
  }

  /* =========================================================
     CONTROL DE CATEGORÍAS
     ========================================================= */
  cambiarCategoria(categoria: 'todos' | 'plato' | 'bebida'): void {
    if (this.categoriaSeleccionada === categoria) return;

    this.categoriaSeleccionada = categoria;
    this.indiceProductoActual = 0;
    this.progresoAutoPlay = 0;
    this.vibracion.toque().catch(() => {});
    this.cdr.detectChanges();
  }

  /* =========================================================
     REPRODUCCIÓN AUTOMÁTICA
     ========================================================= */
  alternarAutoPlay(): void {
    this.autoPlayActivo = !this.autoPlayActivo;
    this.progresoAutoPlay = 0;
    this.vibracion.toque().catch(() => {});
    this.cdr.detectChanges();
  }

  private iniciarLoopAutoPlay(): void {
    this.detenerAutoPlay();
    this.autoPlayInterval = setInterval(() => {
      if (!this.autoPlayActivo) return;

      // Si el usuario está interactuando o tocando, pausar avance
      if (this.estaInteractuando) return;

      // Si la descripción está abierta, priorizar la lectura y pausar
      const prod = this.productoActual;
      if (prod && this.descripcionExpandida[prod.id]) return;

      this.progresoAutoPlay += this.INCREMENTO_TICK;
      if (this.progresoAutoPlay >= 100) {
        this.progresoAutoPlay = 0;
        this.siguienteProducto(true);
      }
      this.cdr.detectChanges();
    }, this.TICK_MS);
  }

  private detenerAutoPlay(): void {
    if (this.autoPlayInterval) {
      clearInterval(this.autoPlayInterval);
      this.autoPlayInterval = null;
    }
    if (this.timeoutInteraccion) {
      clearTimeout(this.timeoutInteraccion);
      this.timeoutInteraccion = null;
    }
  }

  marcarInteraccionUsuario(): void {
    this.estaInteractuando = true;
    if (this.timeoutInteraccion) {
      clearTimeout(this.timeoutInteraccion);
      this.timeoutInteraccion = null;
    }
  }

  finalizarInteraccionUsuario(retrasoMs: number = 2000): void {
    if (this.timeoutInteraccion) {
      clearTimeout(this.timeoutInteraccion);
    }
    this.timeoutInteraccion = setTimeout(() => {
      this.estaInteractuando = false;
      this.cdr.detectChanges();
    }, retrasoMs);
  }

  pausarTemporalmenteAutoPlay(): void {
    this.marcarInteraccionUsuario();
    this.finalizarInteraccionUsuario(2500);
  }

  alternarDescripcion(producto: Producto): void {
    this.descripcionExpandida[producto.id] = !this.descripcionExpandida[producto.id];
    this.pausarTemporalmenteAutoPlay();
    this.cdr.detectChanges();
  }

  /* =========================================================
     GESTOS TÁCTILES DESACOPLADOS (HORIZONTAL / VERTICAL)
     ========================================================= */
  onTouchStart(event: TouchEvent): void {
    if (event.touches.length !== 1) return;

    const touch = event.touches[0];
    this.touchStartX = touch.clientX;
    this.touchStartY = touch.clientY;
    this.touchStartTime = Date.now();
    this.dragVerticalOffset = 0;
    this.dragHorizontalOffset = 0;
    this.direccionGesto = null;
    this.esArrastrando = true;
    this.marcarInteraccionUsuario();
  }

  onTouchMove(event: TouchEvent): void {
    if (!this.esArrastrando || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = touch.clientX - this.touchStartX;
    const deltaY = touch.clientY - this.touchStartY;

    // Si aún no definimos el eje, verificar cuál supera primero el umbral
    if (!this.direccionGesto) {
      const distancia = Math.hypot(deltaX, deltaY);
      if (distancia >= this.UMBRAL_DETECCION_EJE) {
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
          this.direccionGesto = 'horizontal';
        } else {
          this.direccionGesto = 'vertical';
        }
      }
    }

    if (this.direccionGesto === 'vertical') {
      if (event.cancelable) {
        event.preventDefault();
      }

      const enPrimero = this.indiceProductoActual === 0 && deltaY > 0;
      const enUltimo = this.indiceProductoActual === (this.productosVisibles.length - 1) && deltaY < 0;

      // Resistencia elástica en extremos para dar feedback táctil natural
      if (enPrimero || enUltimo) {
        this.dragVerticalOffset = deltaY * 0.25;
      } else {
        this.dragVerticalOffset = deltaY;
      }
    } else if (this.direccionGesto === 'horizontal') {
      const prod = this.productoActual;
      const totalFotos = prod?.fotos?.length ?? 0;
      const fotoActual = prod ? (this.indiceFoto[prod.id] ?? 0) : 0;

      const enPrimeraFoto = fotoActual === 0 && deltaX > 0;
      const enUltimaFoto = fotoActual === (totalFotos - 1) && deltaX < 0;

      if (enPrimeraFoto || enUltimaFoto) {
        this.dragHorizontalOffset = deltaX * 0.25;
      } else {
        this.dragHorizontalOffset = deltaX;
      }
    }
  }

  onTouchEnd(event: TouchEvent): void {
    if (!this.esArrastrando) return;

    const deltaY = this.dragVerticalOffset;
    const deltaX = this.dragHorizontalOffset;
    const duracion = Math.max(1, Date.now() - this.touchStartTime);

    if (this.direccionGesto === 'vertical') {
      const velocidadY = Math.abs(deltaY) / duracion;
      const swipeRapido = velocidadY > 0.4 && Math.abs(deltaY) > 30;
      const swipeLargo = Math.abs(deltaY) >= this.UMBRAL_SWIPE_VERTICAL;

      if (swipeRapido || swipeLargo) {
        if (deltaY < 0) {
          this.siguienteProducto();
        } else {
          this.anteriorProducto();
        }
      }
    } else if (this.direccionGesto === 'horizontal') {
      const velocidadX = Math.abs(deltaX) / duracion;
      const swipeRapido = velocidadX > 0.35 && Math.abs(deltaX) > 25;
      const swipeLargo = Math.abs(deltaX) >= this.UMBRAL_SWIPE_HORIZONTAL;

      if (swipeRapido || swipeLargo) {
        if (deltaX < 0) {
          this.siguienteFoto();
        } else {
          this.anteriorFoto();
        }
      }
    }

    this.dragVerticalOffset = 0;
    this.dragHorizontalOffset = 0;
    this.direccionGesto = null;
    this.esArrastrando = false;
    this.finalizarInteraccionUsuario();
    this.cdr.detectChanges();
  }

  /* =========================================================
     ACCESIBILIDAD Y PRUEBAS EN NAVEGADOR (RUEDA Y TECLADO)
     ========================================================= */
  onWheel(event: WheelEvent): void {
    const ahora = Date.now();
    if (ahora - this.ultimoWheelTimestamp < 360) return;

    if (Math.abs(event.deltaY) > 25) {
      this.ultimoWheelTimestamp = ahora;
      this.marcarInteraccionUsuario();
      if (event.deltaY > 0) {
        this.siguienteProducto();
      } else {
        this.anteriorProducto();
      }
      this.finalizarInteraccionUsuario();
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.siguienteProducto();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.anteriorProducto();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      this.siguienteFoto();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      this.anteriorFoto();
    }
  }

  /* =========================================================
     TRANSFORMS DE HARDWARE ACELERADO (GPU)
     ========================================================= */
  obtenerTransformTrack(): string {
    const drag = this.direccionGesto === 'vertical' ? this.dragVerticalOffset : 0;
    return `translate3d(0, calc(-${this.indiceProductoActual * 100}% + ${drag}px), 0)`;
  }

  obtenerTransformFotos(producto: Producto): string {
    const indice = this.obtenerIndiceFoto(producto.id);
    const drag = (this.direccionGesto === 'horizontal' && producto.id === this.productoActual?.id)
      ? this.dragHorizontalOffset
      : 0;
    return `translate3d(calc(-${indice * 100}% + ${drag}px), 0, 0)`;
  }

  obtenerIndiceFoto(productoId: string): number {
    return this.indiceFoto[productoId] ?? 0;
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR').format(precio);
  }


  /* ============================================================
     GESTIÓN DE PRODUCTOS Y CARRITO DE PEDIDO (PUNTO 12 Y 13)
  ============================================================ */

  agregarProducto(producto: Producto): void {
    if (this.esEmpleado) return;
    this.pedidoService.agregarProducto(producto);
  }

  decrementarProducto(productoId: string): void {
    this.pedidoService.decrementarProducto(productoId);
  }

  eliminarProducto(productoId: string): void {
    this.pedidoService.eliminarProducto(productoId);
  }

  abrirModalPedido(): void {
    if (this.pedidoService.cantidadTotal() === 0) {
      void this.mostrarToast('El carrito está vacío. Agregá productos para continuar.', 'warning');
      return;
    }
    this.mostrarModalPedido.set(true);
  }

  cerrarModalPedido(): void {
    this.mostrarModalPedido.set(false);
  }

  /**
   * Finaliza el pedido del cliente y lo envía a revisión del Mozo (Puntos 12 y 13)
   */
  async confirmarYEnviarPedido(): Promise<void> {
    if (this.enviandoPedido()) return;

    if (!this.pedidoService.mesaActual()) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast(
        'Debés tener una mesa asignada y escaneada para realizar el pedido.',
        'warning'
      );
      return;
    }

    this.enviandoPedido.set(true);

    try {
      await this.carga.ejecutar(
        this.pedidoService.modoEdicion() ? 'Actualizando pedido...' : 'Enviando pedido al mozo...',
        async () => {
          await this.pedidoService.enviarPedido();
        }
      );

      this.cerrarModalPedido();
      const esEdicion = this.pedidoService.modoEdicion();
      const mensaje = esEdicion
        ? '¡Pedido actualizado y reenviado al mozo con éxito!'
        : '¡Pedido enviado al mozo con éxito! Esperando su confirmación.';

      await this.mostrarToast(mensaje, 'success');
      await this.router.navigate(['/clienteInicio']);
    } catch (error: any) {
      console.error('Error al enviar pedido:', error);
      await this.vibracion.errorFuerte();
      const detalle = error?.message || 'No se pudo procesar el pedido. Intente nuevamente.';
      await this.mostrarToast(detalle, 'danger');
    } finally {
      this.enviandoPedido.set(false);
    }
  }

  /* ============================================================
     EDICIÓN Y BAJA DE PRODUCTOS (SOLO EMPLEADOS)
  ============================================================ */

  /**
   * Estado del modal de edición y copia editable del producto seleccionado
   */
  mostrarModalEdicion = signal<boolean>(false);
  guardandoEdicion = signal<boolean>(false);
  productoEnEdicion: Producto | null = null;
  formularioEdicion = {
    nombre: '',
    descripcion: '',
    tiempo_elaboracion: null as number | null,
    precio: null as number | null
  };
  erroresEdicion = {
    nombre: false,
    descripcion: false,
    tiempo_elaboracion: false,
    precio: false
  };

  /**
   * Fotos mostradas en el modal: URL actual del producto o ruta local (webPath) de la foto nueva.
   * fotosReemplazadas[i] indica si la foto i fue cambiada y debe subirse al guardar.
   */
  fotosEdicion: string[] = [];
  fotosReemplazadas: boolean[] = [];

  abrirEdicionProducto(producto: Producto): void {
    if (!this.esEmpleado) return;

    this.productoEnEdicion = producto;
    this.formularioEdicion = {
      nombre: producto.nombre,
      descripcion: producto.descripcion,
      tiempo_elaboracion: producto.tiempo_elaboracion,
      precio: producto.precio
    };
    this.erroresEdicion = { nombre: false, descripcion: false, tiempo_elaboracion: false, precio: false };
    this.fotosEdicion = [...(producto.fotos ?? [])];
    this.fotosReemplazadas = this.fotosEdicion.map(() => false);
    this.pausarTemporalmenteAutoPlay();
    this.mostrarModalEdicion.set(true);
  }

  cerrarModalEdicion(): void {
    this.mostrarModalEdicion.set(false);
    this.productoEnEdicion = null;
  }

  /**
   * Reemplaza una foto puntual con la cámara o la galería (se sube recién al guardar)
   */
  async seleccionarFotoEdicion(indice: number): Promise<void> {
    try {
      const imagen = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt,
        webUseInput: true
      });

      if (!imagen.webPath) return;

      this.fotosEdicion[indice] = imagen.webPath;
      this.fotosReemplazadas[indice] = true;
      this.cdr.detectChanges();
    } catch (error) {
      // El usuario canceló la selección o no se pudo acceder a la cámara
      console.warn('No se seleccionó una foto nueva:', error);
    }
  }

  /**
   * Descarta la foto nueva y vuelve a mostrar la original del producto
   */
  deshacerFotoEdicion(indice: number): void {
    const original = this.productoEnEdicion?.fotos?.[indice];
    if (original === undefined) return;

    this.fotosEdicion[indice] = original;
    this.fotosReemplazadas[indice] = false;
    this.cdr.detectChanges();
  }

  async guardarEdicionProducto(): Promise<void> {
    const producto = this.productoEnEdicion;
    if (!producto || this.guardandoEdicion()) return;

    const { nombre, descripcion, tiempo_elaboracion, precio } = this.formularioEdicion;

    // Mismas validaciones que en el alta de platos y bebidas
    this.erroresEdicion = {
      nombre: nombre.trim().length < 3,
      descripcion: descripcion.trim().length < 10,
      tiempo_elaboracion: tiempo_elaboracion === null || tiempo_elaboracion <= 0,
      precio: precio === null || precio <= 0
    };

    if (Object.values(this.erroresEdicion).some(error => error)) {
      await this.vibracion.errorFuerte();
      return;
    }

    this.guardandoEdicion.set(true);
    const fotosOriginales = [...(producto.fotos ?? [])];
    const urlsSubidas: string[] = [];

    try {
      const actualizado = await this.carga.ejecutar(
        'Guardando cambios...',
        async () => {
          // 1. Subir solo las fotos que se reemplazaron
          const carpeta = producto.tipo === 'bebida' ? 'bebidas' : 'platos';
          const idFotos = Date.now();
          const fotosFinales = [...this.fotosEdicion];

          for (let i = 0; i < fotosFinales.length; i++) {
            if (!this.fotosReemplazadas[i]) continue;

            const resultado = await this.supabase.subirFotoProducto(
              fotosFinales[i],
              `${carpeta}/${idFotos}-${i}.jpg`
            );
            const url = this.supabase.obtenerUrlFotoProducto(resultado.path);
            urlsSubidas.push(url);
            fotosFinales[i] = url;
          }

          // 2. Guardar los datos y el nuevo arreglo de fotos
          return this.supabase.actualizarProducto(producto.id, {
            nombre,
            descripcion,
            tiempo_elaboracion: tiempo_elaboracion!,
            precio: precio!,
            fotos: fotosFinales
          });
        }
      );

      // 3. Borrar de Storage las fotos viejas que ya no se usan (si falla, no afecta al producto)
      const fotosViejas = fotosOriginales.filter(url => !actualizado.fotos.includes(url));
      this.supabase.eliminarFotosProducto(fotosViejas)
        .catch(err => console.warn('No se pudieron borrar las fotos anteriores:', err));

      this.productos = this.productos.map(p => p.id === producto.id ? { ...p, ...actualizado } : p);
      this.cerrarModalEdicion();
      await this.mostrarToast('Producto actualizado con éxito.', 'success');
    } catch (error: any) {
      console.error('Error al editar el producto:', error);

      // Si el guardado falló, se borran las fotos nuevas que alcanzaron a subirse
      this.supabase.eliminarFotosProducto(urlsSubidas)
        .catch(err => console.warn('No se pudieron borrar las fotos subidas:', err));

      await this.vibracion.errorFuerte();
      await this.mostrarToast(error?.message || 'No se pudo actualizar el producto.', 'danger');
    } finally {
      this.guardandoEdicion.set(false);
      this.cdr.detectChanges();
    }
  }

  /**
   * Estado del diálogo de eliminación y producto pendiente de confirmación.
   * El producto se limpia recién al terminar la animación de cierre (didDismiss).
   */
  mostrarDialogoEliminar = signal<boolean>(false);
  productoAEliminar = signal<Producto | null>(null);

  confirmarEliminarProducto(producto: Producto): void {
    if (!this.esEmpleado) return;

    this.pausarTemporalmenteAutoPlay();
    this.vibracion.toque().catch(() => {});
    this.productoAEliminar.set(producto);
    this.mostrarDialogoEliminar.set(true);
  }

  cerrarDialogoEliminar(): void {
    this.mostrarDialogoEliminar.set(false);
  }

  alCerrarDialogoEliminar(): void {
    this.mostrarDialogoEliminar.set(false);
    this.productoAEliminar.set(null);
  }

  async eliminarProductoConfirmado(): Promise<void> {
    const producto = this.productoAEliminar();
    if (!producto) return;

    this.cerrarDialogoEliminar();
    await this.eliminarProductoDeCarta(producto);
  }

  private async eliminarProductoDeCarta(producto: Producto): Promise<void> {
    try {
      await this.carga.ejecutar(
        'Eliminando producto...',
        () => this.supabase.eliminarProducto(producto.id)
      );

      // El producto ya no existe: se liberan sus fotos del Storage
      this.supabase.eliminarFotosProducto(producto.fotos ?? [])
        .catch(err => console.warn('No se pudieron borrar las fotos del producto:', err));

      this.productos = this.productos.filter(p => p.id !== producto.id);

      // Evita quedar apuntando a un índice inexistente si se eliminó el último
      const total = this.productosVisibles.length;
      if (this.indiceProductoActual > total - 1) {
        this.indiceProductoActual = Math.max(0, total - 1);
      }

      await this.mostrarToast('Producto eliminado de la carta.', 'success');
    } catch (error: any) {
      console.error('Error al eliminar el producto:', error);
      await this.vibracion.errorFuerte();
      await this.mostrarToast(error?.message || 'No se pudo eliminar el producto.', 'danger');
    } finally {
      this.cdr.detectChanges();
    }
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