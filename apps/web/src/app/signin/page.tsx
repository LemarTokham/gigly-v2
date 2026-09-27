import { redirect } from "next/navigation";
import { Icon } from "@/components/icon";
import { sendMagicLink, signInWithGoogle } from "@/lib/actions/auth";
import { getUser } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function SignIn({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; sent?: string }>;
}) {
  const sp = await searchParams;
  if (await getUser()) redirect(sp.next ?? "/");

  const next = sp.next?.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";

  return (
    <div className="pt-6 pb-8">
      <h1 className="font-display text-2xl leading-[1.1]">Sign in to Gigly</h1>
      <p className="text-soft mt-2 text-[15px]">
        So your hypes, the artists you follow and the gigs you&rsquo;re going to stay yours.
      </p>

      {sp.sent ? (
        <div className="border-line bg-card mt-5 rounded-2xl border p-4">
          <b className="font-display block text-lg leading-tight font-normal">Check your email</b>
          <p className="text-soft mt-1.5 text-sm">
            We sent a link to <span className="text-ink font-semibold">{sp.sent}</span>. It expires
            in an hour.
          </p>
        </div>
      ) : (
        <>
          <form action={signInWithGoogle} className="mt-5">
            <input type="hidden" name="next" value={next} />
            <button
              type="submit"
              className="border-line bg-card text-ink flex w-full items-center justify-center gap-2.5 rounded-xl border-2 px-4 py-3 text-base font-bold"
            >
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
                <path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.6z" />
                <path fill="#34A853" d="M12 24c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A12 12 0 0 0 12 24z" />
                <path fill="#FBBC05" d="M5.6 14.7a7.2 7.2 0 0 1 0-4.6v-3H1.8a12 12 0 0 0 0 10.6l3.8-3z" />
                <path fill="#EA4335" d="M12 4.8c1.7 0 3.2.6 4.4 1.7l3.3-3.3A12 12 0 0 0 1.8 7.1l3.8 3c.9-2.7 3.4-4.7 6.4-4.7z" />
              </svg>
              Continue with Google
            </button>
          </form>

          <div className="text-soft my-5 flex items-center gap-3 text-[13px] font-semibold">
            <span className="bg-line h-px flex-1" />
            or
            <span className="bg-line h-px flex-1" />
          </div>

          <form action={sendMagicLink}>
            <input type="hidden" name="next" value={next} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-bold">Email</span>
              <input
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="border-line bg-card focus:border-focus w-full rounded-xl border-2 px-3 py-2.5 outline-none"
              />
            </label>
            <button
              type="submit"
              className="bg-ink text-bg border-ink mt-3 flex w-full items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 text-base font-bold"
            >
              <Icon name="go" />
              Email me a link
            </button>
          </form>
        </>
      )}

      {sp.error && <p className="text-hype mt-4 text-sm font-bold">{sp.error}</p>}
    </div>
  );
}
