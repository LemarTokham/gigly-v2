import { redirect } from "next/navigation";
import { ProfileForm } from "@/components/profile-form";
import { getMyProfile } from "@/lib/queries";
import { safeNext } from "@/lib/safe-next";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pick a username" };

/**
 * Where a first sign-in lands, and where anyone without a username is sent
 * when they try something that needs one. Sign-in makes the account before
 * any form can be shown, so this is the "at signup" step.
 */
export default async function Welcome({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNext((await searchParams).next);
  const me = await getMyProfile();

  if (!me) redirect(`/signin?next=${encodeURIComponent(`/welcome?next=${next}`)}`);
  if (me.username) redirect(next);

  return (
    <div className="pt-4 pb-6">
      <h1 className="font-display text-2xl leading-[1.1]">Pick a username</h1>
      <p className="text-soft mt-2 text-[15px]">
        It&rsquo;s how your friends find you on Gigly. You can change it later.
      </p>
      <ProfileForm mode="setup" initialName={me.display_name ?? ""} initialUsername="" next={next} />
    </div>
  );
}
