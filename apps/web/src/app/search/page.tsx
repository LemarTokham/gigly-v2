import Link from "next/link";
import { Suspense } from "react";
import { SearchBox } from "@/components/search-box";
import { ArtistImage } from "@/components/artist-image";
import { Icon } from "@/components/icon";
import { search } from "@/lib/queries";

export const dynamic = "force-dynamic";

export const metadata = { title: "Search" };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { artists, venues } = await search(q);
  const empty = artists.length === 0 && venues.length === 0;

  return (
    <div className="min-h-[70vh] pt-4">
      <h1 className="font-display mb-1 text-2xl leading-[1.1]">Search</h1>

      <Suspense>
        <SearchBox />
      </Suspense>

      <div className="mt-2">
        {artists.map((a) => (
          <div key={a.id} className="border-line flex items-center gap-3 border-b py-2">
            <span className="relative block size-[54px] shrink-0 overflow-hidden rounded-xl">
              <ArtistImage artist={a} />
            </span>
            <Link href={`/artist/${a.slug}`} className="min-w-0 flex-1">
              <b className="block text-base leading-tight font-bold">{a.name}</b>
              <i className="text-soft block text-[13px] not-italic">{a.genre}</i>
            </Link>
          </div>
        ))}

        {venues.map((v) => (
          <div key={v.id} className="border-line flex items-center gap-3 border-b py-2">
            <span className="bg-raise text-soft grid size-[54px] shrink-0 place-items-center rounded-xl">
              <Icon name="pin" />
            </span>
            <Link href={`/venue/${v.slug}`} className="min-w-0 flex-1">
              <b className="block text-base leading-tight font-bold">{v.name}</b>
              <i className="text-soft block text-[13px] not-italic">{v.area}</i>
            </Link>
          </div>
        ))}

        {empty && (
          <div className="border-line text-soft mt-4 rounded-2xl border-2 border-dashed px-4 py-[22px] text-center">
            Nobody by that name yet.
          </div>
        )}
      </div>
    </div>
  );
}
