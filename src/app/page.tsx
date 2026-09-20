import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { GigCard } from "@/components/gig-card";
import { DayStrip, GenreChips } from "@/components/filters";
import { ArtistImage } from "@/components/artist-image";
import { Icon } from "@/components/icon";
import { dayWord, todayNight } from "@/lib/format";
import {
  getChart,
  getHypeCounts,
  getMyState,
  getUpcomingGigs,
  GENRE_GROUPS,
  type GenreGroup,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function WhatsOn({
  searchParams,
}: {
  searchParams: Promise<{ night?: string; genre?: string }>;
}) {
  const sp = await searchParams;
  const today = todayNight();

  const night = sp.night && /^\d{4}-\d{2}-\d{2}$/.test(sp.night) ? sp.night : null;
  const genre = GENRE_GROUPS.includes(sp.genre as GenreGroup) ? (sp.genre as GenreGroup) : null;

  const [gigs, chart, hypeCounts, me] = await Promise.all([
    getUpcomingGigs({ night, genre }),
    getChart(8),
    getHypeCounts(),
    getMyState(),
  ]);

  const path = night || genre ? `/?${new URLSearchParams({
    ...(night ? { night } : {}),
    ...(genre ? { genre } : {}),
  })}` : "/";

  const heading = night ? dayWord(night, today) : "Coming up";

  return (
    <>
      <TopBar signedIn={!!me.userId} />
      <DayStrip today={today} night={night} genre={genre} />
      <GenreChips today={today} night={night} genre={genre} />

      <div className="mt-[22px] mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-xl leading-[1.1]">Backed this week</h2>
        <Link href="/chart" className="text-soft inline-flex items-center gap-1 text-sm font-bold">
          Chart
          <Icon name="go" />
        </Link>
      </div>

      {chart.length > 0 ? (
        <div className="-mx-4 flex gap-3.5 overflow-x-auto px-4 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {chart.map((a, i) => (
            <Link key={a.id} href={`/artist/${a.slug}`} className="w-[84px] shrink-0 text-center">
              <span className="border-line relative inline-block rounded-full border-[3px] p-[3px]">
                <span className="relative block size-[72px] overflow-hidden rounded-full">
                  <ArtistImage
                    artist={{
                      slug: a.slug!,
                      name: a.name!,
                      photo_url: a.photo_url,
                      art_seed: a.art_seed!,
                      art_palette: a.art_palette!,
                      art_band: a.art_band!,
                    }}
                  />
                </span>
                <span className="bg-ink text-bg font-display border-bg absolute -bottom-0.5 -left-0.5 grid size-[26px] place-items-center rounded-full border-2 text-[13px]">
                  {i + 1}
                </span>
              </span>
              <em className="mt-1.5 line-clamp-2 block text-xs leading-tight font-semibold not-italic">
                {a.name}
              </em>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-soft text-sm">No gigs listed, so nobody to back yet.</p>
      )}

      <div className="mt-[22px] mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-xl leading-[1.1]">{heading}</h2>
        <span className="text-soft text-sm">
          {gigs.length} {gigs.length === 1 ? "gig" : "gigs"}
        </span>
      </div>

      {gigs.length > 0 ? (
        <div className="grid gap-4">
          {gigs.map((g) => (
            <GigCard
              key={g.id}
              gig={g}
              today={today}
              hypeCounts={hypeCounts}
              going={me.going.has(g.id)}
              signedIn={!!me.userId}
              path={path}
            />
          ))}
        </div>
      ) : (
        <div className="border-line text-soft rounded-2xl border-2 border-dashed px-4 py-[22px] text-center">
          Nothing listed yet.
        </div>
      )}
    </>
  );
}
