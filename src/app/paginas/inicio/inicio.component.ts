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
  mostrarAnimacion = signal(false);
  animacionActiva = signal(false);
  desvanecerAnimacion = signal(false);

  constructor(
    private supabase: Supabase,
    private pushNotifications: PushNotificationsService,
    private router: Router
  ) { }

  async ngOnInit() {
    if (await this.verificarSesionActivaYRedirigir()) {
      return;
    }

    if (!InicioComponent.animacionRealizada) {
      InicioComponent.animacionRealizada = true;
      this.mostrarAnimacion.set(true);

      // 1.65s: inicia la animación del logo y entrada desde la izquierda
      setTimeout(() => this.animacionActiva.set(true), 1650);

      // 5.6s: se desvanece suavemente la capa de presentación
      setTimeout(() => this.desvanecerAnimacion.set(true), 5600);

      // 6.1s: se destruye la capa del DOM y se revelan los botones de inicio
      setTimeout(() => this.mostrarAnimacion.set(false), 6100);
    } else {
      // Si ya se mostró antes (ej. volvió de login), muestra directamente los botones
      this.mostrarAnimacion.set(false);
    }
  }

  async ionViewWillEnter() {
    await this.verificarSesionActivaYRedirigir();
  }

  private async verificarSesionActivaYRedirigir(): Promise<boolean> {
    let perfilGuardado = localStorage.getItem('perfil');
    const nombreGuardado = localStorage.getItem('nombre');

    // Si hay sesión de Supabase Auth pero por algún motivo falta el perfil en localStorage, lo recuperamos
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
      return false;
    }

    const rutaDestino = this.obtenerRutaPorPerfil(perfilGuardado);
    if (rutaDestino) {
      try {
        await this.pushNotifications.inicializar();
        await this.pushNotifications.asociarTokenDelUsuarioActual();
      } catch (e) {
        console.warn('No se pudo re-asociar token al restaurar sesión:', e);
      }
      await this.router.navigate([rutaDestino], { replaceUrl: true });
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
