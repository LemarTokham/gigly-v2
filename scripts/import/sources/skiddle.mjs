/**
 * Skiddle import source.
 *
 * Asks for live events at each venue we have a Skiddle id for, rather than
 * everything within a radius — that way a gig only ever attaches to the room
 * it is actually in, and we never import listings for venues Gigly does not
 * cover.
 *
 * Their response shape is not documented field by field, so everything is
 * read defensively and anything unreadable is skipped with a reason rather
 * than guessed at. Run `npm run import -- --debug` to see a raw event.
 */
import { skiddlePages } from "../../skiddle.mjs";

const DEBUG = process.argv.includes("--debug");

/**
 * Skiddle gives a date and a separate opening time. Times are UK local, so the
 * instant is built in Europe/London rather than assuming the machine's zone —
 * Vercel runs UTC and would put a 19:30 gig at 20:30 for half the year.
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

/** "£8.00" / "8" / "Free" -> pence, or null when we cannot tell. */
function toPence(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (/free/i.test(s)) return 0;
  const n = Number.parseFloat(s.replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/**
 * The headline act. Skiddle sometimes gives a parsed artist list and sometimes
 * only the event name, which may be "Band Name + support" or "Club Night
 * presents Band". Taking the first named artist when there is one is far more
 * reliable than trying to unpick the title.
 */
function headliner(event) {
  const artists = event.artists ?? event.lineup ?? [];
  const first = Array.isArray(artists) ? artists[0] : null;
  const fromList = typeof first === "string" ? first : first?.name;
  if (fromList?.trim()) return fromList.trim();

  const name = String(event.eventname ?? event.name ?? "").trim();
  // strip a trailing support list, which is where most of the noise is
  return name.split(/\s+[+&]\s+| with | \/ /i)[0].trim() || name;
}

function support(event) {
  const artists = event.artists ?? event.lineup ?? [];
  if (!Array.isArray(artists) || artists.length < 2) return [];
  return artists
    .slice(1, 5)
    .map((a) => (typeof a === "string" ? a : a?.name))
    .filter((n) => n && n.trim())
    .map((n) => n.trim());
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

    for (const venue of mapped) {
      const events = await skiddlePages("/events/search/", {
        venueid: venue.skiddle_id,
        eventcode: "LIVE",
        minDate: today,
        maxDate: horizon,
        description: 1, // asks Skiddle to include artist and genre detail
      });

      if (DEBUG && events[0]) {
        console.log(`\n  raw Skiddle event for ${venue.name}:`);
        console.log("  " + JSON.stringify(events[0], null, 2).split("\n").join("\n  "));
      }

      for (const e of events) {
        const startsAt = toInstant(e.date ?? e.startdate, e.openingtimes?.doorsopen ?? e.doorsopen);
        if (!startsAt) continue;

        out.push({
          sourceRef: String(e.id ?? e.eventid ?? ""),
          venueSlug: venue.slug,
          artistName: headliner(e),
          support: support(e),
          startsAt,
          pricePence: toPence(e.entryprice ?? e.minPrice ?? e.price),
          ticketUrl: e.link ?? e.url ?? null,
        });
      }
    }

    return out;
  },
};

export default skiddleSource;
