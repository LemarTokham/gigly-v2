import Image from "next/image";
import { ArtistImage } from "@/components/artist-image";
import type { GigRow } from "@/lib/queries";

/**
 * The picture for a gig, in order of preference: the event's own artwork from
 * whichever feed it came from, then the headliner's photo, then the generated
 * poster art. Everything that shows a gig goes through here so the fallback
 * chain is never forgotten.
 */
export function GigImage({
  gig,
  className,
  sizes,
  priority,
}: {
  gig: Pick<GigRow, "image_url" | "lineup">;
  className?: string;
  sizes?: string;
  priority?: boolean;
}) {
  const head = gig.lineup[0]?.artist;

  if (gig.image_url) {
    return (
      <Image
        src={gig.image_url}
        alt=""
        fill
        priority={priority}
        sizes={sizes ?? "(max-width: 500px) 100vw, 500px"}
        className={className ?? "object-cover"}
      />
    );
  }

  if (!head) return null;
  return <ArtistImage artist={head} className={className} sizes={sizes} />;
}
