import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { ArtistImage } from "@/components/artist-image";
import { Icon } from "@/components/icon";
import { dayWord, nightOf, todayNight } from "@/lib/format";
import { getChart } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chart",
  description: "Who Liverpool is backing this week.",
};

export default async function ChartPage() {
  const chart = await getChart();
  const today = todayNight();
  const [king, ...rest] = chart;

  const nextLine = (a: (typeof chart)[number]) =>
    a.next_gig_starts_at
      ? `${dayWord(nightOf(a.next_gig_starts_at), today)} at ${a.next_venue_name}`
      : "No gigs listed";

  return (
    <>
      <TopBar />

      <div className="mt-2 mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-xl leading-[1.1]">Backed this week</h2>
        <Icon name="info" className="text-soft" />
      </div>

      {/* The hype buttons and the rank movement arrows arrive in step 4. */}
      {!king ? (
        <div className="border-line text-soft rounded-2xl border-2 border-dashed px-4 py-[22px] text-center">
          No gigs listed, so nobody to back yet.
        </div>
      ) : (
        <>
          <div className="border-line bg-card relative mt-4 overflow-hidden rounded-2xl border">
            <Link
              href={`/artist/${king.slug}`}
              className="relative block aspect-video w-full text-white"
            >
              <ArtistImage
                artist={{
                  slug: king.slug!,
                  name: king.name!,
                  photo_url: king.photo_url,
                  art_seed: king.art_seed!,
                  art_palette: king.art_palette!,
                  art_band: king.art_band!,
                }}
              />
              <span className="pointer-events-none absolute inset-x-0 top-[40%] bottom-0 bg-gradient-to-t from-[rgba(10,6,20,0.88)] to-transparent" />
              <span className="font-display absolute top-2.5 left-2.5 z-10 rounded-2xl bg-[rgba(10,6,20,0.8)] px-3.5 pt-1 pb-2 text-[40px] leading-none">
                1
              </span>
              <span className="absolute right-3.5 bottom-3 left-3.5 z-10">
                <b className="font-display block text-[clamp(24px,7.4vw,30px)] leading-[1.04]">
                  {king.name}
                </b>
                <i className="mt-[3px] block text-sm font-semibold not-italic opacity-90">
                  {nextLine(king)}
                </i>
              </span>
            </Link>
            <div className="flex items-center gap-2.5 py-2.5 pr-3 pl-3.5">
              <span className="min-w-0 flex-1 text-[15px] leading-tight font-bold">
                {king.genre}
                <i className="text-soft block text-[13px] font-normal not-italic">
                  {king.from_area}
                </i>
              </span>
              <span className="text-hype inline-flex items-center gap-[3px] text-sm font-bold">
                <Icon name="flame" className="size-4" />
                {king.hype_count}
              </span>
            </div>
          </div>

          <ol className="mt-1.5">
            {rest.map((a) => (
              <li
                key={a.id}
                className="border-line grid grid-cols-[30px_54px_1fr_auto] items-center gap-2.5 border-b py-2.5"
              >
                <span className="font-display text-center text-[18px] leading-none">
                  {a.position}
                </span>
                <Link
                  href={`/artist/${a.slug}`}
                  aria-label={a.name ?? ""}
                  className="relative block size-[54px] overflow-hidden rounded-xl"
                >
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
                </Link>
                <Link href={`/artist/${a.slug}`} className="min-w-0">
                  <b className="block text-base leading-tight font-bold [overflow-wrap:anywhere]">
                    {a.name}
                  </b>
                  <i className="text-soft block text-[13px] not-italic">{nextLine(a)}</i>
                </Link>
                <span className="text-hype inline-flex items-center gap-[3px] text-sm font-bold">
                  <Icon name="flame" className="size-4" />
                  {a.hype_count}
                </span>
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
