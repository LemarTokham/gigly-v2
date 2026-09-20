"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";

const TABS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Gigs", icon: "cal" },
  { href: "/map", label: "Map", icon: "map" },
  { href: "/chart", label: "Chart", icon: "bars" },
  { href: "/you", label: "You", icon: "user" },
];

export function TabBar() {
  const path = usePathname();

  return (
    <nav
      aria-label="Sections"
      className="border-line bg-bg fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="mx-auto grid max-w-[500px] grid-cols-4">
        {TABS.map((t) => {
          const active = t.href === "/" ? path === "/" : path.startsWith(t.href);
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`grid justify-items-center gap-[3px] px-1 pt-2.5 pb-2 text-xs font-bold ${
                active ? "text-ink" : "text-soft"
              }`}
            >
              <Icon name={t.icon} className={`size-6 ${active ? "text-hype" : ""}`} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
