# Gigly

A what's-on guide for grassroots gigs in Liverpool, where fans hype local
artists into a weekly chart. The unit is the **artist**, not the ticketed
event, and the chart is about who is worth turning up for rather than what is
selling.

`gigly-prototype.html` is the design and behaviour spec. It is not built on and
not edited.

## Running it

Needs Docker Desktop for the local Supabase stack, and pnpm. pnpm's version is
pinned in `package.json`; corepack, which ships with Node, fetches it.

```sh
corepack enable pnpm   # once per machine
pnpm install
pnpm db:start          # first run pulls ~10 images, takes a while
pnpm dev
```

`pnpm db:start` prints a local Studio URL and a mail inbox URL, and writes
nothing to your hosted project.

### Scripts

| script | does |
| --- | --- |
| `pnpm dev` / `build` / `start` | the website |
| `pnpm lint` / `typecheck` | every workspace, plus the root scripts and tests |
| `pnpm test` | hype rules, social, submission, dates, usernames |
| `pnpm db:start` / `db:stop` | local Supabase stack |
| `pnpm db:reset` | drop, replay all migrations, reseed |
| `pnpm db:types` | regenerate `packages/shared/src/database.types.ts` |
| `pnpm db:push` | apply migrations to the hosted project |
| `pnpm seed:hypes` | synthetic users + hypes so the chart has data |
| `pnpm make:admin you@example.com` | grant the approval queue |
| `pnpm venues:locate --write` | refresh venue coordinates and place ids |
| `pnpm venues:skiddle --write` | map venues to Skiddle venue ids |
| `pnpm venues:load --write` | the real venues and nothing else — for the hosted project |
| `pnpm run import --write` | run every registered import source |
| `pnpm db:clear-demo` | drop the invented sample data locally |
| `pnpm dev:lan` | serve on the LAN address so a phone can use it |

`pnpm run import` needs the `run`: `pnpm import` on its own is pnpm's built-in
lockfile converter.

`scripts/supabase.sh` wraps the CLI so it finds Docker Desktop's binary and
socket under `$HOME` without anything being added to your shell profile.

### Environment

Two env files, read by two different programs:

- **`apps/web/.env.local`** — Next.js, which reads env files from its own
  folder. Supabase URL and keys. The scripts in `scripts/` read it too.
- **`.env`** — the Supabase CLI. OAuth provider credentials referenced from
  `config.toml` as `env(...)`, currently
  `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `..._SECRET`.

`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` goes in `apps/web/.env.local`. It reaches the browser
by design — the Maps JavaScript API runs client-side — so an HTTP referrer
restriction on the key is the actual protection, not secrecy.
`NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` is optional and falls back to Google's demo
id; create your own before deploying.

`apps/web/.env.local` points at the local stack and holds no secrets — those
credentials are the same on every local install. Hosted project keys live in
`apps/web/.env.production.local`, and go into Vercel at deploy time. All three
files are gitignored.

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

The OAuth callback returns to **the host the person started on**, not a
configured one. PKCE stores a code verifier in a cookie before handing off to
the provider, and cookies are per-origin: beginning at `localhost:3000` and
returning to `192.168.1.252:3000` means the verifier never comes back and the
exchange fails with "code verifier not found". Same machine, different origin.
The request host is only trusted when it matches `NEXT_PUBLIC_SITE_URL` or is
a local/private address, so a forged Host header cannot redirect a sign-in.

A consequence worth knowing: signing in at `localhost:3000` does not sign you
in at the LAN address, because they are separate origins with separate
cookies. Pick one and stay on it.

Google sign-in **from a phone** additionally needs Supabase's own callback to
be reachable from the phone. By default it is `http://127.0.0.1:54321/auth/v1/callback`,
which on a phone means the phone. Set `api_url` in `config.toml` to the LAN
address and register that callback in the Google console, or just use a magic
link on the phone — that flow has no provider redirect.

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

## The map

A real Google Map rather than the prototype's hand-drawn SVG. Pins keep the
prototype's language: gig count inside, gold ring for something on tonight,
muted when a venue has nothing coming up.

Venue coordinates come from OpenStreetMap, not Google. Google's terms let you
store a `place_id` indefinitely but not the content behind it — coordinates,
ratings and reviews must not be cached beyond 30 days. So coordinates come
from a source whose licence permits keeping them, the `place_id` is stored, and
ratings and reviews are fetched in the browser when a venue is opened and never
written to our database. The map therefore draws from our own rows with no
Places call on page load; a request is only spent when someone opens a venue.

Coordinates are baked into `supabase/seed.sql` so `db:reset` restores a working
map. `pnpm venues:locate` refreshes them. Two of the eight venues are
street-level rather than exact, because OpenStreetMap has no entry for the room
itself — the script reports which, and rejects any match more than 8km from the
city centre, since "Quarry" otherwise matches a road in Woolton.

## Importing gigs

`scripts/import/` holds the plumbing: a source returns plain objects, the
runner validates them and calls `import_gig()`, and everything lands as
**pending**. An importer is not more trusted than a person — a broken feed
fills the approval queue, not the chart.

Re-running updates rather than duplicating, keyed on `(source, source_ref)`.
A gig already here from another source or from a human submission is
recognised as a duplicate when it matches venue, headliner and a start time
within 90 minutes.

**Skiddle** is the first source. Looking at the eight venues directly showed
why: only Future Yard and Quarry have sites robots.txt permits and that are
not behind Cloudflare, neither publishes `schema.org/Event` data, The
Jacaranda's own listings are Skiddle-powered anyway, Quarry's come from DICE,
and four venues have no website at all. One feed beats eight scrapers.

Skiddle's API is documented as **non-commercial use only**. Fine for a project;
anything that takes money needs an agreement with them.

`SKIDDLE_API_KEY` goes in `apps/web/.env.local` with no `NEXT_PUBLIC_` prefix — unlike
the Maps key it is a real secret and only ever runs in the import script.

Run `pnpm venues:skiddle --write` once to map venues to Skiddle ids,
then `pnpm run import --write`. Venue matches are verified by name, because
a near-miss would quietly attach another room's listings to ours. Those ids
are baked into the seed alongside the coordinates, so `db:reset` does not
quietly break the importer.

Every event brings artwork, and where Skiddle parsed an artist list it brings
that artist's photo and Spotify link too. Images are **referenced from their
CDN, never copied** — the pictures belong to the promoters and to Skiddle, and
their API is non-commercial use only. Around one image in six points at an
object the CDN no longer serves, so every URL is checked once at import and
the dead ones dropped, leaving the artist with their generated poster art
rather than a broken image nothing in the data would flag.

`GigImage` picks, in order: the event's artwork, the headliner's photo, then
the generated art. Everything that shows a gig goes through it.

Two thirds of Skiddle's live events carry no parsed artist list, so the name
is read out of the event title — "AnotherVU: A Tribute to The Velvet
Underground & Nico" becomes "AnotherVU". Where that happens the original title
is kept in `gigs.source_title` and shown in the approval queue, so a bad parse
is obvious rather than becoming a junk artist page. Two other traps in their
data: `entryprice` exists on every event and is empty on all of them (the
money is in `ticketpricing`), and `startdate` carries a `+00:00` offset even
in British Summer Time, so the instant is built from the date plus the door
time read as London local.

After a `db:reset` the admin flag goes with `auth.users`. Sign in again, then
`pnpm make:admin` — it reads `ADMIN_EMAIL` from `apps/web/.env.local` if you set one.

### The live site

The hosted database gets migrations from `pnpm db:push` and nothing else, so
it starts with no venues, and the importer can only attach listings to a venue
that exists. The scripts read whichever env file they are given; pointing them
at `apps/web/.env.production.local` points them at the live database:

```sh
node --env-file=apps/web/.env.production.local scripts/load-venues.mjs --write
node --env-file=apps/web/.env.local --env-file=apps/web/.env.production.local \
  scripts/import/run.mjs --write
node --env-file=apps/web/.env.production.local scripts/make-admin.mjs you@example.com
```

The import takes two files because `SKIDDLE_API_KEY` lives only in
`.env.local`. Node lets a later `--env-file` override an earlier one, so the
Supabase URL and key come from production. Drop `--write` for a dry run first.
Everything lands pending; approve it at `/admin` on the live site.

### Sample data

The seed is invented, and `pnpm db:reset` is what loads it. It never
reaches the hosted project — `db push` applies migrations only — and the test
suite depends on it, so it stays. Seeded gigs carry `source = 'seed'`, and
`pnpm db:clear-demo` removes them locally when you want to look at real
listings without "Dock Leaf" next to them.

Seeded gig times are offsets from the day the seed ran, so the local seed goes
stale. About a week after a reset the seeded bands' gigs have all happened, and
the hype tests that need an upcoming gig fail until the next `pnpm db:reset`.

`scripts/import/polite.mjs` identifies as GiglyBot with a contact URL, obeys
robots.txt for **that** name, and waits a second between requests to a host.
robots.txt is per-user-agent: a site blocking thirty AI crawlers by name has
said nothing about an app importing gig listings, and the parser reads the
rules that actually apply.

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
apps/web/              the website (Next.js)
  src/lib/supabase/    browser, server and service-role clients
  tests/               date handling
packages/shared/       @gigly/shared: generated database types, hype numbers
                       and messages, username rules, the five reactions
supabase/migrations/   schema, policies, functions, views
supabase/seed.sql      GENERATED — run scripts/generate-seed.mjs
scripts/               seed generation, importers, admin, CLI wrapper
tests/                 the database rules, against the local stack
```

The native app will be `apps/mobile`. `supabase/`, `scripts/` and `tests/` stay
at the root because they belong to the backend both apps share, not to either
app.

### Why pnpm

The website and the Expo app will want different versions of the same
packages — React Native pins its own React. pnpm gives each app its own copy
instead of hoisting one to the top, where the other app would silently pick it
up. It is strict in the other direction too: a package can only import what its
own `package.json` declares. Moving over caught one example —
`@types/google.maps` only ever reached the map code because npm happened to
hoist it from `@vis.gl/react-google-maps`, so it is now declared in
`apps/web`.

Dependency install scripts do not run unless `pnpm-workspace.yaml` lists them
under `allowBuilds`. A new dependency that wants one stops the install and
asks, rather than running code on the way in.

`@gigly/shared` has no build step. Both apps compile its TypeScript source
directly — Next via `transpilePackages` — and Node runs its tests by stripping
the types. It depends on nothing, React included, so it cannot drag one app's
versions into the other. Its hype numbers are for display: the database
enforces the rules, and a test checks the two agree.

Seed data is lifted from the prototype's `VENUES` / `ARTISTS` / `GIGS` arrays.
Venues are real Liverpool rooms; artists and gigs are invented. Gig times are
offsets from the date the seed runs, so a reset always yields a listing with
gigs still to come.
