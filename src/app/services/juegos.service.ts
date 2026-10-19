import { Injectable, signal, WritableSignal } from '@angular/core';

export interface ResultadoIntentoJuego {
  exito: boolean;
  motivo?: 'solo_registrados' | 'descuento_ya_obtenido' | 'ya_jugado_primer_intento' | 'perdio_primer_intento';
  porcentajeAplicado?: number;
  mensaje: string;
}

export interface DefinicionJuego {
  id: string;
  titulo: string;
  subtitulo: string;
  descuento: number;
  icono: string;
  colorIcono: string;
  descripcion: string;
  disponibleParaDescuento: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class JuegosService {
  private readonly STORAGE_KEY = 'basilico_estado_juegos';

  // Descuento ganado (0, 10, 15 o 20)
  descuentoAplicado: WritableSignal<number> = signal(0);
  
  // Identificador del juego con el que se obtuvo el descuento
  juegoPremiado: WritableSignal<string | null> = signal(null);

  // Registro de qué juegos ya consumieron su primer intento
  primerosIntentosUsados: WritableSignal<Record<string, boolean>> = signal({});

  constructor() {
    this.cargarEstadoLocal();
  }

  /**
   * Carga el estado guardado en el dispositivo para mantener la coherencia
   * durante la estadía o sesión del cliente.
   */
  private cargarEstadoLocal(): void {
    try {
      const datosGuardados = localStorage.getItem(this.STORAGE_KEY);
      if (datosGuardados) {
        const parsed = JSON.parse(datosGuardados);
        this.descuentoAplicado.set(parsed.descuentoAplicado ?? 0);
        this.juegoPremiado.set(parsed.juegoPremiado ?? null);
        this.primerosIntentosUsados.set(parsed.primerosIntentosUsados ?? {});
      }
    } catch (e) {
      console.warn('No se pudo restaurar el estado de juegos:', e);
    }
  }

  private guardarEstadoLocal(): void {
    try {
      const estado = {
        descuentoAplicado: this.descuentoAplicado(),
        juegoPremiado: this.juegoPremiado(),
        primerosIntentosUsados: this.primerosIntentosUsados()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(estado));
    } catch (e) {
      console.warn('No se pudo guardar el estado de juegos:', e);
    }
  }

  /**
   * Valida si el usuario actual tiene perfil de cliente registrado.
   * Regla UTN: "permitan al cliente registrado (anónimo NO) obtener descuentos".
   */
  esClienteRegistrado(): boolean {
    const perfil = localStorage.getItem('perfil')?.toLowerCase()?.trim();
    // El anónimo también guarda perfil 'cliente', por eso se verifica 'tipo_cliente'
    const esAnonimo = localStorage.getItem('tipo_cliente') === 'anonimo';
    return perfil === 'cliente' && !esAnonimo;
  }

  /**
   * Consulta si un juego todavía tiene su primer intento disponible para aspirar al descuento.
   */
  puedeObtenerDescuentoEn(juegoId: string): boolean {
    if (!this.esClienteRegistrado()) return false;
    if (this.descuentoAplicado() > 0) return false;
    return !this.primerosIntentosUsados()[juegoId];
  }

  /**
   * Procesa el resultado de un juego jugado por el cliente.
   * Aplica las reglas del enunciado:
   * - Solo en el 1er intento.
   * - No acumulativo (el primero que gane aplica).
   * - Solo clientes registrados.
   */
  registrarResultado(juegoId: string, gano: boolean, porcentaje: number): ResultadoIntentoJuego {
    const esRegistrado = this.esClienteRegistrado();

    // 1. Cliente anónimo: puede jugar pero no acumula descuento
    if (!esRegistrado) {
      return {
        exito: false,
        motivo: 'solo_registrados',
        mensaje: '¡Buen intento! Recordá que los descuentos solo aplican a clientes registrados.'
      };
    }

    // 2. Ya tiene un descuento ganado previamente (no son acumulativos)
    if (this.descuentoAplicado() > 0) {
      return {
        exito: false,
        motivo: 'descuento_ya_obtenido',
        porcentajeAplicado: this.descuentoAplicado(),
        mensaje: `Ya tenés un ${this.descuentoAplicado()}% de descuento activo en tu cuenta. Los descuentos no son acumulativos.`
      };
    }

    // 3. Ya usó el primer intento para este juego en particular
    const yaUsoPrimerIntento = !!this.primerosIntentosUsados()[juegoId];
    if (yaUsoPrimerIntento) {
      return {
        exito: false,
        motivo: 'ya_jugado_primer_intento',
        mensaje: 'Este juego ya no participa por descuento porque consumiste el primer intento. ¡Podés seguir jugando por diversión!'
      };
    }

    // 4. Marca el primer intento como consumido
    const intentosActuales = { ...this.primerosIntentosUsados(), [juegoId]: true };
    this.primerosIntentosUsados.set(intentosActuales);

    // 5. Caso: Ganó en el primer intento
    if (gano) {
      this.descuentoAplicado.set(porcentaje);
      this.juegoPremiado.set(juegoId);
      this.guardarEstadoLocal();

      return {
        exito: true,
        porcentajeAplicado: porcentaje,
        mensaje: `¡Felicitaciones! Ganaste un ${porcentaje}% de descuento en tu cuenta final.`
      };
    }

    // 6. Caso: Perdió en el primer intento
    this.guardarEstadoLocal();
    return {
      exito: false,
      motivo: 'perdio_primer_intento',
      mensaje: 'No lograste ganar en tu primer intento. Podés probar en los otros juegos o seguir jugando por diversión.'
    };
  }

  /**
   * Resetea los descuentos para una nueva estadía o mesa.
   */
  resetearDescuentos(): void {
    this.descuentoAplicado.set(0);
    this.juegoPremiado.set(null);
    this.primerosIntentosUsados.set({});
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
