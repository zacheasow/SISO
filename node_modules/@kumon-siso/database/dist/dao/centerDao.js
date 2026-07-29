"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CenterDao = void 0;
class CenterDao {
    db;
    constructor(db) {
        this.db = db;
    }
    async getCenterInfo() {
        return this.db.get('SELECT * FROM center_info WHERE id = 1');
    }
    async initializeCenter(data) {
        const existing = await this.getCenterInfo();
        if (existing) {
            await this.db.run(`UPDATE center_info SET
          center_name = ?, contact_phone = ?, time_zone = ?, staff_pin_hash = ?,
          logo_url = ?, accent_color = ?, is_onboarded = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = 1`, [
                data.center_name,
                data.contact_phone,
                data.time_zone,
                data.staff_pin_hash,
                data.logo_url || null,
                data.accent_color || '#1E40AF',
            ]);
        }
        else {
            await this.db.run(`INSERT INTO center_info (id, center_name, contact_phone, time_zone, staff_pin_hash, logo_url, accent_color, is_onboarded)
         VALUES (1, ?, ?, ?, ?, ?, ?, 1)`, [
                data.center_name,
                data.contact_phone,
                data.time_zone,
                data.staff_pin_hash,
                data.logo_url || null,
                data.accent_color || '#1E40AF',
            ]);
        }
    }
    async updateSettings(settings) {
        const current = await this.getCenterInfo();
        if (!current)
            return;
        await this.db.run(`UPDATE center_info SET
        center_name = COALESCE(?, center_name),
        contact_phone = COALESCE(?, contact_phone),
        time_zone = COALESCE(?, time_zone),
        early_checkin_window_mins = COALESCE(?, early_checkin_window_mins),
        late_checkin_window_mins = COALESCE(?, late_checkin_window_mins),
        backup_location = COALESCE(?, backup_location),
        updated_at = CURRENT_TIMESTAMP
       WHERE id = 1`, [
            settings.center_name ?? null,
            settings.contact_phone ?? null,
            settings.time_zone ?? null,
            settings.early_checkin_window_mins ?? null,
            settings.late_checkin_window_mins ?? null,
            settings.backup_location ?? null,
        ]);
    }
}
exports.CenterDao = CenterDao;
