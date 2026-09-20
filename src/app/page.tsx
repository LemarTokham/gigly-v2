/**
 * Step 1 placeholder. Exists to prove the token layer and fonts resolve in both
 * themes — replaced by the real what's-on page in step 2.
 */

const TOKENS = [
  "bg",
  "ink",
  "soft",
  "card",
  "line",
  "raise",
  "hype",
  "on-hype",
  "gold",
  "go",
  "down",
  "focus",
  "river",
  "land",
  "road",
] as const;

export default function Home() {
  return (
    <main className="mx-auto max-w-[500px] px-4 pb-24">
      <header className="flex items-baseline gap-2.5 py-3">
        <h1 className="font-display text-[28px] leading-none">Gigly</h1>
        <span className="text-[13px] font-semibold text-soft">Liverpool</span>
      </header>

      <p className="text-soft text-sm">
        Step 1 — project setup. Schema and seed data next.
      </p>

      <h2 className="font-display mt-6 mb-2 text-xl">Type</h2>
      <div className="border-line bg-card rounded-2xl border p-4">
        <p className="font-display text-2xl leading-tight">Bowlby One display</p>
        <p className="mt-2 text-base">Archivo regular 400</p>
        <p className="text-base font-semibold">Archivo semibold 600</p>
        <p className="text-base font-bold">Archivo bold 700</p>
      </div>

      <h2 className="font-display mt-6 mb-2 text-xl">Palette</h2>
      <ul className="grid grid-cols-3 gap-2">
        {TOKENS.map((t) => (
          <li
            key={t}
            className="border-line bg-card overflow-hidden rounded-xl border"
          >
            <div
              className="border-line h-12 border-b"
              style={{ background: `var(--${t})` }}
            />
            <span className="text-soft block px-2 py-1.5 text-xs font-semibold">
              {t}
            </span>
          </li>
        ))}
      </ul>

      <p className="text-soft mt-6 text-sm">
        Dark is the default. Switch your device to light and this should flip to
        the prototype&rsquo;s light palette.
      </p>
    </main>
  );
}
