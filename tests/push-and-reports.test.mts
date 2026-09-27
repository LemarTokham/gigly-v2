/**
 * Push tokens (one row per device, following whoever is signed in on it) and
 * reports (anyone can file one about what they can see; only admins read).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, code, fixtures, going, makeFriends, openWindow, postStub } from "./support.mts";

const f = fixtures("pushrep");
const token = () => `ExponentPushToken[${Math.random().toString(36).slice(2)}${Date.now().toString(36)}]`;

describe("push tokens", () => {
  test("you can register a device and see only your own", async () => {
    const me = await f.user();
    const other = await f.user();
    const t = token();
    assert.equal((await me.db.rpc("register_push_token", { p_token: t, p_platform: "ios" })).error, null);

    assert.deepEqual((await me.db.from("push_tokens").select("token")).data, [{ token: t }]);
    assert.deepEqual((await other.db.from("push_tokens").select("token")).data, []);
  });

  test("signing into another account on the same phone moves the token", async () => {
    const first = await f.user();
    const second = await f.user();
    const t = token();
    await first.db.rpc("register_push_token", { p_token: t, p_platform: "android" });
    await second.db.rpc("register_push_token", { p_token: t, p_platform: "android" });

    assert.deepEqual((await first.db.from("push_tokens").select("token")).data, [], "first account no longer gets this phone's pushes");
    const { data } = await admin.from("push_tokens").select("user_id").eq("token", t);
    assert.deepEqual(data, [{ user_id: second.id }]);
  });

  test("you can unregister only your own", async () => {
    const me = await f.user();
    const other = await f.user();
    const t = token();
    await me.db.rpc("register_push_token", { p_token: t, p_platform: "ios" });

    await other.db.rpc("unregister_push_token", { p_token: t });
    assert.equal((await me.db.from("push_tokens").select("token")).data?.length, 1, "someone else cannot remove it");

    await me.db.rpc("unregister_push_token", { p_token: t });
    assert.deepEqual((await me.db.from("push_tokens").select("token")).data, []);
  });

  test("the table cannot be written directly", async () => {
    const me = await f.user();
    const { error } = await me.db.from("push_tokens").insert({ token: token(), user_id: me.id, platform: "ios" });
    assert.equal(code(error), "42501");
  });

  test("only ios and android", async () => {
    const me = await f.user();
    const { error } = await me.db.rpc("register_push_token", { p_token: token(), p_platform: "windows" });
    assert.ok(error);
  });
});

describe("reports", () => {
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

  const report = (by: { id: string; db: import("@supabase/supabase-js").SupabaseClient }, about: string, stub: string | null) =>
    by.db.from("reports").insert({ reporter_id: by.id, reported_user_id: about, stub_id: stub, reason: "harassment" });

  test("anyone can report a stub they can see", async () => {
    const s = await scene();
    assert.equal((await report(s.stranger, s.owner.id, s.wall)).error, null);
    assert.equal((await report(s.friend, s.owner.id, s.friendsOnly)).error, null);
  });

  test("but not one they cannot see", async () => {
    const s = await scene();
    assert.equal(code((await report(s.stranger, s.owner.id, s.friendsOnly)).error), "42501");
  });

  test("the stub has to belong to the person named", async () => {
    const s = await scene();
    assert.equal(code((await report(s.stranger, s.friend.id, s.wall)).error), "42501");
  });

  test("not as someone else, and not about yourself", async () => {
    const s = await scene();
    const forged = await s.stranger.db
      .from("reports")
      .insert({ reporter_id: s.friend.id, reported_user_id: s.owner.id, stub_id: s.wall, reason: "spam" });
    assert.equal(code(forged.error), "42501");
    assert.ok((await report(s.owner, s.owner.id, null)).error);
  });

  test("a report cannot arrive already resolved", async () => {
    const s = await scene();
    const { error } = await s.stranger.db.from("reports").insert({
      reporter_id: s.stranger.id, reported_user_id: s.owner.id, stub_id: s.wall, reason: "spam",
      resolved_at: new Date().toISOString(),
    });
    assert.equal(code(error), "42501");
  });

  test("only admins can read reports", async () => {
    const s = await scene();
    await report(s.stranger, s.owner.id, s.wall);
    assert.deepEqual((await s.stranger.db.from("reports").select("id").eq("stub_id", s.wall)).data, [], "not even your own");

    const moderator = await f.user();
    await admin.from("profiles").update({ is_admin: true }).eq("id", moderator.id);
    assert.equal((await moderator.db.from("reports").select("id").eq("stub_id", s.wall)).data?.length, 1);
  });

  test("the report outlives the stub being deleted", async () => {
    const s = await scene();
    await report(s.stranger, s.owner.id, s.wall);
    await s.owner.db.from("stubs").delete().eq("id", s.wall);
    const { data } = await admin.from("reports").select("stub_id").eq("reporter_id", s.stranger.id);
    assert.deepEqual(data, [{ stub_id: null }], "who was reported is kept, even though the stub is gone");
  });
});
