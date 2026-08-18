import { QRScanManager } from './scanner.js';
import { apiFetch, apiUrl, getCenterSlug } from './backend.js';
import {
  getQueuedEvents,
  enqueueEvent,
  removeProcessedEvents,
  clearQueuedEvents,
  getDeviceId,
  cacheRoster,
  findCachedStudentByQr,
  findCachedStudentById,
  StreamlinedQueuedEvent,
} from './offlineStorage.js';

let deviceId = '';
let scanManager: QRScanManager | null = null;
let currentView = 'checkin';
let currentScannedStudent: any = null;
let consecutiveFailures = 0;

// DOM Elements
const viewCheckin = document.getElementById('view-checkin')!;
const viewCheckout = document.getElementById('view-checkout')!;
const btnModeToggle = document.getElementById('btn-mode-toggle')!;
const modeLabel = document.getElementById('mode-label')!;
const btnSync = document.getElementById('btn-sync')!;
const syncText = document.getElementById('sync-text')!;

const videoPreview = document.getElementById('video-preview') as HTMLVideoElement;
const inputSearch = document.getElementById('input-search') as HTMLInputElement;
const btnSearch = document.getElementById('btn-search')!;
const searchResults = document.getElementById('search-results')!;

const modalSuccess = document.getElementById('modal-success')!;
const successStudentName = document.getElementById('success-student-name')!;
const successClassName = document.getElementById('success-class-name')!;
const successTimeIn = document.getElementById('success-time-in')!;
const successSmsStatus = document.getElementById('success-sms-status')!;
const countdownNum = document.getElementById('countdown-num')!;

const modalError = document.getElementById('modal-error')!;
const errorTitle = document.getElementById('error-title')!;
const errorMessage = document.getElementById('error-message')!;
const btnCancelOverride = document.getElementById('btn-cancel-override')!;

const offlineBanner = document.getElementById('offline-banner')!;
const btnBannerDismiss = document.getElementById('btn-banner-dismiss')!;

const checkedinList = document.getElementById('checkedin-list')!;
const btnRefreshCheckout = document.getElementById('btn-refresh-checkout')!;
const netDot = document.getElementById('net-dot')!;
const netStatus = document.getElementById('net-status')!;
const deviceNameDisplay = document.getElementById('device-name-display')!;
const cameraNotice = document.getElementById('camera-notice')!;
const cameraNoticeText = document.getElementById('camera-notice-text')!;
const btnRetryCamera = document.getElementById('btn-retry-camera')!;

const btnDebug = document.getElementById('btn-debug')!;
const debugDrawer = document.getElementById('debug-drawer')!;
const btnCloseDebug = document.getElementById('btn-close-debug')!;
const btnRetrySync = document.getElementById('btn-retry-sync')!;
const btnClearQueue = document.getElementById('btn-clear-queue')!;
const debugQueueCount = document.getElementById('debug-queue-count')!;

async function init() {
  deviceId = await getDeviceId();
  deviceNameDisplay.textContent = deviceId;

  // Register service worker for home-screen install / offline shell.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('[PWA] SW registration failed:', err));
  }

  // Setup Event Listeners immediately (fast UI)
  btnModeToggle.addEventListener('click', toggleView);
  btnSearch.addEventListener('click', handleManualSearch);
  inputSearch.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleManualSearch();
  });
  inputSearch.addEventListener('input', () => {
    clearTimeout((inputSearch as any)._debounceTimer);
    (inputSearch as any)._debounceTimer = setTimeout(handleLiveSearch, 250);
  });
  btnSync.addEventListener('click', handleSyncTrigger);
  btnRefreshCheckout.addEventListener('click', loadCheckedInStudents);

  // Offline banner dismiss
  btnBannerDismiss.addEventListener('click', () => {
    offlineBanner.classList.add('hidden');
  });

  // Debug / Offline Queue drawer
  btnDebug.addEventListener('click', async () => {
    debugDrawer.classList.toggle('hidden');
    debugQueueCount.textContent = String((await getQueuedEvents()).length);
  });
  btnCloseDebug.addEventListener('click', () => {
    debugDrawer.classList.add('hidden');
  });
  btnRetrySync.addEventListener('click', async () => {
    await handleSyncTrigger();
    debugQueueCount.textContent = String((await getQueuedEvents()).length);
  });
  btnClearQueue.addEventListener('click', async () => {
    await clearQueuedEvents();
    debugQueueCount.textContent = '0';
    updateQueueBadge();
    syncText.textContent = 'Sync (0)';
    hideOfflineBannerIfEmpty();
  });

  btnCancelOverride.addEventListener('click', () => {
    modalError.classList.add('hidden');
  });

  // Camera retry button
  if (btnRetryCamera) {
    btnRetryCamera.addEventListener('click', async () => {
      cameraNotice.classList.add('hidden');
      if (scanManager) {
        scanManager.stopCamera();
        scanManager = null;
      }
      await initCamera();
    });
  }

  // Auto-flush offline queue: on reconnect + every 10 seconds
  window.addEventListener('online', () => {
    checkServerHealth();
    handleSyncTrigger();
  });
  setInterval(() => {
    handleSyncTrigger();
  }, 10000);

  // Check initial sync status & queue size
  updateQueueBadge();
  refreshOfflineBanner();
  checkServerHealth();
  setInterval(checkServerHealth, 10000);

  // Defer camera init so UI is interactive first
  requestAnimationFrame(() => {
    setTimeout(initCamera, 0);
  });
}

async function initCamera() {
  scanManager = new QRScanManager();
  const cameraResult = await scanManager.startCamera(videoPreview, handleQrScan);

  if (!cameraResult.success && cameraNotice) {
    cameraNotice.classList.remove('hidden');
    switch (cameraResult.error) {
      case 'CAMERA_UNAVAILABLE_HTTP':
        cameraNoticeText.textContent = 'Camera requires a secure connection (HTTPS). Use the Cloudflare tunnel link (https://...) or connect via localhost. You can still use the manual search below.';
        break;
      case 'CAMERA_UNAVAILABLE':
        cameraNoticeText.textContent = 'Camera access is not available on this device. Use the manual search below to find students.';
        break;
      case 'CAMERA_PERMISSION_DENIED':
        cameraNoticeText.textContent = 'Camera permission was denied. Please allow camera access in your browser settings and reload, or use the manual search below.';
        break;
      case 'NO_CAMERAS_FOUND':
        cameraNoticeText.textContent = 'No camera was detected on this device. Use the manual search below to find students.';
        break;
      default:
        cameraNoticeText.textContent = 'Camera could not be started. Use the manual search below to find students.';
    }
  }
}

/**
 * Network-first check-in/out. When a QR code is scanned or a student name is
 * clicked in manual search we POST to /api/check-in immediately and only show
 * the green confirmation after HTTP 200. On network failure the event is
 * queued in IndexedDB and an amber "Saved Offline" banner is shown.
 */
async function performCheckin(student: any, sourceLabel: string) {
  const nowStr = new Date().toISOString();
  const studentName = student?.student_name || student?.name || 'Student';

  try {
    const res = await apiFetch('/api/check-in', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: student.id, deviceId }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[Check-In] Server rejected:', res.status, errText);
      if (res.status === 404) {
        showError('Student Not Found', `No active student matched this ${sourceLabel}.`);
      } else {
        showError('Check-In Failed', `Server returned ${res.status}. Recording locally instead.`);
      }
      await queueOffline(student.id, nowStr, 'check_in');
      return;
    }

    const data = await res.json();
    const status = data.status === 'checked_out' ? 'Checked Out' : 'Signed In';
    successStudentName.textContent = data.student?.name || studentName;
    successClassName.textContent = status;
    const timeValue = data.session?.timeIn || nowStr;
    successTimeIn.textContent = new Date(timeValue).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    successSmsStatus.textContent = data.status === 'checked_out' ? `Session complete${data.session?.duration != null ? ` — Duration ${data.session.duration}m` : ''}` : 'Parent SMS Queued';

    modalSuccess.classList.remove('hidden');

    let countdown = 3;
    countdownNum.textContent = String(countdown);
    const timer = setInterval(() => {
      countdown--;
      countdownNum.textContent = String(countdown);
      if (countdown <= 0) {
        clearInterval(timer);
        modalSuccess.classList.add('hidden');
        inputSearch.value = '';
      }
    }, 1000);
  } catch (err) {
    console.error('[Check-In] Network error:', err);
    await queueOffline(student.id, nowStr, 'check_in');
  }
}

async function queueOffline(studentId: string, timestamp: string, action: 'check_in' | 'check_out') {
  const event: StreamlinedQueuedEvent = {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    studentId,
    timestamp,
    action,
  };
  await enqueueEvent(event);
  await updateQueueBadge();
  refreshOfflineBanner();
}

async function refreshOfflineBanner() {
  const events = await getQueuedEvents();
  if (events.length > 0) {
    offlineBanner.classList.remove('hidden');
  } else {
    offlineBanner.classList.add('hidden');
  }
}

async function hideOfflineBannerIfEmpty() {
  refreshOfflineBanner();
}

async function handleQrScan(qrValue: string) {
  const cleaned = qrValue.trim();
  console.log('[QR Scan] Raw:', qrValue, 'Cleaned:', cleaned);
  try {
    const res = await apiFetch(`/api/students/qr-lookup/${encodeURIComponent(cleaned)}`);
    if (!res.ok) {
      console.error('[QR Scan] Lookup failed:', res.status, await res.text().catch(() => ''));
      // Offline fallback: resolve QR from the cached roster
      const cached = await findCachedStudentByQr(cleaned);
      if (cached) {
        await performCheckin(cached, 'QR code');
        return;
      }
      showError('Student Not Found', `No active student matched QR code: ${cleaned}`);
      return;
    }

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      // The relay returned an HTML page (e.g. the SPA fallback) instead of a
      // real API response — the center computer's tunnel could not be reached.
      const cached = await findCachedStudentByQr(cleaned);
      if (cached) {
        await performCheckin(cached, 'QR code');
        return;
      }
      showError('Center Computer Unreachable', 'Could not reach the main computer through the relay. Make sure the Kumon SISO app is running on the center computer.');
      return;
    }

    const data = await res.json();
    currentScannedStudent = data.student;
    if (data.student) {
      await performCheckin(data.student, 'QR code');
    } else {
      showError('Student Not Found', `No active student matched QR code: ${cleaned}`);
    }
  } catch (err) {
    console.error('[QR Scan] Network error:', err);
    // Offline: resolve from cached roster so check-in still works
    const cached = await findCachedStudentByQr(cleaned);
    if (cached) {
      await performCheckin(cached, 'QR code');
    } else {
      showError('Center Computer Unreachable', 'Could not reach the main computer. If this is the first scan today, verify the Kumon SISO app is running on the center computer, then try again.');
    }
  }
}

async function handleManualSearch() {
  const query = inputSearch.value.trim();
  if (!query) {
    searchResults.classList.add('hidden');
    return;
  }

  try {
    const res = await apiFetch(`/api/students?query=${encodeURIComponent(query)}`);
    const students = await res.json();

    // Cache roster so QR codes resolve while offline later
    if (Array.isArray(students) && students.length > 0) {
      cacheRoster(students.map((s: any) => ({ id: s.id, student_id: s.student_id, student_name: s.student_name, qr_identifier: s.qr_identifier }))).catch(() => {});
    }

    searchResults.innerHTML = '';
    if (students.length === 0) {
      searchResults.innerHTML = '<div class="result-item">No students found</div>';
    } else {
      students.forEach((s: any) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `<strong>${s.student_name}</strong> <span style="color:#64748b">ID: ${s.student_id}</span>`;
        item.addEventListener('click', () => {
          searchResults.classList.add('hidden');
          inputSearch.value = '';
          performCheckin(s, 'name search');
        });
        searchResults.appendChild(item);
      });
    }
    searchResults.classList.remove('hidden');
  } catch (err) {
    console.error('Search failed', err);
    searchResults.innerHTML = '<div class="result-item">Search unavailable (offline)</div>';
    searchResults.classList.remove('hidden');
  }
}

async function handleLiveSearch() {
  const query = inputSearch.value.trim();
  if (!query || query.length < 2) {
    searchResults.classList.add('hidden');
    return;
  }
  await handleManualSearch();
}

function showError(title: string, msg: string) {
  errorTitle.textContent = title;
  errorMessage.textContent = msg;
  modalError.classList.remove('hidden');
}

function toggleView() {
  if (currentView === 'checkin') {
    currentView = 'checkout';
    viewCheckin.classList.remove('active');
    viewCheckout.classList.add('active');
    modeLabel.textContent = 'Scan Check-In';
    loadCheckedInStudents();
  } else {
    currentView = 'checkin';
    viewCheckout.classList.remove('active');
    viewCheckin.classList.add('active');
    modeLabel.textContent = 'Staff Checkout';
  }
}

async function loadCheckedInStudents() {
  try {
    const res = await apiFetch('/api/attendance/checked-in');
    const students = await res.json();

    checkedinList.innerHTML = '';
    if (students.length === 0) {
      checkedinList.innerHTML = '<p class="subtitle">No students currently checked in.</p>';
      return;
    }

    students.forEach((s: any) => {
      const card = document.createElement('div');
      card.className = 'student-item-card';

      const isRequested = s.pickup_ack_status === 'PICKUP_REQUESTED';
      const badgeClass = isRequested ? 'badge-requested' : 'badge-normal';
      const statusText = isRequested ? 'Pickup Requested' : 'Checked In';

      card.innerHTML = `
        <h3>${s.student_name}</h3>
        <p class="subtitle">ID: ${s.student_number} | Class: ${s.class_name}</p>
        <p>Time In: ${new Date(s.student_time_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        <p><span class="badge ${badgeClass}">${statusText}</span></p>
        <button class="btn btn-primary btn-checkout" style="margin-top:0.5rem;">Complete Checkout</button>
      `;

      card.querySelector('.btn-checkout')!.addEventListener('click', async () => {
        try {
          const res = await apiFetch('/api/check-in', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: s.student_id, deviceId, action: 'check_out' }),
          });
          if (!res.ok) {
            await queueOffline(s.student_id, new Date().toISOString(), 'check_out');
          }
        } catch (err) {
          await queueOffline(s.student_id, new Date().toISOString(), 'check_out');
        }
        loadCheckedInStudents();
      });

      checkedinList.appendChild(card);
    });
  } catch (err) {
    checkedinList.innerHTML = '<p class="subtitle">Could not load list offline.</p>';
  }
}

async function handleSyncTrigger() {
  const events = await getQueuedEvents();
  if (events.length === 0) {
    syncText.textContent = 'Sync (0)';
    return;
  }

  syncText.textContent = 'Syncing...';

  try {
    const res = await apiFetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        events,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[Sync] Server rejected batch:', res.status, errText);
      syncText.textContent = `Sync Failed (${events.length})`;
      return;
    }

    const result = await res.json();
    const processedIds: string[] = Array.isArray(result.processed_event_ids) ? result.processed_event_ids : [];
    const failedIds: string[] = Array.isArray(result.errors) ? result.errors.map((e: any) => e.event_id) : [];

    if (result.errors && result.errors.length > 0) {
      console.warn('[Sync] Dropping failed events:', result.errors);
    }

    const toRemove = [...new Set([...processedIds, ...failedIds])];
    if (toRemove.length > 0) {
      await removeProcessedEvents(toRemove);
    }

    const remaining = (await getQueuedEvents()).length;
    if (remaining === 0) {
      syncText.textContent = 'Synced Successfully';
    } else {
      syncText.textContent = `Sync Failed (${remaining})`;
    }
    updateQueueBadge();
    refreshOfflineBanner();
  } catch (err) {
    console.error('[Sync] Network error:', err);
    syncText.textContent = `Offline (${events.length})`;
  }
}

async function updateQueueBadge() {
  const events = await getQueuedEvents();
  syncText.textContent = `Sync (${events.length})`;
}

async function checkServerHealth() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await apiFetch('/api/health', { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      consecutiveFailures = 0;
      netDot.className = 'dot dot-online';
      netStatus.textContent = 'Connected';
      return;
    }
  } catch {
    // fetch failed
  }

  consecutiveFailures++;

  if (navigator.onLine && consecutiveFailures < 3) {
    netDot.className = 'dot dot-online';
    netStatus.textContent = 'Connected';
  } else if (!navigator.onLine || consecutiveFailures >= 3) {
    netDot.className = 'dot dot-offline';
    netStatus.textContent = 'Offline Mode';
  }
}

window.addEventListener('DOMContentLoaded', init);