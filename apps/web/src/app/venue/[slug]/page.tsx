import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icon";
import { clockTime, dayNumber, money, nightOf, weekdayShort } from "@/lib/format";
import { getVenueBySlug } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = await getVenueBySlug(slug);
  if (!page) return { title: "Not found" };

  const description = `${page.venue.area}, ${page.venue.capacity ?? "?"} capacity. ${page.gigs.length} gigs coming up.`;
  return { title: page.venue.name, description, openGraph: { title: page.venue.name, description } };
}

export default async function VenuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getVenueBySlug(slug);
  if (!page) notFound();

  const { venue, gigs } = page;

  return (
    <div className="pt-4 pb-6">
      <h1 className="font-display text-2xl leading-[1.1]">{venue.name}</h1>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="border-line bg-card rounded-full border px-2.5 py-1 text-[13px] font-semibold">
          {venue.area}
        </span>
        {venue.capacity && (
          <span className="border-line bg-card rounded-full border px-2.5 py-1 text-[13px] font-semibold">
            {venue.capacity} capacity
          </span>
        )}
      </div>

      <h2 className="font-display mt-[22px] mb-2 text-base">Coming up</h2>
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
              <b className="block text-base leading-tight font-bold">
                {g.lineup.map((l) => l.artist.name).join(", ")}
              </b>
              <i className="text-soft block text-[13px] not-italic">
                {clockTime(g.starts_at)}, {money(g.price_pence)}
              </i>
            </span>
            <Icon name="go" className="text-soft" />
          </Link>
        ))
      ) : (
        <p className="text-soft text-sm">Nothing listed yet.</p>
      )}
    </div>
  );
}
