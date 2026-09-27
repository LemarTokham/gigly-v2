/**
 * A `next` parameter, but only if it points at a page on this site.
 *
 * Anything else becomes the fallback. "//evil.example" is protocol-relative
 * and would leave the site, which turns a sign-in link into an open redirect.
 */
export function safeNext(next: string | null | undefined, fallback = "/"): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : fallback;
}
