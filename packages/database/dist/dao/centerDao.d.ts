import { Database } from '../db.js';
import { CenterInfo } from '@kumon-siso/shared';
export declare class CenterDao {
    private db;
    constructor(db: Database);
    getCenterInfo(): Promise<CenterInfo | undefined>;
    initializeCenter(data: {
        center_name: string;
        contact_phone: string;
        time_zone: string;
        staff_pin_hash: string;
        logo_url?: string;
        accent_color?: string;
    }): Promise<void>;
    updateSettings(settings: Partial<CenterInfo>): Promise<void>;
}
