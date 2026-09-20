# Gigly

A what's-on guide for grassroots gigs in Liverpool, where fans hype local
artists into a weekly chart. The unit is the **artist**, not the ticketed
event, and the chart is about who is worth turning up for rather than what is
selling.

`gigly-prototype.html` is the design and behaviour spec. It is not built on and
not edited.

## Running it

Needs Docker Desktop for the local Supabase stack.

```sh
npm install
npm run db:start     # first run pulls ~10 images, takes a while
npm run dev
```

`npm run db:start` prints a local Studio URL and a mail inbox URL, and writes
nothing to your hosted project.

### Scripts

| script | does |
| --- | --- |
| `npm run db:start` / `db:stop` | local Supabase stack |
| `npm run db:reset` | drop, replay all migrations, reseed |
| `npm run db:types` | regenerate `src/lib/database.types.ts` |
| `npm run db:push` | apply migrations to the hosted project |
| `npm run seed:hypes` | synthetic users + hypes so the chart has data |
| `npm run make:admin -- you@example.com` | grant the approval queue |
| `npm test` | hype rules, social, submission, dates |

`scripts/supabase.sh` wraps the CLI so it finds Docker Desktop's binary and
socket under `$HOME` without anything being added to your shell profile.

### Environment

Two env files, read by two different programs:

- **`.env.local`** — Next.js. Supabase URL and keys.
- **`.env`** — the Supabase CLI. OAuth provider credentials referenced from
  `config.toml` as `env(...)`, currently
  `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `..._SECRET`.

Both are gitignored. `.env.local` points at the local stack and holds no secrets — those
credentials are the same on every local install. Hosted project keys live in
`.env.production.local`, and go into Vercel at deploy time. Both are gitignored.

## The hype rules

All enforced in the database, not the UI. Assume people will try to cheat.

- Three hypes per user per week, resetting Monday 00:00 **Europe/London** —
  computed in London wall-clock time so the reset does not drift by an hour
  under BST.
- One live hype per artist per user. One row per pair, ever: re-hyping after
  the window lapses updates `created_at` rather than inserting a second row.
- Only artists with a `live` gig still to come can be hyped. Hyping opens when
  the gig is listed and closes when it starts. Pending gigs do not count, so an
  unapproved submission cannot lift anyone up the chart.
- Every hype is worth exactly 1 point. No weighting by followers or capacity.
- A hype counts for 7 days from when it was cast, then stops counting. Artist
  scores are never reset; only the user's own allowance resets.
- Taking a hype back returns it to the allowance.

Writes go through `cast_hype()` and `take_back_hype()`; direct DML on `hypes`
is revoked. The allowance cannot be enforced by an RLS policy alone — a policy
is a per-row boolean with no serialisation, so two concurrent inserts both see
"2 of 3 used" and both succeed. The functions take a transaction-scoped
advisory lock keyed on the user.

The up and down arrows are derived from the hypes table, not a daily snapshot:
yesterday's chart is the same query with the window shifted back 24 hours. That
avoids a cron job and a snapshot table. The tradeoff is that a hype cast and
then taken back leaves no trace, so yesterday's position can be slightly off.
Fine for an arrow; if the figure ever needs to be exact it wants a real
`artist_rank_snapshots` table written daily.

Error codes the UI branches on:

| code | meaning |
| --- | --- |
| `GY001` | no hypes left this week |
| `GY002` | already hyping this artist, still inside the 7 day window |
| `GY003` | artist has no upcoming live gig |
| `GY004` | no hype to take back |

## Auth

Google OAuth and magic link. Sessions are cookie-based and refreshed in
middleware, because a Server Component cannot set cookies — without that the
refresh token rotates in memory, is never written back, and the user is quietly
signed out an hour later.

Magic links use a custom email template pointing at `/auth/confirm` with a
token hash. Supabase's default link returns tokens in a URL fragment, which the
server never receives, so a server-rendered app cannot establish a session
from it.

Session checks use `getUser()`, never `getSession()`. `getSession()` trusts the
cookie as it stands; `getUser()` revalidates it against the auth server.

## Submitting a gig

Submissions go through `submit_gig()`, one security definer function, rather
than three client-side inserts. Creating the artist, the gig and the link
between them has to be atomic, and keeping it server-side means `artists` can
stay admin-only for direct writes while a signed-in user can still list a band
that has no page yet.

`status` and `submitted_by` are set inside the function, never taken from the
caller, so nothing arrives pre-approved or under someone else's name. A pending
gig is visible only to whoever submitted it, and `artist_is_hypeable` requires
a live gig, so nothing in the queue can move the chart.

`/admin` 404s rather than 403s for non-admins: a page that announces itself
tells everyone it is there.

## Two things that are not the prototype

**Nights, not calendar days.** A gig at 00:30 on Saturday is Friday night out.
Listings cut the night at 4am, so the day filters group a late gig with the
evening it belongs to. The prototype buckets on the calendar day and puts that
gig under Saturday.

**Routes, not just sheets.** Tapping a gig opens a bottom sheet as it does in
the prototype, but each one is also a real server-rendered route. Next's
intercepting routes render the same component either way, so a pasted link
opens the full page with its Open Graph tags rather than a modal over nothing.

## Layout

```
supabase/migrations/   schema, policies, functions, views
supabase/seed.sql      GENERATED — run scripts/generate-seed.mjs
scripts/               seed generation, prototype data extraction, CLI wrapper
src/lib/supabase/      browser, server and service-role clients
tests/                 hype rules
```

Seed data is lifted from the prototype's `VENUES` / `ARTISTS` / `GIGS` arrays.
Venues are real Liverpool rooms; artists and gigs are invented. Gig times are
offsets from the date the seed runs, so a reset always yields a listing with
gigs still to come.
