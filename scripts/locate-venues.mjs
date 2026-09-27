/**
 * Fills in venue coordinates and Google place ids. One-off.
 *
 *   pnpm venues:locate            # dry run
 *   pnpm venues:locate --write
 *
 * Coordinates come from OpenStreetMap's Nominatim: no key, and its licence
 * lets us store the result. The Google place id comes from Places Text Search
 * and is stored so reviews can be fetched live later.
 *
 * Note: a key restricted by HTTP referrer will reject this, because Node sends
 * no referrer. The coordinates half still works; only the place id needs the
 * restriction lifted for one run.
 */
import { createClient } from "@supabase/supabase-js";

const write = process.argv.includes("--write");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const maps = process.env.GOOGLE_MAPS_SERVER_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Nominatim has no entry for some small rooms. Where it cannot find the venue
 * itself, fall back to the street it is on — a few doors out on a city map,
 * which is fine for a pin, and honest about what it is. Anything that lands
 * here is reported as street level rather than pretending to be exact.
 */
const FALLBACK = {
  "kazimier-stockroom": "Wolstenholme Square, Liverpool, UK",
  quarry: "Hardman Street, Liverpool, UK",
  // "Quarry" alone matches Quarry Street in Woolton, five miles out.
};

/**
 * Extra words that steer Google away from the street and towards the business.
 * Searching "24 Kitchen Street, Baltic Triangle" returns the building; adding
 * "music venue" returns the venue with its 288 reviews.
 */
const PLACE_HINT = {
  "24-kitchen-street": "24 Kitchen Street music venue Liverpool",
  "the-caledonia": "The Caledonia pub Liverpool",
  quarry: "Quarry live music venue Hardman Street Liverpool",
};

/** A building or a stretch of road is never the venue we meant. */
const NOT_A_VENUE = new Set(["premise", "subpremise", "street_address", "route", "locality"]);

/** "The Shipping Forecast" and "Shipping Forecast" are the same place. */
const normalise = (s) =>
  s.toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");

/**
 * Google will answer any query with something. Without a check, EBGBs — which
 * no longer has a listing — silently resolved to a different venue round the
 * corner, and the map would have shown its reviews as if they were ours.
 */
function placeLooksRight(venueName, candidate) {
  const got = candidate.displayName?.text ?? "";
  const a = normalise(venueName);
  const b = normalise(got);

  if (!b) return { ok: false, why: "no name" };
  if (!(b.includes(a) || a.includes(b))) return { ok: false, why: `is "${got}"` };
  if (NOT_A_VENUE.has(candidate.primaryType)) return { ok: false, why: `is a ${candidate.primaryType}` };
  if (!candidate.userRatingCount) return { ok: false, why: "no reviews, likely a building record" };
  return { ok: true, why: `${candidate.rating}\u2605 (${candidate.userRatingCount})` };
}

/**
 * Roughly the middle of the city. Any result far from here is wrong: a venue
 * name like "Quarry" matches a road in Woolton five miles away, and a
 * plausible-looking wrong pin is worse than an obviously missing one.
 */
const CENTRE = { lat: 53.4084, lng: -2.9916 };
const MAX_KM = 8;

function kmFromCentre(lat, lng) {
  const R = 6371;
  const dLat = ((lat - CENTRE.lat) * Math.PI) / 180;
  const dLng = ((lng - CENTRE.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((CENTRE.lat * Math.PI) / 180) *
      Math.cos((lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Ask Nominatim for one query. Returns null if nothing matched. */
async function geocode(q) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`,
    { headers: { "User-Agent": "gigly-dev/0.1 (one-off venue geocoding)" } },
  );
  const hits = await res.json();
  await sleep(1200); // Nominatim asks for at most one request a second
  const hit = hits?.[0];
  return hit ? { lat: Number(hit.lat), lng: Number(hit.lon), kind: hit.addresstype ?? hit.type } : null;
}

const { data: venues, error } = await db
  .from("venues")
  .select("id, name, slug, area, lat, lng, google_place_id")
  .order("name");
if (error) throw error;

console.log(`${venues.length} venues. ${write ? "Writing." : "Dry run — pass --write to save."}\n`);

let placeFailures = 0;

for (const v of venues) {
  const city = v.area === "Birkenhead" ? "Birkenhead" : "Liverpool";
  const query = `${v.name}, ${v.area}, ${city}, UK`;

  // --- OpenStreetMap: coordinates (no key needed) -------------------------
  // Try the most specific phrasing first and widen only on a miss, so an
  // exact building match always wins over the street it sits on.
  // A curated fallback exists precisely because the venue's name is not
  // distinctive enough to search on, so it is trusted over name matching
  // rather than used as a last resort.
  const attempts = FALLBACK[v.slug]
    ? [FALLBACK[v.slug]]
    : [query, `${v.name}, ${city}, UK`, `${v.name.replace(/^The\s+/i, "")}, ${city}, UK`];

  let lat = v.lat;
  let lng = v.lng;
  let precision = "kept";
  try {
    for (const [i, attempt] of attempts.entries()) {
      const hit = await geocode(attempt);
      if (!hit) continue;

      const away = kmFromCentre(hit.lat, hit.lng);
      if (away > MAX_KM) {
        console.warn(`  ! ${v.name}: "${attempt}" landed ${away.toFixed(1)}km out, ignoring`);
        continue;
      }

      lat = hit.lat;
      lng = hit.lng;
      precision = FALLBACK[v.slug] ? `street (${hit.kind})` : `exact (${hit.kind})`;
      void i;
      break;
    }
  } catch (e) {
    console.warn(`  ! ${v.name}: OSM lookup failed — ${e.message}`);
  }

  // --- Google: place id only ----------------------------------------------
  let placeId = v.google_place_id;
  let placeNote = placeId ? "kept" : "-";
  if (maps && !placeId) {
    try {
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": maps,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.primaryType,places.rating,places.userRatingCount",
        },
        body: JSON.stringify({
          textQuery: PLACE_HINT[v.slug] ?? query,
          maxResultCount: 5,
          locationBias: {
            circle: { center: { latitude: CENTRE.lat, longitude: CENTRE.lng }, radius: 6000 },
          },
        }),
      });
      const body = await res.json();

      if (body.error) {
        if (placeFailures === 0) console.warn(`  ! Places: ${body.error.message}\n`);
        placeFailures++;
      } else {
        // Take the first candidate that is actually this venue. Better to
        // store nothing than to show another venue's reviews as ours.
        let reason = "nothing returned";
        for (const candidate of body.places ?? []) {
          const verdict = placeLooksRight(v.name, candidate);
          if (verdict.ok) {
            placeId = candidate.id;
            placeNote = verdict.why;
            break;
          }
          reason = verdict.why;
        }
        if (!placeId) placeNote = `skipped, best match ${reason}`;
      }
    } catch (e) {
      console.warn(`  ! ${v.name}: Places request failed — ${e.message}`);
      placeFailures++;
    }
  }

  const coords = lat && lng ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : "NOT FOUND";
  console.log(`${v.name.padEnd(24)} ${coords.padEnd(21)} ${precision.padEnd(18)} ${placeNote}`);

  if (write && (lat !== v.lat || lng !== v.lng || placeId !== v.google_place_id)) {
    const { error: upErr } = await db
      .from("venues")
      .update({ lat, lng, google_place_id: placeId })
      .eq("id", v.id);
    if (upErr) console.warn(`  ! ${v.name}: save failed — ${upErr.message}`);
  }
}

if (placeFailures) {
  console.log(
    `\n${placeFailures} place id lookups failed. If that is a referrer restriction,` +
      `\nset the key's application restriction to None for one run, or put an` +
      `\nIP-restricted key in GOOGLE_MAPS_SERVER_KEY. Coordinates are unaffected.`,
  );
}
console.log(write ? "\nSaved." : "\nNothing written. Re-run with --write once the positions look right.");
