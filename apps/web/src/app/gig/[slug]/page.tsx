import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArtistImage } from "@/components/artist-image";
import { GigImage } from "@/components/gig-image";
import { Icon } from "@/components/icon";
import { GoingButton } from "@/components/going-button";
import { HypeButton } from "@/components/hype-button";
import { clockTime, dayWord, money, nightOf, todayNight } from "@/lib/format";
import { getGigBySlug, getHypeState, getMyState } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const gig = await getGigBySlug(slug);
  if (!gig) return { title: "Not found" };

  const head = gig.lineup[0]?.artist;
  const title = head ? `${head.name} at ${gig.venue.name}` : gig.venue.name;
  const description = `${dayWord(nightOf(gig.starts_at), todayNight())}, doors ${clockTime(gig.starts_at)}. ${gig.venue.name}, ${gig.venue.area}. ${money(gig.price_pence)}.`;

  return { title, description, openGraph: { title, description, type: "website" } };
}

export default async function GigPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [gig, me, hype] = await Promise.all([
    getGigBySlug(slug),
    getMyState(),
    getHypeState(),
  ]);
  if (!gig) notFound();

  const head = gig.lineup[0]?.artist;
  const support = gig.lineup.slice(1).map((l) => l.artist.name);
  const today = todayNight();

  return (
    <article className="-mx-4">
      <div className="relative aspect-[16/10] w-full overflow-hidden text-white">
        <GigImage gig={gig} priority />
        <span className="pointer-events-none absolute inset-x-0 top-[40%] bottom-0 bg-gradient-to-t from-[rgba(10,6,20,0.88)] to-transparent" />
        <span className="absolute top-2.5 left-2.5 z-10 rounded-full bg-[rgba(10,6,20,0.72)] px-2.5 py-[5px] text-[13px] font-bold">
          {money(gig.price_pence)}
        </span>
        <span className="absolute right-3.5 bottom-3 left-3.5 z-10">
          <b className="font-display block text-[clamp(28px,8.5vw,36px)] leading-[1.04] [overflow-wrap:anywhere]">
            {head?.name}
          </b>
          {support.length > 0 && (
            <i className="mt-[3px] block text-sm font-semibold not-italic opacity-90">
              + {support.join(", ")}
            </i>
          )}
        </span>
      </div>

      <div className="px-4 pt-4 pb-6">
        <p className="flex items-center gap-2.5 font-semibold">
          <Icon name="clock" className="text-soft" />
          {dayWord(nightOf(gig.starts_at), today)}, doors {clockTime(gig.starts_at)}
        </p>
        <Link href={`/venue/${gig.venue.slug}`} className="mt-2.5 flex items-center gap-2.5 font-semibold">
          <Icon name="pin" className="text-soft" />
          {gig.venue.name}, {gig.venue.area}
        </Link>

        <div className="mt-3.5 flex items-stretch gap-2">
          <GoingButton
            gigId={gig.id}
            going={me.going.has(gig.id)}
            signedIn={!!me.userId}
            path={`/gig/${gig.slug}`}
            variant="wide"
          />
          {gig.ticket_url ? (
            <a
              href={gig.ticket_url}
              target="_blank"
              rel="noopener noreferrer"
              className="border-line text-ink inline-flex flex-1 items-center justify-center gap-[7px] rounded-xl border-2 px-4 py-3 text-base font-bold"
            >
              <Icon name="ticket" />
              Tickets
            </a>
          ) : (
            <span className="border-line text-soft inline-flex flex-1 items-center justify-center gap-[7px] rounded-xl border-2 px-4 py-3 text-base font-bold opacity-40">
              <Icon name="ticket" />
              Tickets
            </span>
          )}
        </div>

        <h2 className="font-display mt-[22px] mb-2 text-base">Line-up</h2>
        {gig.lineup.map(({ artist }) => (
          <div key={artist.id} className="border-line flex items-center gap-3 border-b py-2">
            <Link
              href={`/artist/${artist.slug}`}
              className="relative block size-[54px] shrink-0 overflow-hidden rounded-xl"
              aria-label={artist.name}
            >
              <ArtistImage artist={artist} />
            </Link>
            <Link href={`/artist/${artist.slug}`} className="min-w-0 flex-1">
              <b className="block text-base leading-tight font-bold">{artist.name}</b>
              <i className="text-soft block text-[13px] not-italic">{artist.genre}</i>
            </Link>
            <HypeButton
              artistId={artist.id}
              artistName={artist.name}
              hyped={hype.hyped.has(artist.id)}
              hypeable={new Date(gig.starts_at) > new Date() && gig.status === "live"}
              hypesLeft={hype.left}
              signedIn={!!hype.userId}
              path={`/gig/${gig.slug}`}
            />
          </div>
        ))}
      </div>
    </article>
  );
}
