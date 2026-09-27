"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { APIProvider, AdvancedMarker, Map, useMap } from "@vis.gl/react-google-maps";
import { VenuePanel, type MapVenue } from "@/components/venue-panel";

/**
 * Advanced markers require a Map ID, and a map with a Map ID ignores the old
 * inline `styles` option — styling comes from the cloud console instead. So
 * dark mode is done with `colorScheme` rather than a style array, which also
 * means Google maintains it rather than us hand-tuning fifty JSON rules.
 */
const DEFAULT_MAP_ID = "DEMO_MAP_ID";

/** Roughly the middle of the venues, tilted to fit Birkenhead in. */
const CENTRE = { lat: 53.4009, lng: -2.9835 };

/**
 * The device theme is an external store, not React state, so it is read with
 * useSyncExternalStore rather than mirrored into state from an effect. Also
 * watches data-theme, so a manual toggle later moves the map with the app.
 */
const subscribeToScheme = (onChange: () => void) => {
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  mq.addEventListener("change", onChange);

  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });

  return () => {
    mq.removeEventListener("change", onChange);
    observer.disconnect();
  };
};

function readScheme(): "LIGHT" | "DARK" {
  const pinned = document.documentElement.getAttribute("data-theme");
  if (pinned === "light") return "LIGHT";
  if (pinned === "dark") return "DARK";
  // matches the token layer: dark is the base, light only when asked for
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "LIGHT" : "DARK";
}

function useColorScheme(): "LIGHT" | "DARK" {
  return useSyncExternalStore(subscribeToScheme, readScheme, () => "DARK" as const);
}

/**
 * Frames every venue once, when the map first has them.
 *
 * The guard matters more than it looks. Without it this ran on every render,
 * so merely tapping a pin threw away whatever the viewer had zoomed or panned
 * to. It re-frames only if the set of venues genuinely changes, compared by id
 * rather than by array identity — the array is rebuilt each render and would
 * otherwise always look new.
 */
function FrameVenuesOnce({ venues }: { venues: MapVenue[] }) {
  const map = useMap();
  const key = venues.map((v) => v.id).join(",");
  const framed = useRef<string | null>(null);

  useEffect(() => {
    if (!map || venues.length === 0 || framed.current === key) return;
    framed.current = key;

    const bounds = new google.maps.LatLngBounds();
    for (const v of venues) bounds.extend({ lat: v.lat!, lng: v.lng! });
    map.fitBounds(bounds, { top: 48, bottom: 48, left: 32, right: 32 });
  }, [map, venues, key]);

  return null;
}

/**
 * Nudges the map only when the chosen pin is off screen. Panning on every
 * selection would fight the viewer as much as re-framing did; doing nothing at
 * all would let them pick something they cannot see.
 */
function KeepSelectedInView({ venue }: { venue: MapVenue | null }) {
  const map = useMap();

  useEffect(() => {
    if (!map || venue?.lat == null || venue?.lng == null) return;

    const bounds = map.getBounds();
    const position = { lat: venue.lat, lng: venue.lng };
    if (bounds && !bounds.contains(position)) map.panTo(position);
  }, [map, venue]);

  return null;
}

function Pin({
  venue,
  selected,
  onSelect,
}: {
  venue: MapVenue;
  selected: boolean;
  onSelect: () => void;
}) {
  const has = venue.gigCount > 0;

  return (
    <AdvancedMarker
      position={{ lat: venue.lat!, lng: venue.lng! }}
      onClick={onSelect}
      title={`${venue.name}, ${venue.gigCount} ${venue.gigCount === 1 ? "gig" : "gigs"}`}
      zIndex={selected ? 30 : has ? 20 : 10}
    >
      <button
        aria-label={`${venue.name}, ${venue.gigCount} gigs`}
        aria-pressed={selected}
        className={`font-display grid size-9 place-items-center rounded-full border-[3px] text-[15px] transition-transform ${
          selected
            ? "bg-hype text-on-hype scale-[1.18] border-white"
            : has
              ? "bg-ink text-bg border-bg"
              : "bg-raise text-soft border-bg"
        } ${venue.tonight ? "ring-gold ring-[3px]" : ""}`}
      >
        {venue.gigCount}
      </button>
    </AdvancedMarker>
  );
}

/** Puts every venue back in frame, now that it no longer happens by itself. */
function ShowAll({ venues }: { venues: MapVenue[] }) {
  const map = useMap();
  if (!venues.length) return null;

  return (
    <button
      onClick={() => {
        if (!map) return;
        const bounds = new google.maps.LatLngBounds();
        for (const v of venues) bounds.extend({ lat: v.lat!, lng: v.lng! });
        map.fitBounds(bounds, { top: 48, bottom: 48, left: 32, right: 32 });
      }}
      className="text-soft shrink-0 text-[13px] font-bold underline"
    >
      Show all
    </button>
  );
}

export function VenueMap({
  venues,
  apiKey,
  mapId,
}: {
  venues: MapVenue[];
  apiKey: string;
  mapId?: string;
}) {
  // Memoised so the reference is stable across renders. A fresh array on every
  // render is what made the framing effect fire on each pin tap.
  const placed = useMemo(() => venues.filter((v) => v.lat != null && v.lng != null), [venues]);

  const scheme = useColorScheme();
  const [selectedId, setSelectedId] = useState<string | null>(
    () => [...placed].sort((a, b) => b.gigCount - a.gigCount)[0]?.id ?? null,
  );

  const selected = placed.find((v) => v.id === selectedId) ?? null;

  if (!apiKey) {
    return (
      <div className="border-line text-soft rounded-2xl border-2 border-dashed px-4 py-8 text-center">
        <p className="font-bold">The map needs a Google Maps key.</p>
        <p className="mt-1 text-sm">
          Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to .env.local and restart the dev server.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="border-line relative aspect-[3/4] overflow-hidden rounded-2xl border sm:aspect-[4/3]">
        <Map
          mapId={mapId || DEFAULT_MAP_ID}
          colorScheme={scheme}
          defaultCenter={CENTRE}
          defaultZoom={14}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          className="h-full w-full"
          onClick={() => setSelectedId(null)}
        >
          <FrameVenuesOnce venues={placed} />
          <KeepSelectedInView venue={selected} />
          {placed.map((v) => (
            <Pin
              key={v.id}
              venue={v}
              selected={v.id === selectedId}
              onSelect={() => setSelectedId(v.id)}
            />
          ))}
        </Map>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <p className="text-soft text-[13px]">
          <span className="bg-ink ring-gold mr-2.5 ml-[3px] inline-block size-3 rounded-full align-[-1px] ring-[3px]" />
          Gig on tonight
        </p>
        <ShowAll venues={placed} />
      </div>

      <VenuePanel venue={selected} />
    </APIProvider>
  );
}
