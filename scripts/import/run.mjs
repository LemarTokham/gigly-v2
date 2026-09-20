/**
 * Runs every registered import source.
 *
 *   npm run import              # show what would happen
 *   npm run import -- --write
 *   npm run import -- --write --only=skiddle
 *
 * Everything imported lands as pending, so a bad feed fills the approval queue
 * rather than the chart. Re-running updates rather than duplicating, keyed on
 * (source, source_ref).
 */
import { createClient } from "@supabase/supabase-js";
import { SOURCES } from "./sources/index.mjs";

const args = process.argv.slice(2);
const write = args.includes("--write");
const only = args.find((a) => a.startsWith("--only="))?.split("=")[1];

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const sources = only ? SOURCES.filter((s) => s.name === only) : SOURCES;

if (sources.length === 0) {
  console.log(
    only
      ? `No source called "${only}". Registered: ${SOURCES.map((s) => s.name).join(", ") || "none"}`
      : "No import sources registered yet — see scripts/import/sources/index.mjs.",
  );
  process.exit(0);
}

const { data: venues, error: venueErr } = await db.from("venues").select("id, slug, name");
if (venueErr) throw venueErr;
const known = new Set(venues.map((v) => v.slug));

console.log(`${sources.length} source${sources.length === 1 ? "" : "s"}. ${write ? "Writing." : "Dry run — pass --write to save."}\n`);

let created = 0;
let updated = 0;
let duplicate = 0;
let rejected = 0;

for (const source of sources) {
  console.log(`${source.label ?? source.name}`);

  let gigs;
  try {
    gigs = await source.fetch({ venues });
  } catch (e) {
    // A source that breaks must say so. Silence here would look identical to
    // a venue simply having nothing on.
    console.error(`  ! failed: ${e.message}`);
    process.exitCode = 1;
    continue;
  }

  if (!gigs.length) {
    console.log("  nothing returned");
    continue;
  }

  for (const gig of gigs) {
    const why = validate(gig, known);
    if (why) {
      console.log(`  skip  ${String(gig.artistName ?? "?").slice(0, 28).padEnd(30)} ${why}`);
      rejected++;
      continue;
    }

    if (!write) {
      console.log(
        `  would ${gig.artistName.slice(0, 28).padEnd(30)} ${gig.venueSlug.padEnd(22)} ${gig.startsAt.toISOString().slice(0, 16).replace("T", " ")}`,
      );
      continue;
    }

    const { data, error } = await db.rpc("import_gig", {
      p_source: source.name,
      p_source_ref: gig.sourceRef,
      p_artist_name: gig.artistName,
      p_venue_slug: gig.venueSlug,
      p_starts_at: gig.startsAt.toISOString(),
      p_price_pence: gig.pricePence ?? null,
      p_ticket_url: gig.ticketUrl ?? null,
      p_support: gig.support ?? [],
    });

    if (error) {
      console.log(`  error ${gig.artistName.slice(0, 28).padEnd(30)} ${error.message.slice(0, 50)}`);
      rejected++;
      continue;
    }

    const outcome = data?.[0]?.outcome ?? "created";
    if (outcome === "created") created++;
    else if (outcome === "updated") updated++;
    else duplicate++;

    console.log(`  ${outcome.padEnd(10)} ${gig.artistName.slice(0, 28).padEnd(30)} ${gig.venueSlug}`);
  }
}

console.log(
  write
    ? `\n${created} new, ${updated} updated, ${duplicate} already here, ${rejected} skipped.` +
        (created ? `\nThey are pending — approve them at /admin.` : "")
    : "\nNothing written.",
);

/** Returns a reason to skip, or null. */
function validate(gig, knownVenues) {
  if (!gig.sourceRef) return "no source id, cannot dedupe";
  if (!gig.artistName?.trim()) return "no artist name";
  if (!knownVenues.has(gig.venueSlug)) return `unknown venue ${gig.venueSlug}`;
  if (!(gig.startsAt instanceof Date) || Number.isNaN(gig.startsAt.getTime())) return "bad date";
  if (gig.startsAt < new Date()) return "already happened";
  if (gig.startsAt > new Date(Date.now() + 400 * 864e5)) return "too far ahead";
  if (gig.pricePence != null && (gig.pricePence < 0 || gig.pricePence > 50000)) return "odd price";
  return null;
}
