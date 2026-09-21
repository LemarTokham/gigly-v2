"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** localhost, or anything on a private network — i.e. this machine in dev. */
function isLocalHost(host: string) {
  return (
    /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host) ||
    /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
  );
}

/**
 * Where Supabase should send the browser back to.
 *
 * This has to be the host the person is actually on, not a configured one.
 * PKCE stores a code verifier in a cookie before handing off to the provider,
 * and cookies are per-origin: starting at localhost:3000 but returning to
 * 192.168.1.252:3000 means the verifier is never sent back, and the exchange
 * fails with "code verifier not found". Same machine, different origin.
 *
 * The request host is only trusted when it is one we recognise, since a forged
 * Host header would otherwise decide where the sign-in lands.
 */
async function origin() {
  const h = await headers();
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const host = h.get("x-forwarded-host") ?? h.get("host");

  if (!host) return configured ?? "http://localhost:3000";

  const known = configured ? new URL(configured).host === host : false;
  if (!known && !isLocalHost(host)) return configured ?? "http://localhost:3000";

  const proto = h.get("x-forwarded-proto") ?? (isLocalHost(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signInWithGoogle(formData: FormData) {
  const next = (formData.get("next") as string) || "/";
  const db = await createClient();

  const { data, error } = await db.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) {
    redirect(`/signin?error=${encodeURIComponent(error?.message ?? "Could not start sign in")}`);
  }
  redirect(data.url);
}

export async function sendMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const next = (formData.get("next") as string) || "/";

  if (!email) redirect("/signin?error=Enter+your+email+address");

  const db = await createClient();
  const { error } = await db.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${await origin()}/auth/confirm?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) redirect(`/signin?error=${encodeURIComponent(error.message)}`);
  redirect(`/signin?sent=${encodeURIComponent(email)}`);
}

export async function signOut() {
  const db = await createClient();
  await db.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
