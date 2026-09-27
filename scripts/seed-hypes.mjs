/**
 * Seeds synthetic users and hype rows so the chart has something real in it.
 *
 *   pnpm seed:hypes
 *
 * Reproduces the per-artist counts from the prototype's ARTISTS array (354
 * hypes in total), spread over enough users that nobody exceeds the
 * three-a-week allowance and nobody hypes the same artist twice. created_at is
 * staggered across the last 7 days so the rolling window and the decay have
 * realistic data to work against.
 *
 * Inserts go in as the service role, which bypasses RLS — but the eligibility
 * trigger still fires, so this also checks every seeded artist really is
 * hypeable. Re-running removes the previous batch first.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "prototype-data.json"), "utf8"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  console.error("Run via: pnpm seed:hypes");
  process.exit(1);
}

// Local means this machine or this network — the LAN address is still the
// local stack, just reachable from a phone. Anything else is a real project.
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
if (!LOCAL.test(url)) {
  console.error(`Refusing to seed synthetic users into a non-local project:\n  ${url}`);
  console.error("This creates throwaway auth users. Point at the local stack first.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const SEED_DOMAIN = "seed.gigly.test";
/** Deterministic shuffle, so a reseed produces the same chart. */
function rng(seed) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296), s / 4294967296);
}

// ---------------------------------------------------------------- teardown

console.log("removing any previous seed users...");
let removed = 0;
for (let page = 1; ; page++) {
  const { data: list, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  const mine = (list?.users ?? []).filter((u) => u.email?.endsWith(`@${SEED_DOMAIN}`));
  for (const u of mine) {
    await db.auth.admin.deleteUser(u.id);
    removed++;
  }
  if ((list?.users ?? []).length < 200) break;
}
console.log(`  removed ${removed}`);

// ------------------------------------------------------------------ plan

const { data: artists, error: artistErr } = await db.from("artists").select("id, slug, name");
if (artistErr) throw artistErr;
const bySlug = new Map(artists.map((a) => [a.slug, a]));

const slugify = (s) =>
  s.toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Target hype count per artist, largest first so the tight ones place early. */
const targets = data.ARTISTS.map((a) => ({ slug: slugify(a.name), want: a.hypes }))
  .filter((t) => bySlug.has(t.slug))
  .sort((a, b) => b.want - a.want);

const total = targets.reduce((n, t) => n + t.want, 0);
const biggest = targets[0].want;
// 3 per user caps how few users can carry the load; one hype per artist per
// user means we need at least as many users as the biggest single count.
const userCount = Math.max(Math.ceil(total / 3), biggest) + 12;

console.log(`planning ${total} hypes across ${userCount} users...`);

// ------------------------------------------------------------ make users

const users = [];
const batch = 20;
for (let i = 0; i < userCount; i += batch) {
  const slice = Array.from({ length: Math.min(batch, userCount - i) }, (_, k) => i + k);
  const made = await Promise.all(
    slice.map((n) =>
      db.auth.admin.createUser({
        email: `fan${String(n).padStart(3, "0")}@${SEED_DOMAIN}`,
        password: crypto.randomUUID(),
        email_confirm: true,
        user_metadata: { seed: true, display_name: `Fan ${n}` },
      }),
    ),
  );
  for (const m of made) {
    if (m.error) throw m.error;
    users.push({ id: m.data.user.id, left: 3, taken: new Set() });
  }
  process.stdout.write(`\r  created ${users.length}/${userCount}`);
}
console.log();

// ------------------------------------------------------------- assign

const rand = rng(20260920);
const rows = [];

for (const t of targets) {
  const artist = bySlug.get(t.slug);
  // rotate the starting point so the same users are not always picked first
  const start = Math.floor(rand() * users.length);
  let placed = 0;

  for (let step = 0; step < users.length && placed < t.want; step++) {
    const u = users[(start + step) % users.length];
    if (u.left === 0 || u.taken.has(artist.id)) continue;

    u.left--;
    u.taken.add(artist.id);
    // spread over the last 7 days, never in the future, never quite at the
    // 7 day edge where it would already have aged out
    const ageMs = rand() * 6.8 * 864e5;
    rows.push({
      user_id: u.id,
      artist_id: artist.id,
      created_at: new Date(Date.now() - ageMs).toISOString(),
    });
    placed++;
  }

  if (placed < t.want) {
    console.warn(`  ! ${artist.name}: placed ${placed} of ${t.want}`);
  }
}

// -------------------------------------------------------------- insert

console.log(`inserting ${rows.length} hypes...`);
for (let i = 0; i < rows.length; i += 200) {
  const { error } = await db.from("hypes").insert(rows.slice(i, i + 200));
  if (error) throw error;
  process.stdout.write(`\r  inserted ${Math.min(i + 200, rows.length)}/${rows.length}`);
}
console.log();

// -------------------------------------------------------------- verify

const { data: chart, error: chartErr } = await db
  .from("artist_chart")
  .select("position, name, hype_count")
  .order("position");
if (chartErr) throw chartErr;

console.log("\nchart:");
for (const r of chart) console.log(`  ${String(r.position).padStart(2)}. ${r.name.padEnd(24)} ${r.hype_count}`);

const over = users.filter((u) => 3 - u.left > 3);
console.log(`\n${rows.length} hypes, ${users.length} users, max per user ${Math.max(...users.map((u) => 3 - u.left))}`);
if (over.length) throw new Error(`${over.length} users exceeded the allowance`);
