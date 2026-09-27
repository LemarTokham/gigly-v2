/**
 * Shared setup for the friends, stubs and reactions tests.
 *
 * Every file makes its own users, venue and gigs rather than leaning on the
 * seed. The seed's gig times are offsets from the day it ran, so tests built
 * on it start failing a week after a reset; these do not.
 *
 * Times that matter (doors, the moment) are set directly with the service
 * role, which is how the tests reach the edges of the posting window without
 * waiting for them.
 */
import { after } from "node:test";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const status = JSON.parse(
  execFileSync("sh", ["scripts/supabase.sh", "status", "-o", "json"], {
    encoding: "utf8",
    cwd: new URL("..", import.meta.url).pathname,
  }),
) as Record<string, string>;

const options = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service role: bypasses RLS. Only for setting up and inspecting. */
export const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);

/** Signed out, as a visitor to the website. */
export const anon = () => createClient(status.API_URL, status.ANON_KEY, options);

/** Error code from a failed call, e.g. "GY021" or "42501". */
export const code = (e: unknown) => (e as { code?: string } | null)?.code;

export type User = { id: string; db: SupabaseClient; username: string | null };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
export const minutesAgo = (m: number) => new Date(Date.now() - m * MINUTE).toISOString();
export const minutesFromNow = (m: number) => new Date(Date.now() + m * MINUTE).toISOString();
export const hoursAgo = (h: number) => new Date(Date.now() - h * HOUR).toISOString();

/**
 * A per-file tag keeps parallel test files from touching each other's rows,
 * and makes usernames unique across runs.
 */
export function fixtures(tag: string) {
  const run = `${tag}${Date.now().toString(36)}`;
  const users: string[] = [];
  const gigs: string[] = [];
  let venueId: string | null = null;
  let artistId: string | null = null;
  let seq = 0;

  after(async () => {
    if (gigs.length) await admin.from("gigs").delete().in("id", gigs);
    if (artistId) await admin.from("artists").delete().eq("id", artistId);
    if (venueId) await admin.from("venues").delete().eq("id", venueId);
    await Promise.all(users.map((id) => admin.auth.admin.deleteUser(id)));
  });

  /** A signed-in user. Gets a username unless told not to. */
  async function user(opts: { username?: boolean } = {}): Promise<User> {
    const n = seq++;
    const email = `${run}-${n}@${tag}.gigly.test`;
    const password = "test-password-123";
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error) throw error;
    users.push(data.user.id);

    const db = createClient(status.API_URL, status.ANON_KEY, options);
    const signIn = await db.auth.signInWithPassword({ email, password });
    if (signIn.error) throw signIn.error;

    let username: string | null = null;
    if (opts.username !== false) {
      const set = await db.rpc("set_username", { p_username: `${run}${n}`.slice(0, 20) });
      if (set.error) throw set.error;
      username = set.data;
    }
    return { id: data.user.id, db, username };
  }

  /** A profile with no session, for when only the row matters. */
  async function bareProfile(): Promise<string> {
    const { data, error } = await admin.auth.admin.createUser({
      email: `${run}-bare-${seq++}@${tag}.gigly.test`,
      email_confirm: true,
    });
    if (error) throw error;
    users.push(data.user.id);
    return data.user.id;
  }

  async function venueAndArtist() {
    if (!venueId) {
      const v = await admin
        .from("venues")
        .insert({ name: `Test Room ${run}`, slug: `test-room-${run}`, area: "Testing" })
        .select("id")
        .single();
      if (v.error) throw v.error;
      venueId = v.data.id;
      const a = await admin
        .from("artists")
        .insert({ name: `Test Band ${run}`, slug: `test-band-${run}`, genre: "Indie", genre_group: "Indie" })
        .select("id")
        .single();
      if (a.error) throw a.error;
      artistId = a.data.id;
    }
    return { venueId: venueId!, artistId: artistId! };
  }

  /** A gig whose doors opened `doorsMinutesAgo` ago. Live unless told otherwise. */
  async function gig(opts: { doorsMinutesAgo?: number; status?: "live" | "pending" } = {}) {
    const { venueId, artistId } = await venueAndArtist();
    const g = await admin
      .from("gigs")
      .insert({
        slug: `test-gig-${run}-${seq++}`,
        venue_id: venueId,
        starts_at: minutesAgo(opts.doorsMinutesAgo ?? 120),
        status: opts.status ?? "live",
        source: "test",
      })
      .select("id")
      .single();
    if (g.error) throw g.error;
    gigs.push(g.data.id);
    await admin.from("gig_artists").insert({ gig_id: g.data.id, artist_id: artistId, position: 0 });
    return g.data.id as string;
  }

  return { user, bareProfile, gig };
}

/** Put a gig's moment at an exact time (the trigger picks a random one). */
export async function setMoment(gigId: string, firesAt: string) {
  const { error } = await admin.from("gig_moments").update({ fires_at: firesAt }).eq("gig_id", gigId);
  if (error) throw error;
}

/** Doors two hours ago and the moment a minute ago: the window is open. */
export async function openWindow(gigId: string) {
  await admin.from("gigs").update({ starts_at: minutesAgo(120) }).eq("id", gigId);
  await setMoment(gigId, minutesAgo(1));
}

export async function going(u: User, gigId: string) {
  const { error } = await u.db.from("attending").insert({ user_id: u.id, gig_id: gigId });
  if (error) throw error;
}

export async function makeFriends(a: User, b: User) {
  const sent = await a.db.rpc("send_friend_request", { p_to: b.id });
  if (sent.error) throw sent.error;
  const ok = await b.db.rpc("respond_to_request", { p_from: a.id, p_accept: true });
  if (ok.error) throw ok.error;
}

export const paths = (userId: string, gigId: string) => ({
  back_path: `${userId}/${gigId}/back.jpg`,
  front_path: `${userId}/${gigId}/front.jpg`,
  thumb_path: `${userId}/${gigId}/thumb.jpg`,
});

/** Post a stub as `u`, window permitting. Returns the insert result. */
export function postStub(u: User, gigId: string, audience: "friends" | "wall" = "wall") {
  return u.db
    .from("stubs")
    .insert({ user_id: u.id, gig_id: gigId, people: 1, audience, ...paths(u.id, gigId) })
    .select("id")
    .single();
}
