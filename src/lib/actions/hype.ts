"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type HypeResult =
  | { ok: true; hyped: boolean; left: number }
  | { ok: false; code: string; message: string };

/** Maps the database's error codes to the words the prototype uses. */
const MESSAGES: Record<string, string> = {
  GY001: "That's all three this week. Fresh hypes on Monday.",
  GY002: "You're already backing them.",
  GY003: "They need a gig coming up before you can back them.",
  GY004: "You weren't backing them.",
  "28000": "Sign in to back an artist.",
};

async function remaining(): Promise<number> {
  const db = await createClient();
  const { data } = await db.rpc("hypes_remaining");
  return data ?? 0;
}

export async function castHype(artistId: string, path: string): Promise<HypeResult> {
  const db = await createClient();
  const { error } = await db.rpc("cast_hype", { p_artist_id: artistId });

  if (error) {
    const code = error.code ?? "";
    return { ok: false, code, message: MESSAGES[code] ?? "That didn't work. Try again." };
  }

  revalidatePath(path);
  revalidatePath("/chart");
  return { ok: true, hyped: true, left: await remaining() };
}

export async function takeBackHype(artistId: string, path: string): Promise<HypeResult> {
  const db = await createClient();
  const { error } = await db.rpc("take_back_hype", { p_artist_id: artistId });

  if (error) {
    const code = error.code ?? "";
    return { ok: false, code, message: MESSAGES[code] ?? "That didn't work. Try again." };
  }

  revalidatePath(path);
  revalidatePath("/chart");
  return { ok: true, hyped: false, left: await remaining() };
}
