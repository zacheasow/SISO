/**
 * Dynamic backend dispatch for the PWA.
 *
 * The same PWA bundle is served from multiple origins:
 *   - The local LAN server / Cloudflare Quick Tunnel (same-origin API calls).
 *   - The Vercel-hosted permanent portal, e.g.
 *     https://kumon-siso.vercel.app/<centerSlug>/parent (API calls must be
 *     forwarded to the desktop's active tunnel through the Vercel relay).
 *
 * When loaded on a hosted origin (Vercel / custom domain), we parse the
 * centerSlug from the URL pathname, query /api/target?center=<centerSlug> to
 * resolve the active backend tunnel URL, and route every /api/* call to it.
 * On the tunnel / LAN origins the API is same-origin, so no prefix is added.
 */
const TUNNEL_HOSTS = /(\.trycloudflare\.com|\.cfargotunnel\.com|\.tunnel\.cloudflared\.com)$/;

const LAST_TUNNEL_KEY = 'kumon_siso_last_tunnel_url';

let centerSlug = '';
let backendBase = ''; // '' = same-origin, otherwise resolved tunnel origin
let backendResolved = false;
let backendPromise: Promise<string> | null = null;

function isLocalHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)
  );
}

/** First path segment = center slug (e.g. /fremont-center/parent -> fremont-center). */
export function getCenterSlug(): string {
  if (centerSlug) return centerSlug;
  centerSlug = window.location.pathname.split('/')[1] || '';
  return centerSlug;
}

/** True when served from the Vercel hosted portal (not the tunnel/LAN server). */
export function isHostedOrigin(): boolean {
  const host = window.location.hostname;
  return !isLocalHost(host) && !TUNNEL_HOSTS.test(host);
}

/** Cache the last-known-good tunnel so a brief relay cold start can't break the kiosk. */
function cacheTunnelUrl(url: string): void {
  try {
    localStorage.setItem(LAST_TUNNEL_KEY, url);
  } catch {
    // storage unavailable — ignore
  }
}

function readCachedTunnelUrl(): string {
  try {
    return localStorage.getItem(LAST_TUNNEL_KEY) || '';
  } catch {
    return '';
  }
}

async function resolveBackend(): Promise<string> {
  if (!isHostedOrigin()) return '';

  const slug = getCenterSlug();
  if (!slug) return '';

  // Query /api/target up to 3 times with exponential backoff before declaring
  // the center unreachable — Vercel lambdas cold-start and may need a warm-up.
  const attempts = 3;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`/api/target?center=${encodeURIComponent(slug)}`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.targetUrl) {
          const target = data.targetUrl.replace(/\/+$/, '');
          cacheTunnelUrl(target);
          return target;
        }
        // success:false (e.g. target_not_registered) — retry a couple times, a
        // fresh registration may land from the desktop heartbeat any moment.
      }
    } catch {
      // network error — retry below
    }
    if (attempt < attempts) {
      await new Promise((r) => setTimeout(r, 300 * attempt));
    }
  }

  // Relay temporarily unreachable or unregistered — reuse the last-known tunnel
  // URL so an already-paired tablet keeps working even during a Vercel cold start.
  const cached = readCachedTunnelUrl();
  if (cached && await isTunnelHealthy(cached)) return cached;

  return '';
}

/** Verify a cached tunnel URL is actually alive before falling back to it. */
async function isTunnelHealthy(base: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${base}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Resolve the backend API base for this origin.
 *   - Tunnel / LAN: same-origin ('').
 *   - Hosted (Vercel): parse centerSlug, ask /api/target, use the tunnel URL.
 */
export async function getBackendBase(): Promise<string> {
  if (backendResolved) return backendBase;
  if (backendPromise) return backendPromise;

  backendPromise = resolveBackend().then((base) => {
    backendBase = base;
    backendResolved = true;
    backendPromise = null;
    return backendBase;
  });

  return backendPromise;
}

/** Full URL for an API path on the correct origin for this page. */
export async function apiUrl(path: string): Promise<string> {
  const base = await getBackendBase();
  return base ? `${base}${path}` : path;
}

/** fetch() helper that transparently dispatches to the resolved backend. */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(await apiUrl(path), init);
}

/**
 * Clear the cached backend resolution so the next getBackendBase() re-resolves
 * the relay target. Used by the "Tap to Retry Connection" flow after the center
 * tunnel comes back online.
 */
export function resetBackend(): void {
  backendResolved = false;
  backendBase = '';
  backendPromise = null;
}