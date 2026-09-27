"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

/**
 * Approve and reject are plain updates gated by the gigs_admin_write policy.
 * A non-admin's update matches no rows rather than failing, so the result is
 * checked rather than trusting the absence of an error.
 */
async function setStatus(gigId: string, status: "live" | "rejected"): Promise<Result> {
  const db = await createClient();

  const { data, error } = await db
    .from("gigs")
    .update({ status })
    .eq("id", gigId)
    .eq("status", "pending")
    .select("id");

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: "Not allowed, or that gig is no longer pending." };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/chart");
  return { ok: true };
}

export async function approveGig(gigId: string) {
  return setStatus(gigId, "live");
}

export async function rejectGig(gigId: string) {
  return setStatus(gigId, "rejected");
}
