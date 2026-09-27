/**
 * Date handling. These are pure functions, but every one of them is a place a
 * timezone bug hides silently: the page still renders, just with the wrong day
 * on it. Vercel runs UTC, so none of this is exercised by developing locally.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  clockTime,
  dayWord,
  money,
  nightOf,
  nightRange,
  nightsBetween,
  weekdayShort,
} from "../src/lib/format.ts";

describe("which night a gig belongs to", () => {
  test("an evening gig belongs to its own date", () => {
    // 19:30 BST on Friday 18 September 2026
    assert.equal(nightOf("2026-09-18T18:30:00Z"), "2026-09-18");
  });

  test("a gig after midnight belongs to the night before", () => {
    // 00:30 BST on Saturday is Friday night out
    assert.equal(nightOf("2026-09-18T23:30:00Z"), "2026-09-18");
  });

  test("the cut is at 4am, not midnight", () => {
    // 03:59 BST Saturday -> still Friday night
    assert.equal(nightOf("2026-09-19T02:59:00Z"), "2026-09-18");
    // 04:01 BST Saturday -> Saturday
    assert.equal(nightOf("2026-09-19T03:01:00Z"), "2026-09-19");
  });

  test("the same instant buckets correctly in winter", () => {
    // 00:30 GMT on 2026-01-10 -> the night of the 9th
    assert.equal(nightOf("2026-01-10T00:30:00Z"), "2026-01-09");
  });
});

describe("night ranges are used as indexed timestamp filters", () => {
  test("a summer night runs 04:00 to 04:00 British Summer Time", () => {
    const { start, end } = nightRange("2026-09-18");
    // BST is UTC+1, so 04:00 local is 03:00Z
    assert.equal(start.toISOString(), "2026-09-18T03:00:00.000Z");
    assert.equal(end.toISOString(), "2026-09-19T03:00:00.000Z");
  });

  test("a winter night runs 04:00 to 04:00 GMT", () => {
    const { start, end } = nightRange("2026-01-09");
    assert.equal(start.toISOString(), "2026-01-09T04:00:00.000Z");
    assert.equal(end.toISOString(), "2026-01-10T04:00:00.000Z");
  });

  test("the night the clocks go forward is 23 hours long", () => {
    // 29 March 2026: 01:00 GMT becomes 02:00 BST
    const { start, end } = nightRange("2026-03-28");
    const hours = (end.getTime() - start.getTime()) / 3600_000;
    assert.equal(hours, 23);
  });

  test("the night the clocks go back is 25 hours long", () => {
    // 25 October 2026: 02:00 BST becomes 01:00 GMT
    const { start, end } = nightRange("2026-10-24");
    const hours = (end.getTime() - start.getTime()) / 3600_000;
    assert.equal(hours, 25);
  });
});

describe("times are shown in London, not in the server's timezone", () => {
  test("a summer evening reads as its local time", () => {
    assert.equal(clockTime("2026-09-18T18:30:00Z"), "7:30pm");
  });

  test("a winter evening reads as its local time", () => {
    assert.equal(clockTime("2026-01-09T19:30:00Z"), "7:30pm");
  });

  test("a whole hour drops the minutes, as the prototype does", () => {
    assert.equal(clockTime("2026-09-18T19:00:00Z"), "8pm");
  });
});

describe("day labels", () => {
  const today = "2026-09-18";

  test("tonight and tomorrow are named", () => {
    assert.equal(dayWord("2026-09-18", today), "Tonight");
    assert.equal(dayWord("2026-09-19", today), "Tomorrow");
  });

  test("the rest of the week is just the weekday", () => {
    assert.equal(dayWord("2026-09-20", today), "Sun");
    assert.equal(dayWord("2026-09-23", today), "Wed");
  });

  test("beyond a week the date is spelled out", () => {
    assert.equal(dayWord("2026-09-25", today), "Fri 25 Sep");
  });

  test("the date block always shows a weekday, never Ton or Tom", () => {
    assert.equal(weekdayShort("2026-09-18"), "Fri");
    assert.equal(weekdayShort("2026-09-19"), "Sat");
  });

  test("counting nights is unaffected by the clocks changing", () => {
    // spans the spring forward
    assert.equal(nightsBetween("2026-03-28", "2026-03-30"), 2);
    // spans the autumn back
    assert.equal(nightsBetween("2026-10-24", "2026-10-26"), 2);
  });
});

describe("money", () => {
  test("free is free, not zero pounds", () => {
    assert.equal(money(0), "Free");
  });

  test("whole pounds have no decimals", () => {
    assert.equal(money(600), "£6");
  });

  test("part pounds keep both digits", () => {
    assert.equal(money(750), "£7.50");
  });
});
