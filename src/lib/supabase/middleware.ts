import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/database.types";

/**
 * Refreshes the auth session on every request and writes the rotated cookies
 * back onto the response.
 *
 * Server Components cannot set cookies, so without this the refresh token
 * rotates in memory, is never persisted, and the user is silently signed out
 * when the access token expires an hour later.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Must be getUser(), not getSession(). getSession() trusts the cookie as-is;
  // getUser() revalidates the token against the auth server. Anything that
  // decides what a person may see needs the checked answer.
  await supabase.auth.getUser();

  return response;
}
