/**
 * The hype rules as numbers and words, for the web and the app to display.
 *
 * The database is what enforces them: cast_hype(), take_back_hype() and
 * hypes_remaining() in supabase/migrations. Changing a number here changes
 * nothing about what a user is allowed to do — tests/hype.test.mts checks
 * that the two agree.
 */

/** Hypes each user gets per week, reset Monday 00:00 Europe/London. */
export const HYPES_PER_WEEK = 3;

/** How long a hype keeps counting for its artist. */
export const HYPE_DAYS = 7;
export const HYPE_WINDOW_MS = HYPE_DAYS * 864e5;

/** The database's error codes, in the words the prototype uses. */
export const HYPE_ERRORS: Readonly<Record<string, string>> = {
  GY001: "That's all three this week. Fresh hypes on Monday.",
  GY002: "You're already backing them.",
  GY003: "They need a gig coming up before you can back them.",
  GY004: "You weren't backing them.",
  "28000": "Sign in to back an artist.",
};

export const HYPE_ERROR_FALLBACK = "That didn't work. Try again.";

export function hypeErrorMessage(code: string | undefined): string {
  return (code && HYPE_ERRORS[code]) || HYPE_ERROR_FALLBACK;
}
