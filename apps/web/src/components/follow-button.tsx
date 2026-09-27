"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Icon } from "@/components/icon";
import { toggleFollow } from "@/lib/actions/social";

export function FollowButton({
  artistId,
  following,
  signedIn,
  path,
}: {
  artistId: string;
  following: boolean;
  signedIn: boolean;
  path: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(following);

  return (
    <button
      aria-pressed={on}
      disabled={pending}
      onClick={() => {
        if (!signedIn) {
          router.push(`/signin?next=${encodeURIComponent(path)}`);
          return;
        }
        start(async () => {
          setOn(!on);
          await toggleFollow(artistId, path);
        });
      }}
      className={`inline-flex flex-1 items-center justify-center gap-[7px] rounded-xl border-2 px-4 py-3 text-base font-bold ${
        on ? "border-ink text-ink" : "border-line text-ink"
      }`}
    >
      {on && <Icon name="check" />}
      {on ? "Following" : "Follow"}
    </button>
  );
}
