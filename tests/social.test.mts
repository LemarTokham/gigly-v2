/**
 * Follow and "I'm going". Both are plain tables rather than going through a
 * function, so RLS is the only thing standing between a user and somebody
 * else's rows. That is what these check.
 */
import { test, describe, before, after, beforeEach } from "node:test";
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

/** Per-file domain: the two test files must not delete each other's users. */
const DOMAIN = "social.gigly.test";

const created: string[] = [];
let seq = 0;
async function newUser(): Promise<{ id: string; db: SupabaseClient }> {
  const email = `social-${Date.now()}-${seq++}@${DOMAIN}`;
  const password = "social-test-password";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;

  const db = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await db.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  created.push(data.user!.id);
  return { id: data.user!.id, db };
}

let artistA: string;
let artistB: string;
let gigA: string;

before(async () => {
  const { data: artists } = await admin.from("artists").select("id").limit(2);
  artistA = artists![0].id;
  artistB = artists![1].id;
  const { data: gigs } = await admin.from("gigs").select("id").eq("status", "live").limit(1);
  gigA = gigs![0].id;
});

after(async () => {
  for (const id of created) await admin.auth.admin.deleteUser(id);
});

beforeEach(async () => {
  // only this file's users, so a parallel test file is left alone
  if (created.length) {
    await admin.from("follows").delete().in("user_id", created);
    await admin.from("attending").delete().in("user_id", created);
  }
});

describe("following an artist", () => {
  test("a user can follow and unfollow", async () => {
    const { id, db } = await newUser();

    const { error: insErr } = await db.from("follows").insert({ user_id: id, artist_id: artistA });
    assert.equal(insErr, null);

    const { data: mine } = await db.from("follows").select("artist_id");
    assert.deepEqual(mine?.map((r) => r.artist_id), [artistA]);

    await db.from("follows").delete().eq("artist_id", artistA);
    const { count } = await admin
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id);
    assert.equal(count, 0);
  });

  test("following twice is refused by the primary key", async () => {
    const { id, db } = await newUser();
    await db.from("follows").insert({ user_id: id, artist_id: artistA });

    const { error } = await db.from("follows").insert({ user_id: id, artist_id: artistA });
    assert.notEqual(error, null, "a duplicate follow must not create a second row");
  });

  test("a user cannot follow on somebody else's behalf", async () => {
    const victim = await newUser();
    const attacker = await newUser();

    const { error } = await attacker.db
      .from("follows")
      .insert({ user_id: victim.id, artist_id: artistA });
    assert.notEqual(error, null);
  });

  test("a user cannot see who else follows an artist", async () => {
    const victim = await newUser();
    const attacker = await newUser();
    await victim.db.from("follows").insert({ user_id: victim.id, artist_id: artistA });

    const { data } = await attacker.db.from("follows").select("*");
    assert.equal(data?.length ?? 0, 0, "follows are readable only by their owner");
  });

  test("a user cannot unfollow for somebody else", async () => {
    const victim = await newUser();
    const attacker = await newUser();
    await victim.db.from("follows").insert({ user_id: victim.id, artist_id: artistA });

    await attacker.db.from("follows").delete().eq("user_id", victim.id);

    const { count } = await admin
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("user_id", victim.id);
    assert.equal(count, 1, "the victim's follow must survive");
  });

  test("follower counts are public but the followers are not", async () => {
    const a = await newUser();
    const b = await newUser();
    await a.db.from("follows").insert({ user_id: a.id, artist_id: artistA });
    await b.db.from("follows").insert({ user_id: b.id, artist_id: artistA });

    // a third party sees the count
    const stranger = await newUser();
    const { data: stats } = await stranger.db
      .from("artist_stats")
      .select("follower_count")
      .eq("artist_id", artistA)
      .single();
    assert.equal(stats?.follower_count, 2);

    // but not who they are
    const { data: rows } = await stranger.db.from("follows").select("user_id");
    assert.equal(rows?.length ?? 0, 0);
  });

  test("counts are per artist, not global", async () => {
    const a = await newUser();
    await a.db.from("follows").insert({ user_id: a.id, artist_id: artistA });

    const { data } = await admin
      .from("artist_stats")
      .select("follower_count")
      .eq("artist_id", artistB)
      .single();
    assert.equal(data?.follower_count, 0);
  });
});

describe("going to a gig", () => {
  test("a user can mark going and change their mind", async () => {
    const { id, db } = await newUser();

    const { error } = await db.from("attending").insert({ user_id: id, gig_id: gigA });
    assert.equal(error, null);

    const { data: mine } = await db.from("attending").select("gig_id");
    assert.deepEqual(mine?.map((r) => r.gig_id), [gigA]);

    await db.from("attending").delete().eq("gig_id", gigA);
    const { count } = await admin
      .from("attending")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id);
    assert.equal(count, 0);
  });

  test("a user cannot mark somebody else as going", async () => {
    const victim = await newUser();
    const attacker = await newUser();

    const { error } = await attacker.db
      .from("attending")
      .insert({ user_id: victim.id, gig_id: gigA });
    assert.notEqual(error, null);
  });

  test("a user cannot see who else is going", async () => {
    const victim = await newUser();
    const attacker = await newUser();
    await victim.db.from("attending").insert({ user_id: victim.id, gig_id: gigA });

    const { data } = await attacker.db.from("attending").select("*");
    assert.equal(data?.length ?? 0, 0);
  });

  test("attending counts are public, the attendees are not", async () => {
    const a = await newUser();
    await a.db.from("attending").insert({ user_id: a.id, gig_id: gigA });

    const stranger = await newUser();
    const { data } = await stranger.db
      .from("gig_stats")
      .select("attending_count")
      .eq("gig_id", gigA)
      .single();
    assert.equal(data?.attending_count, 1);
  });
});

describe("signed-out visitors", () => {
  test("cannot follow", async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await anon
      .from("follows")
      .insert({ user_id: "00000000-0000-0000-0000-000000000001", artist_id: artistA });
    assert.notEqual(error, null);
  });

  test("can still read the listings", async () => {
    const anon = createClient(status.API_URL, status.ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.from("artists").select("id").limit(1);
    assert.equal(error, null);
    assert.equal(data?.length, 1, "listings must work signed out");
  });

  test("cannot promote themselves to admin", async () => {
    const { id, db } = await newUser();
    await db.from("profiles").update({ is_admin: true }).eq("id", id);

    const { data } = await admin.from("profiles").select("is_admin").eq("id", id).single();
    assert.equal(data?.is_admin, false, "is_admin must not be writable by its owner");
  });
});
