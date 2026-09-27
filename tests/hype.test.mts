/**
 * Hype rules, tested against the real local Postgres — real policies, real
 * constraints, real JWTs. Mocking the Supabase client here would test the mock:
 * every rule below lives in the database, not in TypeScript.
 *
 *   pnpm db:start   (once)
 *   ppnpm test
 */
import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HYPES_PER_WEEK } from "../packages/shared/src/hype.ts";

// ---------------------------------------------------------------- bootstrap

const status = JSON.parse(
  execFileSync("sh", ["scripts/supabase.sh", "status", "-o", "json"], {
    encoding: "utf8",
    cwd: new URL("..", import.meta.url).pathname,
  }),
) as Record<string, string>;

const API_URL = status.API_URL;
const ANON_KEY = status.ANON_KEY;
const SERVICE_KEY = status.SERVICE_ROLE_KEY;

const admin = createClient(API_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Error code from a failed rpc, e.g. "GY001". */
const code = (e: unknown) => (e as { code?: string } | null)?.code;

/** Per-file domain: the two test files must not delete each other's users. */
const DOMAIN = "hype.gigly.test";

const created: string[] = [];
let userSeq = 0;
async function newUser(): Promise<{ id: string; db: SupabaseClient }> {
  const email = `test-${Date.now()}-${userSeq++}@${DOMAIN}`;
  const password = "hype-test-password";

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const db = createClient(API_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;

  created.push(data.user!.id);
  return { id: data.user!.id, db };
}

/** Artist ids by slug, for the seeded twelve plus the fixtures below. */
const artist: Record<string, string> = {};

/** Move a hype back in time. Service role bypasses RLS and the write revoke. */
async function backdate(userId: string, artistId: string, days: number) {
  const { error } = await admin
    .from("hypes")
    .update({ created_at: new Date(Date.now() - days * 864e5).toISOString() })
    .eq("user_id", userId)
    .eq("artist_id", artistId);
  if (error) throw error;
}

async function chartCount(artistId: string): Promise<number> {
  const { data, error } = await admin
    .from("artist_chart")
    .select("hype_count")
    .eq("id", artistId)
    .maybeSingle();
  if (error) throw error;
  return data?.hype_count ?? 0;
}

// Fixtures the seed cannot provide: all twelve seeded artists are hypeable.
let fixtureVenue: string;

before(async () => {
  const { data: artists, error } = await admin.from("artists").select("id, slug");
  if (error) throw error;
  for (const a of artists!) artist[a.slug] = a.id;

  const { data: venue } = await admin.from("venues").select("id").limit(1).single();
  fixtureVenue = venue!.id;

  // an artist with no gig at all
  const noGig = await admin
    .from("artists")
    .insert({ name: "Test No Gig", slug: "test-no-gig", genre: "Test", genre_group: "Indie" })
    .select("id")
    .single();
  artist["test-no-gig"] = noGig.data!.id;

  // an artist whose only gig is awaiting approval
  const pending = await admin
    .from("artists")
    .insert({ name: "Test Pending", slug: "test-pending", genre: "Test", genre_group: "Indie" })
    .select("id")
    .single();
  artist["test-pending"] = pending.data!.id;

  const pendingGig = await admin
    .from("gigs")
    .insert({
      slug: "test-pending-gig",
      venue_id: fixtureVenue,
      starts_at: new Date(Date.now() + 5 * 864e5).toISOString(),
      status: "pending",
    })
    .select("id")
    .single();
  await admin
    .from("gig_artists")
    .insert({ gig_id: pendingGig.data!.id, artist_id: artist["test-pending"], position: 0 });

  // an artist whose only gig has already started
  const past = await admin
    .from("artists")
    .insert({ name: "Test Past", slug: "test-past", genre: "Test", genre_group: "Indie" })
    .select("id")
    .single();
  artist["test-past"] = past.data!.id;

  // chart-eligible and starts with no hypes at all, for the movement tests
  const fresh = await admin
    .from("artists")
    .insert({ name: "Test Fresh", slug: "test-fresh", genre: "Test", genre_group: "Indie" })
    .select("id")
    .single();
  artist["test-fresh"] = fresh.data!.id;

  const freshGig = await admin
    .from("gigs")
    .insert({
      slug: "test-fresh-gig",
      venue_id: fixtureVenue,
      starts_at: new Date(Date.now() + 6 * 864e5).toISOString(),
      status: "live",
    })
    .select("id")
    .single();
  await admin
    .from("gig_artists")
    .insert({ gig_id: freshGig.data!.id, artist_id: artist["test-fresh"], position: 0 });

  const pastGig = await admin
    .from("gigs")
    .insert({
      slug: "test-past-gig",
      venue_id: fixtureVenue,
      starts_at: new Date(Date.now() - 3600_000).toISOString(),
      status: "live",
    })
    .select("id")
    .single();
  await admin
    .from("gig_artists")
    .insert({ gig_id: pastGig.data!.id, artist_id: artist["test-past"], position: 0 });
});

after(async () => {
  for (const slug of ["test-no-gig", "test-pending", "test-past", "test-fresh"]) {
    await admin.from("artists").delete().eq("slug", slug);
  }
  for (const slug of ["test-pending-gig", "test-past-gig", "test-fresh-gig"]) {
    await admin.from("gigs").delete().eq("slug", slug);
  }
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

// ------------------------------------------------------------- allowance

describe("the three-a-week allowance", () => {
  test("the web and the app are told the same allowance the database enforces", async () => {
    const { db } = await newUser();
    assert.equal((await db.rpc("hypes_remaining")).data, HYPES_PER_WEEK);
  });

  test("three hypes are allowed and the fourth is refused", async () => {
    const { db } = await newUser();
    const slugs = ["dock-leaf", "marzipan-riot", "velvet-ferry", "low-tide-club"];

    for (const slug of slugs.slice(0, 3)) {
      const { error } = await db.rpc("cast_hype", { p_artist_id: artist[slug] });
      assert.equal(error, null, `${slug} should have been hypeable`);
    }

    const { error } = await db.rpc("cast_hype", { p_artist_id: artist["low-tide-club"] });
    assert.equal(code(error), "GY001", "fourth hype must be refused");
  });

  test("hypes_remaining counts down from three", async () => {
    const { db } = await newUser();
    assert.equal((await db.rpc("hypes_remaining")).data, 3);

    await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    assert.equal((await db.rpc("hypes_remaining")).data, 2);

    await db.rpc("cast_hype", { p_artist_id: artist["marzipan-riot"] });
    assert.equal((await db.rpc("hypes_remaining")).data, 1);
  });

  test("taking a hype back returns it to the allowance", async () => {
    const { db } = await newUser();
    for (const slug of ["dock-leaf", "marzipan-riot", "velvet-ferry"]) {
      await db.rpc("cast_hype", { p_artist_id: artist[slug] });
    }
    assert.equal((await db.rpc("hypes_remaining")).data, 0);

    const { error: back } = await db.rpc("take_back_hype", { p_artist_id: artist["dock-leaf"] });
    assert.equal(back, null);
    assert.equal((await db.rpc("hypes_remaining")).data, 1);

    // and the freed hype is spendable on someone else
    const { error } = await db.rpc("cast_hype", { p_artist_id: artist["low-tide-club"] });
    assert.equal(error, null);
  });

  test("taking back a hype that was never cast is refused", async () => {
    const { db } = await newUser();
    const { error } = await db.rpc("take_back_hype", { p_artist_id: artist["dock-leaf"] });
    assert.equal(code(error), "GY004");
  });

  test("six concurrent casts still only spend three", async () => {
    const { db } = await newUser();
    const slugs = [
      "dock-leaf",
      "marzipan-riot",
      "velvet-ferry",
      "low-tide-club",
      "nans-carpet",
      "ozone-layer-cake",
    ];

    const results = await Promise.all(
      slugs.map((s) => db.rpc("cast_hype", { p_artist_id: artist[s] })),
    );

    const ok = results.filter((r) => r.error === null).length;
    assert.equal(ok, 3, "advisory lock must stop concurrent casts overspending");
    assert.equal((await db.rpc("hypes_remaining")).data, 0);
  });
});

// --------------------------------------------------------- one per artist

describe("one hype per artist per user", () => {
  test("hyping the same artist twice is refused", async () => {
    const { db } = await newUser();
    await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });

    const { error } = await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    assert.equal(code(error), "GY002");
  });

  test("a second hype is still refused at six days", async () => {
    const { id, db } = await newUser();
    await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    await backdate(id, artist["dock-leaf"], 6);

    const { error } = await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    assert.equal(code(error), "GY002", "still inside the 7 day window");
  });

  test("once the window has lapsed the artist can be hyped again", async () => {
    const { id, db } = await newUser();
    await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    await backdate(id, artist["dock-leaf"], 8);

    const { error } = await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    assert.equal(error, null, "past 7 days the hype should be castable again");

    // still exactly one row for the pair
    const { count } = await admin
      .from("hypes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id)
      .eq("artist_id", artist["dock-leaf"]);
    assert.equal(count, 1, "a re-hype refreshes the row, it does not add one");
  });

  test("a lapsed hype does not count against this week's allowance", async () => {
    const { id, db } = await newUser();
    await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    await backdate(id, artist["dock-leaf"], 8);

    assert.equal((await db.rpc("hypes_remaining")).data, 3);
  });
});

// ---------------------------------------------------------- eligibility

describe("only artists with an upcoming live gig can be hyped", () => {
  test("an artist with no gig at all is refused", async () => {
    const { db } = await newUser();
    const { error } = await db.rpc("cast_hype", { p_artist_id: artist["test-no-gig"] });
    assert.equal(code(error), "GY003");
  });

  test("an artist whose only gig is still pending is refused", async () => {
    const { db } = await newUser();
    const { error } = await db.rpc("cast_hype", { p_artist_id: artist["test-pending"] });
    assert.equal(code(error), "GY003", "a pending gig must not open hyping");
  });

  test("hyping closes once the gig has started", async () => {
    const { db } = await newUser();
    const { error } = await db.rpc("cast_hype", { p_artist_id: artist["test-past"] });
    assert.equal(code(error), "GY003");
  });

  test("a refused hype does not consume the allowance", async () => {
    const { db } = await newUser();
    await db.rpc("cast_hype", { p_artist_id: artist["test-no-gig"] });
    assert.equal((await db.rpc("hypes_remaining")).data, 3);
  });
});

// ------------------------------------------------------- scoring + window

describe("scoring and the rolling seven day window", () => {
  test("every hype is worth exactly one point", async () => {
    // The Overheads have 5400 followers in the seed, Kirkdale Static 130.
    // Both must move the chart by exactly 1 per hype.
    const a = await newUser();
    const b = await newUser();

    const beforeBig = await chartCount(artist["the-overheads"]);
    const beforeSmall = await chartCount(artist["kirkdale-static"]);

    await a.db.rpc("cast_hype", { p_artist_id: artist["the-overheads"] });
    await b.db.rpc("cast_hype", { p_artist_id: artist["the-overheads"] });
    await a.db.rpc("cast_hype", { p_artist_id: artist["kirkdale-static"] });

    assert.equal(await chartCount(artist["the-overheads"]), beforeBig + 2);
    assert.equal(await chartCount(artist["kirkdale-static"]), beforeSmall + 1);
  });

  test("a hype stops counting after seven days", async () => {
    const { id, db } = await newUser();
    const base = await chartCount(artist["dock-leaf"]);

    await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    assert.equal(await chartCount(artist["dock-leaf"]), base + 1);

    await backdate(id, artist["dock-leaf"], 8);
    assert.equal(await chartCount(artist["dock-leaf"]), base, "should have aged out");
  });

  test("a hype at six days still counts", async () => {
    const { id, db } = await newUser();
    const base = await chartCount(artist["dock-leaf"]);

    await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    await backdate(id, artist["dock-leaf"], 6);
    assert.equal(await chartCount(artist["dock-leaf"]), base + 1);
  });

  test("the chart holds only artists with an upcoming live gig", async () => {
    const { data } = await admin.from("artist_chart").select("id");
    const ids = new Set((data ?? []).map((r) => r.id));

    assert.ok(ids.has(artist["dock-leaf"]));
    assert.ok(!ids.has(artist["test-no-gig"]), "no gig, no chart place");
    assert.ok(!ids.has(artist["test-pending"]), "pending gig must not chart");
    assert.ok(!ids.has(artist["test-past"]), "gig already started");
  });
});

// ----------------------------------------------------------- week boundary

describe("the Monday reset in Europe/London", () => {
  async function weekStart(at: string): Promise<string> {
    const { data, error } = await admin.rpc("hype_week_start", { p_at: at });
    if (error) throw error;
    return data as unknown as string;
  }

  test("lands on Monday 00:00 local while in GMT", async () => {
    // Sunday 2026-01-18 23:30 GMT -> Monday 2026-01-12 00:00 GMT
    const got = new Date(await weekStart("2026-01-18T23:30:00Z"));
    assert.equal(got.toISOString(), "2026-01-12T00:00:00.000Z");
  });

  test("lands on Monday 00:00 local while in BST, not 01:00", async () => {
    // Clocks go forward 29 Mar 2026, so Monday 30 Mar is BST (UTC+1) and
    // local midnight is 23:00Z the day before. Truncating in UTC would
    // wrongly give 2026-03-30T00:00Z.
    const got = new Date(await weekStart("2026-04-01T12:00:00Z"));
    assert.equal(got.toISOString(), "2026-03-29T23:00:00.000Z");
  });

  test("the instant after the reset belongs to the new week", async () => {
    const before = new Date(await weekStart("2026-04-05T22:59:59Z")); // Sun 23:59 BST
    const after = new Date(await weekStart("2026-04-05T23:00:01Z")); // Mon 00:00 BST
    assert.notEqual(before.toISOString(), after.toISOString());
    assert.equal(after.toISOString(), "2026-04-05T23:00:00.000Z");
  });
});

// ------------------------------------------------------------ direct writes

describe("the table cannot be written around the functions", () => {
  test("an authenticated user cannot insert a hype directly", async () => {
    const { id, db } = await newUser();
    const { error } = await db.from("hypes").insert({ user_id: id, artist_id: artist["dock-leaf"] });
    assert.notEqual(error, null, "direct insert must be refused");
  });

  test("an authenticated user cannot insert a hype as somebody else", async () => {
    const victim = await newUser();
    const attacker = await newUser();

    const { error } = await attacker.db
      .from("hypes")
      .insert({ user_id: victim.id, artist_id: artist["dock-leaf"] });
    assert.notEqual(error, null);
  });

  test("an authenticated user cannot delete another user's hype", async () => {
    const victim = await newUser();
    const attacker = await newUser();
    await victim.db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });

    await attacker.db.from("hypes").delete().eq("user_id", victim.id);

    const { count } = await admin
      .from("hypes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", victim.id);
    assert.equal(count, 1, "the victim's hype must survive");
  });

  test("an authenticated user cannot read another user's hypes", async () => {
    const victim = await newUser();
    const attacker = await newUser();
    await victim.db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });

    const { data } = await attacker.db.from("hypes").select("*");
    assert.equal(data?.length ?? 0, 0, "hypes are readable only by their owner");
  });

  test("take_back_hype only ever removes your own", async () => {
    const victim = await newUser();
    const attacker = await newUser();
    await victim.db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });

    const { error } = await attacker.db.rpc("take_back_hype", {
      p_artist_id: artist["dock-leaf"],
    });
    assert.equal(code(error), "GY004", "nothing of the attacker's to take back");

    const { count } = await admin
      .from("hypes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", victim.id);
    assert.equal(count, 1);
  });
});

// ------------------------------------------------------- chart movement

describe("the up and down arrows", () => {
  async function chartRow(artistId: string) {
    const { data } = await admin
      .from("artist_chart")
      .select("hype_count, position, position_yesterday, is_new")
      .eq("id", artistId)
      .maybeSingle();
    return data;
  }

  test("the live count is 7 days even though the view scans 8", async () => {
    // The view reaches back 8 days so yesterday's ranking can come off the same
    // scan. If the live count is not filtered back to 7 it silently becomes an
    // 8 day count, which nothing else would catch.
    const { id, db } = await newUser();
    const before = (await chartRow(artist["dock-leaf"]))!.hype_count;

    await db.rpc("cast_hype", { p_artist_id: artist["dock-leaf"] });
    await backdate(id, artist["dock-leaf"], 7.5);

    const after = (await chartRow(artist["dock-leaf"]))!;
    assert.equal(after.hype_count, before, "a 7.5 day old hype must not count now");

    const { count } = await admin
      .from("hypes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id);
    assert.equal(count, 1, "the row is still there, it just stopped counting");
  });

  test("an artist with no earlier hypes is marked new", async () => {
    const row = await chartRow(artist["test-fresh"]);
    assert.equal(row?.hype_count, 0);
    assert.equal(row?.is_new, true);
  });

  test("a hype cast today does not make an artist look established", async () => {
    const { db } = await newUser();
    await db.rpc("cast_hype", { p_artist_id: artist["test-fresh"] });

    const row = await chartRow(artist["test-fresh"]);
    assert.equal(row?.hype_count, 1);
    assert.equal(row?.is_new, true, "yesterday's window is still empty");
  });

  test("once a hype is older than a day the artist is no longer new", async () => {
    const { id, db } = await newUser();
    await db.rpc("cast_hype", { p_artist_id: artist["test-fresh"] });
    await backdate(id, artist["test-fresh"], 3);

    const row = await chartRow(artist["test-fresh"]);
    assert.equal(row?.is_new, false);
  });

  test("gaining hypes moves an artist up relative to yesterday", async () => {
    // Park three hypes on the fresh artist at 3 days old, so they sit in both
    // windows, then add more that only count now.
    for (let i = 0; i < 3; i++) {
      const { id, db } = await newUser();
      await db.rpc("cast_hype", { p_artist_id: artist["test-fresh"] });
      await backdate(id, artist["test-fresh"], 3);
    }
    const settled = (await chartRow(artist["test-fresh"]))!;

    for (let i = 0; i < 12; i++) {
      const { db } = await newUser();
      await db.rpc("cast_hype", { p_artist_id: artist["test-fresh"] });
    }
    const climbed = (await chartRow(artist["test-fresh"]))!;

    assert.ok(
      climbed.position! < settled.position!,
      "more hypes should mean a better position",
    );
    assert.ok(
      climbed.position! < climbed.position_yesterday!,
      "and it should read as a climb against yesterday",
    );
  });
});
