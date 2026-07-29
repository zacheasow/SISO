export interface ColumnMapping {
    studentIdCol: string;
    studentNameCol: string;
    parent1PhoneCol: string;
    parent2PhoneCol?: string;
}
export interface ParsedStudentRow {
    rowNumber: number;
    studentId: string;
    studentName: string;
    parent1Phone: string;
    parent2Phone?: string;
    isValid: boolean;
    errors: string[];
}
export interface ImportPreviewResult {
    headers: string[];
    suggestedMapping: ColumnMapping;
    rows: ParsedStudentRow[];
    validCount: number;
    errorCount: number;
    duplicateStudentIds: string[];
}
/**
 * Auto-detects column headers for standard fields.
 */
export declare function detectColumnMapping(headers: string[]): ColumnMapping;
/**
 * Parses raw CSV content and evaluates row-level validation rules.
 */
export declare function parseAndValidateCsv(csvContent: string, customMapping?: Partial<ColumnMapping>): ImportPreviewResult;
/**
 * Formats invalid rows into downloadable error report string.
 */
export declare function generateErrorReportCsv(rows: ParsedStudentRow[]): string;
