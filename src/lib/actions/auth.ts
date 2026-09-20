"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/** Where Supabase should send the browser back to after the provider. */
async function origin() {
  const h = await headers();
  return (
    process.env.NEXT_PUBLIC_SITE_URL ??
    `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host") ?? "localhost:3000"}`
  );
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
