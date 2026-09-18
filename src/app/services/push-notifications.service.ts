import { Injectable } from '@angular/core';
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
    private toastCtrl: ToastController
  ) {}

  private async mostrarEstado(mensaje: string, color: 'success' | 'danger' | 'warning') {
    const toast = await this.toastCtrl.create({
      message: mensaje,
      duration: 5000,
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
    } catch (error) {
      this.inicializado = false;
      console.error('[Push] Error al inicializar notificaciones:', error);
      await this.mostrarEstado('Push: falló el registro en Firebase. Revisá la configuración Android.', 'danger');
    }
  }

  private async configurarListeners(): Promise<void> {
    await PushNotifications.addListener('registration', async (token: Token) => {
      console.log('[Push] Token FCM recibido:', token.value);
      this.tokenActual = token.value;
      await this.guardarToken(token.value);
    });

    this.supabase.clienteSupabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user && this.tokenActual) {
        void this.asociarTokenConUsuario(this.tokenActual, session.user.id);
      }
    });

    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Error al registrar el dispositivo:', error);
      void this.mostrarEstado('Push: Firebase no entregó el token del dispositivo.', 'danger');
    });

    await PushNotifications.addListener(
      'pushNotificationReceived',
      (notification: PushNotificationSchema) => {
        console.log('Notificación push recibida:', notification);
      }
    );

    await PushNotifications.addListener(
      'pushNotificationActionPerformed',
      (action: ActionPerformed) => {
        console.log('Notificación push seleccionada:', action);
      }
    );
  }

  private async guardarToken(token: string): Promise<void> {
    const { data } = await this.supabase.clienteSupabase.auth.getUser();
    const plataforma = Capacitor.getPlatform();

    console.log('[Push] Guardando token en device_tokens. Usuario:', data.user?.id ?? 'anónimo');

    const { error } = await this.supabase.clienteSupabase
      .from('device_tokens')
      .upsert(
        {
          user_id: data.user?.id ?? null,
          token,
          plataforma,
          activo: true,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'token' }
      );

    if (error) {
      console.error('[Push] Error al guardar token en Supabase:', error.message, error.details, error.hint);
      await this.mostrarEstado(`Push: Supabase rechazó el token. ${error.message}`, 'danger');
      return;
    }

    console.log('[Push] Token guardado correctamente.');
    await this.mostrarEstado('Push: token guardado correctamente en Supabase.', 'success');
  }

  async desasociarToken(): Promise<void> {
    if (!this.tokenActual) return;

    const { data } = await this.supabase.clienteSupabase.auth.getUser();
    if (!data.user) return;

    const { error } = await this.supabase.clienteSupabase
      .from('device_tokens')
      .update({
        user_id: null,
        activo: false,
        updated_at: new Date().toISOString()
      })
      .eq('token', this.tokenActual)
      .eq('user_id', data.user.id);

    if (error) {
      console.error('Error al desasociar el token de notificaciones:', error.message);
      return;
    }
  }

  private async asociarTokenConUsuario(token: string, userId: string): Promise<void> {
    const { error } = await this.supabase.clienteSupabase
      .from('device_tokens')
      .update({
        user_id: userId,
        activo: true,
        updated_at: new Date().toISOString()
      })
      .eq('token', token)
      .is('user_id', null);

    if (error) {
      console.error('Error al asociar el token al usuario:', error.message);
    }
  }
}
