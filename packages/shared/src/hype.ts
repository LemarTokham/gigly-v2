/**
 * The hype rules as numbers and words, for the web and the app to display.
 *
 * A hype backs a show and counts until its doors open. The database is what
 * enforces that: cast_hype(), take_back_hype() and hypes_remaining() in
 * supabase/migrations. Changing a number here changes nothing about what a
 * user is allowed to do; tests/hype.test.mts checks the two agree.
 */

/** Hypes each user gets per week, reset Monday 00:00 Europe/London. */
export const HYPES_PER_WEEK = 3;

/** The database's error codes, in the words the apps use. */
export const HYPE_ERRORS: Readonly<Record<string, string>> = {
  GY001: "That's all three this week. Fresh hypes on Monday.",
  GY002: "You're already backing this show.",
  GY003: "This show isn't taking hypes. They close when doors open.",
  GY004: "You weren't backing this show.",
  GY005: "Doors are open, so that hype's been spent.",
  GY026: "Pick a username first.",
  "28000": "Sign in to back a show.",
};

export const HYPE_ERROR_FALLBACK = "That didn't work. Try again.";

export function hypeErrorMessage(code: string | undefined): string {
  return (code && HYPE_ERRORS[code]) || HYPE_ERROR_FALLBACK;
}
