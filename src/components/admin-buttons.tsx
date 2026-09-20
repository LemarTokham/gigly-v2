"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/icon";
import { toast } from "@/components/toaster";
import { approveGig, rejectGig } from "@/lib/actions/admin";

export function AdminButtons({ gigId, artist }: { gigId: string; artist: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const run = (what: "approve" | "reject") =>
    start(async () => {
      const result = what === "approve" ? await approveGig(gigId) : await rejectGig(gigId);
      toast(result.ok ? (what === "approve" ? `${artist} is live` : "Rejected") : result.error);
      router.refresh();
    });

  return (
    <div className="mt-3 flex gap-2">
      <button
        onClick={() => run("approve")}
        disabled={pending}
        className="bg-go inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-[var(--go)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
      >
        <Icon name="check" className="size-4" />
        Approve
      </button>
      <button
        onClick={() => run("reject")}
        disabled={pending}
        className="border-line text-ink inline-flex flex-1 items-center justify-center gap-2 rounded-xl border-2 px-4 py-2.5 text-sm font-bold disabled:opacity-50"
      >
        <Icon name="x" className="size-4" />
        Reject
      </button>
    </div>
  );
}
