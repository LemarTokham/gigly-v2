import Link from "next/link";
import { Icon } from "@/components/icon";

/**
 * Hype pips are shown spent-out until auth lands in step 3 and the real
 * allowance is readable.
 */
export function TopBar({ hypesLeft = 3 }: { hypesLeft?: number }) {
  return (
    <header className="bg-bg sticky top-[env(safe-area-inset-top,0px)] z-30 flex items-center justify-between pt-3 pb-2.5">
      <h1 className="font-display flex items-baseline gap-2.5 text-[28px] leading-none">
        Gigly
        <span className="text-soft font-body inline-flex items-center gap-[3px] text-[13px] font-semibold">
          <Icon name="pin" className="size-3.5" />
          Liverpool
        </span>
      </h1>

      <div className="flex items-center gap-2">
        <Link
          href="/search"
          aria-label="Search"
          className="border-line bg-card grid size-10 place-items-center rounded-full border"
        >
          <Icon name="search" />
        </Link>
        <span
          className="border-line bg-card flex items-center gap-0.5 rounded-full border px-2.5 py-[7px]"
          aria-label={`${hypesLeft} of 3 hypes left`}
        >
          {[0, 1, 2].map((i) => (
            <Icon
              key={i}
              name="flame"
              className={i < hypesLeft ? "text-hype" : "text-line"}
            />
          ))}
        </span>
      </div>
    </header>
  );
}
