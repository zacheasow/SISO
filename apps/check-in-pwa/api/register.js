import { setTarget } from './_store.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Relay-Secret',
  };
}

/**
 * POST /api/register
 * Body: { centerSlug, targetUrl, secret? }
 * Updates the center's active tunnel URL so the hosted PWA can reach the
 * desktop server through the (rotating) Cloudflare Quick Tunnel.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).set(corsHeaders()).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).set(corsHeaders()).json({ error: 'Method not allowed' });
    return;
  }

  let body = {};
  try {
    body = req.body || {};
  } catch {
    /* body already parsed by the framework */
  }

  const { centerSlug, targetUrl, secret } = body;
  if (!centerSlug || !targetUrl) {
    res.status(400).set(corsHeaders()).json({ error: 'centerSlug and targetUrl are required' });
    return;
  }

  // Optional shared secret check — mirrors the X-Relay-Secret header used by
  // the desktop TunnelManager. If RELAY_SECRET is configured on Vercel it must
  // match, otherwise registration is rejected.
  if (process.env.RELAY_SECRET && secret !== process.env.RELAY_SECRET) {
    res.status(401).set(corsHeaders()).json({ error: 'Invalid relay secret' });
    return;
  }

  const normalized = targetUrl.replace(/\/+$/, '');
  await setTarget(centerSlug, normalized);

  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  res.status(200).set(corsHeaders()).json({
    success: true,
    centerSlug,
    targetUrl: normalized,
    relayUrl: `${proto}://${host}/${centerSlug}`,
    registeredAt: new Date().toISOString(),
  });
}