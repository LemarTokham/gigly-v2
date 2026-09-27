/**
 * Stubs and the gig moment.
 *
 * The posting window is the rule most likely to fail silently: get it wrong
 * and stubs either never post or post whenever, and nothing errors. So its
 * edges are tested exactly, by setting doors and the moment directly.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  admin, anon, code, fixtures, going, makeFriends, minutesAgo, minutesFromNow,
  openWindow, paths, postStub, setMoment,
} from "./support.mts";

const f = fixtures("stubs");

/** Someone going to a gig whose window is open. */
async function readyToPost() {
  const me = await f.user();
  const gig = await f.gig();
  await going(me, gig);
  await openWindow(gig);
  return { me, gig };
}

describe("the gig moment", () => {
  test("is picked when a gig goes live, between doors +60 and +150 minutes", async () => {
    const gig = await f.gig({ doorsMinutesAgo: -600 });
    const [{ data: m }, { data: g }] = await Promise.all([
      admin.from("gig_moments").select("fires_at").eq("gig_id", gig).single(),
      admin.from("gigs").select("starts_at").eq("id", gig).single(),
    ]);
    const after = (Date.parse(m!.fires_at) - Date.parse(g!.starts_at)) / 60_000;
    assert.ok(after >= 60 && after <= 150, `moment ${after} minutes after doors`);
  });

  test("a pending gig has no moment until it is approved", async () => {
    const gig = await f.gig({ status: "pending", doorsMinutesAgo: -600 });
    assert.equal((await admin.from("gig_moments").select("gig_id").eq("gig_id", gig)).data?.length, 0);
    await admin.from("gigs").update({ status: "live" }).eq("id", gig);
    assert.equal((await admin.from("gig_moments").select("gig_id").eq("gig_id", gig)).data?.length, 1);
  });

  test("re-saving the same time does not re-roll it (the importer does this)", async () => {
    const gig = await f.gig({ doorsMinutesAgo: -600 });
    const before = (await admin.from("gig_moments").select("fires_at").eq("gig_id", gig).single()).data!.fires_at;
    const { data: g } = await admin.from("gigs").select("starts_at").eq("id", gig).single();
    for (let i = 0; i < 5; i++) await admin.from("gigs").update({ starts_at: g!.starts_at }).eq("id", gig);
    const afterSave = (await admin.from("gig_moments").select("fires_at").eq("gig_id", gig).single()).data!.fires_at;
    assert.equal(afterSave, before);
  });

  test("moving the gig moves the moment, unless it has already fired", async () => {
    const gig = await f.gig({ doorsMinutesAgo: -600 });
    await admin.from("gigs").update({ starts_at: minutesFromNow(24 * 60) }).eq("id", gig);
    const moved = (await admin.from("gig_moments").select("fires_at").eq("gig_id", gig).single()).data!.fires_at;
    assert.ok(Date.parse(moved) > Date.now() + 24 * 3600_000, "moment follows the new time");

    await admin.from("gig_moments").update({ notified_at: new Date().toISOString() }).eq("gig_id", gig);
    await admin.from("gigs").update({ starts_at: minutesFromNow(48 * 60) }).eq("id", gig);
    const fired = (await admin.from("gig_moments").select("fires_at").eq("gig_id", gig).single()).data!.fires_at;
    assert.equal(fired, moved, "a moment that has fired is history");
  });

  test("a gig taken down loses its unfired moment", async () => {
    const gig = await f.gig({ doorsMinutesAgo: -600 });
    await admin.from("gigs").update({ status: "rejected" }).eq("id", gig);
    assert.equal((await admin.from("gig_moments").select("gig_id").eq("gig_id", gig)).data?.length, 0);
  });

  test("nobody can read the moment until it fires", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await setMoment(gig, minutesFromNow(10));
    for (const db of [anon(), me.db]) {
      assert.deepEqual((await db.from("gig_moments").select("fires_at").eq("gig_id", gig)).data, []);
    }
    await setMoment(gig, minutesAgo(1));
    assert.equal((await anon().from("gig_moments").select("fires_at").eq("gig_id", gig)).data?.length, 1);
  });

  test("nobody can move a moment", async () => {
    const me = await f.user();
    const gig = await f.gig();
    const { error } = await me.db.from("gig_moments").update({ fires_at: minutesAgo(1) }).eq("gig_id", gig);
    assert.equal(code(error), "42501");
  });
});

describe("the posting window", () => {
  test("is shut before the moment", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await going(me, gig);
    await setMoment(gig, minutesFromNow(5));
    assert.equal(code((await postStub(me, gig)).error), "42501");
  });

  test("opens at the moment", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await going(me, gig);
    await setMoment(gig, new Date(Date.now() - 2000).toISOString());
    assert.equal((await postStub(me, gig)).error, null);
  });

  test("is still open just before doors +6 hours", async () => {
    const me = await f.user();
    const gig = await f.gig({ doorsMinutesAgo: 6 * 60 - 1 });
    await going(me, gig);
    await setMoment(gig, minutesAgo(200));
    assert.equal((await postStub(me, gig)).error, null);
  });

  test("closes at doors +6 hours", async () => {
    const me = await f.user();
    const gig = await f.gig({ doorsMinutesAgo: 6 * 60 + 1 });
    await going(me, gig);
    await setMoment(gig, minutesAgo(200));
    assert.equal(code((await postStub(me, gig)).error), "42501");
  });

  test("can_post_stub tells the app whether to show the camera", async () => {
    const { me, gig } = await readyToPost();
    assert.equal((await me.db.rpc("can_post_stub", { p_gig_id: gig })).data, true);
    await postStub(me, gig);
    assert.equal((await me.db.rpc("can_post_stub", { p_gig_id: gig })).data, false, "already posted");
  });
});

describe("posting a stub", () => {
  test("needs you to be going", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await openWindow(gig);
    assert.equal(code((await postStub(me, gig)).error), "42501");
  });

  test("tapping I'm going during the gig is enough", async () => {
    const me = await f.user();
    const gig = await f.gig();
    await openWindow(gig);
    await going(me, gig);
    assert.equal((await postStub(me, gig)).error, null);
  });

  test("needs a username", async () => {
    const me = await f.user({ username: false });
    const gig = await f.gig();
    await going(me, gig);
    await openWindow(gig);
    assert.equal(code((await postStub(me, gig)).error), "42501");
  });

  test("one per person per gig", async () => {
    const { me, gig } = await readyToPost();
    assert.equal((await postStub(me, gig)).error, null);
    assert.ok((await postStub(me, gig)).error, "second stub refused");
  });

  test("only as yourself", async () => {
    const { me, gig } = await readyToPost();
    const other = await f.user();
    await going(other, gig);
    const forged = await me.db
      .from("stubs")
      .insert({ user_id: other.id, gig_id: gig, people: 0, audience: "wall", ...paths(other.id, gig) });
    assert.equal(code(forged.error), "42501");
  });

  test("only with photos from your own folder for that gig", async () => {
    const { me, gig } = await readyToPost();
    const victim = await f.user();
    const stolen = await me.db
      .from("stubs")
      .insert({ user_id: me.id, gig_id: gig, people: 0, audience: "wall", ...paths(victim.id, gig) });
    assert.ok(stolen.error, "someone else's photo paths are refused");

    const escape = await me.db.from("stubs").insert({
      user_id: me.id, gig_id: gig, people: 0, audience: "wall",
      back_path: `${me.id}/${gig}/../x.jpg`, front_path: `${me.id}/${gig}/f.jpg`, thumb_path: `${me.id}/${gig}/t.jpg`,
    });
    assert.ok(escape.error, "a path that climbs out of the folder is refused");
  });

  test("the posting time is the server's, not the phone's", async () => {
    const { me, gig } = await readyToPost();
    const { error } = await me.db.from("stubs").insert({
      user_id: me.id, gig_id: gig, people: 0, audience: "wall", ...paths(me.id, gig),
      created_at: minutesAgo(600),
    });
    assert.equal(code(error), "42501");
  });

  test("a stub cannot be edited after posting", async () => {
    const { me, gig } = await readyToPost();
    const { data } = await postStub(me, gig, "friends");
    const { error } = await me.db.from("stubs").update({ audience: "wall" }).eq("id", data!.id);
    assert.equal(code(error), "42501");
  });
});

describe("who can see a stub", () => {
  async function scene() {
    const owner = await f.user();
    const friend = await f.user();
    const stranger = await f.user();
    await makeFriends(owner, friend);
    const gigA = await f.gig();
    const gigB = await f.gig();
    for (const g of [gigA, gigB]) {
      await going(owner, g);
      await openWindow(g);
    }
    const wall = (await postStub(owner, gigA, "wall")).data!.id as string;
    const friendsOnly = (await postStub(owner, gigB, "friends")).data!.id as string;
    return { owner, friend, stranger, wall, friendsOnly };
  }

  test("the owner sees both", async () => {
    const s = await scene();
    const { data } = await s.owner.db.from("stubs").select("id").in("id", [s.wall, s.friendsOnly]);
    assert.equal(data?.length, 2);
  });

  test("a friend sees both", async () => {
    const s = await scene();
    const { data } = await s.friend.db.from("stubs").select("id").in("id", [s.wall, s.friendsOnly]);
    assert.equal(data?.length, 2);
  });

  test("a stranger sees only the wall one", async () => {
    const s = await scene();
    const { data } = await s.stranger.db.from("stubs").select("id").in("id", [s.wall, s.friendsOnly]);
    assert.deepEqual(data?.map((r) => r.id), [s.wall]);
  });

  test("someone signed out sees only the wall one", async () => {
    const s = await scene();
    const { data } = await anon().from("stubs").select("id").in("id", [s.wall, s.friendsOnly]);
    assert.deepEqual(data?.map((r) => r.id), [s.wall]);
  });

  test("a block hides even wall stubs, whoever did the blocking", async () => {
    const one = await scene();
    await one.stranger.db.from("blocks").insert({ blocker_id: one.stranger.id, blocked_id: one.owner.id });
    const blocker = await one.stranger.db.from("stubs").select("id").in("id", [one.wall, one.friendsOnly]);
    assert.deepEqual(blocker.data, [], "the person who blocked no longer sees them");

    const two = await scene();
    await two.owner.db.from("blocks").insert({ blocker_id: two.owner.id, blocked_id: two.stranger.id });
    const blocked = await two.stranger.db.from("stubs").select("id").in("id", [two.wall, two.friendsOnly]);
    assert.deepEqual(blocked.data, [], "the person blocked no longer sees them");
  });

  test("unfriending takes the friends-only stub away", async () => {
    const s = await scene();
    await s.friend.db.rpc("remove_friend", { p_other: s.owner.id });
    const { data } = await s.friend.db.from("stubs").select("id").in("id", [s.wall, s.friendsOnly]);
    assert.deepEqual(data?.map((r) => r.id), [s.wall]);
  });

  test("only the owner can delete it", async () => {
    const s = await scene();
    const tried = await s.friend.db.from("stubs").delete().eq("id", s.wall).select("id");
    assert.deepEqual(tried.data, [], "someone else's delete matches nothing");

    const done = await s.owner.db.from("stubs").delete().eq("id", s.wall).select("id");
    assert.equal(done.data?.length, 1);
  });
});
