/**
 * Dates, times and money, all rendered in Europe/London regardless of where the
 * server runs. Vercel runs UTC, so anything that formats a date without saying
 * so will drift by an hour for half the year.
 */

export const LONDON = "Europe/London";

/**
 * A gig at 00:30 on Saturday is Friday night out, not Saturday. Listings cut
 * the night at 4am, so the day filters group a late gig with the evening it
 * actually belongs to. The prototype buckets on the calendar day and gets this
 * wrong for anything after midnight.
 */
const NIGHT_CUTOFF_MS = 4 * 60 * 60 * 1000;

const ymd = new Intl.DateTimeFormat("en-CA", {
  timeZone: LONDON,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The night a moment belongs to, as YYYY-MM-DD in London. */
export function nightOf(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  return ymd.format(new Date(d.getTime() - NIGHT_CUTOFF_MS));
}

/** Whole days from one night to another. Both are plain dates, so no DST math. */
export function nightsBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 864e5);
}

/** Add days to a YYYY-MM-DD night. */
export function addNights(night: string, days: number): string {
  const d = new Date(`${night}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Hardcoded rather than taken from Intl: en-GB renders September as "Sept",
// and the exact abbreviations vary with the runtime's ICU build, so the same
// code can print different labels locally and on Vercel. These are the
// prototype's DOW and MON arrays.
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const weekday = { format: (d: Date) => DOW[d.getUTCDay()] };
const dayMonth = { format: (d: Date) => `${d.getUTCDate()} ${MON[d.getUTCMonth()]}` };

/** "Tonight", "Tomorrow", "Wed", "Wed 24 Sep" — the prototype's dayWord(). */
export function dayWord(night: string, today: string): string {
  const offset = nightsBetween(today, night);
  if (offset === 0) return "Tonight";
  if (offset === 1) return "Tomorrow";

  const d = new Date(`${night}T00:00:00Z`);
  if (offset > 1 && offset < 7) return weekday.format(d);
  return `${weekday.format(d)} ${dayMonth.format(d)}`;
}

/** Short weekday label for the day strip. */
export function shortDay(night: string, today: string): string {
  return nightsBetween(today, night) === 0 ? "Today" : weekday.format(new Date(`${night}T00:00:00Z`));
}

/** Date number for the day strip. */
export function dayNumber(night: string): number {
  return new Date(`${night}T00:00:00Z`).getUTCDate();
}

const hourMin = new Intl.DateTimeFormat("en-GB", {
  timeZone: LONDON,
  hour: "numeric",
  minute: "2-digit",
  hour12: false,
});

/** "7:30pm", "8pm" — the prototype drops :00. */
export function clockTime(at: Date | string): string {
  const d = typeof at === "string" ? new Date(at) : at;
  const [h, m] = hourMin.format(d).split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${h % 12 || 12}${m === 0 ? "" : `:${String(m).padStart(2, "0")}`}${suffix}`;
}

/** "Free", "£6", "£7.50". Stored in pence so nothing lives in a float. */
export function money(pence: number): string {
  if (pence === 0) return "Free";
  return pence % 100 === 0 ? `£${pence / 100}` : `£${(pence / 100).toFixed(2)}`;
}

/** Today's night in London — the anchor the day strip counts from. */
export function todayNight(): string {
  return nightOf(new Date());
}

const londonParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: LONDON,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function londonOffsetMs(at: Date): number {
  const p = londonParts.formatToParts(at);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  const asIfUtc = Date.parse(
    `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
  );
  return asIfUtc - at.getTime();
}

/**
 * The instant at which a given London wall-clock time occurs, e.g. 04:00 on a
 * given night. Used to turn a night bucket into a `starts_at` range, so the day
 * filter is an indexed range scan rather than a per-row timezone conversion.
 *
 * Two passes because the offset depends on the answer: the first guess picks
 * the wrong side of a DST change, the second corrects it.
 */
export function londonInstant(night: string, hour = 4): Date {
  const naive = Date.parse(`${night}T${String(hour).padStart(2, "0")}:00:00Z`);
  const once = naive - londonOffsetMs(new Date(naive));
  return new Date(naive - londonOffsetMs(new Date(once)));
}

/** [start, end) covering one night: 04:00 that day to 04:00 the next. */
export function nightRange(night: string): { start: Date; end: Date } {
  return { start: londonInstant(night, 4), end: londonInstant(addNights(night, 1), 4) };
}

/** Always the weekday, e.g. "Fri" — for the small date blocks. */
export function weekdayShort(night: string): string {
  return weekday.format(new Date(`${night}T00:00:00Z`));
}

/** Turn a date and a wall-clock time in London into an absolute instant. */
export function londonDateTime(date: string, time: string): Date {
  const [h, m] = time.split(":").map(Number);
  const naive = Date.parse(
    `${date}T${String(h).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}:00Z`,
  );
  const once = naive - londonOffsetMs(new Date(naive));
  return new Date(naive - londonOffsetMs(new Date(once)));
}
