"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { londonDateTime } from "@/lib/format";

export type SubmitState =
  | { status: "idle" }
  | { status: "sent"; slug: string }
  | { status: "error"; message: string; values: Record<string, string> };

/** Messages come from the database so the rules live in one place. */
export async function submitGig(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const values = Object.fromEntries(
    ["name", "venue", "date", "time", "price", "link", "role"].map((k) => [
      k,
      String(formData.get(k) ?? ""),
    ]),
  );

  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) {
    return { status: "error", message: "Sign in to add a gig.", values };
  }

  if (!values.date || !values.time) {
    return { status: "error", message: "Pick a date and a time.", values };
  }

  const pounds = Number(values.price);
  if (!Number.isFinite(pounds) || pounds < 0) {
    return { status: "error", message: "Check the price.", values };
  }

  const { data, error } = await db.rpc("submit_gig", {
    p_artist_name: values.name,
    p_venue_id: values.venue,
    p_starts_at: londonDateTime(values.date, values.time).toISOString(),
    p_price_pence: Math.round(pounds * 100),
    p_ticket_url: values.link || undefined,
    p_submitted_as: values.role || undefined,
  });

  if (error) {
    return { status: "error", message: error.message, values };
  }

  revalidatePath("/");
  revalidatePath("/you");
  revalidatePath("/admin");
  return { status: "sent", slug: (data as unknown as { slug: string }).slug };
}
