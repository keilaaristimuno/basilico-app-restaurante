import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class SonidoService {

  private readonly rutaInicio = 'assets/sonidos/inicio.wav';
  private readonly rutaCierre = 'assets/sonidos/cierre.wav';

  /* Sonido al abrir la aplicación */
  async inicio(): Promise<void> {
    await this.reproducir(this.rutaInicio);
  }

  /* Sonido al cerrar sesión / salir. Espera a que termine para no cortarlo */
  async cierre(): Promise<void> {
    await this.reproducir(this.rutaCierre, true);
  }

  private reproducir(ruta: string, esperarFin = false): Promise<void> {
    return new Promise((resolve) => {
      try {
        const audio = new Audio(ruta);
        audio.volume = 0.8;

        if (esperarFin) {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          // Por si el evento 'ended' nunca llega
          setTimeout(() => resolve(), 2000);
        }

        audio.play()
          .then(() => {
            if (!esperarFin) resolve();
          })
          .catch((error) => {
            // En el navegador puede bloquearse el autoplay sin interacción del usuario
            console.warn('No se pudo reproducir el sonido:', error);
            resolve();
          });
      } catch (error) {
        console.warn('El audio no está disponible:', error);
        resolve();
      }
    });
  }
}
