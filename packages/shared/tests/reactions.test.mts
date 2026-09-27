import { test } from "node:test";
import assert from "node:assert/strict";
import { REACTIONS, REACTION_CODES, reactionEmoji } from "../src/reactions.ts";

test("the five reactions are the spec's five, in its order", () => {
  assert.deepEqual(
    REACTIONS.map((r) => r.emoji),
    ["\u{1F525}", "\u{1F64C}", "\u{1F60D}", "\u{1F602}", "\u{1F918}"],
  );
});

test("codes are unique and map back to their emoji", () => {
  assert.equal(new Set(REACTION_CODES).size, 5);
  assert.equal(reactionEmoji("horns"), "\u{1F918}");
});

test("no emoji carries a variation selector", () => {
  for (const r of REACTIONS) assert.ok(!r.emoji.includes("️"), r.code);
});
