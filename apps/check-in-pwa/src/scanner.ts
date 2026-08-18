export class QRScanManager {
  private codeReader: any = null;
  private isScanning = false;

  async startCamera(videoElement: HTMLVideoElement, onScanCallback: (qrValue: string) => void): Promise<{ success: boolean; error?: string }> {
    if (this.isScanning) return { success: true };
    this.isScanning = true;

    const isSecureContext = window.isSecureContext;
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    if (!hasMediaDevices) {
      this.isScanning = false;
      if (!isSecureContext) {
        return { success: false, error: 'CAMERA_UNAVAILABLE_HTTP' };
      }
      return { success: false, error: 'CAMERA_UNAVAILABLE' };
    }

    try {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      this.codeReader = new BrowserMultiFormatReader();

      const videoInputDevices = await this.codeReader.listVideoInputDevices();
      if (videoInputDevices.length === 0) {
        this.isScanning = false;
        return { success: false, error: 'NO_CAMERAS_FOUND' };
      }

      const selectedDevice = videoInputDevices.find(
        (d: any) => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('environment')
      ) || videoInputDevices[0];

      await this.codeReader.decodeFromVideoDevice(selectedDevice.deviceId, videoElement, (result: any) => {
        if (result) {
          onScanCallback(result.getText());
        }
      });

      return { success: true };
    } catch (err: any) {
      this.isScanning = false;
      console.error('Camera initialization error:', err);
      if (err?.name === 'NotAllowedError' || err?.message?.includes('Permission')) {
        return { success: false, error: 'CAMERA_PERMISSION_DENIED' };
      }
      return { success: false, error: 'CAMERA_INIT_FAILED' };
    }
  }

  stopCamera(): void {
    if (!this.isScanning) return;
    if (this.codeReader) {
      this.codeReader.reset();
    }
    this.isScanning = false;
  }
}
