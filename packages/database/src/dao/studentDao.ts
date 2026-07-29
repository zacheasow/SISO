import { Database } from '../db.js';
import { Student, ClassItem, Schedule, Enrollment } from '@kumon-siso/shared';
import { generateSecureToken } from '@kumon-siso/shared';
import { randomUUID } from 'node:crypto';

export class StudentDao {
  constructor(private db: Database) {}

  async getStudentById(id: string): Promise<Student | undefined> {
    return this.db.get<Student>('SELECT * FROM students WHERE id = ?', [id]);
  }

  async getStudentByStudentId(studentId: string): Promise<Student | undefined> {
    return this.db.get<Student>('SELECT * FROM students WHERE student_id = ?', [studentId]);
  }

  async getStudentByQr(qrIdentifier: string): Promise<Student | undefined> {
    return this.db.get<Student>('SELECT * FROM students WHERE qr_identifier = ? AND is_active = 1', [qrIdentifier]);
  }

  async getAllStudents(activeOnly = true): Promise<Student[]> {
    if (activeOnly) {
      return this.db.all<Student>('SELECT * FROM students WHERE is_active = 1 ORDER BY student_name ASC');
    }
    return this.db.all<Student>('SELECT * FROM students ORDER BY student_name ASC');
  }

  async searchStudents(query: string): Promise<Student[]> {
    const q = `%${query.trim()}%`;
    return this.db.all<Student>(
      `SELECT * FROM students
       WHERE is_active = 1 AND (student_name LIKE ? OR student_id LIKE ?)
       ORDER BY student_name ASC LIMIT 50`,
      [q, q]
    );
  }

  async createStudent(data: {
    student_id: string;
    student_name: string;
    parent1_phone: string;
    parent2_phone?: string | null;
    qr_identifier?: string;
  }): Promise<Student> {
    const id = randomUUID();
    const qr = data.qr_identifier || generateSecureToken(16);
    await this.db.run(
      `INSERT INTO students (id, student_id, student_name, parent1_phone, parent2_phone, qr_identifier)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, data.student_id, data.student_name, data.parent1_phone, data.parent2_phone || null, qr]
    );
    const created = await this.getStudentById(id);
    return created!;
  }

  async updateStudent(id: string, data: Partial<Student>): Promise<void> {
    await this.db.run(
      `UPDATE students SET
        student_id = COALESCE(?, student_id),
        student_name = COALESCE(?, student_name),
        parent1_phone = COALESCE(?, parent1_phone),
        parent2_phone = COALESCE(?, parent2_phone),
        is_active = COALESCE(?, is_active),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [
        data.student_id ?? null,
        data.student_name ?? null,
        data.parent1_phone ?? null,
        data.parent2_phone ?? null,
        data.is_active !== undefined ? (data.is_active ? 1 : 0) : null,
        id,
      ]
    );
  }

  async regenerateQrCode(studentId: string): Promise<string> {
    const newQr = generateSecureToken(16);
    await this.db.run(
      'UPDATE students SET qr_identifier = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newQr, studentId]
    );
    return newQr;
  }

  // Class and Schedule methods
  async createClass(name: string, description?: string): Promise<ClassItem> {
    const id = randomUUID();
    await this.db.run('INSERT INTO classes (id, name, description) VALUES (?, ?, ?)', [id, name, description || null]);
    return (await this.db.get<ClassItem>('SELECT * FROM classes WHERE id = ?', [id]))!;
  }

  async getAllClasses(): Promise<ClassItem[]> {
    return this.db.all<ClassItem>('SELECT * FROM classes WHERE is_active = 1 ORDER BY name ASC');
  }

  async createSchedule(data: {
    class_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    early_window_mins?: number;
    late_window_mins?: number;
  }): Promise<Schedule> {
    const id = randomUUID();
    await this.db.run(
      `INSERT INTO schedules (id, class_id, day_of_week, start_time, end_time, early_window_mins, late_window_mins)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.class_id,
        data.day_of_week,
        data.start_time,
        data.end_time,
        data.early_window_mins || 30,
        data.late_window_mins || 60,
      ]
    );
    return (await this.db.get<Schedule>('SELECT * FROM schedules WHERE id = ?', [id]))!;
  }

  async enrollStudent(studentId: string, classId: string): Promise<Enrollment> {
    const id = randomUUID();
    await this.db.run(
      'INSERT INTO enrollments (id, student_id, class_id) VALUES (?, ?, ?)',
      [id, studentId, classId]
    );
    return (await this.db.get<Enrollment>('SELECT * FROM enrollments WHERE id = ?', [id]))!;
  }

  async getMatchingClassesForStudent(studentId: string, checkinTime: Date): Promise<ClassItem[]> {
    const dayOfWeek = checkinTime.getDay(); // 0=Sun, 6=Sat
    const hours = String(checkinTime.getHours()).padStart(2, '0');
    const mins = String(checkinTime.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${hours}:${mins}`;

    // Get all enrolled classes for student
    const enrollments = await this.db.all<{ class_id: string }>(
      'SELECT class_id FROM enrollments WHERE student_id = ? AND is_active = 1',
      [studentId]
    );
    if (enrollments.length === 0) return [];

    const classIds = enrollments.map((e) => e.class_id);
    const placeholders = classIds.map(() => '?').join(',');

    const schedules = await this.db.all<Schedule & { class_name: string }>(
      `SELECT s.*, c.name as class_name
       FROM schedules s
       JOIN classes c ON c.id = s.class_id
       WHERE s.class_id IN (${placeholders}) AND s.day_of_week = ?`,
      [...classIds, dayOfWeek]
    );

    const matchedClasses: ClassItem[] = [];
    for (const sched of schedules) {
      // Check if current time is within [start_time - early_window, end_time + late_window]
      const [sH, sM] = sched.start_time.split(':').map(Number);
      const [eH, eM] = sched.end_time.split(':').map(Number);

      const startMinutes = sH * 60 + sM - (sched.early_window_mins || 30);
      const endMinutes = eH * 60 + eM + (sched.late_window_mins || 60);
      const currentMinutes = checkinTime.getHours() * 60 + checkinTime.getMinutes();

      if (currentMinutes >= startMinutes && currentMinutes <= endMinutes) {
        matchedClasses.push({
          id: sched.class_id,
          name: sched.class_name,
          is_active: true,
        });
      }
    }

    return matchedClasses;
  }
}
