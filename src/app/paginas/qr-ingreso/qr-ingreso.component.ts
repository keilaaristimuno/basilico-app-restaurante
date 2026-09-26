import { Component, OnInit,  } from '@angular/core';
import { QrService } from '../../services/qr.service';
import { 
  IonContent, IonButton, 
} from '@ionic/angular';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { signal, WritableSignal } from '@angular/core';

@Component({
  selector: 'app-qr-ingreso',
  templateUrl: './qr-ingreso.component.html',
  standalone: true,
  styleUrls: ['./qr-ingreso.component.scss'],
  imports: [IonButton, IonContent, RouterLink, CommonModule],
})
export class QrIngresoComponent  implements OnInit {

  qrImage:  WritableSignal<string> = signal("");

  constructor(private qrService: QrService) {}

  async ngOnInit() {
    await this.generarCodigo();
  }

  async generarCodigo() {
    try {
      // Genera la cadena en formato data:image/png;base64,...
      const resultado = await this.qrService.generarQR('BASILICO_INGRESO_LISTA_ESPERA');
      console.log('QR generado con éxito:', resultado);
      this.qrImage.set(resultado);
    } catch (error) {
      console.error('Error al generar el QR:', error);
    }
  }

}
