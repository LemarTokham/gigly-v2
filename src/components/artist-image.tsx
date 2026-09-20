import Image from "next/image";
import { PosterArt } from "@/components/poster-art";

type Artistish = {
  slug: string;
  name: string;
  photo_url: string | null;
  art_seed: number;
  art_palette: number;
  art_band: string[];
};

/**
 * An artist's picture: their uploaded photo if there is one, otherwise the
 * generated poster art. Everything that shows an artist goes through here so
 * the fallback is never forgotten.
 */
export function ArtistImage({
  artist,
  className,
  sizes,
}: {
  artist: Artistish;
  className?: string;
  sizes?: string;
}) {
  if (artist.photo_url) {
    return (
      <Image
        src={artist.photo_url}
        alt=""
        fill
        sizes={sizes ?? "(max-width: 500px) 100vw, 500px"}
        className={className ?? "object-cover"}
      />
    );
  }
  return (
    <PosterArt
      uid={artist.slug}
      seed={artist.art_seed}
      palette={artist.art_palette}
      band={artist.art_band}
      className={className ?? "block h-full w-full"}
    />
  );
}
