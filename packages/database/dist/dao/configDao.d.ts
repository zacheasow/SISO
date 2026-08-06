import { Database } from '../db.js';
import { SystemConfig } from '@kumon-siso/shared';
export declare class ConfigDao {
    private db;
    private cache;
    constructor(db: Database);
    getValue(key: string, defaultValue?: string): Promise<string>;
    setValue(key: string, value: string): Promise<void>;
    getConfig(): Promise<SystemConfig>;
    updateConfig(partial: Partial<SystemConfig>): Promise<SystemConfig>;
}
