import { BrowserMultiFormatReader } from '@zxing/library';

export class QRScanManager {
  private codeReader: BrowserMultiFormatReader;
  private isScanning = false;

  constructor() {
    this.codeReader = new BrowserMultiFormatReader();
  }

  async startCamera(videoElement: HTMLVideoElement, onScanCallback: (qrValue: string) => void): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      const videoInputDevices = await this.codeReader.listVideoInputDevices();
      if (videoInputDevices.length === 0) {
        console.warn('No camera devices found for QR scanning');
        return;
      }

      // Prefer back environment camera on tablets/phones
      const selectedDevice = videoInputDevices.find((d) => d.label.toLowerCase().includes('back')) || videoInputDevices[0];

      await this.codeReader.decodeFromVideoDevice(selectedDevice.deviceId, videoElement, (result) => {
        if (result) {
          onScanCallback(result.getText());
        }
      });
    } catch (err) {
      console.error('Camera initialization error:', err);
    }
  }

  stopCamera(): void {
    if (!this.isScanning) return;
    this.codeReader.reset();
    this.isScanning = false;
  }
}
