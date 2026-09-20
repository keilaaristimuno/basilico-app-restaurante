import { Component, OnInit } from '@angular/core';
import { IonContent, IonNote, IonTabButton, IonIcon, IonGrid, IonRow, IonCol, IonList, IonItem, IonInput, IonButton } from '@ionic/angular';
import { addIcons } from 'ionicons';
import { qrCodeOutline } from 'ionicons/icons';
import { QrService } from '../services/qr.service';
import { Supabase } from '../services/supabase';

@Component({
  selector: 'app-cliente-inicio',
  standalone: true,
  templateUrl: './cliente-inicio.component.html',
  styleUrls: ['./cliente-inicio.component.scss'],
  imports: [IonTabButton, IonContent, IonNote, IonIcon, IonGrid, IonRow, IonCol, IonList, IonItem, IonInput, IonButton],
})
export class ClienteInicioComponent {

  constructor(
    private qrService: QrService,
    private supabase: Supabase
  ) {
    addIcons({ qrCodeOutline });
  }

  async escanearIngreso() {
    //Abre directamente la cámara usando BarcodeScanner de Capacitor
    const codigoEscaneado = await this.qrService.leerQR();

    if (!codigoEscaneado) {
      alert('Se canceló la lectura o no se pudo acceder a la cámara.');
      return;
    }

    //Valida que sea el QR correcto del local
    if (codigoEscaneado === 'BASILICO_INGRESO_LISTA_ESPERA') {
      await this.agregarAListaDeEspera();
    } else {
      //Agregar module
      //alert('El código QR escaneado no corresponde al ingreso de la lista de espera.');
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
      alert('Error al anotarse en la lista de espera.');
      return;
    }
    //Agregar module
    //alert(`¡Te anotaste con éxito en la lista de espera como "${nombreCliente}"!`);
  }

}
