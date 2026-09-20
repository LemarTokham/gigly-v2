"use client";

import { useEffect, useState } from "react";

const EVENT = "gigly:toast";

/** Fire from anywhere on the client. Avoids threading context through the
 *  server-rendered tree just to show a message. */
export function toast(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function Toaster() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const onToast = (e: Event) => {
      setMessage((e as CustomEvent<string>).detail);
      clearTimeout(timer);
      timer = setTimeout(() => setMessage(null), 3200);
    };
    window.addEventListener(EVENT, onToast);
    return () => {
      window.removeEventListener(EVENT, onToast);
      clearTimeout(timer);
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-ink text-bg fixed bottom-[calc(84px+env(safe-area-inset-bottom,0px))] left-1/2 z-[60] max-w-[min(92vw,460px)] -translate-x-1/2 rounded-xl px-4 py-2.5 text-center text-sm font-semibold"
    >
      {message}
    </div>
  );
}
