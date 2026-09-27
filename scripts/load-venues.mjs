/**
 * Loads the real venues, and nothing else, into a database.
 *
 *   pnpm venues:load                  # dry run against the local stack
 *   node --env-file=apps/web/.env.production.local scripts/load-venues.mjs --write
 *
 * For the hosted project. There the seed never runs — it is mostly invented
 * bands — but the venues in it are real, and the importer can only attach
 * listings to a venue that exists with its skiddle_id. This writes the same
 * venue rows the seed does, from the same two files, so local and live agree.
 *
 * Upserts on slug, so re-running refreshes coordinates and ids in place.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, "prototype-data.json"), "utf8"));
const locations = JSON.parse(readFileSync(join(here, "venue-locations.json"), "utf8"));

const write = process.argv.includes("--write");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

/** Must match scripts/generate-seed.mjs, or the two would disagree on slugs. */
const slugify = (s) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const rows = data.VENUES.map((v) => {
  const slug = slugify(v.name);
  const loc = locations[slug] ?? {};
  return {
    name: v.name,
    slug,
    area: v.area,
    capacity: v.cap,
    map_x: v.x,
    map_y: v.y,
    lat: loc.lat ?? null,
    lng: loc.lng ?? null,
    google_place_id: loc.place_id ?? null,
    skiddle_id: loc.skiddle_id ?? null,
  };
});

console.log(`${new URL(url).host}: ${rows.length} venues. ${write ? "Writing." : "Dry run — pass --write to save."}\n`);
for (const r of rows) {
  console.log(`  ${r.name.padEnd(24)} ${r.skiddle_id ? `skiddle ${r.skiddle_id}` : "no skiddle id"}`);
}

if (write) {
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: saved, error } = await db.from("venues").upsert(rows, { onConflict: "slug" }).select("slug");
  if (error) {
    console.error(`\n${error.message}`);
    process.exit(1);
  }
  console.log(`\n${saved.length} venues saved.`);
}
