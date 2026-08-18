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

async function resolveBackend(): Promise<string> {
  if (!isHostedOrigin()) return '';

  const slug = getCenterSlug();
  if (!slug) return '';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`/api/target?center=${encodeURIComponent(slug)}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      return (data.targetUrl || '').replace(/\/+$/, '');
    }
  } catch {
    // fall through to same-origin
  }

  return '';
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