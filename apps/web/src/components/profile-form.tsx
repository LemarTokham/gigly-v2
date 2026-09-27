"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { validateUsername } from "@gigly/shared";
import { toast } from "@/components/toaster";
import { saveProfile } from "@/lib/actions/profile";

/**
 * Name and @username, as the prototype's "Pick a username" sheet: the same
 * fields, limits and words, whether it is the first time or an edit.
 */
export function ProfileForm({
  mode,
  initialName,
  initialUsername,
  next,
}: {
  mode: "setup" | "edit";
  initialName: string;
  initialUsername: string;
  next: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Add your name.");
    const check = validateUsername(username);
    if (!check.ok) return setError(check.message);

    setError(null);
    start(async () => {
      const result = await saveProfile(name, username);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      toast(result.first ? `Welcome to Gigly, @${result.username}` : "Profile saved");
      router.replace(next);
      router.refresh();
    });
  };

  const field = "border-line bg-card focus:border-focus w-full rounded-xl border-2 px-3 py-2.5 outline-none";

  return (
    <form onSubmit={submit} noValidate>
      <label className="mt-3.5 block">
        <span className="mb-1.5 block text-sm font-bold">Name</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={30}
          autoComplete="given-name"
          autoFocus={mode === "setup"}
          className={field}
        />
      </label>

      <label className="mt-3.5 block">
        <span className="mb-1.5 block text-sm font-bold">Username</span>
        <span className="border-line bg-card focus-within:border-focus flex items-center rounded-xl border-2 pl-3">
          <span aria-hidden="true" className="text-soft font-bold">
            @
          </span>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={21}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-describedby="username-help"
            className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 pl-0.5 outline-none"
          />
        </span>
      </label>

      {error ? (
        <p id="username-help" role="alert" className="text-hype mt-2 text-sm font-bold">
          {error}
        </p>
      ) : (
        <p id="username-help" className="text-soft mt-1.5 text-sm">
          3 to 20 characters. Letters, numbers, dots and underscores.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-ink text-bg border-ink mt-4 inline-flex w-full items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-bold disabled:opacity-50"
      >
        {mode === "setup" ? "Continue" : "Save"}
      </button>
    </form>
  );
}
