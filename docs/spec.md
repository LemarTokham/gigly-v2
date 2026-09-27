Big product update for Gigly. Read this fully, then re-read
gigly-prototype.html in the repo root (I've replaced it with a new
version) before you plan anything.

WHAT CHANGED
Gigly is now three things: discovery (listings, map, hype chart),
journaling (Stubs), and friends. It's also becoming TWO products on
one backend: the existing Next.js website, plus a native mobile app.

=====================================================================
1. WEB VS APP SPLIT
=====================================================================
The website is the lightweight front door. Shared artist links land
here, so it must load instantly with no install. The app owns
everything personal and social.

WEBSITE (no install needed):
- Artist pages (this is what artists share)
- Hyping (requires sign-in, otherwise the chart gets rigged)
- The chart
- What's on listings and gig pages (public, so they rank on Google)
- Map
- Search

APP ONLY:
- Stubs and the camera
- Friends, profiles, reactions
- Following artists (alerts need push)
- "I'm going" and the mid-gig nudge
- "Find someone new" swiping
- Your stub calendar

When a web user tries something app-only, show ONE prompt tied to
that action, never a banner on every scroll:
- After hyping: "2 hypes left. Find someone new in the app."
- Tapping I'm going: "Get a nudge when they're on. Get the app."
- Tapping Follow: "Hear first when they announce a gig. Get the app."
- Gig page: show 3 public stubs, then "See all 23 in the app."
- Friend invite links: "@maya added you on Gigly" -> App Store.

Accounts are shared. Someone who hypes on the web and later installs
the app signs in and has the same account, hypes included.
Auth: Google, Sign in with Apple, and email magic link, on both.

Universal links (iOS) / App Links (Android): a gigly link opens the
app if installed, the website otherwise.

=====================================================================
2. USERNAMES AND FRIENDS
=====================================================================
- Every user picks a display name and a unique @username at signup.
  Rules: 3-20 chars, lowercase letters, numbers, dots, underscores.
  Case-insensitive uniqueness. Users can change it later.
- Friends are MUTUAL: send a request, the other person accepts or
  declines. (Artists stay one-way follows. Different thing.)
- Add friends by searching @username or name.
- Friends screen sections: incoming Requests (accept/decline),
  Your friends, Sent (tap to cancel), and "Were at your gigs":
  non-friends who posted stubs at gigs you also posted stubs at.
- Profiles show avatar, name, @username, counts (stubs, going,
  friends). Friends see the person's stubs and upcoming gigs.
  Non-friends see a locked state: "Add @them to see their stubs."
- Removing a friend needs a confirm step.
- Badge on the Friends tab for pending incoming requests.
- Tagging who you went with: NOT now. Leave room for it later.

=====================================================================
3. STUBS (the core new feature — get this right)
=====================================================================
A Stub is a front-and-back camera photo taken DURING a gig. No
caption, no rating, no words. Named after ticket stubs.

FLOW
1. User taps "I'm going" on a gig.
2. Each gig gets ONE shared "moment": a random time during the likely
   headline set (default: doors + 60 to doors + 150 min). At that
   moment, EVERYONE marked as going to that gig gets the same push:
   "Dock Leaf are on. Everyone at The Jacaranda just got this.
   Take your stub."
   The shared moment is the point: the gig wall ends up being
   everyone's photo of the same moment from different spots.
3. Camera opens. Pick who's in the selfie: "Just me", "Me +1",
   "The group" (store it, it's used for display only).
   Back camera photo, then front camera about a second later
   (sequential, like BeReal — simultaneous isn't needed).
4. Preview: choose audience — "Friends" or "Friends and gig wall".
   Then Retake or "Post stub". Toast: "Stub posted".
5. Posting window opens at the moment and closes 6 hours after
   doors. One stub per user per gig.

WHERE STUBS SHOW UP
- Friends feed (app): your stubs + friends' stubs. "Tonight" section
  with a Live pill, then "Earlier". Tapping a photo opens the gig wall.
- Gig wall: every stub from that gig with audience = wall, plus the
  shared moment time ("23 people, same moment, 9:12pm"). Public on
  the gig page (web shows 3, app shows all).
- Artist page "From the crowd": stubs from their recent gigs. Social
  proof for someone who's never heard of them.
- Your calendar (app, You tab): month grid, days with a stub show the
  photo. This IS the gig diary.
- Viewer: big photo with the selfie inset; tap the inset to swap them.

=====================================================================
4. REACTIONS
=====================================================================
- Five fixed emoji: 🔥 🙌 😍 😂 🤘. No comments, ever.
- One reaction per user per stub. Tapping another swaps it; tapping
  the same one removes it.
- Can't react to your own stubs, but you see friends' reactions on them.
- Tap the reaction counts to see who reacted.
- Enforce all of this in the database, not just the UI.

=====================================================================
5. SCHEMA ADDITIONS (propose changes before applying, with reasons)
=====================================================================
profiles(id = auth.users.id, username citext UNIQUE, display_name,
  avatar_url, created_at)
friendships(requester_id, addressee_id, status
  'pending'|'accepted'|'declined', created_at, responded_at)
  -- one row per pair, prevent duplicates in both directions
gig_moments(gig_id PK, fires_at, notified_at)
stubs(id, user_id, gig_id, back_path, front_path, people 0|1|2,
  audience 'friends'|'wall', created_at)  UNIQUE(user_id, gig_id)
reactions(stub_id, user_id, emoji CHECK in the five, created_at)
  PK(stub_id, user_id)
push_tokens(user_id, token, platform, updated_at)

RLS rules:
- A stub is readable by its owner, by accepted friends, and by anyone
  if audience = 'wall'.
- Only the owner can insert a stub, only for a gig they're going to,
  only inside the posting window.
- A reaction can only be inserted on a stub the user can read, and
  never on their own.
- Friend requests: only the addressee can accept or decline.

Photos: Supabase Storage, private bucket, signed URLs. Compress on
device to ~1080px JPEG before upload.

Moment + push: a scheduled job (Supabase pg_cron + an edge function)
picks each gig's moment when the gig goes live, and at fires_at sends
Expo push notifications to everyone going who hasn't posted.

=====================================================================
6. MOBILE STACK
=====================================================================
React Native with Expo (expo-router, expo-camera, expo-notifications,
EAS Build). Same Supabase project. iOS first, but Android must work
too — it's a friends feature and half a group chat can't be left out.

Restructure the repo as a monorepo:
  apps/web      (existing Next.js)
  apps/mobile   (new Expo app)
  packages/shared  (TypeScript types generated from Supabase, hype
                    rules, username validation, shared constants
                    like the five emoji)
Propose the exact structure and tooling (pnpm workspaces or similar)
BEFORE moving any files. Don't break the web app while doing it.

=====================================================================
7. ORDER
=====================================================================
Finish whatever web step you're on first. Then, stopping after each
for me to check, and committing each one:
A. Monorepo restructure + shared package. Web still works.
B. Schema + RLS for profiles, friendships, stubs, reactions,
   gig_moments, push_tokens. Tests for every RLS rule above.
C. Username signup flow (web and app).
D. Expo app shell: auth, tabs (Gigs, Map, Chart, Friends, You)
   matching the prototype, reading the same data as the web.
E. Friends: search, requests, profiles, remove.
F. Stubs: camera, upload, feed, gig wall, calendar, viewer.
G. Reactions.
H. Gig moments + push notifications.
I. Web conversion prompts + universal links.

=====================================================================
HOW I WANT YOU TO WORK
=====================================================================
- Match the prototype's look and copy. It's the spec.
- Tell me what I need to set up myself before you need it: Apple
  Developer account, Expo account, APNs key, Google Play later,
  Sign in with Apple config, etc.
- Never print keys back to me. Secrets stay in env files and EAS
  secrets, never committed.
- Write tests for the RLS rules and the posting window. Those are
  the parts that fail silently.
- If something in this spec won't work well at real scale, say so
  and suggest the fix rather than copying it.

Start by reading the prototype and telling me your plan for step A,
plus anything in this spec you think is wrong.