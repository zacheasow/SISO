import { Database } from '../db.js';
import { Student, ClassItem, Schedule, Enrollment } from '@kumon-siso/shared';
export declare class StudentDao {
    private db;
    constructor(db: Database);
    getStudentById(id: string): Promise<Student | undefined>;
    getStudentByStudentId(studentId: string): Promise<Student | undefined>;
    getStudentByQr(qrIdentifier: string): Promise<Student | undefined>;
    getAllStudents(activeOnly?: boolean): Promise<Student[]>;
    searchStudents(query: string): Promise<Student[]>;
    createStudent(data: {
        student_id: string;
        student_name: string;
        parent1_phone: string;
        parent2_phone?: string | null;
        qr_identifier?: string;
    }): Promise<Student>;
    updateStudent(id: string, data: Partial<Student>): Promise<void>;
    regenerateQrCode(studentId: string): Promise<string>;
    createClass(name: string, description?: string): Promise<ClassItem>;
    getAllClasses(): Promise<ClassItem[]>;
    createSchedule(data: {
        class_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        early_window_mins?: number;
        late_window_mins?: number;
    }): Promise<Schedule>;
    enrollStudent(studentId: string, classId: string): Promise<Enrollment>;
    getMatchingClassesForStudent(studentId: string, checkinTime: Date): Promise<ClassItem[]>;
}
