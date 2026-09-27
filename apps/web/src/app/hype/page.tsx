import { Icon, type IconName } from "@/components/icon";

export const metadata = { title: "How hype works" };

const RULES: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "flame",
    title: "Three hypes a week",
    detail: "Fresh ones every Monday.",
  },
  {
    icon: "user",
    title: "One per artist",
    detail: "So a big number means a lot of different people.",
  },
  {
    icon: "cal",
    title: "Only artists with a Liverpool gig coming up",
    detail: "You back them before the show, to help fill the room.",
  },
  {
    icon: "clock",
    title: "A hype counts for seven days",
    detail: "Then it fades, so the chart shows who people back right now.",
  },
];

export default function HypeRules() {
  return (
    <div className="pt-4 pb-6">
      <h1 className="font-display text-2xl leading-[1.1]">How hype works</h1>
      <ul className="mt-3">
        {RULES.map((r) => (
          <li key={r.title} className="border-line flex items-start gap-3 border-b py-3 font-semibold">
            <Icon name={r.icon} className="text-hype mt-px" />
            <span>
              {r.title}
              <i className="text-soft block text-sm font-normal not-italic">{r.detail}</i>
            </span>
          </li>
        ))}
      </ul>
      <p className="text-soft mt-4 text-sm">
        Changed your mind? Take a hype back and it returns to your three.
      </p>
    </div>
  );
}
