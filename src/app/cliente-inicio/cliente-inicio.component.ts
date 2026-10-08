import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonNote,
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
    RouterLink,
    NavbarComponent,
    IonContent,
    IonNote,
    IonIcon,
    IonButton,
    IonModal,
    IonToolbar,
    IonHeader,
    IonButton,
    IonItem,
    IonButtons,
    IonTitle,
    FormsModule,
    IonInput
    
  ],
})
export class ClienteInicioComponent {
  cantidadComensales = signal<string>("");
  comensalesValidados = signal<number>(0);
  abrirInputComensales = signal<boolean>(false);
  codigoQrIngreso = signal<boolean>(false);
  numeroMesa = signal<string>("");
  clienteId = signal<string>("");
  constructor(
    private qrService: QrService,
    private supabase: Supabase,
    private toastCtrl: ToastController,
    private vibracion: VibracionService
  ) {
    addIcons({ qrCodeOutline, gameControllerOutline });
  }

  async escanearIngreso() {
    //Abre directamente la cámara usando BarcodeScanner de Capacitor
    const codigoEscaneado = await this.qrService.leerQR();
    

    if (!codigoEscaneado) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Se canceló la lectura o no se pudo acceder a la cámara.', 'warning');
      return;
    }

    //Valida que sea el QR correcto del local
    if (codigoEscaneado === 'BASILICO_INGRESO_LISTA_ESPERA') {
      this.codigoQrIngreso.set(true);
      this.abrirInputComensales.set(true);
      this.confirmarComensales()
      
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
    }
    else {
    this.mostrarToast('Por favor, ingrese un número válido de comensales.', 'warning');
  }

  }

  cerrarModuleComensales(){
    this.abrirInputComensales.set(false);
  }
  
  async agregarAListaDeEspera() {
    const { data: { user } } = await this.supabase.clienteSupabase.auth.getUser();

    if (!user?.email) {
      await this.mostrarToast('Iniciá sesión para anotarte.', 'warning');
      return;
    }

    const cliente = await this.supabase.obtenerClientePorCorreo(user.email);

    if (!cliente || cliente.estado !== 'aprobado') {
      await this.mostrarToast('No se encontró una cuenta de cliente aprobada.', 'warning');
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

    await this.mostrarToast(`¡Te anotaste con éxito en la lista de espera como "${nombreCliente}"!`, 'success');
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

  async buscarMesaAsignada(){
    const mesas = await this.supabase.obtenerMesas()
    mesas.forEach((mesa) => {
      if (mesa.cliente_id === this.clienteId()) {
        this.numeroMesa.set(mesa.numero);
      }
    });
    
  }
  async escanearQrMesa(){
    const codigoEscaneado = await this.qrService.leerQR();
    this.buscarMesaAsignada(); //Para ver si el id del cliente ya está con mesa asignada
    if (!codigoEscaneado) {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('Se canceló la lectura o no se pudo acceder a la cámara.', 'warning');
      return;
    }
    //Valida que sea el QR correcto del local
    if (codigoEscaneado === `mesa_numer:${this.numeroMesa()}`) { 
      this.confirmarComensales()
      
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('El código QR no corresponde a la mesa asignada', 'danger');
    }
    
  }
}
