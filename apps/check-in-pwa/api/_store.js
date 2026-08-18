/**
 * Shared centerSlug -> activeTunnelUrl store for the Vercel serverless relay.
 *
 * Works out of the box with an in-memory Map. For a truly global store across
 * cold starts / multiple instances, set the standard Upstash REST env vars
 * (KV_REST_API_URL + KV_REST_API_TOKEN) and this module transparently switches
 * to that Redis-backed store. No extra dependency is required — the Upstash
 * REST API is called over plain fetch.
 */
const MEMORY = new Map();

function useUpstash() {
  return Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function upstashGet(key) {
  const res = await fetch(`${process.env.KV_REST_API_URL}/get/${key}`, {
    headers: { Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  if (data && data.result) return data.result;
  const text = await res.text().catch(() => '');
  return text || null;
}

async function upstashSet(key, value) {
  await fetch(`${process.env.KV_REST_API_URL}/set/${key}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.KV_REST_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(value),
  });
}

export async function setTarget(centerSlug, targetUrl) {
  const key = `center:${centerSlug}`;
  const value = JSON.stringify({ targetUrl, updatedAt: new Date().toISOString() });
  if (useUpstash()) {
    await upstashSet(key, value);
  } else {
    MEMORY.set(key, value);
  }
}

export async function getTarget(centerSlug) {
  const key = `center:${centerSlug}`;
  let raw;
  if (useUpstash()) {
    raw = await upstashGet(key);
  } else {
    raw = MEMORY.get(key) || null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw).targetUrl || null;
  } catch {
    return raw;
  }
}