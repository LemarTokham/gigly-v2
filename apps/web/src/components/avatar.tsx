/**
 * A person's circle: their initial on a colour, as the prototype draws people
 * until photos arrive. Your own is always the hype colour.
 */
export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden="true"
      className={`bg-hype text-on-hype grid shrink-0 place-items-center rounded-full font-bold ${
        size === "lg" ? "size-16 text-[26px]" : "size-9 text-sm"
      }`}
    >
      {initial}
    </span>
  );
}
