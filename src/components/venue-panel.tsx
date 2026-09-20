"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useMapsLibrary } from "@vis.gl/react-google-maps";
import { Icon } from "@/components/icon";

export type MapVenue = {
  id: string;
  name: string;
  slug: string;
  area: string;
  capacity: number | null;
  lat: number | null;
  lng: number | null;
  googlePlaceId: string | null;
  gigCount: number;
  tonight: boolean;
  gigs: { id: string; slug: string; headliner: string; when: string; price: string }[];
};

type Review = {
  author: string;
  authorUri: string | null;
  rating: number;
  text: string;
  when: string;
};

type Places = {
  rating: number | null;
  count: number | null;
  mapsUri: string | null;
  reviews: Review[];
};

/** A row of five stars, half-filled to the nearest tenth. */
function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, rating - i));
        return (
          <span key={i} className="relative inline-block size-3.5">
            <span className="text-line absolute inset-0">★</span>
            <span
              className="text-gold absolute inset-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              ★
            </span>
          </span>
        );
      })}
    </span>
  );
}

/**
 * Google's terms forbid storing Places content, so ratings and reviews are
 * fetched in the browser each time a venue is opened and never written to our
 * database. One request per venue opened, not one per map load.
 */
function useGooglePlace(placeId: string | null) {
  const places = useMapsLibrary("places");
  // One piece of state carrying which venue it belongs to, so "loading" is
  // derived from a mismatch rather than set synchronously inside the effect.
  const [result, setResult] = useState<{
    forPlaceId: string | null;
    data: Places | null;
    failed: boolean;
  }>({ forPlaceId: null, data: null, failed: false });

  useEffect(() => {
    if (!places || !placeId) return;

    let cancelled = false;

    (async () => {
      try {
        const place = new places.Place({ id: placeId });
        await place.fetchFields({
          fields: ["rating", "userRatingCount", "reviews", "googleMapsURI"],
        });
        if (cancelled) return;

        setResult({
          forPlaceId: placeId,
          failed: false,
          data: {
            rating: place.rating ?? null,
            count: place.userRatingCount ?? null,
            mapsUri: place.googleMapsURI ?? null,
            reviews: (place.reviews ?? []).slice(0, 5).map((r) => ({
              author: r.authorAttribution?.displayName ?? "A Google user",
              authorUri: r.authorAttribution?.uri ?? null,
              rating: r.rating ?? 0,
              text: r.text ?? "",
              when: r.relativePublishTimeDescription ?? "",
            })),
          },
        });
      } catch {
        if (!cancelled) setResult({ forPlaceId: placeId, data: null, failed: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [places, placeId]);

  const settled = result.forPlaceId === placeId;
  return {
    data: settled ? result.data : null,
    state: !placeId ? ("idle" as const) : settled ? (result.failed ? ("error" as const) : ("idle" as const)) : ("loading" as const),
  };
}

export function VenuePanel({ venue }: { venue: MapVenue | null }) {
  const { data, state } = useGooglePlace(venue?.googlePlaceId ?? null);

  if (!venue) {
    return (
      <p className="text-soft mt-4 text-sm">Tap a pin to see what&rsquo;s on there.</p>
    );
  }

  return (
    <section className="border-line bg-card mt-4 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-xl leading-[1.1]">{venue.name}</h2>
          <p className="text-soft text-sm">
            {venue.area}
            {venue.capacity ? ` · ${venue.capacity} capacity` : ""}
          </p>
        </div>
        <Link
          href={`/venue/${venue.slug}`}
          className="border-line shrink-0 rounded-[10px] border-2 px-3 py-2 text-sm font-bold"
        >
          Venue
        </Link>
      </div>

      {/* --- what's on ----------------------------------------------------- */}
      {venue.gigs.length > 0 ? (
        <ul className="mt-3">
          {venue.gigs.map((g) => (
            <li key={g.id}>
              <Link
                href={`/gig/${g.slug}`}
                className="border-line flex items-center gap-3 border-b py-2 last:border-b-0"
              >
                <span className="min-w-0 flex-1">
                  <b className="block text-[15px] leading-tight font-bold">{g.headliner}</b>
                  <i className="text-soft block text-[13px] not-italic">
                    {g.when} · {g.price}
                  </i>
                </span>
                <Icon name="go" className="text-soft size-4" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-soft mt-3 text-sm">Nothing listed here yet.</p>
      )}

      {/* --- what people say ----------------------------------------------- */}
      {venue.googlePlaceId && (
        <div className="border-line mt-4 border-t pt-3">
          {state === "loading" && (
            <p className="text-soft text-sm">Loading reviews…</p>
          )}

          {state === "error" && (
            <p className="text-soft text-sm">Couldn&rsquo;t load reviews just now.</p>
          )}

          {data && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  {data.rating != null && <Stars rating={data.rating} />}
                  <b className="text-[15px] font-bold">
                    {data.rating != null ? data.rating.toFixed(1) : "—"}
                  </b>
                  {data.count != null && (
                    <span className="text-soft text-[13px]">
                      {data.count.toLocaleString("en-GB")} reviews
                    </span>
                  )}
                </span>
                {/* Attribution is required when showing Places content. */}
                {data.mapsUri && (
                  <a
                    href={data.mapsUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-soft text-[13px] font-bold underline"
                  >
                    on Google
                  </a>
                )}
              </div>

              {data.reviews.length > 0 && (
                <ul className="mt-2.5 space-y-2.5">
                  {data.reviews.map((r, i) => (
                    <li key={i} className="border-line bg-bg rounded-xl border p-3">
                      <div className="flex items-center gap-2">
                        <Stars rating={r.rating} />
                        <span className="text-soft text-[13px]">{r.when}</span>
                      </div>
                      <p className="mt-1.5 line-clamp-4 text-sm">{r.text}</p>
                      <p className="text-soft mt-1.5 text-[13px] font-semibold">
                        {r.authorUri ? (
                          <a href={r.authorUri} target="_blank" rel="noopener noreferrer">
                            {r.author}
                          </a>
                        ) : (
                          r.author
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}
