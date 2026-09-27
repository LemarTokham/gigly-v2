/**
 * Username rules. The web and the app both show these messages before a
 * request is sent, so a wrong answer here is a wrong answer on both.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { normaliseUsername, validateUsername } from "../src/username.ts";

const ok = (input: string) => validateUsername(input);

describe("normalising what people type", () => {
  test("drops a leading @, surrounding spaces and capitals", () => {
    assert.equal(normaliseUsername("  @MayaOnBass "), "mayaonbass");
  });

  test("only the first @ is treated as the prefix", () => {
    assert.equal(normaliseUsername("@@maya"), "@maya");
  });
});

describe("the format", () => {
  for (const good of ["abc", "maya.onbass", "priya_p", "a1b2c3", "x".repeat(20), "_maya_"]) {
    test(`accepts ${good}`, () => {
      assert.deepEqual(ok(good), { ok: true, username: good });
    });
  }

  test("accepts what the prototype's people use", () => {
    for (const h of ["mayaonbass", "joshk", "aisha.gigs", "tomwavertree", "dan_in_lpool", "rosaaa"]) {
      assert.equal(ok(h).ok, true, h);
    }
  });

  test("stores the lowercase form of a capitalised handle", () => {
    assert.deepEqual(ok("Maya.Rose"), { ok: true, username: "maya.rose" });
  });

  for (const bad of ["ab", "x".repeat(21), "maya rose", "maya-rose", "maya!", "mäya", "", "@"]) {
    test(`refuses ${JSON.stringify(bad)}`, () => {
      const r = ok(bad);
      assert.equal(r.ok, false);
      assert.equal(
        !r.ok && r.message,
        "Usernames are 3 to 20 characters: letters, numbers, dots and underscores.",
      );
    });
  }

  test("counts length after the @ is dropped", () => {
    assert.equal(ok("@" + "x".repeat(20)).ok, true);
    assert.equal(ok("@ab").ok, false);
  });
});

describe("dots", () => {
  for (const bad of [".maya", "maya.", "ma..ya", "..."]) {
    test(`refuses ${bad}`, () => {
      const r = ok(bad);
      assert.equal(r.ok, false);
      assert.match(!r.ok ? r.message : "", /start or end with a dot/);
    });
  }
});

describe("reserved names", () => {
  test("look taken, whatever the capitals", () => {
    assert.deepEqual(ok("Gigly"), { ok: false, message: "@gigly is taken. Try another." });
    assert.deepEqual(ok("@admin"), { ok: false, message: "@admin is taken. Try another." });
  });

  test("only whole names are reserved", () => {
    assert.equal(ok("gigly.fan").ok, true);
    assert.equal(ok("adminmaya").ok, true);
  });
});
