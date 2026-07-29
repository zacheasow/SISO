import QRCode from 'qrcode';

/**
 * Generates a PNG Buffer or DataURL representation of a student's opaque QR identifier.
 */
export async function generateQrDataUrl(qrIdentifier: string): Promise<string> {
  return QRCode.toDataURL(qrIdentifier, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 250,
  });
}

/**
 * Generates a PNG Buffer for server-side PDF embedding.
 */
export async function generateQrBuffer(qrIdentifier: string): Promise<Buffer> {
  return QRCode.toBuffer(qrIdentifier, {
    errorCorrectionLevel: 'H',
    margin: 2,
    width: 250,
  });
}

/**
 * Generates an SVG string representation of the QR code.
 */
export async function generateQrSvg(qrIdentifier: string): Promise<string> {
  return QRCode.toString(qrIdentifier, {
    type: 'svg',
    errorCorrectionLevel: 'H',
    margin: 2,
  });
}
