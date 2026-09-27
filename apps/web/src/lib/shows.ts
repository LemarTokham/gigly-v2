import type { Artistish } from "@/components/artist-image";
import type { ChartShow } from "@/lib/queries";

/**
 * What to call a show, everywhere one is named.
 *
 * Its own title when the listing gave one ("Gallus: Album Launch Show",
 * "TurnTable's Halloween Party 2026"), otherwise its headliner, which is how
 * shows people submit are named. A show can have a title and no artists at
 * all: most Skiddle listings name nobody, and guessing made junk artists.
 */
type Showish = {
  title: string | null;
  lineup: { artist: { name: string } }[];
};

export function showName(show: Showish): string {
  return show.title ?? show.lineup[0]?.artist.name ?? "Live music";
}

/**
 * The rest of the bill for the line under a show's name: everyone not already
 * named in it. "Dan Croll: UK Tour" with Dan Croll headlining shows only the
 * support acts; a headliner-named show shows its support as before.
 */
export function showSupport(show: Showish): string[] {
  const name = showName(show).toLowerCase();
  return show.lineup.map((l) => l.artist.name).filter((n) => !name.includes(n.toLowerCase()));
}

/** A chart row in the shape GigImage draws from. */
export function chartShowImage(show: ChartShow): {
  slug: string;
  image_url: string | null;
  lineup: { artist: Artistish }[];
} {
  return {
    slug: show.slug!,
    image_url: show.image_url,
    lineup: show.headliner_slug
      ? [
          {
            artist: {
              slug: show.headliner_slug,
              name: show.name ?? "",
              photo_url: show.headliner_photo_url,
              art_seed: show.headliner_art_seed ?? 7,
              art_palette: show.headliner_art_palette ?? 0,
              art_band: show.headliner_art_band ?? [],
            },
          },
        ]
      : [],
  };
}
