"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateQrDataUrl = generateQrDataUrl;
exports.generateQrBuffer = generateQrBuffer;
exports.generateQrSvg = generateQrSvg;
const qrcode_1 = __importDefault(require("qrcode"));
/**
 * Generates a PNG Buffer or DataURL representation of a student's opaque QR identifier.
 */
async function generateQrDataUrl(qrIdentifier) {
    return qrcode_1.default.toDataURL(qrIdentifier, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 250,
    });
}
/**
 * Generates a PNG Buffer for server-side PDF embedding.
 */
async function generateQrBuffer(qrIdentifier) {
    return qrcode_1.default.toBuffer(qrIdentifier, {
        errorCorrectionLevel: 'H',
        margin: 2,
        width: 250,
    });
}
/**
 * Generates an SVG string representation of the QR code.
 */
async function generateQrSvg(qrIdentifier) {
    return qrcode_1.default.toString(qrIdentifier, {
        type: 'svg',
        errorCorrectionLevel: 'H',
        margin: 2,
    });
}
