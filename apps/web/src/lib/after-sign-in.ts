import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Where a completed sign-in goes: on to `next`, unless the person has no
 * username yet, in which case picking one comes first and `next` after.
 * This is what makes a first sign-in the "pick a username at signup" step.
 */
export async function afterSignIn(db: SupabaseClient, next: string): Promise<string> {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return next;

  const { data } = await db.from("profiles").select("username").eq("id", user.id).maybeSingle();
  return data?.username ? next : `/welcome?next=${encodeURIComponent(next)}`;
}
