export interface CardPrintItem {
    studentName: string;
    studentId: string;
    qrIdentifier: string;
    centerName?: string;
}
/**
 * Generates a printable PDF document containing student QR check-in cards arranged in a grid layout.
 */
export declare function generateQrCardsPdf(students: CardPrintItem[], centerName?: string): Promise<Buffer>;
