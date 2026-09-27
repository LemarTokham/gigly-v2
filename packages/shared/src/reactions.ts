import type { Database } from "./database.types.ts";

/**
 * The five reactions. The database stores the code, never the emoji: an emoji
 * can arrive with or without an invisible variation selector, which would
 * slip past an equality CHECK, and a code reads plainly in SQL.
 */
export const REACTIONS = [
  { code: "fire", emoji: "\u{1F525}" },
  { code: "hands", emoji: "\u{1F64C}" },
  { code: "heart_eyes", emoji: "\u{1F60D}" },
  { code: "laugh", emoji: "\u{1F602}" },
  { code: "horns", emoji: "\u{1F918}" },
] as const;

export type ReactionCode = (typeof REACTIONS)[number]["code"];

export const REACTION_CODES: readonly ReactionCode[] = REACTIONS.map((r) => r.code);

export function reactionEmoji(code: ReactionCode): string {
  return REACTIONS.find((r) => r.code === code)!.emoji;
}

type DatabaseReaction = Database["public"]["Enums"]["reaction_code"];
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

/**
 * Fails to compile if this list and the database's reaction_code enum ever
 * disagree, so the apps cannot offer a reaction the database would refuse.
 */
export const REACTIONS_MATCH_DATABASE: Same<ReactionCode, DatabaseReaction> = true;
