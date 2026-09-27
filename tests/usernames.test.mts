/**
 * @usernames and who can read a profile.
 *
 * set_username() is the only way to set one, so these check it enforces the
 * format, the reserved list and the 30-day hold on its own, and that the
 * shared validator both apps use agrees with it.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RESERVED_USERNAMES, USERNAME_PATTERN, validateUsername } from "../packages/shared/src/username.ts";
import { admin, anon, code, fixtures } from "./support.mts";

const f = fixtures("names");
const unique = () => `u${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

describe("setting a username", () => {
  test("stores the normalised form and returns it", async () => {
    const me = await f.user({ username: false });
    const name = unique();
    const { data, error } = await me.db.rpc("set_username", { p_username: `  @${name.toUpperCase()} ` });
    assert.equal(error, null);
    assert.equal(data, name);
  });

  test("the database and the shared validator agree", async () => {
    const me = await f.user({ username: false });
    const samples = ["ab", "x".repeat(21), "maya rose", "maya-rose", ".lead", "trail.", "two..dots", "mäya", "fine_name", "a.b_c"];
    for (const s of samples) {
      const shared = validateUsername(s).ok;
      // Suffix keeps the valid ones unique across runs without changing validity.
      const candidate = shared ? `${s}${Math.floor(Math.random() * 99)}`.slice(0, 20) : s;
      const { error } = await me.db.rpc("set_username", { p_username: candidate });
      assert.equal(error === null, shared, `${JSON.stringify(s)}: shared says ${shared}, database says ${error === null}`);
    }
  });

  test("a bad format is refused with GY010", async () => {
    const me = await f.user({ username: false });
    const { error } = await me.db.rpc("set_username", { p_username: "no spaces" });
    assert.equal(code(error), "GY010");
  });

  test("every reserved name is refused, reported as taken", async () => {
    const me = await f.user({ username: false });
    for (const name of RESERVED_USERNAMES) {
      const { error } = await me.db.rpc("set_username", { p_username: name });
      // "me" is reserved but also too short, and the format check comes first.
      assert.equal(code(error), USERNAME_PATTERN.test(name) ? "GY011" : "GY010", name);
    }
  });

  test("names are unique whatever the capitals", async () => {
    const a = await f.user({ username: false });
    const b = await f.user({ username: false });
    const name = unique();
    assert.equal((await a.db.rpc("set_username", { p_username: name })).error, null);
    const { error } = await b.db.rpc("set_username", { p_username: name.toUpperCase() });
    assert.equal(code(error), "GY011");
  });

  test("a username cannot be written directly, only through set_username", async () => {
    const me = await f.user();
    const { error } = await me.db.from("profiles").update({ username: unique() }).eq("id", me.id);
    assert.equal(code(error), "42501");
  });

  test("the display name can be edited directly, but not is_admin", async () => {
    const me = await f.user();
    const ok = await me.db.from("profiles").update({ display_name: "Maya" }).eq("id", me.id).select("display_name");
    assert.equal(ok.error, null);
    assert.equal(ok.data?.[0]?.display_name, "Maya");

    const bad = await me.db.from("profiles").update({ is_admin: true }).eq("id", me.id);
    assert.equal(code(bad.error), "42501");
  });

  test("not signed in is refused", async () => {
    const { error } = await anon().rpc("set_username", { p_username: unique() });
    assert.ok(error, "anonymous call must fail");
  });
});

describe("the 30-day hold on an old username", () => {
  test("someone else cannot take a name that was just changed away from", async () => {
    const a = await f.user({ username: false });
    const b = await f.user({ username: false });
    const old = unique();
    await a.db.rpc("set_username", { p_username: old });
    await a.db.rpc("set_username", { p_username: unique() });

    const { error } = await b.db.rpc("set_username", { p_username: old });
    assert.equal(code(error), "GY011");
  });

  test("the previous owner can take it back", async () => {
    const a = await f.user({ username: false });
    const old = unique();
    await a.db.rpc("set_username", { p_username: old });
    await a.db.rpc("set_username", { p_username: unique() });

    const { data, error } = await a.db.rpc("set_username", { p_username: old });
    assert.equal(error, null);
    assert.equal(data, old);
  });

  test("once the hold lapses anyone can have it", async () => {
    const a = await f.user({ username: false });
    const b = await f.user({ username: false });
    const old = unique();
    await a.db.rpc("set_username", { p_username: old });
    await a.db.rpc("set_username", { p_username: unique() });
    await admin.from("username_holds").update({ held_until: new Date(Date.now() - 1000).toISOString() }).eq("username", old);

    const { error } = await b.db.rpc("set_username", { p_username: old });
    assert.equal(error, null);
  });

  test("the holds table is closed to everyone", async () => {
    const me = await f.user();
    const { error } = await me.db.from("username_holds").select("*");
    assert.equal(code(error), "42501");
  });
});

describe("reading profiles", () => {
  test("anyone, signed in or not, can read the public columns", async () => {
    const me = await f.user();
    const { data, error } = await anon()
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("id", me.id);
    assert.equal(error, null);
    assert.equal(data?.[0]?.username, me.username);
  });

  test("is_admin cannot be read, signed in or not", async () => {
    const me = await f.user();
    for (const db of [anon(), me.db]) {
      const { error } = await db.from("profiles").select("is_admin").eq("id", me.id);
      assert.equal(code(error), "42501");
    }
  });

  test("a blocked pair cannot see each other's profile, either way round", async () => {
    const a = await f.user();
    const b = await f.user();
    assert.equal((await a.db.from("blocks").insert({ blocker_id: a.id, blocked_id: b.id })).error, null);

    const fromB = await b.db.from("profiles").select("id").eq("id", a.id);
    const fromA = await a.db.from("profiles").select("id").eq("id", b.id);
    assert.deepEqual(fromB.data, []);
    assert.deepEqual(fromA.data, []);
  });
});
