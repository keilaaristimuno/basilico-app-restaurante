import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class QrService {

  async generarQR(contenido: string): Promise<string> {
    return await QRCode.toDataURL(contenido, { width: 300, margin: 1 });
  }

  async leerQR(): Promise<string | null> {
    const { camera } = await BarcodeScanner.checkPermissions();

    if (camera !== "granted") {
      const permiso = await BarcodeScanner.requestPermissions();
      if (permiso.camera !== "granted") return null;
    }
        /* LA INSTALACION SE INCIA ACA */
    if (Capacitor.getPlatform() === 'android') {
      const { available } =
        await BarcodeScanner.isGoogleBarcodeScannerModuleAvailable();

      if (!available) {
        await BarcodeScanner.installGoogleBarcodeScannerModule();
        throw new Error('Se inició la instalación del lector QR. Esperá un momento y volvé a intentar.');
      }
    }

    const { barcodes } = await BarcodeScanner.scan();
    
    return barcodes.length > 0 ? (barcodes[0].rawValue ?? null) : null;
  }
}