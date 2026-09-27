import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { GigImage } from "@/components/gig-image";
import { Icon } from "@/components/icon";
import { HypeButton } from "@/components/hype-button";
import { clockTime, dayWord, nightOf, todayNight } from "@/lib/format";
import { CHART_RANGES, getHypeState, getShowChart, type ChartRange, type ChartShow } from "@/lib/queries";
import { chartShowImage } from "@/lib/shows";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Backed",
  description: "The shows Liverpool is most up for.",
};

/** ▲2 / ▼1 / – / new, as the prototype shows it. */
function Movement({ show }: { show: ChartShow }) {
  if (show.isNew) return <i className="text-soft mt-[3px] block text-[11px] font-bold not-italic">new</i>;
  const moved = show.positionYesterday - show.position;
  if (moved === 0 || !show.hype_count) {
    return <i className="text-soft mt-[3px] block text-[11px] font-bold not-italic">–</i>;
  }
  return (
    <i
      className={`mt-[3px] block text-[11px] font-bold not-italic ${moved > 0 ? "text-go" : "text-down"}`}
      aria-label={moved > 0 ? `up ${moved}` : `down ${-moved}`}
    >
      {moved > 0 ? `▲${moved}` : `▼${-moved}`}
    </i>
  );
}

const EMPTY: Record<ChartRange, string> = {
  tonight: "Nothing on tonight yet.",
  week: "Nothing on this week yet.",
  month: "Nothing on this month yet.",
  all: "No shows listed yet.",
};

export default async function ChartPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  // This week by default: hype lasts until doors, so under "All" a big show
  // announced months out could sit at No. 1 all season.
  const range: ChartRange = CHART_RANGES.some((r) => r.id === sp.range) ? (sp.range as ChartRange) : "week";
  const path = range === "week" ? "/chart" : `/chart?range=${range}`;

  const [chart, me] = await Promise.all([getShowChart(range), getHypeState()]);
  const today = todayNight();
  const [top, ...rest] = chart;

  const whenWhere = (s: ChartShow) =>
    `${dayWord(nightOf(s.starts_at!), today)} ${clockTime(s.starts_at!)}, ${s.venue_name}`;

  const hypeProps = (s: ChartShow) => ({
    gigId: s.id!,
    showName: s.name ?? "this show",
    hyped: me.hyped.has(s.id!),
    hypeable: true as const,
    hypesLeft: me.left,
    signedIn: !!me.userId,
    path,
  });

  return (
    <>
      <TopBar signedIn={!!me.userId} hypesLeft={me.left} />

      <div className="mt-2 mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-xl leading-[1.1]">Backed</h2>
        <Link href="/hype" aria-label="How hype works" className="text-soft">
          <Icon name="info" />
        </Link>
      </div>

      <div
        role="group"
        aria-label="When"
        className="-mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {CHART_RANGES.map((r) => {
          const on = r.id === range;
          return (
            <Link
              key={r.id}
              href={r.id === "week" ? "/chart" : `/chart?range=${r.id}`}
              aria-pressed={on}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-sm font-semibold ${
                on ? "border-ink text-ink bg-card" : "border-line text-soft"
              }`}
            >
              {r.label}
            </Link>
          );
        })}
      </div>

      {me.userId &&
        (me.left > 0 ? (
          <div className="bg-ink text-bg flex w-full items-center gap-3 rounded-2xl px-3.5 py-3">
            <span>
              <b className="block text-base leading-tight font-bold">
                {me.left} {me.left === 1 ? "hype" : "hypes"} left
              </b>
              <i className="block text-[13px] not-italic opacity-75">Back the shows you&rsquo;re most up for</i>
            </span>
          </div>
        ) : (
          <div className="border-line bg-card text-soft flex w-full items-center gap-3 rounded-2xl border px-3.5 py-3">
            <span>
              <b className="block text-base leading-tight font-bold">All three spent</b>
              <i className="block text-[13px] not-italic">Fresh hypes on Monday</i>
            </span>
          </div>
        ))}

      {!top ? (
        <div className="border-line text-soft mt-4 rounded-2xl border-2 border-dashed px-4 py-[22px] text-center">
          {EMPTY[range]}
        </div>
      ) : (
        <>
          <div className="border-line bg-card relative mt-4 overflow-hidden rounded-2xl border">
            <Link href={`/gig/${top.slug}`} className="relative block aspect-video w-full text-white">
              <GigImage gig={chartShowImage(top)} priority />
              <span className="pointer-events-none absolute inset-x-0 top-[40%] bottom-0 bg-gradient-to-t from-[rgba(10,6,20,0.88)] to-transparent" />
              <span className="font-display absolute top-2.5 left-2.5 z-10 rounded-2xl bg-[rgba(10,6,20,0.8)] px-3.5 pt-1 pb-2 text-[40px] leading-none">
                1
              </span>
              {me.hyped.has(top.id!) && (
                <span
                  aria-hidden="true"
                  className="font-display border-hype text-hype absolute top-12 right-3 z-20 -rotate-12 rounded-md border-[3px] bg-white/95 px-2.5 pt-1.5 pb-1 text-base leading-none"
                >
                  Hyped
                </span>
              )}
              <span className="absolute right-3.5 bottom-3 left-3.5 z-10">
                <b className="font-display block text-[clamp(24px,7.4vw,30px)] leading-[1.04] [overflow-wrap:anywhere]">
                  {top.name}
                </b>
                <i className="mt-[3px] block text-sm font-semibold not-italic opacity-90">{whenWhere(top)}</i>
              </span>
            </Link>
            <div className="flex items-center gap-2.5 py-2.5 pr-3 pl-3.5">
              <Link href={`/venue/${top.venue_slug}`} className="min-w-0 flex-1 text-[15px] leading-tight font-bold">
                {top.venue_name}
                <i className="text-soft block text-[13px] font-normal not-italic">{top.venue_area}</i>
              </Link>
              <span className="text-hype inline-flex items-center gap-[3px] text-sm font-bold">
                <Icon name="flame" className="size-4" />
                {top.hype_count}
              </span>
              <HypeButton {...hypeProps(top)} />
            </div>
          </div>

          <ol className="mt-1.5">
            {rest.map((s) => (
              <li
                key={s.id}
                className="border-line grid grid-cols-[30px_54px_1fr_auto_auto] items-center gap-2.5 border-b py-2.5"
              >
                <span className="font-display text-center text-[18px] leading-none">
                  {s.position}
                  <Movement show={s} />
                </span>
                <Link
                  href={`/gig/${s.slug}`}
                  aria-label={s.name ?? ""}
                  className="relative block size-[54px] overflow-hidden rounded-xl"
                >
                  <GigImage gig={chartShowImage(s)} sizes="54px" />
                </Link>
                <Link href={`/gig/${s.slug}`} className="min-w-0">
                  <b className="block text-base leading-tight font-bold [overflow-wrap:anywhere]">{s.name}</b>
                  <i className="text-soft block text-[13px] not-italic">{whenWhere(s)}</i>
                </Link>
                <span className="text-hype inline-flex items-center gap-[3px] text-sm font-bold">
                  <Icon name="flame" className="size-4" />
                  {s.hype_count}
                </span>
                <HypeButton {...hypeProps(s)} />
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
