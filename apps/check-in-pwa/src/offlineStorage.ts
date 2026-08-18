import { get, set, update } from 'idb-keyval';

// Backward-compatible full event record (legacy sync payloads).
export interface LocalQueuedEvent {
  id: string;
  attendance_session_id: string;
  event_type: string;
  originating_device_id: string;
  client_timestamp: string;
  idempotency_key: string;
  student_id?: string;
  class_id?: string;
  is_override?: boolean;
  override_type?: string;
  override_reason?: string;
  metadata?: any;
}

// Streamlined offline check-in/out record sent to POST /api/sync.
export interface StreamlinedQueuedEvent {
  id: string;
  studentId: string;
  timestamp: string;
  action: 'check_in' | 'check_out';
}

// Cached roster used to resolve QR codes while offline.
export interface CachedStudent {
  id: string;
  student_id: string;
  student_name: string;
  qr_identifier: string;
}

const QUEUE_KEY = 'kumon_siso_event_queue';
const DEVICE_KEY = 'kumon_siso_device_info';
const ROSTER_CACHE_KEY = 'kumon_siso_student_cache';

export async function getQueuedEvents(): Promise<StreamlinedQueuedEvent[]> {
  const events = await get<StreamlinedQueuedEvent[]>(QUEUE_KEY);
  return events || [];
}

export async function enqueueEvent(event: StreamlinedQueuedEvent): Promise<void> {
  await update(QUEUE_KEY, (val: StreamlinedQueuedEvent[] | undefined) => {
    const list = val || [];
    list.push(event);
    return list;
  });
}

export async function removeProcessedEvents(processedIds: string[]): Promise<void> {
  await update(QUEUE_KEY, (val: StreamlinedQueuedEvent[] | undefined) => {
    if (!val) return [];
    return val.filter((evt) => !processedIds.includes(evt.id));
  });
}

export async function clearQueuedEvents(): Promise<void> {
  await set(QUEUE_KEY, []);
}

export async function getDeviceId(): Promise<string> {
  let dev = await get<string>(DEVICE_KEY);
  if (!dev) {
    dev = 'PWA_TABLET_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    await set(DEVICE_KEY, dev);
  }
  return dev;
}

export async function cacheRoster(students: CachedStudent[]): Promise<void> {
  await set(ROSTER_CACHE_KEY, students);
}

export async function getCachedRoster(): Promise<CachedStudent[]> {
  const students = await get<CachedStudent[]>(ROSTER_CACHE_KEY);
  return students || [];
}

export async function findCachedStudentByQr(qr: string): Promise<CachedStudent | undefined> {
  const roster = await getCachedRoster();
  return roster.find((s) => s.qr_identifier === qr);
}

export async function findCachedStudentById(id: string): Promise<CachedStudent | undefined> {
  const roster = await getCachedRoster();
  return roster.find((s) => s.id === id);
}