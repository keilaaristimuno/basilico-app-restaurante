import { Component, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonToolbar, IonTitle, IonItem, IonLabel,
  IonInput, IonSelect, IonSelectOption, IonTextarea, IonButton,
  IonSpinner, IonButtons, IonBackButton, AlertController
} from '@ionic/angular';
import { EmailService, SenderCategory } from '../../services/email';

@Component({
  selector: 'app-admin-email',
  templateUrl: './admin-email.page.html',
  styleUrls: ['./admin-email.page.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, IonContent, IonHeader, IonToolbar,
    IonTitle, IonItem, IonLabel, IonInput, IonSelect, IonSelectOption,
    IonTextarea, IonButton, IonSpinner, IonButtons, IonBackButton
  ]
})
export class AdminEmailPage {
  to: string = '';
  category: SenderCategory = 'notificaciones';
  title: string = '';
  message: string = '';
  cargando: boolean = false;

  constructor(
    private emailService: EmailService,
    private alertController: AlertController,
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) { }

  enviar() {
    console.log('[DEBUG 1] Inicio del método enviar()');

    if (!this.to || !this.title || !this.message) {
      this.mostrarAlerta('Campos incompletos', 'Por favor, complete todos los campos obligatorios.');
      return;
    }

    if (!this.validarEmail(this.to)) {
      this.mostrarAlerta('Correo inválido', 'El formato del correo electrónico ingresado no es válido.');
      return;
    }

    this.cargando = true;
    console.log('[DEBUG 2] Estado cargando = true seteadas en UI');

    this.emailService.sendEmail({
      to: this.to,
      subject: this.title,
      category: this.category,
      title: this.title,
      messageHtml: this.message
    }).subscribe({
      next: (res) => {
        console.log('[DEBUG 3] Respuesta recibida del servidor:', res);

        // FORZAMOS LA SALIDA DEL SPINNER DE INMEDIATO
        this.ngZone.run(() => {
          this.cargando = false;
          this.cdr.detectChanges(); // Refresco síncrono del DOM
          console.log('[DEBUG 4] UI Liberada (cargando = false)');

          // Disparar la alerta en segundo plano
          this.mostrarAlertaExito();
        });
      },
      error: (err: any) => {
        console.error('[DEBUG ERROR] Error en suscripción:', err);

        this.ngZone.run(() => {
          this.cargando = false;
          this.cdr.detectChanges();
          this.mostrarAlerta('Error de Envío', err.message || 'No se pudo procesar la solicitud.');
        });
      }
    });
  }

  private async mostrarAlertaExito() {
    console.log('[DEBUG 5] Presentando AlertController');
    const alert = await this.alertController.create({
      header: '¡Correo Enviado!',
      subHeader: 'Resto Basílico',
      message: 'La notificación se entregó correctamente a la casilla de destino.',
      buttons: [
        {
          text: 'Aceptar',
          handler: () => {
            this.ngZone.run(() => {
              this.limpiarFormulario();
              this.cdr.detectChanges();
            });
          }
        }
      ]
    });
    await alert.present();
  }

  private async mostrarAlerta(titulo: string, mensaje: string) {
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }
    const alert = await this.alertController.create({
      header: titulo,
      message: mensaje,
      buttons: ['Aceptar']
    });
    await alert.present();
  }

  private validarEmail(email: string): boolean {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email);
  }

  private limpiarFormulario() {
    this.to = '';
    this.title = '';
    this.message = '';
    console.log('[DEBUG 6] Formulario limpiado');
  }
}