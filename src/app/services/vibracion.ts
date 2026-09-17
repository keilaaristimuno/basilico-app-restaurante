import { Injectable } from '@angular/core';
import {
  Haptics,
  ImpactStyle
} from '@capacitor/haptics';

@Injectable({
  providedIn: 'root'
})
export class VibracionService {

  async error(): Promise<void> {
    try {
      await Haptics.vibrate({
        duration: 400
      });
    } catch (error) {
      console.warn(
        'La vibración no está disponible:',
        error
      );
    }
  }

  async errorFuerte(): Promise<void> {
    try {
      await Haptics.vibrate({
        duration: 700
      });
    } catch (error) {
      console.warn(
        'La vibración no está disponible:',
        error
      );
    }
  }

  async toque(): Promise<void> {
    try {
      await Haptics.impact({
        style: ImpactStyle.Light
      });
    } catch (error) {
      console.warn(
        'La respuesta háptica no está disponible:',
        error
      );
    }
  }
}