/**
 * @username rules, shared so the web and the app say the same thing before a
 * request is ever sent. Uniqueness can only be known by the database, which
 * also enforces the format with a CHECK — this is the friendly first pass.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

/** Lowercase letters, numbers, dots and underscores. */
export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

/**
 * Names nobody can pick: they would read as Gigly speaking, or collide with a
 * page if usernames ever appear in a URL. Reported as "taken" rather than
 * "reserved" so the list is not advertised.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  "about", "account", "admin", "administrator", "api", "app", "artist",
  "artists", "auth", "chart", "friends", "gig", "gigly", "gigs", "help",
  "hype", "invite", "login", "logout", "map", "me", "mod", "moderator",
  "null", "official", "root", "search", "settings", "signin", "signout",
  "signup", "staff", "stub", "stubs", "submit", "support", "team",
  "undefined", "venue", "venues", "www", "you",
]);

export type UsernameCheck =
  | { ok: true; username: string }
  | { ok: false; message: string };

/** What people type, as it would be stored: no @, no spaces, lowercase. */
export function normaliseUsername(input: string): string {
  return input.trim().replace(/^@/, "").toLowerCase();
}

export function validateUsername(input: string): UsernameCheck {
  const username = normaliseUsername(input);

  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      message: "Usernames are 3 to 20 characters: letters, numbers, dots and underscores.",
    };
  }
  // A dot at either end or two in a row reads as a typo, and makes a handle
  // easy to spoof: "maya." next to "maya".
  if (username.startsWith(".") || username.endsWith(".") || username.includes("..")) {
    return {
      ok: false,
      message: "Usernames can't start or end with a dot, or have two dots in a row.",
    };
  }
  if (RESERVED_USERNAMES.has(username)) {
    return { ok: false, message: `@${username} is taken. Try another.` };
  }
  return { ok: true, username };
}

/**
 * set_username()'s error codes in the same words as validateUsername, so a
 * name the database refuses reads the same as one refused before sending.
 */
export function usernameErrorMessage(code: string | undefined, username: string): string {
  if (code === "GY011") return `@${normaliseUsername(username)} is taken. Try another.`;
  if (code === "GY010") {
    const check = validateUsername(username);
    return check.ok
      ? "Usernames are 3 to 20 characters: letters, numbers, dots and underscores."
      : check.message;
  }
  return "That didn't save. Try again.";
}
