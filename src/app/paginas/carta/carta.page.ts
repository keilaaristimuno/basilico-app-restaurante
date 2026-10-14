import { Component, ChangeDetectorRef, ViewChild, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

import {
  IonContent,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonBackButton,
  IonTitle,
  IonIcon,
  IonModal,
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
  alertCircleOutline
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
    IonContent,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonBackButton,
    IonTitle,
    IonIcon,
    IonModal
  ]
})
export class CartaPage {

  @ViewChild(IonContent) ionContent?: IonContent;

  productos: Producto[] = [];

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
      alertCircleOutline
    });
  }

  async ionViewWillEnter() {
    await this.verificarSesionYMesa();
    await this.cargarProductos();
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

  async cargarProductos() {
    try {
      this.productos = await this.carga.ejecutar(
        'Cargando carta...',
        () => this.supabase.obtenerProductos()
      );

      // Fuerza a Angular a refrescar el HTML
      this.cdr.detectChanges();

    } catch (error) {
      await this.vibracion.errorFuerte();
      console.error(
        'Error al cargar la carta:',
        error
      );
    }
  }

  indiceFoto: Record<string, number> = {};
  fotosVerticales: Record<string, boolean> = {};
  descripcionExpandida: Record<string, boolean> = {};

  /**
   * Detecta la orientación natural de la imagen al cargarse en el DOM.
   * Si naturalHeight > naturalWidth se marca como vertical para aplicar object-fit: contain.
   */
  detectarOrientacion(event: Event, urlFoto?: string): void {
    const img = event.target as HTMLImageElement;
    if (img && img.naturalHeight && img.naturalWidth) {
      const esVertical = img.naturalHeight > img.naturalWidth;
      if (urlFoto) {
        this.fotosVerticales[urlFoto] = esVertical;
      }
      if (esVertical) {
        img.classList.add('imagen-vertical');
      } else {
        img.classList.remove('imagen-vertical');
      }
    }
  }

  /**
   * Realiza un desplazamiento suave hacia la sección solicitada dentro del ion-content.
   */
  async scrollASeccion(idSeccion: string): Promise<void> {
    const elemento = document.getElementById(idSeccion);
    if (!elemento) {
      return;
    }

    if (this.ionContent) {
      try {
        const scrollEl = await this.ionContent.getScrollElement();
        const elementoRect = elemento.getBoundingClientRect();
        const scrollRect = scrollEl.getBoundingClientRect();
        const destinoY = elementoRect.top - scrollRect.top + scrollEl.scrollTop;
        const posicionFinal = Math.max(0, destinoY - 12);

        await this.ionContent.scrollToPoint(0, posicionFinal, 450);
        return;
      } catch {
        // Fallback suave en caso de que scrollToPoint no responda
      }
    }

    elemento.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  alternarDescripcion(producto: Producto): void {
    this.descripcionExpandida[producto.id] = !this.descripcionExpandida[producto.id];
  }
  
  /* ======================
          CARRUSEL
  ========================= */
  anteriorFoto(producto: Producto): void {
    const indiceActual = this.indiceFoto[producto.id] ?? 0;
    if (indiceActual === 0) {
      this.indiceFoto[producto.id] = producto.fotos.length - 1;
    } else {
      this.indiceFoto[producto.id] = indiceActual - 1;
    }
  }

  siguienteFoto(producto: Producto): void {
    const indiceActual = this.indiceFoto[producto.id] ?? 0;
    if (indiceActual === producto.fotos.length - 1) {
      this.indiceFoto[producto.id] = 0;
    } else {
      this.indiceFoto[producto.id] = indiceActual + 1;
    }
  }

  irAFoto(producto: Producto, indice: number): void {
    this.indiceFoto[producto.id] = indice;
  }

  formatearPrecio(precio: number): string {
    return new Intl.NumberFormat('es-AR').format(precio);
  }

  /* ============================================================
     GESTIÓN DE PRODUCTOS Y CARRITO DE PEDIDO (PUNTO 12 Y 13)
  ============================================================ */

  agregarProducto(producto: Producto): void {
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