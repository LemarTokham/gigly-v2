import Link from "next/link";
import { TopBar } from "@/components/top-bar";
import { GigImage } from "@/components/gig-image";
import { Icon } from "@/components/icon";
import { VenueMap } from "@/components/venue-map";
import type { MapVenue } from "@/components/venue-panel";
import { clockTime, dayWord, money, nightOf, todayNight } from "@/lib/format";
import { getHypeState, getVenuesForMap } from "@/lib/queries";
import { showName } from "@/lib/shows";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Map",
  description: "Where tonight's gigs are, and what the rooms are like.",
};

export default async function MapPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const sp = await searchParams;
  const range = sp.range === "tonight" ? "tonight" : "week";
  const [venues, hype] = await Promise.all([getVenuesForMap(range), getHypeState()]);
  const today = todayNight();

  // Only what the map actually needs crosses to the client.
  const forMap: MapVenue[] = venues.map((v) => ({
    id: v.id,
    name: v.name,
    slug: v.slug,
    area: v.area,
    capacity: v.capacity,
    lat: v.lat,
    lng: v.lng,
    googlePlaceId: v.google_place_id,
    gigCount: v.gig_count,
    tonight: v.tonight,
    gigs: v.gigs.map((g) => ({
      id: g.id,
      slug: g.slug,
      name: showName(g),
      when: `${dayWord(nightOf(g.starts_at), today)} ${clockTime(g.starts_at)}`,
      price: money(g.price_pence),
    })),
  }));

  const missing = forMap.filter((v) => v.lat == null).length;

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

      <VenueMap
        venues={forMap}
        apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""}
        mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}
      />

      {missing > 0 && (
        <p className="text-soft mt-2 text-[13px]">
          {missing} {missing === 1 ? "venue has" : "venues have"} no position yet — run{" "}
          <code>npm run venues:locate -- --write</code>.
        </p>
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
                <GigImage gig={v.next_gig} />
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
                {v.next_gig ? `. Next: ${showName(v.next_gig)}` : ""}
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
