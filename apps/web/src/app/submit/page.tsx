import { redirect } from "next/navigation";
import { SubmitForm } from "@/components/submit-form";
import { createClient } from "@/lib/supabase/server";
import { addNights, dayWord, todayNight } from "@/lib/format";
import { getUser } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Add a gig" };

export default async function SubmitPage() {
  if (!(await getUser())) redirect("/signin?next=%2Fsubmit");

  const db = await createClient();
  const { data: venues } = await db.from("venues").select("id, name").order("name");

  const today = todayNight();
  const days = Array.from({ length: 21 }, (_, i) => {
    const night = addNights(today, i);
    return { value: night, label: dayWord(night, today) };
  });

  return <SubmitForm venues={venues ?? []} days={days} />;
}
