import PDFDocument from 'pdfkit';
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

        // Draw Center Header Header Banner
        doc.rect(x, y, cardWidth, 28).fill('#1E40AF');
        doc
          .fillColor('#FFFFFF')
          .fontSize(10)
          .font('Helvetica-Bold')
          .text(centerName.toUpperCase(), x + 8, y + 8, { width: cardWidth - 16, align: 'center' });

        // Generate QR Image Buffer
        const qrBuffer = await generateQrBuffer(item.qrIdentifier);
        doc.image(qrBuffer, x + 10, y + 36, { width: 100, height: 100 });

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
