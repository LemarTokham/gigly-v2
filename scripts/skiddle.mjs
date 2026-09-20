/**
 * Shared Skiddle client.
 *
 * Their docs say the API is for non-commercial use and that they rate-limit or
 * block excessive requests, so this keeps a gap between calls and asks for the
 * largest page they allow rather than making many small ones.
 */
const BASE = "https://www.skiddle.com/api/v1";
const MIN_GAP_MS = 350;
let lastCall = 0;

export function apiKey() {
  const key = process.env.SKIDDLE_API_KEY;
  if (!key) {
    console.error("SKIDDLE_API_KEY is not set. Add it to .env.local.");
    process.exit(1);
  }
  return key;
}

async function pace() {
  const since = Date.now() - lastCall;
  if (since < MIN_GAP_MS) await new Promise((r) => setTimeout(r, MIN_GAP_MS - since));
  lastCall = Date.now();
}

/** GET a Skiddle endpoint. Throws with their message rather than a bare code. */
export async function skiddle(path, params = {}) {
  await pace();

  const url = new URL(`${BASE}${path}`);
  for (const [k, v] of Object.entries({ ...params, api_key: apiKey() })) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, { headers: { Accept: "application/json" } });
  const text = await res.text();

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Skiddle returned ${res.status} and not JSON: ${text.slice(0, 120)}`);
  }

  if (!res.ok || body.error) {
    throw new Error(`Skiddle ${res.status}: ${body.error ?? body.errormessage ?? text.slice(0, 120)}`);
  }
  return body;
}

/** Walks `offset` until Skiddle stops returning a full page. */
export async function skiddlePages(path, params = {}, { max = 500 } = {}) {
  const limit = 100; // their documented maximum
  const all = [];

  for (let offset = 0; offset < max; offset += limit) {
    const body = await skiddle(path, { ...params, limit, offset });
    const batch = body.results ?? [];
    all.push(...batch);
    if (batch.length < limit) break;
  }
  return all;
}
