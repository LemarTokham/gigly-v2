import { Icon, type IconName } from "@/components/icon";

export const metadata = { title: "How hype works" };

const RULES: { icon: IconName; title: string; detail: string }[] = [
  {
    icon: "flame",
    title: "Three hypes a week",
    detail: "Fresh ones every Monday.",
  },
  {
    icon: "ticket",
    title: "You back a show, not a band",
    detail: "The chart is the shows Liverpool is most up for, so it's always something you can go to.",
  },
  {
    icon: "user",
    title: "One per show",
    detail: "So a big number means a lot of different people.",
  },
  {
    icon: "clock",
    title: "A hype counts until doors open",
    detail: "Then the show's on, and the chart moves on to what's next.",
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
        Changed your mind? Take a hype back before doors and it returns to your three.
      </p>
    </div>
  );
}
