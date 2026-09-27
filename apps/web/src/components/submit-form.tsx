"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Icon } from "@/components/icon";
import { submitGig, type SubmitState } from "@/lib/actions/submit";

type Venue = { id: string; name: string };
type DayOption = { value: string; label: string };

const ROLES = [
  { value: "artist", label: "The artist" },
  { value: "venue", label: "Venue or promoter" },
  { value: "fan", label: "A fan" },
] as const;

export function SubmitForm({ venues, days }: { venues: Venue[]; days: DayOption[] }) {
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitGig, {
    status: "idle",
  });
  const [role, setRole] = useState<string>("artist");

  const prior = state.status === "error" ? state.values : undefined;

  if (state.status === "sent") {
    return (
      <div className="pt-4 pb-6">
        <h1 className="font-display text-2xl leading-[1.1]">Sent for checking</h1>
        <ul className="mt-3">
          <li className="border-line flex items-start gap-3 border-b py-3 font-semibold">
            <Icon name="clock" className="text-hype mt-px" />
            <span>
              Every new gig is checked before anyone else sees it
              <i className="text-soft block text-sm font-normal not-italic">
                Usually the same day. Until then only you can see it.
              </i>
            </span>
          </li>
          <li className="border-line flex items-start gap-3 border-b py-3 font-semibold">
            <Icon name="check" className="text-hype mt-px" />
            <span>
              {role === "fan" ? "Artists and venues can skip the queue" : "Claim your page to skip the queue"}
              <i className="text-soft block text-sm font-normal not-italic">
                Once a page is proven to be theirs, their gigs go live straight away.
              </i>
            </span>
          </li>
        </ul>
        <div className="mt-4 flex gap-2">
          <Link
            href={`/gig/${state.slug}`}
            className="bg-ink text-bg border-ink inline-flex flex-1 items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-bold"
          >
            See it
          </Link>
          <Link
            href="/"
            className="border-line text-ink inline-flex flex-1 items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-bold"
          >
            Done
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="pt-4 pb-6">
      <h1 className="font-display text-2xl leading-[1.1]">Add a gig</h1>

      <fieldset className="mt-3.5">
        <legend className="mb-1.5 block text-sm font-bold">You are</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              aria-pressed={role === r.value}
              onClick={() => setRole(r.value)}
              className={`rounded-xl border-2 px-1 py-2.5 text-center text-sm leading-tight font-bold ${
                role === r.value ? "border-ink bg-ink text-bg" : "border-line bg-card"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <input type="hidden" name="role" value={role} />
      </fieldset>

      <label className="mt-3.5 block">
        <span className="mb-1.5 block text-sm font-bold">Headline artist</span>
        <input
          name="name"
          type="text"
          maxLength={80}
          required
          autoComplete="off"
          defaultValue={prior?.name}
          className="border-line bg-card focus:border-focus w-full rounded-xl border-2 px-3 py-2.5 outline-none"
        />
      </label>

      <label className="mt-3.5 block">
        <span className="mb-1.5 block text-sm font-bold">Venue</span>
        <select
          name="venue"
          defaultValue={prior?.venue ?? venues[0]?.id}
          className="border-line bg-card w-full rounded-xl border-2 px-3 py-2.5"
        >
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3.5 block">
        <span className="mb-1.5 block text-sm font-bold">Date</span>
        <select
          name="date"
          defaultValue={prior?.date ?? days[0]?.value}
          className="border-line bg-card w-full rounded-xl border-2 px-3 py-2.5"
        >
          {days.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </label>

      <label className="mt-3.5 block">
        <span className="mb-1.5 block text-sm font-bold">Doors</span>
        <input
          name="time"
          type="time"
          defaultValue={prior?.time ?? "19:30"}
          className="border-line bg-card w-full rounded-xl border-2 px-3 py-2.5"
        />
      </label>

      <label className="mt-3.5 block">
        <span className="mb-1.5 block text-sm font-bold">Price in pounds, 0 for free</span>
        <input
          name="price"
          type="number"
          min={0}
          max={200}
          step={1}
          inputMode="numeric"
          defaultValue={prior?.price ?? "5"}
          className="border-line bg-card w-full rounded-xl border-2 px-3 py-2.5"
        />
      </label>

      <label className="mt-3.5 block">
        <span className="mb-1.5 block text-sm font-bold">
          Link to the gig{role === "fan" ? "" : " (optional)"}
        </span>
        <input
          name="link"
          type="url"
          placeholder="Instagram post or ticket page"
          defaultValue={prior?.link}
          className="border-line bg-card focus:border-focus w-full rounded-xl border-2 px-3 py-2.5 outline-none"
        />
      </label>

      {state.status === "error" && (
        <p className="text-hype mt-3 text-sm font-bold">{state.message}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-ink text-bg border-ink mt-4 flex w-full items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-bold disabled:opacity-50"
      >
        {pending ? "Sending…" : "Send for checking"}
      </button>
    </form>
  );
}
