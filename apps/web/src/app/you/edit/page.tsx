import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/components/icon";
import { ProfileForm } from "@/components/profile-form";
import { getMyProfile } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Edit profile" };

export default async function EditProfile() {
  const me = await getMyProfile();
  if (!me) redirect("/signin?next=%2Fyou%2Fedit");

  return (
    <div className="pt-4 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl leading-[1.1]">Edit profile</h1>
        <Link
          href="/you"
          aria-label="Close"
          className="border-line bg-card grid size-10 place-items-center rounded-full border"
        >
          <Icon name="x" />
        </Link>
      </div>
      <ProfileForm
        mode="edit"
        initialName={me.display_name ?? ""}
        initialUsername={me.username ?? ""}
        next="/you"
      />
    </div>
  );
}
