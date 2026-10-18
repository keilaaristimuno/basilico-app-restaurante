import { Component, OnInit, signal } from '@angular/core';
import { 
  IonContent, IonGrid, IonRow, IonCol, 
  IonList, IonItem, IonInput, IonButton, 
  IonText
} from '@ionic/angular';
import { Router, RouterLink } from '@angular/router';
import { Supabase } from '../../services/supabase';
import { PushNotificationsService } from '../../services/push-notifications.service';

@Component({
  selector: 'app-inicio',
  templateUrl: './inicio.component.html',
  standalone: true,
  styleUrls: ['./inicio.component.scss'],
  imports: [ IonContent, IonGrid, IonRow, IonCol, IonButton, RouterLink ],
})
export class InicioComponent implements OnInit {
  // Bandera estática para que la animación solo ocurra al abrir la app, no cada vez que se vuelve a inicio
  private static animacionRealizada = false;

  // Signals: la app es zoneless, por lo que los setTimeout no disparan change detection con variables comunes
  mostrarAnimacion = signal(!InicioComponent.animacionRealizada);
  animacionActiva = signal(false);
  desvanecerAnimacion = signal(false);

  constructor(
    private supabase: Supabase,
    private pushNotifications: PushNotificationsService,
    private router: Router
  ) { }

  async ngOnInit() {
    if (!InicioComponent.animacionRealizada) {
      InicioComponent.animacionRealizada = true;
      this.mostrarAnimacion.set(true);

      // Verificamos la sesión en paralelo mientras la animación corre
      const promesaSesion = this.obtenerRutaSesionActiva();

      // 0.4s: se muestra logo y arbusto estáticos y a los 0.4s inicia la animación
      setTimeout(() => this.animacionActiva.set(true), 400);

      // 5.0s: se desvanece suavemente la capa de presentación (0.6s antes)
      setTimeout(() => this.desvanecerAnimacion.set(true), 5000);

      // 5.5s: termina la animación: si hay sesión va al rol, si no revela botones de inicio
      setTimeout(async () => {
        const rutaDestino = await promesaSesion;
        if (rutaDestino) {
          await this.redirigirConNotificaciones(rutaDestino);
        } else {
          this.mostrarAnimacion.set(false);
        }
      }, 5500);
    } else {
      // Si la animación ya se realizó en esta sesión (ej. al desloguearse), no se repite
      this.mostrarAnimacion.set(false);
      await this.verificarSesionActivaYRedirigir();
    }
  }

  async ionViewWillEnter() {
    // Solo redirige directo en ionViewWillEnter si la animación inicial ya fue completada
    if (InicioComponent.animacionRealizada && !this.mostrarAnimacion()) {
      await this.verificarSesionActivaYRedirigir();
    }
  }

  /**
   * Resuelve la ruta de sesión activa si existe, sin redirigir inmediatamente
   */
  private async obtenerRutaSesionActiva(): Promise<string | null> {
    let perfilGuardado = localStorage.getItem('perfil');
    const nombreGuardado = localStorage.getItem('nombre');

    if (!perfilGuardado) {
      try {
        const { data: { session } } = await this.supabase.clienteSupabase.auth.getSession();
        if (session?.user?.email) {
          const cliente = await this.supabase.obtenerClientePorCorreo(session.user.email);
          if (cliente && cliente.estado === 'aprobado') {
            perfilGuardado = 'cliente';
            localStorage.setItem('perfil', 'cliente');
            localStorage.setItem('nombre', `${cliente.nombres} ${cliente.apellidos || ''}`.trim());
          } else {
            const empleado = await this.supabase.obtenerPerfilUsuarioLogueado();
            if (empleado?.perfil) {
              perfilGuardado = empleado.perfil;
              localStorage.setItem('perfil', empleado.perfil);
              localStorage.setItem('nombre', empleado.nombres ?? '');
            }
          }
        } else if (nombreGuardado) {
          perfilGuardado = 'cliente';
          localStorage.setItem('perfil', 'cliente');
        }
      } catch (err) {
        console.warn('Error verificando sesión al iniciar:', err);
      }
    }

    if (!perfilGuardado) {
      return null;
    }

    return this.obtenerRutaPorPerfil(perfilGuardado);
  }

  private async redirigirConNotificaciones(rutaDestino: string): Promise<void> {
    try {
      await this.pushNotifications.inicializar();
      await this.pushNotifications.asociarTokenDelUsuarioActual();
    } catch (e) {
      console.warn('No se pudo re-asociar token al restaurar sesión:', e);
    }
    await this.router.navigate([rutaDestino], { replaceUrl: true });
  }

  private async verificarSesionActivaYRedirigir(): Promise<boolean> {
    const rutaDestino = await this.obtenerRutaSesionActiva();
    if (rutaDestino) {
      await this.redirigirConNotificaciones(rutaDestino);
      return true;
    }
    return false;
  }

  private obtenerRutaPorPerfil(perfil: string): string | null {
    switch (perfil) {
      case 'duenio':
      case 'supervisor':
        return '/duenioInicio';
      case 'metre':
        return '/metreInicio';
      case 'cocinero':
        return '/inicio-cocinero';
      case 'cantinero':
        return '/inicio-cantinero';
      case 'mozo':
        return '/mozoInicio';
      case 'cliente':
      case 'anonimo':
        return '/clienteInicio';
      default:
        return null;
    }
  }

  async entrarComoInvitado() {
    await this.pushNotifications.desasociarToken();
    await this.supabase.cerrarSesion();
    await this.pushNotifications.inicializar();
    await this.router.navigate(['/carta']);
  }
}
