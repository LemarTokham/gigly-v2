import Link from "next/link";
import { GigImage } from "@/components/gig-image";
import { Icon } from "@/components/icon";
import { GoingButton } from "@/components/going-button";
import { clockTime, dayWord, money, nightOf } from "@/lib/format";
import type { GigRow } from "@/lib/queries";
import { showName, showSupport } from "@/lib/shows";

export function GigCard({
  gig,
  today,
  hypeCounts,
  going,
  signedIn,
  path,
}: {
  gig: GigRow;
  today: string;
  hypeCounts: Map<string, number>;
  going: boolean;
  signedIn: boolean;
  path: string;
}) {
  const support = showSupport(gig);
  const hypes = hypeCounts.get(gig.id) ?? 0;

  return (
    <article className="border-line bg-card overflow-hidden rounded-2xl border">
      <Link href={`/gig/${gig.slug}`} className="relative block aspect-[16/10] w-full text-white">
        <GigImage gig={gig} />
        <span className="pointer-events-none absolute inset-x-0 top-[40%] bottom-0 bg-gradient-to-t from-[rgba(10,6,20,0.88)] to-transparent" />

        <span className="absolute top-2.5 left-2.5 z-10 rounded-full bg-[rgba(10,6,20,0.72)] px-2.5 py-[5px] text-[13px] font-bold">
          {dayWord(nightOf(gig.starts_at), today)} {clockTime(gig.starts_at)}
        </span>
        <span className="bg-gold absolute top-2.5 right-2.5 z-10 rounded-full px-2.5 py-[5px] text-[13px] font-bold text-[#17131D]">
          {money(gig.price_pence)}
        </span>
        {gig.status === "pending" && (
          <span className="absolute top-11 left-2.5 z-10 rounded-full bg-white px-2.5 py-[5px] text-[13px] font-bold text-[#17131D]">
            Being checked
          </span>
        )}

        <span className="absolute right-3.5 bottom-3 left-3.5 z-10">
          <b className="font-display block text-[clamp(24px,7.4vw,30px)] leading-[1.04] [overflow-wrap:anywhere]">
            {showName(gig)}
          </b>
          {support.length > 0 && (
            <i className="mt-[3px] block text-sm font-semibold not-italic opacity-90">
              + {support.join(", ")}
            </i>
          )}
        </span>
      </Link>

      <div className="flex items-center gap-2.5 py-2.5 pr-3 pl-3.5">
        <Link href={`/venue/${gig.venue.slug}`} className="min-w-0 flex-1 text-[15px] leading-tight font-bold">
          {gig.venue.name}
          <i className="text-soft block text-[13px] font-normal not-italic">{gig.venue.area}</i>
        </Link>
        <span
          className="text-hype inline-flex items-center gap-[3px] text-sm font-bold"
          aria-label={`${hypes} hypes`}
        >
          <Icon name="flame" className="size-4" />
          {hypes}
        </span>
        <GoingButton gigId={gig.id} going={going} signedIn={signedIn} path={path} />
      </div>
    </article>
  );
}
