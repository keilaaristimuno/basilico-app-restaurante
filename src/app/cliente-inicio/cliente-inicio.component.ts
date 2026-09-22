import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  IonContent,
  IonNote,
  IonIcon,
  IonButton,
  ToastController
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import { qrCodeOutline, gameControllerOutline } from 'ionicons/icons';
import { QrService } from '../services/qr.service';
import { Supabase } from '../services/supabase';
import { VibracionService } from '../services/vibracion';
import { NavbarComponent } from '../components/navbar/navbar.component';

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
    IonButton
  ],
})
export class ClienteInicioComponent {

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
      await this.agregarAListaDeEspera();
    } else {
      await this.vibracion.errorFuerte();
      await this.mostrarToast('El código QR no corresponde al ingreso del local.', 'danger');
    }
  }

  async agregarAListaDeEspera() {
    const { data: { user } } = await this.supabase.clienteSupabase.auth.getUser();

    let nombreCliente = 'Cliente Anónimo';

    if (user) {
      const perfil = await this.supabase.obtenerPerfilUsuarioLogueado();
      if (perfil?.nombres) {
        nombreCliente = perfil.nombres;
      }
    }

    //Guarda la entrada en la tabla 'lista_espera' de Supabase
    const { error } = await this.supabase.clienteSupabase
      .from('lista_espera')
      .insert([
        { 
          user_id: user ? user.id : null, 
          nombre: nombreCliente,
          estado: 'pendiente',
          created_at: new Date()
        }
      ]);

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
}
