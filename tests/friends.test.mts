/**
 * Mutual friends. The raw friendships table is closed to everyone; people
 * change it through four functions and read it through the friend_links
 * view. These check the functions enforce the rules on their own, and that
 * the view tells each side only what it should know.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { admin, code, fixtures, going, makeFriends, type User } from "./support.mts";

const f = fixtures("friends");

async function linkState(viewer: User, other: User): Promise<string | null> {
  const { data, error } = await viewer.db.from("friend_links").select("state").eq("user_id", other.id);
  if (error) throw error;
  return data?.[0]?.state ?? null;
}

describe("sending and answering a request", () => {
  test("a request shows as sent to one side and incoming to the other", async () => {
    const a = await f.user();
    const b = await f.user();
    const { data, error } = await a.db.rpc("send_friend_request", { p_to: b.id });
    assert.equal(error, null);
    assert.equal(data, "sent");
    assert.equal(await linkState(a, b), "sent");
    assert.equal(await linkState(b, a), "incoming");
  });

  test("the person asked can accept, and both see a friend", async () => {
    const a = await f.user();
    const b = await f.user();
    await a.db.rpc("send_friend_request", { p_to: b.id });
    const { data, error } = await b.db.rpc("respond_to_request", { p_from: a.id, p_accept: true });
    assert.equal(error, null);
    assert.equal(data, "friends");
    assert.equal(await linkState(a, b), "friend");
    assert.equal(await linkState(b, a), "friend");
  });

  test("only the person asked can answer: the sender cannot accept their own request", async () => {
    const a = await f.user();
    const b = await f.user();
    await a.db.rpc("send_friend_request", { p_to: b.id });
    const { error } = await a.db.rpc("respond_to_request", { p_from: b.id, p_accept: true });
    assert.equal(code(error), "GY024");
    assert.equal(await linkState(a, b), "sent");
  });

  test("a third person cannot answer someone else's request", async () => {
    const a = await f.user();
    const b = await f.user();
    const c = await f.user();
    await a.db.rpc("send_friend_request", { p_to: b.id });
    const { error } = await c.db.rpc("respond_to_request", { p_from: a.id, p_accept: true });
    assert.equal(code(error), "GY024");
    assert.equal(await linkState(b, a), "incoming");
  });

  test("two people adding each other at once become friends", async () => {
    const a = await f.user();
    const b = await f.user();
    const [x, y] = await Promise.all([
      a.db.rpc("send_friend_request", { p_to: b.id }),
      b.db.rpc("send_friend_request", { p_to: a.id }),
    ]);
    assert.equal(x.error, null);
    assert.equal(y.error, null);
    assert.deepEqual([x.data, y.data].sort(), ["friends", "sent"]);
    assert.equal(await linkState(a, b), "friend");
  });

  test("sending again while pending changes nothing", async () => {
    const a = await f.user();
    const b = await f.user();
    await a.db.rpc("send_friend_request", { p_to: b.id });
    const again = await a.db.rpc("send_friend_request", { p_to: b.id });
    assert.equal(again.data, "sent");
    assert.equal(await linkState(b, a), "incoming");
  });

  test("already friends is GY022", async () => {
    const a = await f.user();
    const b = await f.user();
    await makeFriends(a, b);
    assert.equal(code((await a.db.rpc("send_friend_request", { p_to: b.id })).error), "GY022");
  });

  test("you cannot add yourself", async () => {
    const a = await f.user();
    assert.equal(code((await a.db.rpc("send_friend_request", { p_to: a.id })).error), "GY020");
  });

  test("someone who does not exist is GY021", async () => {
    const a = await f.user();
    const { error } = await a.db.rpc("send_friend_request", { p_to: "00000000-0000-4000-8000-000000000000" });
    assert.equal(code(error), "GY021");
  });

  test("you need a username before you can add anyone", async () => {
    const a = await f.user({ username: false });
    const b = await f.user();
    assert.equal(code((await a.db.rpc("send_friend_request", { p_to: b.id })).error), "GY026");
  });
});

describe("a declined request is silent", () => {
  async function declined() {
    const a = await f.user();
    const b = await f.user();
    await a.db.rpc("send_friend_request", { p_to: b.id });
    await b.db.rpc("respond_to_request", { p_from: a.id, p_accept: false });
    return { a, b };
  }

  test("the sender still sees sent; the decliner sees nothing", async () => {
    const { a, b } = await declined();
    assert.equal(await linkState(a, b), "sent");
    assert.equal(await linkState(b, a), null);
  });

  test("sending again inside 30 days reaches nobody", async () => {
    const { a, b } = await declined();
    const { data } = await a.db.rpc("send_friend_request", { p_to: b.id });
    assert.equal(data, "sent");
    assert.equal(await linkState(b, a), null);
  });

  test("after 30 days the request can be made again", async () => {
    const { a, b } = await declined();
    await admin
      .from("friendships")
      .update({ responded_at: new Date(Date.now() - 31 * 864e5).toISOString() })
      .eq("requester_id", a.id)
      .eq("addressee_id", b.id);
    await a.db.rpc("send_friend_request", { p_to: b.id });
    assert.equal(await linkState(b, a), "incoming");
  });

  test("cancelling and re-sending does not skip the 30 days", async () => {
    const { a, b } = await declined();
    assert.equal((await a.db.rpc("cancel_request", { p_to: b.id })).error, null);
    assert.equal(await linkState(a, b), null, "cancelled request leaves the sender's list");
    await a.db.rpc("send_friend_request", { p_to: b.id });
    assert.equal(await linkState(b, a), null, "still nothing reaches the decliner");
  });

  test("the person who declined can change their mind by adding them", async () => {
    const { a, b } = await declined();
    const { data } = await b.db.rpc("send_friend_request", { p_to: a.id });
    assert.equal(data, "friends");
    assert.equal(await linkState(a, b), "friend");
  });
});

describe("cancelling and removing", () => {
  test("the sender can cancel a pending request, and it goes from both lists", async () => {
    const a = await f.user();
    const b = await f.user();
    await a.db.rpc("send_friend_request", { p_to: b.id });
    assert.equal((await a.db.rpc("cancel_request", { p_to: b.id })).error, null);
    assert.equal(await linkState(a, b), null);
    assert.equal(await linkState(b, a), null);
  });

  test("the person asked cannot cancel it for the sender", async () => {
    const a = await f.user();
    const b = await f.user();
    await a.db.rpc("send_friend_request", { p_to: b.id });
    assert.equal(code((await b.db.rpc("cancel_request", { p_to: a.id })).error), "GY024");
    assert.equal(await linkState(b, a), "incoming");
  });

  test("either friend can remove the other", async () => {
    const a = await f.user();
    const b = await f.user();
    await makeFriends(a, b);
    assert.equal((await b.db.rpc("remove_friend", { p_other: a.id })).error, null);
    assert.equal(await linkState(a, b), null);
  });

  test("removing someone who is not a friend is GY025", async () => {
    const a = await f.user();
    const b = await f.user();
    await a.db.rpc("send_friend_request", { p_to: b.id });
    assert.equal(code((await a.db.rpc("remove_friend", { p_other: b.id })).error), "GY025");
  });
});

describe("the table cannot be used directly", () => {
  test("reading it is refused", async () => {
    const a = await f.user();
    assert.equal(code((await a.db.from("friendships").select("*")).error), "42501");
  });

  test("writing it is refused: no self-made friendships", async () => {
    const a = await f.user();
    const b = await f.user();
    const ins = await a.db.from("friendships").insert({ requester_id: a.id, addressee_id: b.id, status: "accepted" });
    assert.equal(code(ins.error), "42501");

    await a.db.rpc("send_friend_request", { p_to: b.id });
    const upd = await a.db.from("friendships").update({ status: "accepted" }).eq("requester_id", a.id);
    assert.equal(code(upd.error), "42501");
    assert.equal(await linkState(a, b), "sent");
  });

  test("friend_links only ever shows your own links", async () => {
    const a = await f.user();
    const b = await f.user();
    const c = await f.user();
    await makeFriends(a, b);
    const { data } = await c.db.from("friend_links").select("user_id");
    assert.deepEqual(data, []);
  });
});

describe("blocking", () => {
  test("ends a friendship, and the blocked person cannot ask again", async () => {
    const a = await f.user();
    const b = await f.user();
    await makeFriends(a, b);
    await a.db.from("blocks").insert({ blocker_id: a.id, blocked_id: b.id });

    assert.equal(await linkState(a, b), null);
    assert.equal(await linkState(b, a), null);
    // Same answer as a person who does not exist: a block is not revealed.
    assert.equal(code((await b.db.rpc("send_friend_request", { p_to: a.id })).error), "GY021");
  });

  test("you cannot block on someone else's behalf, or see who blocked you", async () => {
    const a = await f.user();
    const b = await f.user();
    const c = await f.user();
    const forged = await c.db.from("blocks").insert({ blocker_id: a.id, blocked_id: b.id });
    assert.equal(code(forged.error), "42501");

    await a.db.from("blocks").insert({ blocker_id: a.id, blocked_id: b.id });
    const { data } = await b.db.from("blocks").select("*");
    assert.deepEqual(data, []);
  });
});

describe("the daily limit", () => {
  test("the 51st request in a day is refused", async () => {
    const a = await f.user();
    const others = await Promise.all(Array.from({ length: 50 }, () => f.bareProfile()));
    await admin.from("friendships").insert(others.map((id) => ({ requester_id: a.id, addressee_id: id })));

    const b = await f.user();
    assert.equal(code((await a.db.rpc("send_friend_request", { p_to: b.id })).error), "GY023");
  });
});

describe("what friends can see of each other", () => {
  test("a friend's I'm going is visible; a stranger's is not", async () => {
    const a = await f.user();
    const friend = await f.user();
    const stranger = await f.user();
    await makeFriends(a, friend);
    const gig = await f.gig({ doorsMinutesAgo: -24 * 60 });
    await going(friend, gig);
    await going(stranger, gig);

    const { data } = await a.db.from("attending").select("user_id").eq("gig_id", gig);
    assert.deepEqual(data?.map((r) => r.user_id), [friend.id]);
  });

  test("profile counts come back as numbers, and not at all across a block", async () => {
    const a = await f.user();
    const b = await f.user();
    await makeFriends(a, b);
    const { data } = await a.db.rpc("profile_counts", { p_user_id: b.id });
    assert.deepEqual(data, [{ stubs: 0, going: 0, friends: 1 }]);

    await b.db.from("blocks").insert({ blocker_id: b.id, blocked_id: a.id });
    const after = await a.db.rpc("profile_counts", { p_user_id: b.id });
    assert.deepEqual(after.data, []);
  });
});
