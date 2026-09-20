import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistImage } from "@/components/artist-image";
import { Icon } from "@/components/icon";
import {
  clockTime,
  dayNumber,
  dayWord,
  money,
  nightOf,
  todayNight,
  weekdayShort,
} from "@/lib/format";
import { getArtistBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getArtistBySlug(slug);
  if (!page) return { title: "Not found" };

  const next = page.gigs[0];
  const description = next
    ? `${page.artist.genre} from ${page.artist.from_area ?? "Liverpool"}. Next: ${dayWord(nightOf(next.starts_at), todayNight())} at ${next.venue.name}.`
    : (page.artist.bio ?? `${page.artist.genre} from Liverpool.`);

  return {
    title: page.artist.name,
    description,
    openGraph: { title: page.artist.name, description, type: "profile" },
  };
}

export default async function ArtistPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getArtistBySlug(slug);
  if (!page) notFound();

  const { artist, gigs, followerCount, hypeCount, position } = page;

  return (
    <article className="-mx-4">
      <div className="relative aspect-[16/10] w-full overflow-hidden text-white">
        <ArtistImage artist={artist} />
        <span className="pointer-events-none absolute inset-x-0 top-[40%] bottom-0 bg-gradient-to-t from-[rgba(10,6,20,0.88)] to-transparent" />
        <h1 className="font-display absolute right-3.5 bottom-3 left-3.5 text-[clamp(28px,8.5vw,36px)] leading-[1.04] [overflow-wrap:anywhere]">
          {artist.name}
        </h1>
      </div>

      <div className="px-4 pt-4 pb-6">
        <div className="flex flex-wrap gap-1.5">
          <span className="border-line bg-card rounded-full border px-2.5 py-1 text-[13px] font-semibold">
            {artist.genre}
          </span>
          {artist.from_area && (
            <span className="border-line bg-card rounded-full border px-2.5 py-1 text-[13px] font-semibold">
              {artist.from_area}
            </span>
          )}
        </div>

        <div className="mt-3.5 grid grid-cols-3 gap-2">
          {[
            [hypeCount, "hypes this week"],
            [position ? `No. ${position}` : "–", "in Liverpool"],
            [followerCount, "followers"],
          ].map(([v, label]) => (
            <div key={label} className="border-line bg-card rounded-xl border px-1.5 py-2.5 text-center">
              <b className="font-display block text-xl leading-[1.1] font-normal">{v}</b>
              <i className="text-soft mt-0.5 block text-xs not-italic">{label}</i>
            </div>
          ))}
        </div>

        {/* Hype and Follow arrive in steps 4 and 3. Shown disabled so the page
            reads as the prototype does rather than hiding the mechanic. */}
        <div className="mt-3.5 flex items-stretch gap-2">
          <button
            disabled
            className="bg-hype border-hype text-on-hype inline-flex flex-1 items-center justify-center gap-[7px] rounded-xl border-2 px-4 py-3 text-base font-bold opacity-40"
          >
            <Icon name="flame" />
            Hype
          </button>
          <button
            disabled
            className="border-line text-ink inline-flex items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-bold opacity-40"
          >
            Follow
          </button>
          <span className="border-line grid w-[52px] shrink-0 place-items-center rounded-xl border-2 opacity-40">
            <Icon name="share" />
          </span>
        </div>

        {artist.bio && <p className="mt-3.5 max-w-[58ch] text-[15px]">{artist.bio}</p>}

        <h2 className="font-display mt-[22px] mb-2 text-base">Next up</h2>
        {gigs.length > 0 ? (
          gigs.map((g) => (
            <Link
              key={g.id}
              href={`/gig/${g.slug}`}
              className="border-line bg-card mt-2 flex w-full items-center gap-3 rounded-2xl border p-2.5"
            >
              <span className="bg-ink text-bg w-[50px] shrink-0 rounded-[10px] py-1.5 text-center leading-[1.05]">
                <i className="block text-[11px] font-bold not-italic opacity-80">
                  {weekdayShort(nightOf(g.starts_at))}
                </i>
                <b className="font-display block text-[19px] font-normal">
                  {dayNumber(nightOf(g.starts_at))}
                </b>
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-base leading-tight font-bold">{g.venue.name}</b>
                <i className="text-soft block text-[13px] not-italic">
                  {clockTime(g.starts_at)}, {money(g.price_pence)}
                </i>
              </span>
              <Icon name="go" className="text-soft" />
            </Link>
          ))
        ) : (
          <p className="text-soft text-sm">
            Nothing listed. Follow them to hear when that changes.
          </p>
        )}
      </div>
    </article>
  );
}
