/**
 * Removes the invented sample data, leaving the real venues and anything
 * imported or submitted.
 *
 *   npm run db:clear-demo
 *
 * The seed is still what `npm run db:reset` loads and what the tests run
 * against — this is for when you want to look at real listings without
 * "Dock Leaf" sitting next to them. Run db:reset to get it back.
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;

if (!url || !key) { console.error("Missing Supabase env vars."); process.exit(1); }
if (!LOCAL.test(url)) {
  console.error(`Refusing to run against a non-local project:\n  ${url}`);
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data: gigs } = await db.from("gigs").select("id").eq("source", "seed");
console.log(`removing ${gigs?.length ?? 0} seeded gigs...`);
await db.from("gigs").delete().eq("source", "seed");

// Artists left with no gigs at all were only ever there for the sample data.
const { data: artists } = await db.from("artists").select("id, name");
const { data: linked } = await db.from("gig_artists").select("artist_id");
const stillPlaying = new Set((linked ?? []).map((l) => l.artist_id));
const orphans = (artists ?? []).filter((a) => !stillPlaying.has(a.id));

if (orphans.length) {
  console.log(`removing ${orphans.length} artists with no gigs...`);
  await db.from("artists").delete().in("id", orphans.map((a) => a.id));
}

// Seed users exist only to carry seeded hypes.
let removed = 0;
for (let page = 1; ; page++) {
  const { data: list } = await db.auth.admin.listUsers({ page, perPage: 200 });
  const mine = (list?.users ?? []).filter((u) => u.email?.endsWith("@seed.gigly.test"));
  for (const u of mine) { await db.auth.admin.deleteUser(u.id); removed++; }
  if ((list?.users ?? []).length < 200) break;
}
console.log(`removed ${removed} seed users and their hypes`);

const { count } = await db.from("gigs").select("*", { count: "exact", head: true });
console.log(`\n${count ?? 0} gigs left. npm run db:reset puts the sample data back.`);
