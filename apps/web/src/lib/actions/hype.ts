"use server";

import { revalidatePath } from "next/cache";
import { hypeErrorMessage } from "@gigly/shared";
import { createClient } from "@/lib/supabase/server";

export type HypeResult =
  | { ok: true; hyped: boolean; left: number }
  | { ok: false; code: string; message: string };

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
    return { ok: false, code, message: hypeErrorMessage(code) };
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
    return { ok: false, code, message: hypeErrorMessage(code) };
  }

  revalidatePath(path);
  revalidatePath("/chart");
  return { ok: true, hyped: false, left: await remaining() };
}
