import Link from "next/link";
import { HYPES_PER_WEEK } from "@gigly/shared";
import { TopBar } from "@/components/top-bar";
import { ArtistImage } from "@/components/artist-image";
import { GigImage } from "@/components/gig-image";
import { Icon } from "@/components/icon";
import { signOut } from "@/lib/actions/auth";
import { clockTime, dayWord, nightOf, todayNight } from "@/lib/format";
import {
  getHypeState,
  getMyFollowing,
  getMyGoing,
  getMyHypes,
  getUser,
  isAdminUser,
} from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "You" };

export default async function YouPage() {
  const user = await getUser();
  const today = todayNight();

  if (!user) {
    return (
      <>
        <TopBar />
        <div className="border-line text-soft mt-4 rounded-2xl border-2 border-dashed px-4 py-[22px] text-center">
          <p>Sign in to back artists and keep track of what you&rsquo;re going to.</p>
          <Link
            href="/signin?next=%2Fyou"
            className="bg-ink text-bg border-ink mt-3 inline-flex items-center justify-center rounded-xl border-2 px-4 py-2.5 text-sm font-bold"
          >
            Sign in
          </Link>
        </div>
      </>
    );
  }

  const [following, going, backing, hype, admin] = await Promise.all([
    getMyFollowing(),
    getMyGoing(),
    getMyHypes(),
    getHypeState(),
    isAdminUser(),
  ]);
  const isAdmin = admin;

  return (
    <>
      <TopBar signedIn hypesLeft={hype.left} />

      <div className="border-line bg-card mt-1.5 flex items-center gap-4 rounded-2xl border p-4">
        <span className="flex gap-1" role="img" aria-label={`${hype.left} of ${HYPES_PER_WEEK} hypes left`}>
          {Array.from({ length: HYPES_PER_WEEK }, (_, i) => (
            <Icon
              key={i}
              name="flame"
              className={`size-10 ${i < hype.left ? "text-hype" : "text-line"}`}
            />
          ))}
        </span>
        <span>
          <b className="font-display block text-lg leading-[1.15] font-normal">
            {hype.left} {hype.left === 1 ? "hype" : "hypes"} left
          </b>
          <span className="text-soft text-sm">Fresh ones every Monday</span>
        </span>
      </div>

      {backing.length > 0 && (
        <>
          <div className="mt-[22px] mb-2.5">
            <h2 className="font-display text-xl leading-[1.1]">Backing now</h2>
          </div>
          {backing.map((b) => (
            <div key={b.artist.id} className="border-line flex items-center gap-3 border-b py-2">
              <Link
                href={`/artist/${b.artist.slug}`}
                aria-label={b.artist.name}
                className="relative block size-[54px] shrink-0 overflow-hidden rounded-xl"
              >
                <ArtistImage artist={b.artist} />
              </Link>
              <Link href={`/artist/${b.artist.slug}`} className="min-w-0 flex-1">
                <b className="block text-base leading-tight font-bold">{b.artist.name}</b>
                <i className="text-soft block text-[13px] not-italic">
                  Counts for {b.daysLeft} more {b.daysLeft === 1 ? "day" : "days"}
                </i>
              </Link>
            </div>
          ))}
        </>
      )}

      <div className="mt-[22px] mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-xl leading-[1.1]">Going</h2>
      </div>
      {going.length > 0 ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {going.map((g) => (
            <Link key={g.id} href={`/gig/${g.slug}`} className="w-[168px] shrink-0">
              <span className="relative block aspect-[16/10] overflow-hidden rounded-xl">
                <GigImage gig={g} />
              </span>
              <b className="mt-[7px] block text-[15px] leading-tight font-bold">
                {g.lineup[0].artist.name}
              </b>
              <i className="text-soft block text-[13px] not-italic">
                {dayWord(nightOf(g.starts_at), today)} {clockTime(g.starts_at)}, {g.venue.name}
              </i>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-line text-soft rounded-2xl border-2 border-dashed px-4 py-[22px] text-center">
          Tap + on a gig to save it here.
        </div>
      )}

      <div className="mt-[22px] mb-2.5 flex items-center justify-between">
        <h2 className="font-display text-xl leading-[1.1]">Following</h2>
      </div>
      {following.length > 0 ? (
        <div className="-mx-4 flex gap-3.5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {following.map((a) => (
            <Link key={a.id} href={`/artist/${a.slug}`} className="w-[84px] shrink-0 text-center">
              <span className="border-line inline-block rounded-full border-[3px] p-[3px]">
                <span className="relative block size-[72px] overflow-hidden rounded-full">
                  <ArtistImage artist={a} />
                </span>
              </span>
              <em className="mt-1.5 line-clamp-2 block text-xs leading-tight font-semibold not-italic">
                {a.name}
              </em>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-line text-soft rounded-2xl border-2 border-dashed px-4 py-[22px] text-center">
          Follow an artist and you hear first when they announce a gig.
        </div>
      )}

      {isAdmin && (
        <Link
          href="/admin"
          className="border-line bg-card mt-[22px] flex w-full items-center gap-3 rounded-2xl border p-3.5"
        >
          <Icon name="check" className="text-hype" />
          <span>
            <b className="block text-base leading-tight font-bold">Approvals</b>
            <i className="text-soft block text-[13px] not-italic">Gigs waiting to be checked</i>
          </span>
          <Icon name="go" className="text-soft ml-auto" />
        </Link>
      )}

      <form action={signOut} className="mt-6">
        <button type="submit" className="text-soft text-sm font-bold underline">
          Sign out
        </button>
      </form>
    </>
  );
}
