/**
 * Importing gigs from a feed.
 *
 * The rule that matters most here is dedupe: an importer runs on a schedule,
 * so anything that creates a second copy on the second run fills the listings
 * with duplicates.
 *
 * A listing is a show: it always has a title and only sometimes names its
 * artists. Artists are made only when the feed names them, never guessed.
 */
import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const status = JSON.parse(
  execFileSync("sh", ["scripts/supabase.sh", "status", "-o", "json"], {
    encoding: "utf8",
    cwd: new URL("..", import.meta.url).pathname,
  }),
) as Record<string, string>;

const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SOURCE = "test-feed";
const DOMAIN = "import.gigly.test";
const createdUsers: string[] = [];
let seq = 0;

async function newUser(): Promise<{ id: string; db: SupabaseClient }> {
  const email = `imp-${Date.now()}-${seq++}@${DOMAIN}`;
  const password = "import-test-password";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  createdUsers.push(data.user!.id);

  const db = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user!.id, db };
}

const soon = (days: number) => new Date(Date.now() + days * 864e5).toISOString();

type Outcome = { gig_id: string; gig_slug: string; outcome: string };

async function importGig(over: Record<string, unknown> = {}) {
  const res = await admin.rpc("import_gig", {
    p_source: SOURCE,
    p_source_ref: `ref-${seq++}`,
    p_title: `Imported Show ${seq}`,
    p_artist_name: `Imported Band ${seq}`,
    p_venue_slug: "future-yard",
    p_starts_at: soon(12),
    p_price_pence: 900,
    ...over,
  });
  return { row: (res.data as unknown as Outcome[])?.[0] ?? null, error: res.error };
}

after(async () => {
  await admin.from("gigs").delete().eq("source", SOURCE);
  await admin.from("artists").delete().like("name", "Imported Band %");
  await admin.from("artists").delete().like("name", "Feed Support %");
  await admin.from("artists").delete().eq("name", "Shared Headliner");
  await admin.from("artists").delete().like("name", "Named Later %");
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
});

describe("importing a gig", () => {
  test("from an untrusted feed, it waits for review", async () => {
    const { row, error } = await importGig();
    assert.equal(error, null);
    assert.equal(row?.outcome, "created");

    const { data } = await admin
      .from("gigs")
      .select("status, source, source_ref, imported_at, submitted_by")
      .eq("id", row!.gig_id)
      .single();

    assert.equal(data?.status, "pending", "a feed not marked trusted is no more trusted than a person");
    assert.equal(data?.source, SOURCE);
    assert.notEqual(data?.imported_at, null);
    assert.equal(data?.submitted_by, null, "nobody submitted it");
  });

  test("a pending show cannot be hyped or charted", async () => {
    const { row } = await importGig();
    const { data: hypeable } = await admin.rpc("gig_is_hypeable", { p_gig_id: row!.gig_id });
    assert.equal(hypeable, false);
    const { data: charted } = await admin.from("gig_chart").select("id").eq("id", row!.gig_id).maybeSingle();
    assert.equal(charted, null);
  });

  test("from a trusted feed, it goes live straight away, with its moment", async () => {
    const { row } = await importGig({ p_live: true });
    const { data } = await admin.from("gigs").select("status").eq("id", row!.gig_id).single();
    assert.equal(data?.status, "live");
    const { data: moment } = await admin.from("gig_moments").select("gig_id").eq("gig_id", row!.gig_id);
    assert.equal(moment?.length, 1);
  });

  test("the listing's title is the show's name", async () => {
    const { row } = await importGig({ p_title: "Imported Show: Album Launch" });
    const { data } = await admin.from("gigs").select("title").eq("id", row!.gig_id).single();
    assert.equal(data?.title, "Imported Show: Album Launch");
  });

  test("a listing that names nobody makes no artist", async () => {
    const title = `Imported Show Nobody ${Date.now()}`;
    const { row, error } = await importGig({ p_title: title, p_artist_name: null, p_support: ["Feed Support Ignored"] });
    assert.equal(error, null);

    const { data: lineup } = await admin.from("gig_artists").select("artist_id").eq("gig_id", row!.gig_id);
    assert.deepEqual(lineup, [], "no guessed headliner, and no support without one");
    const { count } = await admin.from("artists").select("*", { count: "exact", head: true }).eq("name", title);
    assert.equal(count, 0, "the title is never turned into an artist");
  });

  test("support acts are added behind the headliner", async () => {
    const { row } = await importGig({
      p_artist_name: "Imported Band Headliner",
      p_support: ["Feed Support One", "Feed Support Two"],
    });

    const { data: lineup } = await admin
      .from("gig_artists")
      .select("position, artists!inner(name)")
      .eq("gig_id", row!.gig_id)
      .order("position");

    assert.equal(lineup?.length, 3);
    assert.equal(lineup![0].position, 0);
    assert.equal((lineup![0].artists as unknown as { name: string }).name, "Imported Band Headliner");
    assert.deepEqual(
      lineup!.slice(1).map((l) => l.position),
      [1, 2],
    );
  });

  test("an artist that already has a page is reused, not forked", async () => {
    // Dock Leaf is in the seed
    await importGig({ p_artist_name: "dock leaf" });

    const { count } = await admin
      .from("artists")
      .select("*", { count: "exact", head: true })
      .ilike("name", "dock leaf");
    assert.equal(count, 1);
  });
});

describe("running the same import twice", () => {
  test("a later run that names the headliner links them", async () => {
    const ref = `named-${Date.now()}`;
    const first = await importGig({ p_source_ref: ref, p_artist_name: null });
    await importGig({ p_source_ref: ref, p_artist_name: `Named Later ${Date.now()}` });
    const { data } = await admin.from("gig_artists").select("position").eq("gig_id", first.row!.gig_id);
    assert.deepEqual(data, [{ position: 0 }]);
  });

  test("a trusted re-run publishes a pending show, but never a rejected one", async () => {
    const [pendingRef, rejectedRef] = [`pend-${Date.now()}`, `rej-${Date.now()}`];
    const pending = await importGig({ p_source_ref: pendingRef });
    const rejected = await importGig({ p_source_ref: rejectedRef });
    await admin.from("gigs").update({ status: "rejected" }).eq("id", rejected.row!.gig_id);

    await importGig({ p_source_ref: pendingRef, p_live: true });
    await importGig({ p_source_ref: rejectedRef, p_live: true });

    const { data } = await admin.from("gigs").select("id, status").in("id", [pending.row!.gig_id, rejected.row!.gig_id]);
    const statusOf = (id: string) => data?.find((g) => g.id === id)?.status;
    assert.equal(statusOf(pending.row!.gig_id), "live");
    assert.equal(statusOf(rejected.row!.gig_id), "rejected", "a person's no stands");
  });

  test("updates the gig rather than duplicating it", async () => {
    const ref = `stable-${Date.now()}`;
    const first = await importGig({ p_source_ref: ref, p_artist_name: "Imported Band Stable" });
    assert.equal(first.row?.outcome, "created");

    const second = await importGig({
      p_source_ref: ref,
      p_artist_name: "Imported Band Stable",
      p_starts_at: soon(13),
      p_price_pence: 1200,
    });
    assert.equal(second.row?.outcome, "updated");
    assert.equal(second.row?.gig_id, first.row?.gig_id, "same row");

    const { count } = await admin
      .from("gigs")
      .select("*", { count: "exact", head: true })
      .eq("source", SOURCE)
      .eq("source_ref", ref);
    assert.equal(count, 1);
  });

  test("a changed time and price are carried across", async () => {
    const ref = `moving-${Date.now()}`;
    await importGig({ p_source_ref: ref, p_artist_name: "Imported Band Moving" });
    await importGig({
      p_source_ref: ref,
      p_artist_name: "Imported Band Moving",
      p_starts_at: soon(20),
      p_price_pence: 1500,
    });

    const { data } = await admin
      .from("gigs")
      .select("price_pence")
      .eq("source", SOURCE)
      .eq("source_ref", ref)
      .single();
    assert.equal(data?.price_pence, 1500, "the feed is the authority on its own gig");
  });
});

describe("a gig already here from somewhere else", () => {
  test("is recognised rather than added twice", async () => {
    const when = soon(15);

    const first = await importGig({
      p_source_ref: `a-${Date.now()}`,
      p_artist_name: "Shared Headliner",
      p_starts_at: when,
    });
    assert.equal(first.row?.outcome, "created");

    // same venue, same artist, a different feed and a different id
    const second = await importGig({
      p_source_ref: `b-${Date.now()}`,
      p_artist_name: "Shared Headliner",
      p_starts_at: when,
    });
    assert.equal(second.row?.outcome, "duplicate");
    assert.equal(second.row?.gig_id, first.row?.gig_id);
  });

  test("an hour's difference in the listed time is still the same night", async () => {
    const base = Date.now() + 18 * 864e5;

    await importGig({
      p_source_ref: `t1-${Date.now()}`,
      p_artist_name: "Shared Headliner",
      p_starts_at: new Date(base).toISOString(),
    });
    const second = await importGig({
      p_source_ref: `t2-${Date.now()}`,
      p_artist_name: "Shared Headliner",
      p_starts_at: new Date(base + 60 * 60_000).toISOString(),
    });

    assert.equal(second.row?.outcome, "duplicate", "doors listed an hour apart is one gig");
  });

  test("a show that names nobody is recognised by its title", async () => {
    const when = soon(22);
    const title = `Imported Show Club Night ${Date.now()}`;
    const first = await importGig({ p_source_ref: `c1-${Date.now()}`, p_title: title, p_artist_name: null, p_starts_at: when });
    const second = await importGig({ p_source_ref: `c2-${Date.now()}`, p_title: title.toUpperCase(), p_artist_name: null, p_starts_at: when });
    assert.equal(second.row?.outcome, "duplicate");
    assert.equal(second.row?.gig_id, first.row?.gig_id);
  });

  test("but a different night is a different gig", async () => {
    const result = await importGig({
      p_source_ref: `far-${Date.now()}`,
      p_artist_name: "Shared Headliner",
      p_starts_at: soon(40),
    });
    assert.equal(result.row?.outcome, "created");
  });
});

describe("what an import is not allowed to do", () => {
  test("claim to be a human submission", async () => {
    const { error } = await importGig({ p_source: "submission" });
    assert.equal(error?.code, "GY020");
  });

  test("invent a venue", async () => {
    const { error } = await importGig({ p_venue_slug: "not-a-real-venue" });
    assert.equal(error?.code, "GY021");
  });

  test("arrive with no title", async () => {
    const { error } = await importGig({ p_title: "  " });
    assert.equal(error?.code, "GY020");
  });

  test("be called by a signed-in user", async () => {
    const { db } = await newUser();
    const { error } = await db.rpc("import_gig", {
      p_source: "sneaky",
      p_source_ref: "1",
      p_title: "Back Door",
      p_venue_slug: "future-yard",
      p_starts_at: soon(5),
    });
    assert.notEqual(error, null, "only the service role imports");
  });

  test("be called by an anonymous visitor", async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.rpc("import_gig", {
      p_source: "sneaky",
      p_source_ref: "2",
      p_title: "Back Door",
      p_venue_slug: "future-yard",
      p_starts_at: soon(5),
    });
    assert.notEqual(error, null);
  });
});
