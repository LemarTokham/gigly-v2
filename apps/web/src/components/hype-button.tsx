"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/components/toaster";
import { castHype, takeBackHype } from "@/lib/actions/hype";

type Props = {
  gigId: string;
  /** The show's name, for the toast and the screen-reader label. */
  showName: string;
  hyped: boolean;
  /** false once doors have opened, or for a show still awaiting approval */
  hypeable: boolean;
  hypesLeft: number;
  signedIn: boolean;
  path: string;
  variant?: "round" | "wide";
};

export function HypeButton({
  gigId,
  showName,
  hyped,
  hypeable,
  hypesLeft,
  signedIn,
  path,
  variant = "round",
}: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(hyped);

  // Spent out only blocks casting. Taking one back must always stay available,
  // or a user who spends all three can never change their mind.
  const spent = !on && hypesLeft === 0;
  const disabled = pending || !hypeable || (signedIn && spent);

  const click = () => {
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent(path)}`);
      return;
    }
    start(async () => {
      const next = !on;
      setOn(next);
      const result = next
        ? await castHype(gigId, path)
        : await takeBackHype(gigId, path);

      if (!result.ok) {
        setOn(!next);
        // No username yet: picking one is the way forward, not an error.
        if (result.code === "GY026") {
          router.push(`/welcome?next=${encodeURIComponent(path)}`);
          return;
        }
        toast(result.message);
        return;
      }
      toast(
        next
          ? `Hyped ${showName}. ${result.left ? `${result.left} left this week` : "That's all three"}`
          : "Hype taken back",
      );
      router.refresh();
    });
  };

  const label = !hypeable ? "Hypes closed" : on ? "Hyped" : "Hype";

  if (variant === "wide") {
    return (
      <button
        onClick={click}
        disabled={disabled}
        aria-pressed={on}
        className={`inline-flex flex-1 items-center justify-center gap-[7px] rounded-xl border-2 px-4 py-3 text-base font-bold disabled:opacity-40 ${
          on ? "text-hype border-hype bg-transparent" : "bg-hype border-hype text-on-hype"
        }`}
      >
        <Icon name="flame" />
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={click}
      disabled={disabled}
      aria-pressed={on}
      aria-label={on ? `Take back hype for ${showName}` : `Hype ${showName}`}
      className={`border-hype grid size-[42px] shrink-0 place-items-center rounded-full border-2 disabled:opacity-35 ${
        on ? "bg-hype text-on-hype" : "text-hype"
      }`}
    >
      <Icon name="flame" />
    </button>
  );
}
