/**
 * Generates a PNG Buffer or DataURL representation of a student's opaque QR identifier.
 */
export declare function generateQrDataUrl(qrIdentifier: string): Promise<string>;
/**
 * Generates a PNG Buffer for server-side PDF embedding.
 */
export declare function generateQrBuffer(qrIdentifier: string): Promise<Buffer>;
/**
 * Generates an SVG string representation of the QR code.
 */
export declare function generateQrSvg(qrIdentifier: string): Promise<string>;
