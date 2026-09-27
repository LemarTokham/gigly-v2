import Image from "next/image";
import { ArtistImage, type Artistish } from "@/components/artist-image";
import { PosterArt, type BandPart } from "@/components/poster-art";

/** A stable number from a string, so a show's generated art never changes. */
function seedFrom(text: string): number {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  return h;
}

/**
 * The picture for a gig, in order of preference: the event's own artwork from
 * whichever feed it came from, then the headliner's photo or poster art, then
 * poster art of the show's own. Everything that shows a gig goes through here
 * so the fallback chain is never forgotten. The last step is for shows that
 * name no artists, which most listings do.
 */
export function GigImage({
  gig,
  className,
  sizes,
  priority,
}: {
  gig: { slug: string; image_url: string | null; lineup: { artist: Artistish }[] };
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

  if (head) return <ArtistImage artist={head} className={className} sizes={sizes} />;

  const seed = seedFrom(gig.slug);
  const band: BandPart[] = ["guitar", "mic", "drums"];
  return (
    <PosterArt
      uid={gig.slug}
      seed={(seed % 9999) + 1}
      palette={seed % 6}
      band={band}
      className={className ?? "block h-full w-full"}
    />
  );
}
