import { Injectable } from '@angular/core';
import * as QRCode from 'qrcode';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';

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

    const { barcodes } = await BarcodeScanner.scan();
    
    return barcodes.length > 0 ? (barcodes[0].rawValue ?? null) : null;
  }
}