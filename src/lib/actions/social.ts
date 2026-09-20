"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Follow and attending are plain inserts and deletes. RLS on both tables
 * pins user_id to auth.uid(), so a crafted request cannot act for anyone else
 * and nothing here needs to re-check that.
 */
export async function toggleFollow(artistId: string, path: string): Promise<Result> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to follow" };

  const { data: existing } = await db
    .from("follows")
    .select("artist_id")
    .eq("user_id", user.id)
    .eq("artist_id", artistId)
    .maybeSingle();

  const { error } = existing
    ? await db.from("follows").delete().eq("user_id", user.id).eq("artist_id", artistId)
    : await db.from("follows").insert({ user_id: user.id, artist_id: artistId });

  if (error) return { ok: false, error: error.message };
  revalidatePath(path);
  return { ok: true };
}

export async function toggleAttending(gigId: string, path: string): Promise<Result> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to save this" };

  const { data: existing } = await db
    .from("attending")
    .select("gig_id")
    .eq("user_id", user.id)
    .eq("gig_id", gigId)
    .maybeSingle();

  const { error } = existing
    ? await db.from("attending").delete().eq("user_id", user.id).eq("gig_id", gigId)
    : await db.from("attending").insert({ user_id: user.id, gig_id: gigId });

  if (error) return { ok: false, error: error.message };
  revalidatePath(path);
  return { ok: true };
}
