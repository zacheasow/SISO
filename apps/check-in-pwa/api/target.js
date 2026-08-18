import { getTarget } from './_store.js';

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

/**
 * GET /api/target?center=<centerSlug>
 * Resolves the active backend (Cloudflare tunnel) URL for a center so the
 * Vercel-hosted PWA knows where to dispatch check-in / sign-out pings.
 * Returns { targetUrl } on success, 404 when unregistered.
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.status(204).set(corsHeaders()).end();
    return;
  }
  if (req.method !== 'GET') {
    res.status(405).set(corsHeaders()).json({ error: 'Method not allowed' });
    return;
  }

  const center = typeof req.query.center === 'string' ? req.query.center.trim() : '';
  if (!center) {
    res.status(400).set(corsHeaders()).json({ error: 'center query parameter is required' });
    return;
  }

  const targetUrl = await getTarget(center);
  if (!targetUrl) {
    res.status(404).set(corsHeaders()).json({ error: `No registered target for center: ${center}` });
    return;
  }

  res.status(200).set(corsHeaders()).json({ targetUrl });
}