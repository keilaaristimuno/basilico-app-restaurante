import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class Carga {

  private readonly _visible = signal(false);
  private readonly _mensaje = signal('Cargando...');

  readonly visible = this._visible.asReadonly();
  readonly mensaje = this._mensaje.asReadonly();

  mostrar(mensaje: string = 'Cargando...'): void {
    this._mensaje.set(mensaje);
    this._visible.set(true);
  }

  ocultar(): void {
    this._visible.set(false);
  }

  async ejecutar<T>(
    mensaje: string,
    accion: () => Promise<T>
  ): Promise<T> {

    this.mostrar(mensaje);

    try {
      return await accion();
    } finally {
      this.ocultar();
    }
  }
}