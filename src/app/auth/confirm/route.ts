import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Magic link lands here: verify the token hash and start a session. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

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

  return NextResponse.redirect(`${origin}${safeNext}`);
}
