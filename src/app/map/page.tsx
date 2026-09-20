import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { ArtistImage } from "@/components/artist-image";
import { Icon } from "@/components/icon";
import { clockTime, dayWord, nightOf, todayNight } from "@/lib/format";
import { getHypeState, getVenuesForMap } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; venue?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range === "tonight" ? "tonight" : "week";
  const [venues, hype] = await Promise.all([getVenuesForMap(range), getHypeState()]);
  const today = todayNight();

  const busiest = [...venues].sort((a, b) => b.gig_count - a.gig_count)[0];
  const selected = venues.find((v) => v.slug === sp.venue) ?? busiest;

  return (
    <>
      <TopBar signedIn={!!hype.userId} hypesLeft={hype.left} />

      <div role="group" aria-label="When" className="mt-1 mb-3 flex gap-1.5">
        {(["tonight", "week"] as const).map((r) => (
          <Link
            key={r}
            href={`/map?range=${r}`}
            aria-pressed={range === r}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${
              range === r ? "border-ink text-ink bg-card" : "border-line text-soft"
            }`}
          >
            {r === "tonight" ? "Tonight" : "This week"}
          </Link>
        ))}
      </div>

      <div className="border-line bg-land relative aspect-[600/470] overflow-hidden rounded-2xl border">
        <svg
          viewBox="0 0 600 470"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        >
          <ellipse cx="325" cy="205" rx="120" ry="95" fill="#FF5C9A" opacity=".14" />
          <ellipse cx="300" cy="380" rx="105" ry="62" fill="#F8DF3A" opacity=".18" />
          <ellipse cx="490" cy="250" rx="85" ry="120" fill="#4FD9A0" opacity=".15" />
          <ellipse cx="55" cy="290" rx="80" ry="110" fill="#3EC6F0" opacity=".14" />
          <path
            d="M105 0 C150 110 120 240 150 350 C162 400 150 440 158 470 L214 470 C200 430 224 390 205 330 C180 230 215 120 175 0Z"
            fill="var(--river)"
          />
          <g stroke="var(--road)" strokeWidth="4" fill="none" strokeLinecap="round">
            <path d="M218 115 L570 85" />
            <path d="M226 205 L590 300" />
            <path d="M240 30 L330 450" />
            <path d="M425 60 L475 440" />
            <path d="M216 315 L430 410" />
            <path d="M15 215 L112 365" />
            <path d="M330 120 L420 300" />
            <path d="M250 290 L560 200" />
          </g>
          <g className="fill-soft font-body text-[19px] font-semibold">
            <text x="232" y="100">Ropewalks</text>
            <text x="222" y="432">Baltic Triangle</text>
            <text x="425" y="392">Georgian Qtr</text>
            <text x="8" y="215">Birkenhead</text>
          </g>
        </svg>

        {venues.map((v) => {
          const on = selected?.id === v.id;
          return (
            <Link
              key={v.id}
              href={`/map?range=${range}&venue=${v.slug}`}
              aria-label={`${v.name}, ${v.gig_count} gigs`}
              aria-pressed={on}
              style={{ left: `${(v.map_x ?? 0) / 6}%`, top: `${(v.map_y ?? 0) / 4.7}%` }}
              className={`font-display border-bg absolute -mt-[18px] -ml-[18px] grid size-9 place-items-center rounded-full border-[3px] text-[15px] ${
                on ? "bg-hype text-on-hype z-20 scale-[1.18]" : v.gig_count ? "bg-ink text-bg" : "bg-raise text-soft"
              } ${v.tonight ? "ring-gold ring-[3px]" : ""}`}
            >
              {v.gig_count}
            </Link>
          );
        })}
      </div>

      <p className="text-soft mt-2.5 text-[13px]">
        <i className="bg-ink ring-gold mr-2.5 ml-[3px] inline-block size-3 rounded-full align-[-1px] ring-[3px]" />
        Gig on tonight
      </p>

      {selected && (
        <>
          <div className="mt-4 mb-2.5 flex items-center justify-between gap-2.5">
            <span>
              <b className="font-display block text-xl leading-[1.1] font-normal">{selected.name}</b>
              <span className="text-soft text-sm">
                {selected.area}, {selected.capacity} capacity
              </span>
            </span>
            <Link
              href={`/venue/${selected.slug}`}
              className="border-line rounded-[10px] border-2 px-3 py-2 text-sm font-bold"
            >
              Venue
            </Link>
          </div>

          {selected.next_gig ? (
            <Link
              href={`/gig/${selected.next_gig.slug}`}
              className="block w-[168px]"
            >
              <span className="relative block aspect-[16/10] overflow-hidden rounded-xl">
                <ArtistImage artist={selected.next_gig.lineup[0].artist} />
              </span>
              <b className="mt-[7px] block text-[15px] leading-tight font-bold">
                {selected.next_gig.lineup[0].artist.name}
              </b>
              <i className="text-soft block text-[13px] not-italic">
                {dayWord(nightOf(selected.next_gig.starts_at), today)}{" "}
                {clockTime(selected.next_gig.starts_at)}
              </i>
            </Link>
          ) : (
            <p className="text-soft text-sm">Nothing on {range === "tonight" ? "tonight" : "yet"}.</p>
          )}
        </>
      )}

      <div className="mt-[22px] mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-xl leading-[1.1]">All venues</h2>
        <span className="text-soft text-sm">{venues.length}</span>
      </div>

      {[...venues]
        .sort((a, b) => b.gig_count - a.gig_count || a.name.localeCompare(b.name))
        .map((v) => (
          <div key={v.id} className="border-line flex items-center gap-3 border-b py-2">
            {v.next_gig ? (
              <span className="relative block size-[54px] shrink-0 overflow-hidden rounded-xl">
                <ArtistImage artist={v.next_gig.lineup[0].artist} />
              </span>
            ) : (
              <span className="bg-raise text-soft grid size-[54px] shrink-0 place-items-center rounded-xl">
                <Icon name="pin" />
              </span>
            )}
            <Link href={`/venue/${v.slug}`} className="min-w-0 flex-1">
              <b className="block text-base leading-tight font-bold">{v.name}</b>
              <i className="text-soft block text-[13px] not-italic">
                {v.area}
                {v.next_gig ? `. Next: ${v.next_gig.lineup[0].artist.name}` : ""}
              </i>
            </Link>
            <span className="text-soft text-sm">
              {v.gig_count} {v.gig_count === 1 ? "gig" : "gigs"}
            </span>
          </div>
        ))}
    </>
  );
}
