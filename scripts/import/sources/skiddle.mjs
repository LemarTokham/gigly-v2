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
 * Two thirds of live events carry no parsed artist list, so the name has to
 * come out of the event title. These strip the wrapping a promoter puts round
 * a band's name — never the name itself, and if a rule would leave nothing
 * useful the original title is kept instead.
 */
const TITLE_RULES = [
  // "Big Condo Records Presents EMZz - ..." -> "EMZz - ..."
  [/^.{2,40}?\s+presents[:\s]+/i, ""],
  // "... @ The Jacaranda", "... Live At The Kazimier Stockroom"
  [/\s+(?:@|live\s+(?:at|in))\s+.+$/i, ""],
  // "OOIOO (YoshimiO // Boredoms)" -> "OOIOO"
  [/\s*\([^)]*\)\s*$/, ""],
  // "Gallus: Album Launch Show", "Courds: Jacaranda Residency"
  [/\s*:\s+.+$/, ""],
  // "Natalie McCool - The Kazimier Stockroom, Liverpool"
  [/\s+[-–]\s+.+$/, ""],
  // trailing tour or launch wording left over
  [/\s+(?:uk\s+)?tour\s*20\d\d$/i, ""],
];

function fromTitle(title) {
  let name = String(title ?? "").trim();

  for (const [pattern, replacement] of TITLE_RULES) {
    const next = name.replace(pattern, replacement).trim();
    // A rule that eats the whole name has misfired — "Johnsysshots Presents:"
    // is all wrapper and no band, and the title is the best we have.
    if (next.length >= 2) name = next;
  }
  return name;
}

/** The headline act, and whether we are confident about it. */
function headliner(event) {
  const first = (event.artists ?? [])[0];
  const named = typeof first === "string" ? first : first?.name;
  if (named?.trim()) return { name: named.trim(), guessed: false };

  return { name: fromTitle(event.eventname ?? event.name), guessed: true };
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

  async fetch({ venues }) {
    const mapped = venues.filter((v) => v.skiddle_id);
    if (!mapped.length) {
      throw new Error("No venues have a skiddle_id — run npm run venues:skiddle -- --write first");
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

        const { name, guessed } = headliner(e);
        if (!name) continue;
        const { genre, group } = genreOf(e);

        out.push({
          sourceRef: String(e.id ?? e.eventid ?? ""),
          venueSlug: venue.slug,
          artistName: name,
          support: support(e),
          startsAt,
          pricePence: toPence(e),
          ticketUrl: e.link ?? null,
          genre,
          genreGroup: group,
          // Kept only when the name was read out of the title, so the approval
          // queue can show what it was read from.
          sourceTitle: guessed ? (e.eventname ?? null) : null,
        });
      }
    }

    if (skippedCancelled) console.log(`  (skipped ${skippedCancelled} cancelled)`);
    return out;
  },
};

export default skiddleSource;
