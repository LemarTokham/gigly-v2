/**
 * Gig submission and approval.
 *
 * The rule that matters: nothing a stranger submits can reach the chart before
 * a human approves it. That is enforced by artist_is_hypeable requiring a live
 * gig, and by the approval path being admin-only.
 */
import { test, describe, before, after } from "node:test";
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

const DOMAIN = "submit.gigly.test";
const created: string[] = [];
let seq = 0;

async function newUser(isAdmin = false): Promise<{ id: string; db: SupabaseClient }> {
  const email = `sub-${Date.now()}-${seq++}@${DOMAIN}`;
  const password = "submit-test-password";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  created.push(data.user!.id);

  if (isAdmin) {
    await admin.from("profiles").update({ is_admin: true }).eq("id", data.user!.id);
  }

  const db = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return { id: data.user!.id, db };
}

let venueId: string;
const madeGigs: string[] = [];
const madeArtists: string[] = [];

/** A submission that should succeed, with sensible defaults. */
async function submit(
  db: SupabaseClient,
  over: Partial<{
    p_artist_name: string;
    p_venue_id: string;
    p_starts_at: string;
    p_price_pence: number;
    p_ticket_url: string;
    p_submitted_as: string;
  }> = {},
) {
  const res = await db.rpc("submit_gig", {
    p_artist_name: `Test Band ${seq++}`,
    p_venue_id: venueId,
    p_starts_at: new Date(Date.now() + 9 * 864e5).toISOString(),
    p_price_pence: 700,
    p_submitted_as: "artist",
    ...over,
  });
  const gig = res.data as unknown as { id: string; slug: string; status: string } | null;
  if (gig) madeGigs.push(gig.id);
  return { gig, error: res.error };
}

before(async () => {
  const { data } = await admin.from("venues").select("id").limit(1).single();
  venueId = data!.id;
});

after(async () => {
  if (madeGigs.length) await admin.from("gigs").delete().in("id", madeGigs);
  await admin.from("artists").delete().like("name", "Test Band %");
  await admin.from("artists").delete().in("id", madeArtists);
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

describe("submitting a gig", () => {
  test("creates a pending gig with the artist attached", async () => {
    const { db } = await newUser();
    const { gig, error } = await submit(db);

    assert.equal(error, null);
    assert.equal(gig?.status, "pending", "a submission is never live on arrival");

    const { data: lineup } = await admin
      .from("gig_artists")
      .select("position, artist_id")
      .eq("gig_id", gig!.id);
    assert.equal(lineup?.length, 1);
    assert.equal(lineup![0].position, 0, "the submitted artist is the headliner");
  });

  test("a brand new artist is created but cannot be hyped yet", async () => {
    const { db } = await newUser();
    const { gig } = await submit(db, { p_artist_name: "Completely Unknown Quantity" });

    const { data: lineup } = await admin
      .from("gig_artists")
      .select("artist_id")
      .eq("gig_id", gig!.id)
      .single();
    madeArtists.push(lineup!.artist_id);

    const { data: hypeable } = await admin.rpc("artist_is_hypeable", {
      p_artist_id: lineup!.artist_id,
    });
    assert.equal(hypeable, false, "a pending gig must not open hyping");

    const { data: onChart } = await admin
      .from("artist_chart")
      .select("id")
      .eq("id", lineup!.artist_id)
      .maybeSingle();
    assert.equal(onChart, null, "and must not appear on the chart");
  });

  test("an existing artist is matched, not duplicated", async () => {
    const { db } = await newUser();
    // differs only by case from the seeded artist
    await submit(db, { p_artist_name: "dOcK lEaF" });

    const { count } = await admin
      .from("artists")
      .select("*", { count: "exact", head: true })
      .ilike("name", "dock leaf");
    assert.equal(count, 1, "capitalisation must not create a second page");
  });

  test("the submitter sees their pending gig, nobody else does", async () => {
    const mine = await newUser();
    const stranger = await newUser();
    const { gig } = await submit(mine.db);

    const { data: seen } = await mine.db.from("gigs").select("id").eq("id", gig!.id);
    assert.equal(seen?.length, 1);

    const { data: hidden } = await stranger.db.from("gigs").select("id").eq("id", gig!.id);
    assert.equal(hidden?.length ?? 0, 0);
  });
});

describe("what a submission is not allowed to be", () => {
  test("a date in the past", async () => {
    const { db } = await newUser();
    const { error } = await submit(db, {
      p_starts_at: new Date(Date.now() - 864e5).toISOString(),
    });
    assert.equal(error?.code, "GY011");
  });

  test("a date more than a year out", async () => {
    const { db } = await newUser();
    const { error } = await submit(db, {
      p_starts_at: new Date(Date.now() + 400 * 864e5).toISOString(),
    });
    assert.equal(error?.code, "GY011");
  });

  test("a blank artist name", async () => {
    const { db } = await newUser();
    const { error } = await submit(db, { p_artist_name: "   " });
    assert.equal(error?.code, "GY011");
  });

  test("a negative price", async () => {
    const { db } = await newUser();
    const { error } = await submit(db, { p_price_pence: -100 });
    assert.equal(error?.code, "GY011");
  });

  test("a made-up venue", async () => {
    const { db } = await newUser();
    const { error } = await submit(db, {
      p_venue_id: "00000000-0000-0000-0000-000000000001",
    });
    assert.equal(error?.code, "GY011");
  });

  test("a fan submitting somebody else's gig with no link to check", async () => {
    const { db } = await newUser();
    const { error } = await submit(db, { p_submitted_as: "fan" });
    assert.equal(error?.code, "GY011");

    const withLink = await submit(db, {
      p_submitted_as: "fan",
      p_ticket_url: "https://example.com/gig",
    });
    assert.equal(withLink.error, null, "with a link it goes through");
  });

  test("an eleventh gig while ten are still waiting", async () => {
    const { db } = await newUser();
    for (let i = 0; i < 10; i++) {
      const { error } = await submit(db);
      assert.equal(error, null, `submission ${i + 1} should have been accepted`);
    }
    const { error } = await submit(db);
    assert.equal(error?.code, "GY012");
  });

  test("signed out entirely", async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon.rpc("submit_gig", {
      p_artist_name: "Nobody",
      p_venue_id: venueId,
      p_starts_at: new Date(Date.now() + 864e5).toISOString(),
      p_price_pence: 0,
    });
    assert.notEqual(error, null);
  });
});

describe("going around the submission function", () => {
  test("a user cannot insert a gig that is already live", async () => {
    const { id, db } = await newUser();
    const { error } = await db.from("gigs").insert({
      slug: `sneaky-live-${Date.now()}`,
      venue_id: venueId,
      starts_at: new Date(Date.now() + 864e5).toISOString(),
      status: "live",
      submitted_by: id,
    });
    assert.notEqual(error, null, "self-approval must be refused");
  });

  test("a user cannot submit under somebody else's name", async () => {
    const victim = await newUser();
    const attacker = await newUser();
    const { error } = await attacker.db.from("gigs").insert({
      slug: `impersonated-${Date.now()}`,
      venue_id: venueId,
      starts_at: new Date(Date.now() + 864e5).toISOString(),
      status: "pending",
      submitted_by: victim.id,
    });
    assert.notEqual(error, null);
  });

  test("a submitter cannot approve their own gig", async () => {
    const { db } = await newUser();
    const { gig } = await submit(db);

    await db.from("gigs").update({ status: "live" }).eq("id", gig!.id);

    const { data } = await admin.from("gigs").select("status").eq("id", gig!.id).single();
    assert.equal(data?.status, "pending", "still pending");
  });

  test("a user cannot write artists directly", async () => {
    const { db } = await newUser();
    const { error } = await db
      .from("artists")
      .insert({ name: "Back Door Band", slug: "back-door-band", genre: "x", genre_group: "Indie" });
    assert.notEqual(error, null);
  });
});

describe("approving", () => {
  test("an admin can approve, and only then can the artist be hyped", async () => {
    const submitter = await newUser();
    const boss = await newUser(true);
    const { gig } = await submit(submitter.db, { p_artist_name: "Approval Test Band" });

    const { data: lineup } = await admin
      .from("gig_artists")
      .select("artist_id")
      .eq("gig_id", gig!.id)
      .single();
    madeArtists.push(lineup!.artist_id);

    const before = await admin.rpc("artist_is_hypeable", { p_artist_id: lineup!.artist_id });
    assert.equal(before.data, false);

    const { data: updated, error } = await boss.db
      .from("gigs")
      .update({ status: "live" })
      .eq("id", gig!.id)
      .select("id, status");
    assert.equal(error, null);
    assert.equal(updated?.length, 1, "the admin's update must actually match a row");
    assert.equal(updated![0].status, "live");

    const after = await admin.rpc("artist_is_hypeable", { p_artist_id: lineup!.artist_id });
    assert.equal(after.data, true, "approval is what opens hyping");
  });

  test("a rejected gig stays hidden and its artist stays off the chart", async () => {
    const submitter = await newUser();
    const boss = await newUser(true);
    const { gig } = await submit(submitter.db, { p_artist_name: "Rejected Test Band" });

    const { data: lineup } = await admin
      .from("gig_artists")
      .select("artist_id")
      .eq("gig_id", gig!.id)
      .single();
    madeArtists.push(lineup!.artist_id);

    await boss.db.from("gigs").update({ status: "rejected" }).eq("id", gig!.id);

    const stranger = await newUser();
    const { data: seen } = await stranger.db.from("gigs").select("id").eq("id", gig!.id);
    assert.equal(seen?.length ?? 0, 0);

    const { data: hypeable } = await admin.rpc("artist_is_hypeable", {
      p_artist_id: lineup!.artist_id,
    });
    assert.equal(hypeable, false);
  });

  test("an admin sees the whole queue", async () => {
    const a = await newUser();
    const b = await newUser();
    await submit(a.db);
    await submit(b.db);

    const boss = await newUser(true);
    const { data } = await boss.db.from("gigs").select("id").eq("status", "pending");
    assert.ok((data?.length ?? 0) >= 2, "the queue must not be filtered to the admin's own");
  });
});
