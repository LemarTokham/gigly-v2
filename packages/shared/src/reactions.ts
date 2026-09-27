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
