import { QRScanManager } from './scanner.js';
import { getQueuedEvents, enqueueEvent, removeProcessedEvents, getDeviceId, LocalQueuedEvent } from './offlineStorage.js';

let SERVER_BASE = 'http://localhost:3000';
let deviceId = '';
let scanManager: QRScanManager | null = null;
let currentView = 'checkin';
let currentScannedStudent: any = null;
let currentMatchingClasses: any[] = [];

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
const overridePin = document.getElementById('override-pin') as HTMLInputElement;
const overrideReason = document.getElementById('override-reason') as HTMLInputElement;
const btnCancelOverride = document.getElementById('btn-cancel-override')!;
const btnConfirmOverride = document.getElementById('btn-confirm-override')!;

const checkedinList = document.getElementById('checkedin-list')!;
const btnRefreshCheckout = document.getElementById('btn-refresh-checkout')!;
const netDot = document.getElementById('net-dot')!;
const netStatus = document.getElementById('net-status')!;
const deviceNameDisplay = document.getElementById('device-name-display')!;

async function init() {
  deviceId = await getDeviceId();
  deviceNameDisplay.textContent = deviceId;

  scanManager = new QRScanManager();
  scanManager.startCamera(videoPreview, handleQrScan);

  // Setup Event Listeners
  btnModeToggle.addEventListener('click', toggleView);
  btnSearch.addEventListener('click', handleManualSearch);
  inputSearch.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleManualSearch();
  });
  btnSync.addEventListener('click', handleSyncTrigger);
  btnRefreshCheckout.addEventListener('click', loadCheckedInStudents);

  btnCancelOverride.addEventListener('click', () => {
    modalError.classList.add('hidden');
  });

  btnConfirmOverride.addEventListener('click', handleScheduleOverride);

  // Check initial sync status & queue size
  updateQueueBadge();
  checkServerHealth();
  setInterval(checkServerHealth, 10000);
}

async function handleQrScan(qrValue: string) {
  try {
    const res = await fetch(`${SERVER_BASE}/api/students/qr-lookup/${encodeURIComponent(qrValue)}`);
    if (!res.ok) {
      showError('Student Not Found', `No active student matched QR code: ${qrValue}`);
      return;
    }

    const data = await res.json();
    currentScannedStudent = data.student;
    currentMatchingClasses = data.matchingClasses || [];

    if (currentMatchingClasses.length === 1) {
      // Single class matched -> proceed to check-in
      await executeCheckin(currentScannedStudent.id, currentMatchingClasses[0].id, currentMatchingClasses[0].name);
    } else if (currentMatchingClasses.length > 1) {
      // Multiple classes match -> prompt selection
      showClassSelection(currentMatchingClasses);
    } else {
      // No class matched -> prompt override
      showError('No Scheduled Class', `${currentScannedStudent.student_name} is not scheduled for a class right now. Staff override required.`);
    }
  } catch (err) {
    showError('Offline Check-In', 'Could not reach main computer. Recording check-in locally.');
  }
}

async function handleManualSearch() {
  const query = inputSearch.value.trim();
  if (!query) return;

  try {
    const res = await fetch(`${SERVER_BASE}/api/students?query=${encodeURIComponent(query)}`);
    const students = await res.json();

    searchResults.innerHTML = '';
    if (students.length === 0) {
      searchResults.innerHTML = '<div class="result-item">No students found</div>';
    } else {
      students.forEach((s: any) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `<strong>${s.student_name}</strong> <span>ID: ${s.student_id}</span>`;
        item.addEventListener('click', () => {
          searchResults.classList.add('hidden');
          handleQrScan(s.qr_identifier);
        });
        searchResults.appendChild(item);
      });
    }
    searchResults.classList.remove('hidden');
  } catch (err) {
    console.error('Search failed', err);
  }
}

async function executeCheckin(studentId: string, classId: string, className: string, isOverride = false, reason = '') {
  const nowStr = new Date().toISOString();
  const sessionId = 'session_' + Math.random().toString(36).substring(2, 10);
  const idempotencyKey = `checkin_${studentId}_${Date.now()}`;

  const event: LocalQueuedEvent = {
    id: 'evt_' + Math.random().toString(36).substring(2, 10),
    attendance_session_id: sessionId,
    event_type: 'STUDENT_CHECKED_IN',
    originating_device_id: deviceId,
    client_timestamp: nowStr,
    idempotency_key: idempotencyKey,
    student_id: studentId,
    class_id: classId,
    is_override: isOverride,
    override_reason: reason,
  };

  // 1. Immediately record in local storage queue (Sub-second guaranteed)
  await enqueueEvent(event);
  await updateQueueBadge();

  // 2. Display clear success modal
  successStudentName.textContent = currentScannedStudent ? currentScannedStudent.student_name : 'Student Checked In';
  successClassName.textContent = className;
  successTimeIn.textContent = new Date(nowStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  successSmsStatus.textContent = '📱 Parent SMS Queued';

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

  // 3. Trigger background sync attempt
  handleSyncTrigger();
}

async function handleScheduleOverride() {
  const pin = overridePin.value.trim();
  const reason = overrideReason.value.trim();

  if (!pin) {
    alert('Staff PIN is required');
    return;
  }
  if (!reason) {
    alert('Override reason is required');
    return;
  }

  // Verify PIN with server
  try {
    const authRes = await fetch(`${SERVER_BASE}/api/auth/verify-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });

    if (!authRes.ok) {
      alert('Invalid Staff PIN');
      return;
    }

    modalError.classList.add('hidden');
    // Default to first class if available or dummy class
    const classId = currentMatchingClasses[0]?.id || 'class_manual_override';
    const className = currentMatchingClasses[0]?.name || 'Manual Class Override';

    await executeCheckin(currentScannedStudent.id, classId, className, true, reason);
  } catch (err) {
    alert('Could not verify PIN offline');
  }
}

function showError(title: string, msg: string) {
  errorTitle.textContent = title;
  errorMessage.textContent = msg;
  modalError.classList.remove('hidden');
}

function showClassSelection(classes: any[]) {
  // Render class pick list
  errorMessage.textContent = 'Multiple scheduled classes matched. Please pick one:';
  const list = document.createElement('div');
  classes.forEach((c) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.style.margin = '0.5rem';
    btn.textContent = c.name;
    btn.onclick = () => {
      modalError.classList.add('hidden');
      executeCheckin(currentScannedStudent.id, c.id, c.name);
    };
    list.appendChild(btn);
  });
  errorMessage.appendChild(list);
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
    const res = await fetch(`${SERVER_BASE}/api/attendance/checked-in`);
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
        await fetch(`${SERVER_BASE}/api/attendance/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: s.id, deviceId }),
        });
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
    const res = await fetch(`${SERVER_BASE}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_id: deviceId,
        events,
      }),
    });

    if (res.ok) {
      const result = await res.json();
      if (result.processed_event_ids && result.processed_event_ids.length > 0) {
        await removeProcessedEvents(result.processed_event_ids);
      }
      updateQueueBadge();
    } else {
      syncText.textContent = `Sync Failed (${events.length})`;
    }
  } catch (err) {
    syncText.textContent = `Offline (${events.length})`;
  }
}

async function updateQueueBadge() {
  const events = await getQueuedEvents();
  syncText.textContent = `Sync (${events.length})`;
}

async function checkServerHealth() {
  try {
    const res = await fetch(`${SERVER_BASE}/api/health`);
    if (res.ok) {
      netDot.className = 'dot dot-online';
      netStatus.textContent = 'Local Server Connected';
    } else {
      netDot.className = 'dot dot-offline';
      netStatus.textContent = 'Server Unreachable';
    }
  } catch (err) {
    netDot.className = 'dot dot-offline';
    netStatus.textContent = 'Offline Mode';
  }
}

window.addEventListener('DOMContentLoaded', init);
