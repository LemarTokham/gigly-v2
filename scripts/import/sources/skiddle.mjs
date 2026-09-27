/**
 * Skiddle import source.
 *
 * Asks for live events per venue id rather than everything within a radius, so
 * a gig only ever attaches to the room it is actually in.
 */
import { skiddlePages } from "../../skiddle.mjs";

const DEBUG = process.argv.includes("--debug");

/**
 * Skiddle's `startdate` carries a +00:00 offset even for gigs in British
 * Summer Time — a 14:00 October gig comes back as "14:00:00+00:00", which is
 * 15:00 London. So the instant is built from the date plus the door time,
 * read as London local, which is what those two fields actually mean.
 */
function toInstant(dateStr, timeStr) {
  if (!dateStr) return null;
  const date = String(dateStr).slice(0, 10);
  const time = /^\d{1,2}:\d{2}/.test(timeStr ?? "") ? String(timeStr).slice(0, 5) : "19:30";

  const naive = Date.parse(`${date}T${time.padStart(5, "0")}:00Z`);
  if (Number.isNaN(naive)) return null;

  const offsetAt = (t) => {
    const p = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/London",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(new Date(t));
    const g = (k) => p.find((x) => x.type === k).value;
    return Date.parse(`${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}:${g("second")}Z`) - t;
  };

  const once = naive - offsetAt(naive);
  return new Date(naive - offsetAt(once));
}

/**
 * Price lives in ticketpricing. `entryprice` exists on every event and is
 * empty on all of them, which is how the first version of this dropped every
 * price silently.
 */
function toPence(event) {
  const min = event.ticketpricing?.minPrice;
  if (typeof min === "number" && Number.isFinite(min)) return Math.round(min * 100);

  const raw = String(event.entryprice ?? "").trim();
  if (/free/i.test(raw)) return 0;
  const n = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * The show's name is the event's own title, less the location a promoter
 * tacks on: the venue is shown beside it anyway. Everything else is kept.
 * "Gallus: Album Launch Show" and "Big Condo Records Presents Aftermath 9"
 * are the show; "Natalie McCool - The Kazimier Stockroom, Liverpool" is
 * Natalie McCool.
 *
 * Artists are never read out of the title. Two thirds of Skiddle's events name
 * no artists, and guessing turned club nights and parties into artist pages.
 */
function cleanTitle(title, venueName) {
  const original = String(title ?? "").replace(/\s+/g, " ").trim();
  const place = [venueName, venueName.replace(/^the\s+/i, ""), "Liverpool"]
    .map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|");
  const cleaned = original
    // "... - The Kazimier Stockroom, Liverpool", "... - Liverpool"
    .replace(new RegExp(`\\s+[-–|]\\s+(?:the\\s+)?(?:${place})\\b.*$`, "i"), "")
    // "... @ The Jacaranda", "... Live At The Kazimier Stockroom"
    .replace(new RegExp(`\\s+(?:@|at|live\\s+(?:at|in))\\s+(?:the\\s+)?(?:${place})\\b.*$`, "i"), "")
    // a separator left dangling: "Johnsysshots Presents:"
    .replace(/[\s:|–-]+$/, "")
    .trim();
  return cleaned.length >= 2 ? cleaned : original;
}

/**
 * The headline act, its photo and its streaming link, if Skiddle names one.
 * A photo only ever exists where Skiddle parsed an artist list, so a name and
 * a face always arrive together or not at all.
 */
function headliner(event) {
  const first = (event.artists ?? [])[0];
  const named = typeof first === "string" ? first : first?.name;
  if (!named?.trim()) return null;

  const links = {};
  if (first?.spotifyartisturl) links.spotify = first.spotifyartisturl;
  return {
    name: named.trim(),
    photo: first?.image ?? null,
    links: Object.keys(links).length ? links : null,
  };
}

/** Event artwork, largest first. Referenced from their CDN, never copied. */
function artwork(event) {
  return event.xlargeimageurl ?? event.largeimageurl ?? event.imageurl ?? null;
}

/**
 * Some image URLs in the feed point at objects the CDN no longer serves —
 * around one artist photo in six comes back 403. Storing one of those means a
 * broken image on an artist page with no way to tell from the data that it is
 * broken, so they are checked once here and the dead ones dropped. The artist
 * then keeps their generated poster art, which is the whole point of having it.
 */
async function reachable(urls) {
  const distinct = [...new Set(urls.filter(Boolean))];
  const good = new Set();

  await Promise.all(
    distinct.map(async (url) => {
      try {
        const res = await fetch(url, { method: "HEAD" });
        if (res.ok) good.add(url);
      } catch {
        // unreachable counts as not good
      }
    }),
  );

  const dead = distinct.length - good.size;
  if (dead) console.log(`  (dropped ${dead} of ${distinct.length} images the CDN no longer serves)`);
  return good;
}

function support(event) {
  return (event.artists ?? [])
    .slice(1, 5)
    .map((a) => (typeof a === "string" ? a : a?.name))
    .filter((n) => n?.trim())
    .map((n) => n.trim());
}

/**
 * Skiddle's genres are finer grained than ours. Checked most specific first,
 * because an event tagged both "Indie" and "Punk" is a punk gig.
 */
const GENRE_GROUPS = [
  [/hip\s*hop|rap|grime|drill/i, "Hip hop"],
  [/punk|hardcore|emo/i, "Punk"],
  [/jazz|blues|swing/i, "Jazz"],
  [/soul|funk|motown|r&b|rnb|reggae|dancehall|ska/i, "Soul"],
  [/folk|americana|country|acoustic|singer/i, "Folk"],
  [/electronic|house|techno|drum\s*&?\s*bass|dubstep|garage|trance|disco|dance/i, "Electronic"],
  [/indie|alternative|rock|pop|experimental|metal|shoegaze/i, "Indie"],
];

function genreOf(event) {
  const names = (event.genres ?? []).map((g) => (typeof g === "string" ? g : g?.name)).filter(Boolean);
  if (!names.length) return { genre: null, group: null };

  for (const [pattern, group] of GENRE_GROUPS) {
    const hit = names.find((n) => pattern.test(n));
    if (hit) return { genre: hit, group };
  }
  return { genre: names[0], group: null };
}

const skiddleSource = {
  name: "skiddle",
  label: "Skiddle",
  // Published without review. Every event is a real listing at a venue whose
  // Skiddle id was matched by name, and a show is fine under its own title
  // whether or not it names its artists.
  trusted: true,

  async fetch({ venues }) {
    const mapped = venues.filter((v) => v.skiddle_id);
    if (!mapped.length) {
      throw new Error("No venues have a skiddle_id — run pnpm venues:skiddle --write first");
    }

    const today = new Date().toISOString().slice(0, 10);
    const horizon = new Date(Date.now() + 180 * 864e5).toISOString().slice(0, 10);
    const out = [];
    let skippedCancelled = 0;

    for (const venue of mapped) {
      const events = await skiddlePages("/events/search/", {
        venueid: venue.skiddle_id,
        eventcode: "LIVE",
        minDate: today,
        maxDate: horizon,
        description: 1,
      });

      if (DEBUG && events[0]) {
        console.log(`\n  raw Skiddle event for ${venue.name}:`);
        console.log("  " + JSON.stringify(events[0], null, 2).split("\n").join("\n  "));
      }

      for (const e of events) {
        if (String(e.cancelled) === "1") {
          skippedCancelled++;
          continue;
        }

        const startsAt = toInstant(e.date ?? e.startdate, e.openingtimes?.doorsopen);
        if (!startsAt) continue;

        const title = cleanTitle(e.eventname ?? e.name, venue.name);
        if (!title) continue;
        const head = headliner(e);
        const { genre, group } = genreOf(e);

        out.push({
          sourceRef: String(e.id ?? e.eventid ?? ""),
          venueSlug: venue.slug,
          title,
          artistName: head?.name ?? null,
          support: head ? support(e) : [],
          startsAt,
          pricePence: toPence(e),
          ticketUrl: e.link ?? null,
          imageUrl: artwork(e),
          artistPhoto: head?.photo ?? null,
          artistLinks: head?.links ?? null,
          genre,
          genreGroup: group,
        });
      }
    }

    if (skippedCancelled) console.log(`  (skipped ${skippedCancelled} cancelled)`);

    const good = await reachable(out.flatMap((g) => [g.imageUrl, g.artistPhoto]));
    for (const gig of out) {
      if (gig.imageUrl && !good.has(gig.imageUrl)) gig.imageUrl = null;
      if (gig.artistPhoto && !good.has(gig.artistPhoto)) gig.artistPhoto = null;
    }

    return out;
  },
};

export default skiddleSource;
