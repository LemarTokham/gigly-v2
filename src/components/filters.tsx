import Link from "next/link";
import { addNights, dayNumber, shortDay } from "@/lib/format";
import { GENRE_GROUPS, type GenreGroup } from "@/lib/queries";

function href(night: string | null, genre: GenreGroup | null) {
  const p = new URLSearchParams();
  if (night) p.set("night", night);
  if (genre) p.set("genre", genre);
  const s = p.toString();
  return s ? `/?${s}` : "/";
}

/**
 * Filters are links that set search params, not client state. The page stays
 * server-rendered, and a filtered view is a shareable URL.
 */
export function DayStrip({
  today,
  night,
  genre,
}: {
  today: string;
  night: string | null;
  genre: GenreGroup | null;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addNights(today, i));

  return (
    <div
      role="group"
      aria-label="Day"
      className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pt-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {days.map((d) => {
        const on = night === d;
        return (
          <Link
            key={d}
            href={href(d, genre)}
            aria-pressed={on}
            className={`w-[52px] shrink-0 rounded-xl border py-2 text-center ${
              on ? "border-ink bg-ink text-bg" : "border-line bg-card"
            }`}
          >
            <i className={`block text-xs font-semibold not-italic ${on ? "opacity-75" : "text-soft"}`}>
              {shortDay(d, today)}
            </i>
            <b className="font-display block text-[19px] leading-[1.15] font-normal">
              {dayNumber(d)}
            </b>
          </Link>
        );
      })}
      <Link
        href={href(null, genre)}
        aria-pressed={night === null}
        className={`grid shrink-0 place-items-center rounded-xl border px-3.5 text-sm font-bold ${
          night === null ? "border-ink bg-ink text-bg" : "border-line bg-card"
        }`}
      >
        All
      </Link>
    </div>
  );
}

export function GenreChips({
  today,
  night,
  genre,
}: {
  today: string;
  night: string | null;
  genre: GenreGroup | null;
}) {
  void today;
  const all: (GenreGroup | null)[] = [null, ...GENRE_GROUPS];

  return (
    <div
      role="group"
      aria-label="Genre"
      className="-mx-4 mt-2.5 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {all.map((g) => {
        const on = genre === g;
        return (
          <Link
            key={g ?? "all"}
            href={href(night, g)}
            aria-pressed={on}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
              on ? "border-ink text-ink bg-card" : "border-line text-soft"
            }`}
          >
            {g ?? "All"}
          </Link>
        );
      })}
    </div>
  );
}
