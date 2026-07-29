"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectColumnMapping = detectColumnMapping;
exports.parseAndValidateCsv = parseAndValidateCsv;
exports.generateErrorReportCsv = generateErrorReportCsv;
const papaparse_1 = __importDefault(require("papaparse"));
const shared_1 = require("@kumon-siso/shared");
/**
 * Auto-detects column headers for standard fields.
 */
function detectColumnMapping(headers) {
    const mapping = {
        studentIdCol: '',
        studentNameCol: '',
        parent1PhoneCol: '',
    };
    for (const h of headers) {
        const clean = h.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!mapping.studentIdCol && (clean.includes('studentid') || clean === 'id' || clean.includes('studentnumber') || clean.includes('number'))) {
            mapping.studentIdCol = h;
        }
        else if (!mapping.studentNameCol && (clean.includes('name') || clean.includes('fullname') || clean === 'student')) {
            mapping.studentNameCol = h;
        }
        else if (!mapping.parent1PhoneCol && (clean.includes('parent1') || clean.includes('guardian1') || clean.includes('primaryphone') || clean.includes('parentphone') || clean.includes('phone'))) {
            mapping.parent1PhoneCol = h;
        }
        else if (!mapping.parent2PhoneCol && (clean.includes('parent2') || clean.includes('guardian2') || clean.includes('secondaryphone') || clean.includes('secondparent'))) {
            mapping.parent2PhoneCol = h;
        }
    }
    // Fallback to position if not detected
    if (!mapping.studentIdCol && headers.length > 0)
        mapping.studentIdCol = headers[0];
    if (!mapping.studentNameCol && headers.length > 1)
        mapping.studentNameCol = headers[1];
    if (!mapping.parent1PhoneCol && headers.length > 2)
        mapping.parent1PhoneCol = headers[2];
    if (!mapping.parent2PhoneCol && headers.length > 3)
        mapping.parent2PhoneCol = headers[3];
    return mapping;
}
/**
 * Parses raw CSV content and evaluates row-level validation rules.
 */
function parseAndValidateCsv(csvContent, customMapping) {
    const parsed = papaparse_1.default.parse(csvContent, {
        header: true,
        skipEmptyLines: true,
    });
    const headers = parsed.meta.fields || [];
    const suggestedMapping = { ...detectColumnMapping(headers), ...customMapping };
    const rows = [];
    const seenStudentIds = new Set();
    const duplicateStudentIds = new Set();
    parsed.data.forEach((row, idx) => {
        const rowNum = idx + 2; // header is row 1
        const errors = [];
        const rawId = (row[suggestedMapping.studentIdCol] || '').trim();
        const rawName = (row[suggestedMapping.studentNameCol] || '').trim();
        const rawP1 = (row[suggestedMapping.parent1PhoneCol] || '').trim();
        const rawP2 = suggestedMapping.parent2PhoneCol ? (row[suggestedMapping.parent2PhoneCol] || '').trim() : '';
        if (!rawId) {
            errors.push('Student ID is required');
        }
        else {
            if (seenStudentIds.has(rawId)) {
                errors.push(`Duplicate Student ID '${rawId}' in import file`);
                duplicateStudentIds.add(rawId);
            }
            else {
                seenStudentIds.add(rawId);
            }
        }
        if (!rawName) {
            errors.push('Student Name is required');
        }
        const normP1 = (0, shared_1.normalizePhoneNumber)(rawP1);
        if (!rawP1) {
            errors.push('Parent 1 Phone is required');
        }
        else if (!(0, shared_1.isValidPhoneNumber)(normP1)) {
            errors.push(`Invalid Parent 1 phone number: '${rawP1}'`);
        }
        let normP2 = '';
        if (rawP2) {
            normP2 = (0, shared_1.normalizePhoneNumber)(rawP2);
            if (!(0, shared_1.isValidPhoneNumber)(normP2)) {
                errors.push(`Invalid Parent 2 phone number: '${rawP2}'`);
            }
            if (normP1 === normP2) {
                // Warning / normalize duplicate numbers
                // Both point to same number
            }
        }
        rows.push({
            rowNumber: rowNum,
            studentId: rawId,
            studentName: rawName,
            parent1Phone: normP1,
            parent2Phone: normP2 || undefined,
            isValid: errors.length === 0,
            errors,
        });
    });
    const validCount = rows.filter((r) => r.isValid).length;
    const errorCount = rows.length - validCount;
    return {
        headers,
        suggestedMapping,
        rows,
        validCount,
        errorCount,
        duplicateStudentIds: Array.from(duplicateStudentIds),
    };
}
/**
 * Formats invalid rows into downloadable error report string.
 */
function generateErrorReportCsv(rows) {
    const invalidRows = rows.filter((r) => !r.isValid);
    const data = invalidRows.map((r) => ({
        'Row Number': r.rowNumber,
        'Student ID': r.studentId,
        'Student Name': r.studentName,
        'Parent 1 Phone': r.parent1Phone,
        'Parent 2 Phone': r.parent2Phone || '',
        Errors: r.errors.join('; '),
    }));
    return papaparse_1.default.unparse(data);
}
