import { Database } from '../db.js';
import { PairedDevice } from '@kumon-siso/shared';
export declare class DeviceDao {
    private db;
    constructor(db: Database);
    getAllDevices(): Promise<PairedDevice[]>;
    getDeviceById(id: string): Promise<PairedDevice | undefined>;
    getDeviceByAuthToken(token: string): Promise<PairedDevice | undefined>;
    generatePairingCode(deviceName: string): Promise<{
        device: PairedDevice;
        rawAuthToken: string;
        pairingCode: string;
    }>;
    updateLastSeen(deviceId: string, pendingCount?: number): Promise<void>;
    revokeDevice(deviceId: string): Promise<void>;
}
