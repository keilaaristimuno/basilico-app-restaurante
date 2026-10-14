import {
  Component,
  ChangeDetectorRef,
  ViewChild,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton
} from '@ionic/angular';

import { Supabase } from '../../services/supabase';
import { Carga } from '../../services/carga';
import { VibracionService } from '../../services/vibracion';
import { Producto } from '../../interfaces/producto';

@Component({
  selector: 'app-carta',
  templateUrl: './carta.page.html',
  styleUrls: ['./carta.page.scss'],
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton
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

  constructor(
    private supabase: Supabase,
    private vibracion: VibracionService,
    public carga: Carga,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.iniciarLoopAutoPlay();
  }

  ngOnDestroy(): void {
    this.detenerAutoPlay();
  }

  async ionViewWillEnter(): Promise<void> {
    await this.cargarProductos();
    this.iniciarLoopAutoPlay();
  }

  ionViewWillLeave(): void {
    this.detenerAutoPlay();
  }

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
     Reutilizables para el Punto 31 del TFI:
     - Inclinación vertical (hacia adelante/atrás): siguienteProducto() / anteriorProducto()
     - Inclinación lateral (hacia derecha/izquierda): siguienteFoto() / anteriorFoto()
     ========================================================= */

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
    } else if (event.key === ' ') {
      event.preventDefault();
      this.alternarAutoPlay();
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
}