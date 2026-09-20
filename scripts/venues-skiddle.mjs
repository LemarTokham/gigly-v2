/**
 * Maps our venues to Skiddle venue ids, once.
 *
 *   npm run venues:skiddle
 *   npm run venues:skiddle -- --write
 *
 * Searching live events near Liverpool and reading the venues off them is more
 * reliable than a venue name search: it only ever returns rooms that actually
 * have gigs on, which is what we want anyway.
 *
 * Matches are verified by name the same way the Google lookup is, because a
 * near-miss here would quietly attach another venue's listings to ours.
 */
import { createClient } from "@supabase/supabase-js";
import { skiddlePages } from "./skiddle.mjs";

const write = process.argv.includes("--write");
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const normalise = (s) => s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

const { data: venues, error } = await db
  .from("venues")
  .select("id, name, slug, skiddle_id")
  .order("name");
if (error) throw error;

console.log("asking Skiddle what is on in Liverpool...");
const events = await skiddlePages("/events/search/", {
  latitude: 53.4084,
  longitude: -2.9916,
  radius: 8,
  eventcode: "LIVE",
  minDate: new Date().toISOString().slice(0, 10),
  order: "date",
});

// one entry per venue Skiddle knows about round here
const found = new Map();
for (const e of events) {
  const v = e.venue;
  if (!v?.id || found.has(v.id)) continue;
  found.set(v.id, { id: v.id, name: v.name ?? "" });
}

console.log(`${events.length} live events across ${found.size} venues\n`);

let matched = 0;
for (const v of venues) {
  const hit = [...found.values()].find((s) => {
    const a = normalise(v.name);
    const b = normalise(s.name);
    return b && (b.includes(a) || a.includes(b));
  });

  console.log(
    `${v.name.padEnd(24)} ${hit ? `#${String(hit.id).padEnd(8)} ${hit.name}` : "no Skiddle listing found"}`,
  );

  if (hit) {
    matched++;
    if (write && hit.id !== v.skiddle_id) {
      const { error: upErr } = await db.from("venues").update({ skiddle_id: hit.id }).eq("id", v.id);
      if (upErr) console.warn(`  ! save failed: ${upErr.message}`);
    }
  }
}

console.log(`\n${matched} of ${venues.length} matched.`);
if (!write) console.log("Nothing written. Re-run with --write once the names line up.");

// Anything Skiddle has that we do not is a venue worth knowing about.
const ours = new Set(venues.map((v) => normalise(v.name)));
const extra = [...found.values()].filter(
  (s) => ![...ours].some((a) => normalise(s.name).includes(a) || a.includes(normalise(s.name))),
);
if (extra.length) {
  console.log(`\nSkiddle also has ${extra.length} other Liverpool venues with live gigs on:`);
  for (const s of extra.slice(0, 20)) console.log(`  #${String(s.id).padEnd(8)} ${s.name}`);
  if (extra.length > 20) console.log(`  ...and ${extra.length - 20} more`);
}
