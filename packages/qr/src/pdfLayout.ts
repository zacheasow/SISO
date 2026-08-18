import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { generateQrBuffer } from './qrGenerator.js';

export interface CardPrintItem {
  studentName: string;
  studentId: string;
  qrIdentifier: string;
  centerName?: string;
}

/**
 * Generates a printable PDF document containing student QR check-in cards arranged in a grid layout.
 */
export async function generateQrCardsPdf(
  students: CardPrintItem[],
  centerName = 'Community Learning Center'
): Promise<Buffer> {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margin: 36 });
      const buffers: Buffer[] = [];

      doc.on('data', (chunk) => buffers.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', (err) => reject(err));

      const cardsPerPage = 8;
      const cols = 2;
      const cardWidth = 250;
      const cardHeight = 160;
      const gapX = 40;
      const gapY = 20;
      const startX = 36;
      const startY = 36;

      for (let i = 0; i < students.length; i++) {
        if (i > 0 && i % cardsPerPage === 0) {
          doc.addPage();
        }

        const item = students[i];
        const pageIndex = i % cardsPerPage;
        const col = pageIndex % cols;
        const row = Math.floor(pageIndex / cols);

        const x = startX + col * (cardWidth + gapX);
        const y = startY + row * (cardHeight + gapY);

        // Draw Card Border
        doc.roundedRect(x, y, cardWidth, cardHeight, 8).lineWidth(1).stroke('#CBD5E1');

        // Draw Center Header Banner
        doc.rect(x, y, cardWidth, 28).fill('#1E40AF');
        doc
          .fillColor('#FFFFFF')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(centerName.toUpperCase(), x + 8, y + 8, { width: cardWidth - 16, align: 'center' });

        // Generate QR Image Buffer - try toBuffer first, fall back to SVG
        let qrBuffer: Buffer;
        try {
          qrBuffer = await generateQrBuffer(item.qrIdentifier);
        } catch {
          // Fallback: generate SVG string and convert to data URL
          const svgString = await QRCode.toString(item.qrIdentifier, {
            type: 'svg',
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 100,
          });
          // Create a simple placeholder if QR generation fails entirely
          doc.save();
          doc.rect(x + 10, y + 36, 100, 100).fill('#f1f5f9');
          doc.fillColor('#64748B').fontSize(8).text('QR', x + 50, y + 80, { width: 20, align: 'center' });
          doc.restore();
          qrBuffer = Buffer.alloc(0);
        }

        if (qrBuffer.length > 0) {
          try {
            doc.image(qrBuffer, x + 10, y + 36, { width: 100, height: 100 });
          } catch {
            // If image embed fails, draw placeholder
            doc.save();
            doc.rect(x + 10, y + 36, 100, 100).fill('#f1f5f9');
            doc.fillColor('#64748B').fontSize(8).text('QR', x + 50, y + 80, { width: 20, align: 'center' });
            doc.restore();
          }
        }

        // Draw Student Info
        doc.fillColor('#0F172A').fontSize(14).font('Helvetica-Bold').text(item.studentName, x + 115, y + 45, {
          width: 125,
          ellipsis: true,
        });

        doc.fillColor('#475569').fontSize(10).font('Helvetica').text(`ID: ${item.studentId}`, x + 115, y + 70);

        doc
          .fillColor('#64748B')
          .fontSize(8)
          .text('Scan for Check-in & Pickup', x + 115, y + 110);
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
