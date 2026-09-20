"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { Icon } from "@/components/icon";
import { toggleAttending } from "@/lib/actions/social";

export function GoingButton({
  gigId,
  going,
  signedIn,
  path,
  variant = "round",
}: {
  gigId: string;
  going: boolean;
  signedIn: boolean;
  path: string;
  variant?: "round" | "wide";
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useOptimistic(going);

  const click = () => {
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent(path)}`);
      return;
    }
    start(async () => {
      setOn(!on);
      await toggleAttending(gigId, path);
    });
  };

  if (variant === "wide") {
    return (
      <button
        aria-pressed={on}
        disabled={pending}
        onClick={click}
        className={`inline-flex flex-1 items-center justify-center gap-[7px] rounded-xl border-2 px-4 py-3 text-base font-bold ${
          on ? "bg-go border-go text-white" : "border-line text-ink"
        }`}
      >
        <Icon name={on ? "check" : "plus"} />
        {on ? "Going" : "I'm going"}
      </button>
    );
  }

  return (
    <button
      aria-pressed={on}
      disabled={pending}
      onClick={click}
      aria-label={on ? "Going. Tap to remove" : "I'm going"}
      className={`grid size-[42px] shrink-0 place-items-center rounded-full border-2 ${
        on ? "bg-go border-go text-white" : "border-line text-ink"
      }`}
    >
      <Icon name={on ? "check" : "plus"} />
    </button>
  );
}
