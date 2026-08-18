/**
 * cloudflare-worker-relay.js
 *
 * Cloudflare Worker Relay — gives every center a fixed, branded URL that
 * never changes even when the local Cloudflare Quick Tunnel URL rotates on
 * every app restart.
 *
 *   https://relay.kumonsiso.com/{centerSlug}/kiosk    -> <targetUrl>/kiosk
 *   https://relay.kumonsiso.com/{centerSlug}/parent   -> <targetUrl>/parent
 *   https://relay.kumonsiso.com/{centerSlug}/api/*    -> <targetUrl>/api/*
 *
 * The local server calls POST /api/register (with X-Relay-Secret) whenever
 * a new Quick Tunnel URL is created, storing the centerSlug -> targetUrl
 * mapping in Cloudflare KV.
 *
 * DEPLOYMENT
 *   wrangler kv:namespace create KUMON_RELAY
 *   wrangler secret put RELAY_SECRET
 *   wrangler deploy scripts/cloudflare-worker-relay.js
 *
 * The KV binding must be named KUMON_RELAY and RELAY_SECRET must match the
 * relay_secret stored in the center's local SQLite config.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname } = url;

    // ---- CORS preflight ----
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(),
      });
    }

    // ---- POST /api/register : store centerSlug -> targetUrl ----
    if (request.method === 'POST' && pathname === '/api/register') {
      const providedSecret = request.headers.get('X-Relay-Secret') || '';
      const expectedSecret = env.RELAY_SECRET || '';

      if (expectedSecret && providedSecret !== expectedSecret) {
        return json({ error: 'Unauthorized' }, 401);
      }

      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: 'Invalid JSON body' }, 400);
      }

      const { centerSlug, targetUrl } = body || {};
      if (!centerSlug || !targetUrl) {
        return json({ error: 'centerSlug and targetUrl are required' }, 400);
      }

      const safeSlug = String(centerSlug).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
      if (!safeSlug) {
        return json({ error: 'Invalid centerSlug' }, 400);
      }

      await env.KUMON_RELAY.put(safeSlug, String(targetUrl), { expirationTtl: 60 * 60 * 24 * 30 });

      const relayUrl = `${url.origin}/${safeSlug}/kiosk`;
      return json({ success: true, centerSlug: safeSlug, targetUrl: String(targetUrl), relayUrl }, 200, corsHeaders());
    }

    // ---- GET /api/status : health check for debugging ----
    if (request.method === 'GET' && pathname === '/api/status') {
      return json({ status: 'ok', service: 'kumon-siso-relay' }, 200, corsHeaders());
    }

    // ---- Reverse proxy: /{centerSlug}/... -> targetUrl/... ----
    const match = pathname.match(/^\/([^/]+)(\/.*)?$/);
    if (!match) {
      return json({ error: 'Not found. Expected /{centerSlug}/kiosk or /{centerSlug}/parent' }, 404, corsHeaders());
    }

    const centerSlug = match[1];
    const subPath = match[2] || '/';

    const targetUrl = await env.KUMON_RELAY.get(centerSlug);
    if (!targetUrl) {
      return json({ error: `Unknown center slug "${centerSlug}". Register it via POST /api/register first.` }, 404, corsHeaders());
    }

    const target = new URL(subPath, targetUrl.endsWith('/') ? targetUrl : `${targetUrl}/`);

    // Proxy the request (strip the centerSlug prefix, pass the rest through).
    const init = {
      method: request.method,
      headers: cloneHeaders(request.headers),
      redirect: 'manual',
    };
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      init.body = request.body;
    }

    // Preserve query string.
    target.search = url.search;

    const upstream = await fetch(target.toString(), init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers: responseHeaders,
    });
  },
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Relay-Secret',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...extraHeaders,
    },
  });
}

function cloneHeaders(headers) {
  const out = new Headers();
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === 'host') continue;
    if (key.toLowerCase() === 'cookie') continue;
    out.set(key, value);
  }
  return out;
}