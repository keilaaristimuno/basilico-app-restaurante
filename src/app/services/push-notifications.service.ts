import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  ActionPerformed,
  PushNotificationSchema,
  PushNotifications,
  Token
} from '@capacitor/push-notifications';
import { ToastController } from '@ionic/angular';
import { Supabase } from './supabase';

@Injectable({
  providedIn: 'root'
})
export class PushNotificationsService {
  private inicializado = false;
  private tokenActual = '';

  constructor(
    private supabase: Supabase,
    private toastCtrl: ToastController,
    private router: Router,
    private ngZone: NgZone
  ) {}

  private async mostrarEstado(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 4000,
      color,
      position: 'bottom'
    });

    await toast.present();
  }

  async inicializar(): Promise<void> {
    if (this.inicializado) return;

    if (!Capacitor.isNativePlatform()) {
      await this.mostrarEstado('Push: la app se está ejecutando en navegador, no en Android.', 'warning');
      return;
    }

    this.inicializado = true;

    try {
      console.log('[Push] Plataforma:', Capacitor.getPlatform());

      if (Capacitor.getPlatform() === 'android') {
        try {
          await PushNotifications.createChannel({
            id: 'basilico_alta_prioridad',
            name: 'Notificaciones Importantes',
            description: 'Alertas emergentes de nuevos clientes y pedidos',
            importance: 5,
            visibility: 1,
            sound: 'default',
            vibration: true,
            lights: true,
            lightColor: '#283720'
          });
        } catch (channelError) {
          console.warn('[Push] Error al crear canal en PushNotifications:', channelError);
        }
      }

      await this.configurarListeners();

      const permisos = await PushNotifications.checkPermissions();
      console.log('[Push] Permiso actual:', permisos.receive);

      const permisoNotificaciones = permisos.receive === 'granted'
        ? permisos
        : await PushNotifications.requestPermissions();

      console.log('[Push] Permiso después de solicitar:', permisoNotificaciones.receive);

      if (permisoNotificaciones.receive !== 'granted') {
        console.warn('[Push] Permiso de notificaciones no concedido.');
        await this.mostrarEstado('Push: permiso de notificaciones rechazado.', 'warning');
        return;
      }

      console.log('[Push] Registrando dispositivo en Firebase...');
      await PushNotifications.register();
    } catch (error: any) {
      this.inicializado = false;
      console.error('[Push] Error al inicializar notificaciones:', error);
      await this.mostrarEstado(`Push: falló el registro en Firebase (${error?.message ?? error})`, 'danger');
    }
  }

  private async configurarListeners(): Promise<void> {
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Push] Token FCM recibido:', token.value);
      this.tokenActual = token.value;
      localStorage.setItem('fcm_device_token', token.value);
      await this.guardarTokenSegunSesion(token.value);
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Error al registrar el dispositivo en Firebase:', error);
      void this.mostrarEstado('Push: Firebase no entregó el token del dispositivo.', 'danger');
    });

    await PushNotifications.addListener(
      'pushNotificationReceived',
      async (notification: PushNotificationSchema) => {
        console.log('[Push Foreground] Notificación recibida:', notification);
      }
    );

    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      async (action: ActionPerformed) => {
        console.log('[Push Action] Notificación seleccionada:', action);
        const data = action.notification?.data;
        const ruta = data?.ruta;

        if (ruta) {
          this.ngZone.run(() => {
            const navegar = async () => {
              try {
                await this.router.navigateByUrl(ruta);
              } catch (error) {
                console.error('[Push Action] Error al navegar a ruta:', ruta, error);
                await this.router.navigate([ruta]);
              }
            };

            void navegar();
            setTimeout(() => {
              if (this.router.url !== ruta) {
                void navegar();
              }
            }, 400);
          });
        }
      }
    );
  }

  async desasociarToken(): Promise<void> {
    const token = this.tokenActual || localStorage.getItem('fcm_device_token');
    if (!token) {
      console.warn('[Push] No hay token en memoria para desasociar.');
      return;
    }

    const { error } = await this.supabase.clienteSupabase.rpc(
      'desasociar_device_token',
      { p_token: token }
    );

    if (error) {
      console.error('Error al desasociar el token de notificaciones:', error.message);
      await this.mostrarEstado(`Push: no se pudo liberar el token. ${error.message}`, 'danger');
      return;
    }

    console.log('[Push] Token desasociado del usuario.');
  }

  private async guardarTokenSegunSesion(token: string): Promise<void> {
    const { error } = await this.supabase.clienteSupabase.rpc(
      'registrar_device_token',
      {
        p_token: token,
        p_plataforma: Capacitor.getPlatform()
      }
    );

    if (error) {
      console.error('[Push] Error al registrar token mediante RPC:', error.message);
      await this.mostrarEstado(`Push: no se pudo guardar el token. ${error.message}`, 'danger');
      return;
    }

    await this.mostrarEstado('Push: token guardado correctamente.', 'success');
  }

  async asociarTokenDelUsuarioActual(): Promise<void> {
    const token = this.tokenActual || localStorage.getItem('fcm_device_token');
    if (!token) return;
    await this.guardarTokenSegunSesion(token);
  }

  async enviarNotificacion(
    title: string,
    body: string,
    destinatarios: { userIds?: string[]; profiles?: string[] },
    data: Record<string, string> = {}
  ) {
    const { data: respuesta, error } = await this.supabase.clienteSupabase.functions.invoke(
      'enviar-push',
      {
        body: {
          title,
          body,
          data,
          ...destinatarios
        }
      }
    );

    if (error) throw new Error(error.message);
    console.log('[Push] Resultado del envío desde Supabase Edge Function:', respuesta);
    return respuesta;
  }
}
