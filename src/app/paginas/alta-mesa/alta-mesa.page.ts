import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Camera } from '@capacitor/camera';
import { Haptics } from '@capacitor/haptics';
import {
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
  IonItem,
  IonInput,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonNote,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonSpinner,
  ToastController,
  IonButtons,
  IonBackButton,
  IonModal,

} from '@ionic/angular';
import { Supabase } from '../../services/supabase';
import { QrService } from '../../services/qr.service';

@Component({
  selector: 'app-alta-mesa',
  templateUrl: './alta-mesa.page.html',
  styleUrls: ['./alta-mesa.page.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonItem,
    IonInput,
    IonButton,
    IonSelect,
    IonSelectOption,
    IonNote,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonSpinner,
    IonButtons,
    IonBackButton,
    IonModal,
  ]
})
export class AltaMesaPage implements OnInit {
  numero: number | null = null;
  cantidadComensales: number | null = null;
  tipo: string = '';
  fotoMesa = signal<string>('');
  errorFoto = signal<boolean>(false);
  cargando = signal<boolean>(false);
  qrMesa = signal<string>('');
  mesas = signal<any[]>([]);

  errorNumero = false;
  errorCantidad = false;
  errorCantidadMax = false;
  errorTipo = false;
  numeroTocado = false;
  cantidadTocado = false;
  tipoTocado = false;

  constructor(
    private supabase: Supabase,
    private qrService: QrService,
    private toastCtrl: ToastController
  ) {}

  ngOnInit() {
    this.cargarMesas();
  }

  async tomarFoto() {
    try {
      const imagen = await Camera.takePhoto({ quality: 90 });
      const ruta = imagen.webPath ?? imagen.uri ?? '';
      this.fotoMesa.set(ruta);
      this.errorFoto.set(false);
    } catch (error) {
      console.log('Foto cancelada o error al tomar la foto de la mesa:', error);
    }
  }

  validarFormulario(): boolean {
    this.errorNumero = !this.numero || this.numero <= 0;
    this.errorCantidad = !this.cantidadComensales || this.cantidadComensales <= 0;
    this.errorCantidadMax = !!this.cantidadComensales && this.cantidadComensales > 25;
    this.errorTipo = !this.tipo;
    this.errorFoto.set(!this.fotoMesa());

    return !(this.errorNumero || this.errorCantidad || this.errorCantidadMax || this.errorTipo || this.errorFoto());
  }

  marcarNumeroTocado() {
    this.numeroTocado = true;
    this.errorNumero = !this.numero || this.numero <= 0;
  }

  marcarCantidadTocado() {
    this.cantidadTocado = true;
    this.errorCantidad = !this.cantidadComensales || this.cantidadComensales <= 0;
    this.errorCantidadMax = !!this.cantidadComensales && this.cantidadComensales > 25;
  }

  marcarTipoTocado() {
    this.tipoTocado = true;
    this.errorTipo = !this.tipo;
  }

  normalizarTipo(tipo: string): string {
    const valor = (tipo || '').trim().toLowerCase();

    switch (valor) {
      case 'vip':
        return 'vip';
      case 'estandar':
        return 'estandar';
      case 'movilidad_reducida':
        return 'movilidad_reducida';
      default:
        return 'estandar';
    }
  }

  private async mostrarToast(mensaje: string, color: 'success' | 'danger') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 2500,
      color,
      position: 'bottom'
    });

    await toast.present();
  }

  private mensajeErrorNumeroDuplicado(error: any): string {
    const texto = String(error?.message ?? '').toLowerCase();
    if (texto.includes('numero') || texto.includes('unique') || texto.includes('duplicate')) {
      return 'Ya existe una mesa con ese número.';
    }
    return 'No se pudo guardar la mesa.';
  }

  async guardarMesa() {
    this.numeroTocado = true;
    this.cantidadTocado = true;
    this.tipoTocado = true;

    if (!this.validarFormulario()) {
      await Haptics.vibrate({ duration: 300 });
      return;
    }

    try {
      this.cargando.set(true);

      const tipoGuardado = this.normalizarTipo(this.tipo);

      const nombreArchivo = `mesas/${Date.now()}.jpg`;
      const resultado = await this.supabase.subirFotoMesa(this.fotoMesa(), nombreArchivo);
      const fotoUrl = this.supabase.obtenerUrlFotoMesa(resultado.path);

      const qrString = `mesa_numero:${this.numero}`;
      const qrGenerado = await this.qrService.generarQR(qrString);
      this.qrMesa.set(qrGenerado);

      await this.supabase.guardarMesa(
        Number(this.numero),
        Number(this.cantidadComensales),
        tipoGuardado,
        'vacia',
        fotoUrl,
        this.qrMesa()
      );


      await this.cargarMesas();
      await this.mostrarToast('Mesa cargada correctamente.', 'success');
      this.limpiarFormulario();
    } catch (error: any) {
      console.error('Error al guardar la mesa:', error);
      const mensaje = this.mensajeErrorNumeroDuplicado(error);
      await this.mostrarToast(mensaje, 'danger');
      await Haptics.vibrate({ duration: 500 });
    } finally {
      this.cargando.set(false);
    }
  }

  async cargarMesas() {
    try {
      const datos = await this.supabase.obtenerMesas();
      this.mesas.set(datos ?? []);
    } catch (error) {
      console.error('Error al cargar mesas:', error);
    }
  }

  normalizarDisponibilidad(disponibilidad: string): string {
  const valor = (disponibilidad || '').trim().toLowerCase();

  if (valor === 'ocupada') return 'ocupada';

  if (valor === 'vacía' || valor === 'vacia') {
    return 'vacia';
  }
  return 'vacia';
}

  async cambiarDisponibilidad(mesa: any, event?: any) {
    try {
      const valorSeleccionado = event?.detail?.value ?? mesa.disponibilidad ?? 'vacia';
      const disponibilidadActualizada = this.normalizarDisponibilidad(valorSeleccionado);

      await this.supabase.actualizarDisponibilidadMesa(mesa.id, disponibilidadActualizada);

      this.mesas.update((items) =>
        items.map((item) =>
          item.id === mesa.id
            ? { ...item, disponibilidad: disponibilidadActualizada }
            : item
        )
      );

      await this.mostrarToast('Disponibilidad actualizada.', 'success');
    } catch (error: any) {
      console.error('Error al cambiar disponibilidad:', error);
      await this.mostrarToast('No se pudo actualizar la disponibilidad.', 'danger');
    }
  }

  formatearTipo(tipo: string): string {
    switch ((tipo || '').toLowerCase()) {
      case 'vip':
        return 'VIP';
      case 'estandar':
        return 'Estándar';
      case 'movilidad_reducida':
        return 'Movilidad reducida';
      default:
        return tipo || 'Sin tipo';
    }
  }

  formatearDisponibilidad(disponibilidad: string): string {
    switch ((disponibilidad || '').toLowerCase()) {
      case 'vacia':
      case 'vacía':
        return 'Vacía';
      case 'ocupada':
        return 'Ocupada';
      default:
        return disponibilidad || 'Sin estado';
    }
  }

  limpiarFormulario() {
    this.numero = null;
    this.cantidadComensales = null;
    this.tipo = '';
    this.fotoMesa.set('');

    this.errorNumero = false;
    this.errorCantidad = false;
    this.errorCantidadMax = false;
    this.errorTipo = false;
    this.errorFoto.set(false);
    this.numeroTocado = false;
    this.cantidadTocado = false;
    this.tipoTocado = false;
  }
}
