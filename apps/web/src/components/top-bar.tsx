import Link from "next/link";
import { HYPES_PER_WEEK } from "@gigly/shared";
import { Icon } from "@/components/icon";

/**
 * Hype pips show the full three until step 4 reads the real allowance.
 */
export function TopBar({
  hypesLeft = HYPES_PER_WEEK,
  signedIn = false,
}: {
  hypesLeft?: number;
  signedIn?: boolean;
}) {
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

        {signedIn ? (
          <span
            className="border-line bg-card flex items-center gap-0.5 rounded-full border px-2.5 py-[7px]"
            aria-label={`${hypesLeft} of ${HYPES_PER_WEEK} hypes left`}
          >
            {Array.from({ length: HYPES_PER_WEEK }, (_, i) => (
              <Icon key={i} name="flame" className={i < hypesLeft ? "text-hype" : "text-line"} />
            ))}
          </span>
        ) : (
          <Link
            href="/signin"
            className="border-line bg-card rounded-full border px-3 py-2 text-sm font-bold"
          >
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
