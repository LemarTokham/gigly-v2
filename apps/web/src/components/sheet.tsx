"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icon";

/**
 * Bottom sheet used only by the intercepted routes. The same page component
 * renders inside here on an in-app tap and full-screen on a cold load of the
 * URL, so a shared link never opens a modal over a blank page.
 */
export function Sheet({ children, label }: { children: React.ReactNode; label: string }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
      if (e.key !== "Tab" || !panel.current) return;

      const focusable = panel.current.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(8,5,14,0.62)]"
      onClick={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="bg-bg text-ink relative max-h-[93%] w-full max-w-[500px] overflow-y-auto rounded-t-[22px]"
      >
        <button
          onClick={() => router.back()}
          aria-label="Close"
          className="absolute top-3 right-3 z-30 grid size-[38px] place-items-center rounded-full bg-[rgba(10,6,20,0.7)] text-white"
        >
          <Icon name="x" />
        </button>
        <div className="px-4">{children}</div>
      </div>
    </div>
  );
}
