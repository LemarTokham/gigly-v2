import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { afterSignIn } from "@/lib/after-sign-in";
import { safeNext as safeNextPath } from "@/lib/safe-next";

/**
 * The email link is built from the site URL, which knows nothing of where the
 * person was, so the template also carries Supabase's redirect_to: the
 * /auth/confirm?next=... address sendMagicLink asked for. Only its `next`
 * path is used, never its host, so it cannot send anyone off the site.
 */
function nextFromRedirect(redirectTo: string | null): string | null {
  if (!redirectTo) return null;
  try {
    return new URL(redirectTo).searchParams.get("next");
  } catch {
    return null;
  }
}

/** Magic link lands here: verify the token hash and start a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const safeNext = safeNextPath(searchParams.get("next") ?? nextFromRedirect(searchParams.get("redirect_to")));

  if (!token_hash || !type) {
    return NextResponse.redirect(`${origin}/signin?error=That+link+is+not+valid`);
  }

  const db = await createClient();
  const { error } = await db.auth.verifyOtp({ type, token_hash });
  if (error) {
    return NextResponse.redirect(
      `${origin}/signin?error=${encodeURIComponent("That link has expired. Ask for a new one.")}`,
    );
  }

  return NextResponse.redirect(`${origin}${await afterSignIn(db, safeNext)}`);
}
