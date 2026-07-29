import { get, set, update } from 'idb-keyval';

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

const QUEUE_KEY = 'kumon_siso_event_queue';
const DEVICE_KEY = 'kumon_siso_device_info';

export async function getQueuedEvents(): Promise<LocalQueuedEvent[]> {
  const events = await get<LocalQueuedEvent[]>(QUEUE_KEY);
  return events || [];
}

export async function enqueueEvent(event: LocalQueuedEvent): Promise<void> {
  await update(QUEUE_KEY, (val: LocalQueuedEvent[] | undefined) => {
    const list = val || [];
    list.push(event);
    return list;
  });
}

export async function removeProcessedEvents(processedIds: string[]): Promise<void> {
  await update(QUEUE_KEY, (val: LocalQueuedEvent[] | undefined) => {
    if (!val) return [];
    return val.filter((evt) => !processedIds.includes(evt.id));
  });
}

export async function getDeviceId(): Promise<string> {
  let dev = await get<string>(DEVICE_KEY);
  if (!dev) {
    dev = 'PWA_TABLET_' + Math.random().toString(36).substring(2, 9).toUpperCase();
    await set(DEVICE_KEY, dev);
  }
  return dev;
}
