"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/components/toaster";
import { castHype, takeBackHype } from "@/lib/actions/hype";

type Props = {
  artistId: string;
  artistName: string;
  hyped: boolean;
  /** false when the artist has no upcoming live gig */
  hypeable: boolean;
  hypesLeft: number;
  signedIn: boolean;
  path: string;
  variant?: "round" | "wide";
};

export function HypeButton({
  artistId,
  artistName,
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
        ? await castHype(artistId, path)
        : await takeBackHype(artistId, path);

      if (!result.ok) {
        setOn(!next);
        toast(result.message);
        return;
      }
      toast(
        next
          ? `Hyped ${artistName}. ${result.left ? `${result.left} left this week` : "That's all three"}`
          : "Hype taken back",
      );
      router.refresh();
    });
  };

  const label = !hypeable ? "No gig to back" : on ? "Hyped" : "Hype";

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
      aria-label={on ? `Take back hype for ${artistName}` : `Hype ${artistName}`}
      className={`border-hype grid size-[42px] shrink-0 place-items-center rounded-full border-2 disabled:opacity-35 ${
        on ? "bg-hype text-on-hype" : "text-hype"
      }`}
    >
      <Icon name="flame" />
    </button>
  );
}
