/**
 * /api/relay — single Vercel serverless function serving BOTH relay roles:
 *   GET  /api/relay?center=<slug>  → resolve the center's tunnel URL
 *   POST /api/relay                → register/update the center's tunnel URL
 *
 * vercel.json rewrites map /api/register and /api/target onto this one
 * function so register + lookup share the SAME lambda instance memory. Vercel
 * isolates each api/*.js file into its own function, so splitting register and
 * target across two files would make them unable to share state.
 *
 * Self-contained on purpose: Vercel bundles each file in api/ independently,
 * so no cross-file imports (which can fail during runtime bundling) are used.
 */
function corsHeaders(methods) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Content-Type, X-Relay-Secret',
  };
}

const MEMORY = new Map();

/** Normalize a center slug so lookups are case-insensitive and whitespace-safe. */
function normalizeSlug(value) {
  return (value || '').toString().toLowerCase().trim();
}

function useUpstash() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function upstashSet(key, value) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });
  return res.ok;
}

async function upstashGet(key) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (data && data.result !== null && data.result !== undefined) return data.result;
  const text = await res.text().catch(() => '');
  return text || null;
}

function isStale(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && parsed.updatedAt) {
      const ageMs = Date.now() - new Date(parsed.updatedAt).getTime();
      return ageMs > 5 * 60 * 1000;
    }
  } catch {
    // raw string target — treat as fresh (legacy shape)
  }
  return false;
}

async function setTarget(centerSlug, targetUrl) {
  const key = `center:${normalizeSlug(centerSlug)}`;
  const value = JSON.stringify({ targetUrl, updatedAt: new Date().toISOString() });
  if (useUpstash()) {
    await upstashSet(key, value);
  } else {
    MEMORY.set(key, value);
  }
}

async function getTarget(centerSlug) {
  const key = `center:${normalizeSlug(centerSlug)}`;
  let raw;
  if (useUpstash()) {
    raw = await upstashGet(key);
  } else {
    raw = MEMORY.get(key) || null;
  }
  if (!raw) return null;
  if (isStale(raw)) return null;
  try {
    return JSON.parse(raw).targetUrl || null;
  } catch {
    return raw;
  }
}

function json(res, statusCode, body, methods) {
  res.status(statusCode).set(corsHeaders(methods)).json(body);
}

export default async function handler(req, res) {
  const methods = 'GET, POST, OPTIONS';

  if (req.method === 'OPTIONS') {
    res.status(204).set(corsHeaders(methods)).end();
    return;
  }

  if (req.method === 'GET') {
    const center = normalizeSlug(req.query && req.query.center);
    if (!center) {
      json(res, 200, {
        success: false,
        error: 'missing_center',
        center: '',
        serverTimestamp: Date.now(),
      }, methods);
      return;
    }
    const targetUrl = await getTarget(center);
    if (!targetUrl) {
      // Return 200 (not 404) so the client can render a clear debug status
      // instead of a hard failure it can't distinguish from a network error.
      json(res, 200, {
        success: false,
        error: 'target_not_registered',
        center,
        serverTimestamp: Date.now(),
      }, methods);
      return;
    }
    json(res, 200, { success: true, targetUrl }, methods);
    return;
  }

  if (req.method === 'POST') {
    let body = {};
    try {
      body = req.body || {};
    } catch {
      // body already parsed by the framework
    }
    const { centerSlug, targetUrl, secret } = body;
    if (!centerSlug || !targetUrl) {
      json(res, 400, { error: 'centerSlug and targetUrl are required' }, methods);
      return;
    }
    // Optional shared secret check — mirrors the X-Relay-Secret header used by
    // the desktop TunnelManager. If RELAY_SECRET is configured on Vercel it
    // must match, otherwise registration is rejected. Accepts the secret from
    // either the header or the request body.
    if (process.env.RELAY_SECRET) {
      const headerSecret = req.headers['x-relay-secret'];
      const providedSecret = (Array.isArray(headerSecret) ? headerSecret[0] : headerSecret) || secret || '';
      if (providedSecret !== process.env.RELAY_SECRET) {
        json(res, 401, { error: 'Invalid relay secret' }, methods);
        return;
      }
    }
    const normalized = targetUrl.replace(/\/+$/, '');
    const center = normalizeSlug(centerSlug);
    await setTarget(center, normalized);
    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    json(res, 200, {
      success: true,
      centerSlug: center,
      targetUrl: normalized,
      relayUrl: `${proto}://${host}/${center}`,
      registeredAt: new Date().toISOString(),
    }, methods);
    return;
  }

  json(res, 405, { error: 'Method not allowed' }, methods);
}