import { apiFetch, getCenterSlug, isHostedOrigin } from './backend.js';

const API_BASE = 'http://localhost:3000';
const STORAGE_KEY = 'kumon_siso_saved_children';

interface ChildProfile {
  id: string;
  firstName: string;
  lastName: string;
}

interface ChildStatus {
  id: string;
  student_id: string;
  student_name: string;
  checked_in: boolean;
  session_id: string | null;
  time_in: string | null;
  class_name: string | null;
  duration_text: string | null;
}

const inputFirst = document.getElementById('input-first') as HTMLInputElement;
const inputLast = document.getElementById('input-last') as HTMLInputElement;
const btnAdd = document.getElementById('btn-add')!;
const btnRefresh = document.getElementById('btn-refresh')!;
const profilesList = document.getElementById('profiles-list')!;
const connDot = document.getElementById('conn-dot')!;
const connStatus = document.getElementById('conn-status')!;

let profiles: ChildProfile[] = loadProfiles();
let refreshTimer: number | null = null;

function loadProfiles(): ChildProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((p) => p && p.id && p.firstName && p.lastName)
      : [];
  } catch {
    return [];
  }
}

function saveProfiles() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  } catch (e) {
    console.error('Could not save profiles to localStorage', e);
  }
}

// Dispatch API calls through the resolved backend (Vercel-hosted portal ->
// active Cloudflare tunnel), falling back to same-origin then localhost so the
// page still works when served directly from the LAN/tunnel server.
async function fetchApi(path: string, init?: RequestInit): Promise<Response> {
  try {
    const res = await apiFetch(path, init);
    if (res.ok) return res;
    if (res.status >= 400 && res.status < 500) return res;
  } catch {
    // network failure — try the next fallback
  }
  try {
    const res = await fetch(path, init);
    if (res.ok) return res;
  } catch {
    // fall through to absolute localhost
  }
  return fetch(`${API_BASE}${path}`, init);
}

async function fetchStatus(profile: ChildProfile): Promise<ChildStatus[]> {
  const qs = new URLSearchParams({ firstName: profile.firstName, lastName: profile.lastName }).toString();
  try {
    const res = await fetchApi(`/api/parent/students?${qs}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function signOut(sessionId: string): Promise<boolean> {
  try {
    const res = await fetchApi('/api/parent/signout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return iso;
  }
}

async function renderProfiles() {
  profilesList.innerHTML = '';

  if (profiles.length === 0) {
    profilesList.innerHTML = '<p class="subtitle">No children saved yet. Add your child above to get started.</p>';
    return;
  }

  for (const profile of profiles) {
    const card = document.createElement('div');
    card.className = 'student-item-card';

    const name = `${profile.firstName} ${profile.lastName}`.trim();
    const statuses = await fetchStatus(profile);

    const header = document.createElement('h3');
    header.textContent = name;
    card.appendChild(header);

    if (statuses.length === 0) {
      const p = document.createElement('p');
      p.innerHTML = '<span class="badge badge-normal">Not found in roster</span>';
      card.appendChild(p);
    } else {
      statuses.forEach((s) => {
        const row = document.createElement('div');
        row.className = 'status-row';

        const badge = s.checked_in
          ? '<span class="badge badge-checkedin">Checked In</span>'
          : '<span class="badge badge-normal">Checked Out</span>';
        const timeInfo = s.checked_in
          ? `<p class="subtitle">Class: ${s.class_name || 'N/A'} &middot; Signed in at ${formatTime(s.time_in)}${s.duration_text ? ` &middot; ${s.duration_text} elapsed` : ''}</p>`
          : '';
        row.innerHTML = `<div>${badge}${timeInfo}</div>`;

        if (s.checked_in && s.session_id) {
          const btn = document.createElement('button');
          btn.className = 'btn btn-signout';
          btn.textContent = 'Sign Out';
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Signing out...';
            const ok = await signOut(s.session_id!);
            if (ok) {
              alert(`${s.student_name} signed out successfully.`);
              await renderProfiles();
            } else {
              btn.disabled = false;
              btn.textContent = 'Sign Out';
              alert('Could not sign out. Please try again.');
            }
          });
          row.appendChild(btn);
        }
        card.appendChild(row);
      });
    }

    const actions = document.createElement('div');
    actions.className = 'card-actions';
    const removeBtn = document.createElement('button');
    removeBtn.className = 'btn btn-secondary';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
      profiles = profiles.filter((p) => p.id !== profile.id);
      saveProfiles();
      renderProfiles();
    });
    actions.appendChild(removeBtn);
    card.appendChild(actions);

    profilesList.appendChild(card);
  }
}

function addProfile() {
  const firstName = inputFirst.value.trim();
  const lastName = inputLast.value.trim();
  if (!firstName || !lastName) {
    alert('Please enter both first and last name.');
    return;
  }
  profiles = [...profiles, { id: 'p_' + Math.random().toString(36).substring(2, 10), firstName, lastName }];
  saveProfiles();
  inputFirst.value = '';
  inputLast.value = '';
  renderProfiles();
}

async function checkConnection() {
  try {
    const res = await fetchApi('/api/health');
    connDot.className = res.ok ? 'dot dot-online' : 'dot dot-offline';
    connStatus.textContent = res.ok ? 'Server Connected' : 'Server Unreachable';
  } catch {
    connDot.className = 'dot dot-offline';
    connStatus.textContent = 'Offline';
  }
}

btnAdd.addEventListener('click', addProfile);
inputFirst.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') inputLast.focus();
});
inputLast.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') addProfile();
});
btnRefresh.addEventListener('click', renderProfiles);

window.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch((err) => console.warn('[PWA] SW registration failed:', err));
  }

  // A home-screen launch of /parent (no center slug) on the hosted Vercel
  // origin cannot resolve a backend tunnel — show a helpful notice instead of
  // a misleading "Server Unreachable" state.
  const notice = document.getElementById('center-notice');
  if (notice && isHostedOrigin() && !getCenterSlug()) {
    notice.style.display = 'block';
  }

  renderProfiles();
  checkConnection();
  refreshTimer = window.setInterval(() => {
    checkConnection();
    renderProfiles();
  }, 30000);
});
