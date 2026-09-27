import Link from "next/link";
import { notFound } from "next/navigation";
import { GigImage } from "@/components/gig-image";
import { Icon } from "@/components/icon";
import { AdminButtons } from "@/components/admin-buttons";
import { createClient } from "@/lib/supabase/server";
import { clockTime, dayWord, money, nightOf, todayNight } from "@/lib/format";
import type { GigRow } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "Approvals" };

export default async function AdminPage() {
  const db = await createClient();
  const { data: isAdmin } = await db.rpc("is_admin");

  // Not 403: an admin page that announces itself tells everyone it exists.
  if (!isAdmin) notFound();

  const { data } = await db
    .from("gigs")
    .select(`
      id, slug, starts_at, price_pence, ticket_url, status, submitted_by, submitted_as,
      source, source_ref, source_title, imported_at, image_url,
      venue:venues!inner ( id, name, slug, area, capacity, map_x, map_y ),
      lineup:gig_artists ( position, artist:artists!inner (
        id, name, slug, genre, genre_group, from_area, photo_url, art_seed, art_palette, art_band
      ) )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  const pending = (data ?? []) as unknown as (GigRow & {
    submitted_as: string | null;
    source: string;
    source_ref: string | null;
    source_title: string | null;
  })[];
  const today = todayNight();

  return (
    <div className="pt-4 pb-6">
      <div className="mb-3 flex items-baseline justify-between">
        <h1 className="font-display text-2xl leading-[1.1]">Approvals</h1>
        <span className="text-soft text-sm">
          {pending.length} waiting
        </span>
      </div>

      {pending.length === 0 ? (
        <div className="border-line text-soft rounded-2xl border-2 border-dashed px-4 py-[22px] text-center">
          Nothing waiting. Good.
        </div>
      ) : (
        <div className="grid gap-4">
          {pending.map((gig) => {
            const head = gig.lineup[0]?.artist;
            return (
              <article key={gig.id} className="border-line bg-card overflow-hidden rounded-2xl border">
                {head && (
                  <Link href={`/gig/${gig.slug}`} className="relative block aspect-[16/10] w-full text-white">
                    <GigImage gig={gig} />
                    <span className="pointer-events-none absolute inset-x-0 top-[40%] bottom-0 bg-gradient-to-t from-[rgba(10,6,20,0.88)] to-transparent" />
                    <span className="absolute right-3.5 bottom-3 left-3.5 z-10">
                      <b className="font-display block text-[clamp(20px,6vw,26px)] leading-[1.04]">
                        {head.name}
                      </b>
                    </span>
                  </Link>
                )}
                <div className="p-3.5">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <Icon name="clock" className="text-soft size-4" />
                    {dayWord(nightOf(gig.starts_at), today)}, {clockTime(gig.starts_at)}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold">
                    <Icon name="pin" className="text-soft size-4" />
                    {gig.venue.name}, {gig.venue.area} · {money(gig.price_pence)}
                  </p>
                  <p className="mt-1.5 flex items-center gap-2 text-sm font-semibold">
                    <Icon name={gig.source === "submission" ? "user" : "bars"} className="text-soft size-4" />
                    {gig.source === "submission" ? (
                      <>
                        Submitted as{" "}
                        {gig.submitted_as === "artist"
                          ? "the artist"
                          : gig.submitted_as === "venue"
                            ? "the venue or promoter"
                            : gig.submitted_as === "fan"
                              ? "a fan"
                              : "unspecified"}
                      </>
                    ) : (
                      <>
                        Imported from {gig.source}
                        <span className="bg-raise text-soft rounded-full px-2 py-0.5 text-[11px] font-bold">
                          not a person
                        </span>
                      </>
                    )}
                  </p>
                  {/* Two thirds of imported events carry no artist list, so the
                      name was read out of the title. Showing what it was read
                      from is the difference between spotting a bad parse and
                      approving a junk artist page. */}
                  {gig.source_title && (
                    <p className="border-line bg-bg text-soft mt-2 rounded-xl border px-2.5 py-2 text-[13px]">
                      Name read from:{" "}
                      <span className="text-ink font-semibold">{gig.source_title}</span>
                    </p>
                  )}

                  {gig.ticket_url ? (
                    <a
                      href={gig.ticket_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-soft mt-1.5 flex items-center gap-2 text-sm font-semibold underline"
                    >
                      <Icon name="ticket" className="size-4" />
                      Check the link
                    </a>
                  ) : (
                    <p className="text-soft mt-1.5 flex items-center gap-2 text-sm font-semibold">
                      <Icon name="ticket" className="size-4" />
                      No link given
                    </p>
                  )}

                  <AdminButtons gigId={gig.id} artist={head?.name ?? "That gig"} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
