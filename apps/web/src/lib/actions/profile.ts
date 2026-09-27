"use server";

import { revalidatePath } from "next/cache";
import { usernameErrorMessage, validateUsername } from "@gigly/shared";
import { createClient } from "@/lib/supabase/server";

export type ProfileResult =
  | { ok: true; username: string; first: boolean }
  | { ok: false; message: string };

/** The prototype's name field allows 30; the database allows up to 60. */
const NAME_MAX = 30;

/**
 * Sets the signed-in user's name and @username, for the first time or again.
 *
 * Checked here first with the same rules both apps use, so the common mistakes
 * come back without a round trip to the database; set_username() is still the
 * authority on format, the reserved names, uniqueness and the 30-day hold.
 */
export async function saveProfile(name: string, username: string): Promise<ProfileResult> {
  const cleanName = name.trim().replace(/\s+/g, " ");
  if (!cleanName) return { ok: false, message: "Add your name." };
  if (cleanName.length > NAME_MAX) return { ok: false, message: `Keep your name to ${NAME_MAX} characters.` };

  const check = validateUsername(username);
  if (!check.ok) return { ok: false, message: check.message };

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, message: "Sign in first." };

  const { data: before } = await db.from("profiles").select("username").eq("id", user.id).maybeSingle();

  const set = await db.rpc("set_username", { p_username: check.username });
  if (set.error) return { ok: false, message: usernameErrorMessage(set.error.code, username) };

  const { error } = await db.from("profiles").update({ display_name: cleanName }).eq("id", user.id);
  if (error) return { ok: false, message: "That didn't save. Try again." };

  revalidatePath("/", "layout");
  return { ok: true, username: set.data, first: !before?.username };
}
