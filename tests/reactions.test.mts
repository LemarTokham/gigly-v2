/**
 * Reactions. The spec's rules, all enforced in the database:
 *   - one reaction per person per stub; another swaps it, the same removes it
 *   - only on a stub you can see, and never your own
 *   - you see your friends' reactions on your stubs, and who reacted
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { anon, code, fixtures, going, makeFriends, openWindow, postStub } from "./support.mts";

const f = fixtures("react");

/** An owner with a wall stub and a friends-only stub, a friend and a stranger. */
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

describe("reacting", () => {
  test("a friend can react to a friends-only stub", async () => {
    const s = await scene();
    const { data, error } = await s.friend.db.rpc("react", { p_stub_id: s.friendsOnly, p_reaction: "fire" });
    assert.equal(error, null);
    assert.equal(data, "fire");
  });

  test("a stranger can react to a wall stub", async () => {
    const s = await scene();
    assert.equal((await s.stranger.db.rpc("react", { p_stub_id: s.wall, p_reaction: "hands" })).error, null);
  });

  test("a stranger cannot react to a stub they cannot see", async () => {
    const s = await scene();
    const { error } = await s.stranger.db.rpc("react", { p_stub_id: s.friendsOnly, p_reaction: "fire" });
    assert.equal(code(error), "42501");
  });

  test("nobody can react to their own stub", async () => {
    const s = await scene();
    const { error } = await s.owner.db.rpc("react", { p_stub_id: s.wall, p_reaction: "fire" });
    assert.equal(code(error), "42501");
  });

  test("tapping another swaps it: still one reaction", async () => {
    const s = await scene();
    await s.friend.db.rpc("react", { p_stub_id: s.wall, p_reaction: "fire" });
    const swapped = await s.friend.db.rpc("react", { p_stub_id: s.wall, p_reaction: "horns" });
    assert.equal(swapped.data, "horns");

    const { data } = await s.owner.db.from("reactions").select("reaction").eq("stub_id", s.wall);
    assert.deepEqual(data, [{ reaction: "horns" }]);
  });

  test("tapping the same one takes it off", async () => {
    const s = await scene();
    await s.friend.db.rpc("react", { p_stub_id: s.wall, p_reaction: "laugh" });
    const off = await s.friend.db.rpc("react", { p_stub_id: s.wall, p_reaction: "laugh" });
    assert.equal(off.data, null);
    assert.deepEqual((await s.owner.db.from("reactions").select("reaction").eq("stub_id", s.wall)).data, []);
  });

  test("only the five reactions exist", async () => {
    const s = await scene();
    const { error } = await s.friend.db.rpc("react", { p_stub_id: s.wall, p_reaction: "thumbs_up" });
    assert.ok(error, "an unknown reaction is refused");
  });

  test("signed out, you cannot react", async () => {
    const s = await scene();
    const { error } = await anon().rpc("react", { p_stub_id: s.wall, p_reaction: "fire" });
    assert.ok(error);
  });
});

describe("the table holds the same rules as react()", () => {
  test("a second row for the same person and stub is refused", async () => {
    const s = await scene();
    await s.friend.db.from("reactions").insert({ stub_id: s.wall, user_id: s.friend.id, reaction: "fire" });
    const again = await s.friend.db.from("reactions").insert({ stub_id: s.wall, user_id: s.friend.id, reaction: "hands" });
    assert.ok(again.error);
  });

  test("you cannot react as someone else", async () => {
    const s = await scene();
    const forged = await s.stranger.db.from("reactions").insert({ stub_id: s.wall, user_id: s.friend.id, reaction: "fire" });
    assert.equal(code(forged.error), "42501");
  });

  test("you cannot change someone else's reaction", async () => {
    const s = await scene();
    await s.friend.db.rpc("react", { p_stub_id: s.wall, p_reaction: "fire" });
    const tried = await s.stranger.db
      .from("reactions")
      .update({ reaction: "laugh" })
      .eq("stub_id", s.wall)
      .eq("user_id", s.friend.id)
      .select("reaction");
    assert.deepEqual(tried.data, []);
    assert.deepEqual((await s.owner.db.from("reactions").select("reaction").eq("stub_id", s.wall)).data, [{ reaction: "fire" }]);
  });

  test("a reaction cannot be moved onto another stub", async () => {
    const s = await scene();
    await s.friend.db.rpc("react", { p_stub_id: s.wall, p_reaction: "fire" });
    const moved = await s.friend.db
      .from("reactions")
      .update({ stub_id: s.friendsOnly })
      .eq("stub_id", s.wall)
      .eq("user_id", s.friend.id);
    assert.equal(code(moved.error), "42501");
  });

  test("you can remove only your own", async () => {
    const s = await scene();
    await s.friend.db.rpc("react", { p_stub_id: s.wall, p_reaction: "fire" });
    const tried = await s.owner.db.from("reactions").delete().eq("stub_id", s.wall).select("user_id");
    assert.deepEqual(tried.data, [], "the stub's owner cannot delete a friend's reaction");
  });
});

describe("seeing reactions", () => {
  test("the owner sees who reacted and with what", async () => {
    const s = await scene();
    await s.friend.db.rpc("react", { p_stub_id: s.friendsOnly, p_reaction: "heart_eyes" });
    const { data } = await s.owner.db.from("reactions").select("user_id, reaction").eq("stub_id", s.friendsOnly);
    assert.deepEqual(data, [{ user_id: s.friend.id, reaction: "heart_eyes" }]);
  });

  test("reactions on a stub you cannot see are invisible too", async () => {
    const s = await scene();
    await s.friend.db.rpc("react", { p_stub_id: s.friendsOnly, p_reaction: "fire" });
    assert.deepEqual((await s.stranger.db.from("reactions").select("user_id").eq("stub_id", s.friendsOnly)).data, []);
    assert.deepEqual((await anon().from("reactions").select("user_id").eq("stub_id", s.friendsOnly)).data, []);
  });

  test("a blocked person's reaction disappears from your stub", async () => {
    const s = await scene();
    await s.stranger.db.rpc("react", { p_stub_id: s.wall, p_reaction: "laugh" });
    await s.owner.db.from("blocks").insert({ blocker_id: s.owner.id, blocked_id: s.stranger.id });
    assert.deepEqual((await s.owner.db.from("reactions").select("user_id").eq("stub_id", s.wall)).data, []);
  });

  test("deleting a stub takes its reactions with it", async () => {
    const s = await scene();
    await s.friend.db.rpc("react", { p_stub_id: s.wall, p_reaction: "fire" });
    await s.owner.db.from("stubs").delete().eq("id", s.wall);
    assert.deepEqual((await s.friend.db.from("reactions").select("user_id").eq("stub_id", s.wall)).data, []);
  });
});
