import { createClient } from "@/lib/supabase/server";
import { nightRange, todayNight } from "@/lib/format";
import { HYPES_PER_WEEK, type Database } from "@gigly/shared";

export type GenreGroup = Database["public"]["Enums"]["genre_group"];

export const GENRE_GROUPS: GenreGroup[] = [
  "Indie",
  "Punk",
  "Jazz",
  "Electronic",
  "Folk",
  "Soul",
  "Hip hop",
];

/** Everything a card or page needs to draw an artist, including poster art. */
const ARTIST_FIELDS =
  "id, name, slug, genre, genre_group, from_area, photo_url, art_seed, art_palette, art_band";

const GIG_FIELDS = `
  id, slug, title, starts_at, price_pence, ticket_url, status, submitted_by, image_url,
  venue:venues!inner ( id, name, slug, area, capacity, map_x, map_y ),
  lineup:gig_artists ( position, artist:artists!inner ( ${ARTIST_FIELDS} ) )
`;

export type GigRow = {
  id: string;
  slug: string;
  /** The listing's own name for the show; null for submitted shows. See showName(). */
  title: string | null;
  starts_at: string;
  price_pence: number;
  ticket_url: string | null;
  status: Database["public"]["Enums"]["gig_status"];
  submitted_by: string | null;
  image_url: string | null;
  venue: {
    id: string;
    name: string;
    slug: string;
    area: string;
    capacity: number | null;
    map_x: number | null;
    map_y: number | null;
  };
  lineup: {
    position: number;
    artist: {
      id: string;
      name: string;
      slug: string;
      genre: string;
      genre_group: GenreGroup;
      from_area: string | null;
      photo_url: string | null;
      art_seed: number;
      art_palette: number;
      art_band: string[];
    };
  }[];
};

/** Headliner first. position 0 is the headliner. */
function sortLineup<T extends { lineup: { position: number }[] }>(gig: T): T {
  gig.lineup.sort((a, b) => a.position - b.position);
  return gig;
}

/**
 * Upcoming live gigs, optionally narrowed to one night and one genre bucket.
 *
 * The night filter is a `starts_at` range rather than a computed bucket per
 * row, so it uses the partial index on live gigs. The genre filter is a
 * separate lookup first: filtering on an embedded resource in PostgREST also
 * prunes the embedded rows, which would silently drop the rest of a line-up
 * from the card.
 */
export async function getUpcomingGigs(opts: {
  night?: string | null;
  genre?: GenreGroup | null;
  limit?: number;
  /** Include this user's own gigs that are still awaiting approval. */
  viewerId?: string | null;
} = {}): Promise<GigRow[]> {
  const db = await createClient();

  let gigIds: string[] | null = null;
  if (opts.genre) {
    const { data } = await db
      .from("gig_artists")
      .select("gig_id, artists!inner(genre_group)")
      .eq("artists.genre_group", opts.genre);
    gigIds = [...new Set((data ?? []).map((r) => r.gig_id))];
    if (gigIds.length === 0) return [];
  }

  let q = db
    .from("gigs")
    .select(GIG_FIELDS)
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  // RLS already hides other people's pending gigs, but an admin can see them
  // all — so the feed is filtered explicitly rather than left to the policy,
  // or an admin's what's-on page would fill up with everyone's submissions.
  q = opts.viewerId
    ? q.or(`status.eq.live,and(status.eq.pending,submitted_by.eq.${opts.viewerId})`)
    : q.eq("status", "live");

  if (opts.night) {
    const { start, end } = nightRange(opts.night);
    q = q.gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString());
  }
  if (gigIds) q = q.in("id", gigIds);
  if (opts.limit) q = q.limit(opts.limit);

  const { data, error } = await q;
  if (error) throw error;
  return (data as unknown as GigRow[]).map(sortLineup);
}

export async function getGigBySlug(slug: string): Promise<GigRow | null> {
  const db = await createClient();
  const { data, error } = await db.from("gigs").select(GIG_FIELDS).eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data ? sortLineup(data as unknown as GigRow) : null;
}

export type ChartRange = "tonight" | "week" | "month" | "all";

export const CHART_RANGES: { id: ChartRange; label: string }[] = [
  { id: "tonight", label: "Tonight" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "all", label: "All" },
];

export type ChartShow = Database["public"]["Views"]["gig_chart"]["Row"] & {
  position: number;
  positionYesterday: number;
  /** Nothing before today: the prototype labels it rather than showing a jump. */
  isNew: boolean;
};

/** Hype first; on a tie the sooner show, then by name, so the order is stable. */
function rankBy(key: "hype_count" | "hype_count_yesterday") {
  return (a: ChartShow, b: ChartShow) =>
    (b[key] ?? 0) - (a[key] ?? 0) ||
    Date.parse(a.starts_at!) - Date.parse(b.starts_at!) ||
    (a.name ?? "").localeCompare(b.name ?? "");
}

/**
 * The most anticipated shows in a range, ranked within it: No. 1 tonight is
 * not No. 1 overall. Ranked here rather than in the view because the rank only
 * means something once the range is chosen. "This week" and "This month" are
 * the next 7 and 30 days.
 */
export async function getShowChart(range: ChartRange, limit?: number): Promise<ChartShow[]> {
  const db = await createClient();
  let q = db.from("gig_chart").select("*");

  if (range === "tonight") {
    const { start, end } = nightRange(todayNight());
    q = q.gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString());
  } else if (range !== "all") {
    const days = range === "week" ? 7 : 30;
    q = q.lt("starts_at", new Date(Date.now() + days * 864e5).toISOString());
  }

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data ?? []).map((r) => ({ ...r, position: 0, positionYesterday: 0, isNew: false }));
  rows.sort(rankBy("hype_count_yesterday")).forEach((r, i) => (r.positionYesterday = i + 1));
  rows.sort(rankBy("hype_count")).forEach((r, i) => {
    r.position = i + 1;
    r.isNew = (r.hype_count ?? 0) > 0 && (r.hype_count_yesterday ?? 0) === 0;
  });
  return limit ? rows.slice(0, limit) : rows;
}

export type ArtistPage = {
  artist: Database["public"]["Tables"]["artists"]["Row"];
  gigs: GigRow[];
  followerCount: number;
};

export async function getArtistBySlug(slug: string): Promise<ArtistPage | null> {
  const db = await createClient();

  const { data: artist, error } = await db
    .from("artists")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!artist) return null;

  const [{ data: links }, { data: stats }] = await Promise.all([
    db.from("gig_artists").select("gig_id").eq("artist_id", artist.id),
    db.from("artist_stats").select("follower_count").eq("artist_id", artist.id).maybeSingle(),
  ]);

  const ids = (links ?? []).map((l) => l.gig_id);
  let gigs: GigRow[] = [];
  if (ids.length) {
    const { data } = await db
      .from("gigs")
      .select(GIG_FIELDS)
      .in("id", ids)
      .eq("status", "live")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true });
    gigs = (data as unknown as GigRow[] | null)?.map(sortLineup) ?? [];
  }

  return {
    artist,
    gigs,
    followerCount: stats?.follower_count ?? 0,
  };
}

export type VenuePage = {
  venue: Database["public"]["Tables"]["venues"]["Row"];
  gigs: GigRow[];
};

export async function getVenueBySlug(slug: string): Promise<VenuePage | null> {
  const db = await createClient();
  const { data: venue, error } = await db
    .from("venues")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!venue) return null;

  const { data } = await db
    .from("gigs")
    .select(GIG_FIELDS)
    .eq("venue_id", venue.id)
    .eq("status", "live")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return { venue, gigs: (data as unknown as GigRow[] | null)?.map(sortLineup) ?? [] };
}

export type VenueWithCount = Database["public"]["Tables"]["venues"]["Row"] & {
  gig_count: number;
  tonight: boolean;
  next_gig: GigRow | null;
  /** Upcoming gigs at this venue, soonest first — shown in the map panel. */
  gigs: GigRow[];
};

/** Venues with how many live gigs fall in the window, for the map. */
export async function getVenuesForMap(range: "tonight" | "week"): Promise<VenueWithCount[]> {
  const db = await createClient();
  const [{ data: venues }, gigs] = await Promise.all([
    db.from("venues").select("*").order("name"),
    getUpcomingGigs(),
  ]);

  const { start: tonightStart, end: tonightEnd } = nightRange(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(
      new Date(Date.now() - 4 * 3600_000),
    ),
  );
  const weekEnd = new Date(Date.now() + 7 * 864e5);

  return (venues ?? []).map((v) => {
    const mine = gigs.filter((g) => g.venue.id === v.id);
    const inRange = mine.filter((g) => {
      const t = new Date(g.starts_at);
      return range === "tonight" ? t >= tonightStart && t < tonightEnd : t <= weekEnd;
    });
    return {
      ...v,
      gig_count: inRange.length,
      tonight: mine.some((g) => {
        const t = new Date(g.starts_at);
        return t >= tonightStart && t < tonightEnd;
      }),
      next_gig: mine[0] ?? null,
      gigs: mine.slice(0, 4),
    };
  });
}

export type SearchResults = {
  shows: GigRow[];
  artists: Pick<
    Database["public"]["Tables"]["artists"]["Row"],
    | "id"
    | "name"
    | "slug"
    | "genre"
    | "genre_group"
    | "photo_url"
    | "art_seed"
    | "art_palette"
    | "art_band"
  >[];
  venues: Pick<Database["public"]["Tables"]["venues"]["Row"], "id" | "name" | "slug" | "area">[];
};

export async function search(q: string): Promise<SearchResults> {
  const db = await createClient();
  const term = q.trim();

  if (!term) {
    const { data } = await db.from("artists").select(ARTIST_FIELDS).order("name").limit(5);
    return { shows: [], artists: data ?? [], venues: [] };
  }

  // ilike with a leading wildcard cannot use a btree index. Fine for one city;
  // swap to a trigram index or tsvector when the artist table gets big.
  const like = `%${term.replace(/[%_]/g, "\\$&")}%`;
  const [{ data: shows }, { data: artists }, { data: venues }] = await Promise.all([
    // Shows by their own name. Most listings name no artists, so a show like
    // "TurnTable's Halloween Party" can only be found this way.
    db
      .from("gigs")
      .select(GIG_FIELDS)
      .eq("status", "live")
      .gt("starts_at", new Date().toISOString())
      .ilike("title", like)
      .order("starts_at")
      .limit(5),
    db
      .from("artists")
      .select(ARTIST_FIELDS)
      .or(`name.ilike.${like},genre.ilike.${like}`)
      .order("name")
      .limit(8),
    db
      .from("venues")
      .select("id, name, slug, area")
      .or(`name.ilike.${like},area.ilike.${like}`)
      .order("name")
      .limit(5),
  ]);

  return {
    shows: (shows as unknown as GigRow[] | null)?.map(sortLineup) ?? [],
    artists: artists ?? [],
    venues: venues ?? [],
  };
}

/** Hype per upcoming show, keyed by gig id. Shows whose doors have opened are absent. */
export async function getHypeCounts(): Promise<Map<string, number>> {
  const db = await createClient();
  const { data, error } = await db.from("gig_chart").select("id, hype_count");
  if (error) throw error;
  return new Map((data ?? []).map((r) => [r.id!, r.hype_count ?? 0]));
}

/** The signed-in user, or null. Revalidated against the auth server. */
export async function getUser() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  return user;
}

/** What the signed-in user follows and is going to, for rendering button state. */
export async function getMyState(): Promise<{
  userId: string | null;
  following: Set<string>;
  going: Set<string>;
}> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { userId: null, following: new Set(), going: new Set() };

  // RLS limits both of these to the caller's own rows, so no user_id filter is
  // needed — but it is written explicitly so the intent survives a policy change.
  const [{ data: follows }, { data: attending }] = await Promise.all([
    db.from("follows").select("artist_id").eq("user_id", user.id),
    db.from("attending").select("gig_id").eq("user_id", user.id),
  ]);

  return {
    userId: user.id,
    following: new Set((follows ?? []).map((f) => f.artist_id)),
    going: new Set((attending ?? []).map((a) => a.gig_id)),
  };
}

/** Artists the signed-in user follows, with their next gig line. */
export async function getMyFollowing() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  const { data } = await db
    .from("follows")
    .select(`artist:artists!inner ( ${ARTIST_FIELDS} )`)
    .eq("user_id", user.id);

  return (data ?? []).map((r) => r.artist as unknown as SearchResults["artists"][number]);
}

/** Upcoming gigs the signed-in user has said they are going to. */
export async function getMyGoing(): Promise<GigRow[]> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  const { data: rows } = await db.from("attending").select("gig_id").eq("user_id", user.id);
  const ids = (rows ?? []).map((r) => r.gig_id);
  if (!ids.length) return [];

  const { data } = await db
    .from("gigs")
    .select(GIG_FIELDS)
    .in("id", ids)
    .eq("status", "live")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return (data as unknown as GigRow[] | null)?.map(sortLineup) ?? [];
}

/** The signed-in user's hype state: which shows they back, and how many are left. */
export async function getHypeState(): Promise<{
  userId: string | null;
  hyped: Set<string>;
  left: number;
}> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { userId: null, hyped: new Set(), left: HYPES_PER_WEEK };

  const [{ data: rows }, { data: left }] = await Promise.all([
    db.from("hypes").select("gig_id").eq("user_id", user.id),
    db.rpc("hypes_remaining"),
  ]);

  return {
    userId: user.id,
    hyped: new Set((rows ?? []).map((r) => r.gig_id)),
    left: left ?? 0,
  };
}

/** Shows the user is backing whose doors have not opened yet, soonest first. */
export async function getMyHypes(): Promise<GigRow[]> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return [];

  const { data: rows } = await db.from("hypes").select("gig_id").eq("user_id", user.id);
  const ids = (rows ?? []).map((r) => r.gig_id);
  if (!ids.length) return [];

  const { data } = await db
    .from("gigs")
    .select(GIG_FIELDS)
    .in("id", ids)
    .eq("status", "live")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return (data as unknown as GigRow[] | null)?.map(sortLineup) ?? [];
}

/** Whether the signed-in user can reach the approval queue. */
export async function isAdminUser(): Promise<boolean> {
  const db = await createClient();
  const { data } = await db.rpc("is_admin");
  return data ?? false;
}
