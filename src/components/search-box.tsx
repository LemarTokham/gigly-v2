"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

/**
 * Types straight into the URL, debounced. The results themselves stay
 * server-rendered, so a search is a shareable link and works without JS.
 */
export function SearchBox() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const id = setTimeout(() => {
      const next = new URLSearchParams();
      if (value.trim()) next.set("q", value.trim());
      router.replace(next.toString() ? `/search?${next}` : "/search", { scroll: false });
    }, 200);
    return () => clearTimeout(id);
  }, [value, router]);

  return (
    <label className="border-line bg-card focus-within:border-focus mt-2 flex items-center gap-2.5 rounded-2xl border-2 px-3.5">
      <Icon name="search" className="text-soft" />
      <input
        type="search"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Band, genre or venue"
        autoComplete="off"
        aria-label="Search bands, genres and venues"
        className="min-w-0 flex-1 border-0 bg-transparent py-3 outline-none"
      />
    </label>
  );
}
