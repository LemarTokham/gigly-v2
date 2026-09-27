/**
 * Hype rules, tested against the real local Postgres: real policies, real
 * constraints, real JWTs. Every rule lives in the database, so mocking the
 * client would only test the mock.
 *
 * A hype backs a show and counts until its doors open. Three a week, reset
 * Monday 00:00 Europe/London, one per show, and taking one back before doors
 * returns it.
 *
 *   pnpm db:start   (once)
 *   pnpm test
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { HYPES_PER_WEEK } from "../packages/shared/src/hype.ts";
import { admin, anon, code, fixtures, minutesAgo } from "./support.mts";

const f = fixtures("hype");

/** Move someone's hype on a show back in time. The service role can. */
async function backdate(userId: string, gigId: string, days: number) {
  const { error } = await admin
    .from("hypes")
    .update({ created_at: new Date(Date.now() - days * 864e5).toISOString() })
    .eq("user_id", userId)
    .eq("gig_id", gigId);
  if (error) throw error;
}

async function chartRow(gigId: string) {
  const { data, error } = await anon()
    .from("gig_chart")
    .select("name, hype_count, hype_count_yesterday")
    .eq("id", gigId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

const remaining = async (db: Awaited<ReturnType<typeof f.user>>["db"]) =>
  (await db.rpc("hypes_remaining")).data as number;

// ------------------------------------------------------------- allowance

describe("the three-a-week allowance", () => {
  test("the web and the app are told the same allowance the database enforces", async () => {
    const me = await f.user();
    assert.equal(await remaining(me.db), HYPES_PER_WEEK);
  });

  test("three shows can be backed and the fourth is refused", async () => {
    const me = await f.user();
    const shows = await Promise.all([1, 2, 3, 4].map((d) => f.upcoming(d)));
    for (const show of shows.slice(0, 3)) {
      assert.equal((await me.db.rpc("cast_hype", { p_gig_id: show })).error, null);
    }
    assert.equal(code((await me.db.rpc("cast_hype", { p_gig_id: shows[3] })).error), "GY001");
  });

  test("hypes_remaining counts down", async () => {
    const me = await f.user();
    const [a, b] = await Promise.all([f.upcoming(1), f.upcoming(2)]);
    await me.db.rpc("cast_hype", { p_gig_id: a });
    assert.equal(await remaining(me.db), 2);
    await me.db.rpc("cast_hype", { p_gig_id: b });
    assert.equal(await remaining(me.db), 1);
  });

  test("taking one back before doors returns it", async () => {
    const me = await f.user();
    const show = await f.upcoming();
    await me.db.rpc("cast_hype", { p_gig_id: show });
    assert.equal((await me.db.rpc("take_back_hype", { p_gig_id: show })).error, null);
    assert.equal(await remaining(me.db), 3);
  });

  test("last week's hypes do not count against this week", async () => {
    const me = await f.user();
    const show = await f.upcoming(20);
    await me.db.rpc("cast_hype", { p_gig_id: show });
    await backdate(me.id, show, 8);
    assert.equal(await remaining(me.db), 3);
  });

  test("six casts at once still only spend three", async () => {
    const me = await f.user();
    const shows = await Promise.all([1, 2, 3, 4, 5, 6].map((d) => f.upcoming(d)));
    const results = await Promise.all(shows.map((s) => me.db.rpc("cast_hype", { p_gig_id: s })));
    assert.equal(results.filter((r) => r.error === null).length, 3);
    assert.equal(await remaining(me.db), 0);
  });

  test("signed out, nothing can be hyped", async () => {
    const show = await f.upcoming();
    assert.ok((await anon().rpc("cast_hype", { p_gig_id: show })).error);
  });
});

// ---------------------------------------------------------- one per show

describe("one hype per person per show", () => {
  test("backing the same show twice is refused", async () => {
    const me = await f.user();
    const show = await f.upcoming();
    await me.db.rpc("cast_hype", { p_gig_id: show });
    assert.equal(code((await me.db.rpc("cast_hype", { p_gig_id: show })).error), "GY002");
  });

  test("and a refused second hype does not spend the allowance", async () => {
    const me = await f.user();
    const show = await f.upcoming();
    await me.db.rpc("cast_hype", { p_gig_id: show });
    await me.db.rpc("cast_hype", { p_gig_id: show });
    assert.equal(await remaining(me.db), 2);
  });
});

// ------------------------------------------------ which shows take hypes

describe("which shows can be hyped", () => {
  test("a show still waiting for approval cannot", async () => {
    const me = await f.user();
    const show = await f.gig({ status: "pending", doorsMinutesAgo: -24 * 60 });
    assert.equal(code((await me.db.rpc("cast_hype", { p_gig_id: show })).error), "GY003");
    assert.equal(await remaining(me.db), 3, "a refused hype costs nothing");
  });

  test("a show whose doors have opened cannot", async () => {
    const me = await f.user();
    const show = await f.gig({ doorsMinutesAgo: 5 });
    assert.equal(code((await me.db.rpc("cast_hype", { p_gig_id: show })).error), "GY003");
  });

  test("a show with a title and no artists can", async () => {
    const me = await f.user();
    const show = await f.upcoming(1, { title: "TurnTable's Halloween Party", artist: false });
    assert.equal((await me.db.rpc("cast_hype", { p_gig_id: show })).error, null);
  });

  test("gig_is_hypeable says the same", async () => {
    const [open, pending, started] = await Promise.all([
      f.upcoming(),
      f.gig({ status: "pending", doorsMinutesAgo: -60 }),
      f.gig({ doorsMinutesAgo: 5 }),
    ]);
    const ask = async (id: string) => (await anon().rpc("gig_is_hypeable", { p_gig_id: id })).data;
    assert.deepEqual([await ask(open), await ask(pending), await ask(started)], [true, false, false]);
  });

  test("the service role cannot slip one in either: the trigger holds", async () => {
    const me = await f.user();
    const show = await f.gig({ status: "pending", doorsMinutesAgo: -60 });
    const { error } = await admin.from("hypes").insert({ user_id: me.id, gig_id: show });
    assert.equal(code(error), "GY003");
  });
});

// ---------------------------------------------------------- until doors

describe("a hype counts until doors open", () => {
  test("however long ago it was cast", async () => {
    const me = await f.user();
    const show = await f.upcoming(40);
    await me.db.rpc("cast_hype", { p_gig_id: show });
    await backdate(me.id, show, 30);
    assert.equal((await chartRow(show))?.hype_count, 1, "no 7-day fade any more");
  });

  test("then the show leaves the chart, and the hype stays on record", async () => {
    const me = await f.user();
    const show = await f.upcoming();
    await me.db.rpc("cast_hype", { p_gig_id: show });
    await admin.from("gigs").update({ starts_at: minutesAgo(1) }).eq("id", show);

    assert.equal(await chartRow(show), null, "doors are open: off the chart");
    const { data } = await me.db.from("hypes").select("gig_id").eq("gig_id", show);
    assert.equal(data?.length, 1, "who backed it is kept");
  });

  test("once doors open a hype cannot be taken back", async () => {
    const me = await f.user();
    const show = await f.upcoming();
    await me.db.rpc("cast_hype", { p_gig_id: show });
    await admin.from("gigs").update({ starts_at: minutesAgo(1) }).eq("id", show);

    assert.equal(code((await me.db.rpc("take_back_hype", { p_gig_id: show })).error), "GY005");
    assert.equal(await remaining(me.db), 2, "it was spent on that show");
  });

  test("taking back one you never cast is GY004", async () => {
    const me = await f.user();
    const show = await f.upcoming();
    assert.equal(code((await me.db.rpc("take_back_hype", { p_gig_id: show })).error), "GY004");
  });
});

// ---------------------------------------------------------------- chart

describe("the chart", () => {
  test("holds live shows whose doors have not opened, and nothing else", async () => {
    const [open, pending, started] = await Promise.all([
      f.upcoming(),
      f.gig({ status: "pending", doorsMinutesAgo: -60 }),
      f.gig({ doorsMinutesAgo: 5 }),
    ]);
    assert.ok(await chartRow(open));
    assert.equal(await chartRow(pending), null);
    assert.equal(await chartRow(started), null);
  });

  test("every hype is worth exactly one", async () => {
    const show = await f.upcoming();
    for (let i = 0; i < 3; i++) {
      const u = await f.user();
      await u.db.rpc("cast_hype", { p_gig_id: show });
    }
    assert.equal((await chartRow(show))?.hype_count, 3);
  });

  test("yesterday's count leaves out the last 24 hours, for the arrows", async () => {
    const show = await f.upcoming(10);
    const old = await f.user();
    const recent = await f.user();
    await old.db.rpc("cast_hype", { p_gig_id: show });
    await recent.db.rpc("cast_hype", { p_gig_id: show });
    await backdate(old.id, show, 2);

    const row = await chartRow(show);
    assert.equal(row?.hype_count, 2);
    assert.equal(row?.hype_count_yesterday, 1);
  });

  test("a show is named by its title, or else its headliner", async () => {
    const titled = await f.upcoming(1, { title: "Gallus: Album Launch Show" });
    const plain = await f.upcoming(2);
    assert.equal((await chartRow(titled))?.name, "Gallus: Album Launch Show");
    assert.equal((await chartRow(plain))?.name, f.bandName());
  });

  test("the chart names no one who hyped", async () => {
    const { data } = await anon().from("gig_chart").select("*").limit(1);
    const columns = Object.keys(data?.[0] ?? {});
    assert.ok(columns.length > 0);
    assert.ok(!columns.some((c) => c.includes("user")), `columns: ${columns.join(", ")}`);
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
  test("a hype cannot be inserted directly, as yourself or anyone else", async () => {
    const me = await f.user();
    const victim = await f.user();
    const show = await f.upcoming();
    assert.equal(code((await me.db.from("hypes").insert({ user_id: me.id, gig_id: show })).error), "42501");
    assert.equal(code((await me.db.from("hypes").insert({ user_id: victim.id, gig_id: show })).error), "42501");
  });

  test("nobody can delete or read someone else's hype", async () => {
    const victim = await f.user();
    const attacker = await f.user();
    const show = await f.upcoming();
    await victim.db.rpc("cast_hype", { p_gig_id: show });

    await attacker.db.from("hypes").delete().eq("user_id", victim.id);
    assert.deepEqual((await attacker.db.from("hypes").select("*").eq("user_id", victim.id)).data, []);

    const { count } = await admin.from("hypes").select("*", { count: "exact", head: true }).eq("user_id", victim.id);
    assert.equal(count, 1, "the victim's hype survives");
  });

  test("take_back_hype only ever removes your own", async () => {
    const victim = await f.user();
    const attacker = await f.user();
    const show = await f.upcoming();
    await victim.db.rpc("cast_hype", { p_gig_id: show });

    assert.equal(code((await attacker.db.rpc("take_back_hype", { p_gig_id: show })).error), "GY004");
    assert.equal((await chartRow(show))?.hype_count, 1);
  });
});
