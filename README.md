# Shelf · Silent Book Club Abuja

*A companion app for the Abuja chapter of Silent Book Club (SBC). "Shelf" is the app's working name; the club is SBC Abuja.*

> **Branding note:** Silent Book Club is a global organisation with chapters in many cities and its own branding. This app uses original visuals and refers to the chapter by name only. Confirm with the host (and SBC HQ if needed) before using any official SBC logo or marks.

Every other Saturday, around 30 of the chapter's 270 members walk in with whatever book they're reading. Everyone reads quietly for an hour, then talks. Sharing is optional. Shelf makes that ritual visible: who came, what they brought, and what the club reads over time. It doesn't change how the club works.

---

## 1. Starting from first principles

Before deciding on features, we wrote down what is actually true about this club. Every feature below has to trace back to one of these facts. If it can't, it doesn't get built.

| # | Fact | Consequence |
|---|------|-------------|
| F1 | People **just show up**. There's no sign-up today. | No mandatory RSVP. Any pre-meetup signal must be optional and one tap. |
| F2 | **Everyone reads a different book.** | The unit of data is *a person with a book at a meetup*, not "the club's book". |
| F3 | **Sharing is optional.** Some people never speak. | Every social feature is opt-in. Being present is enough to participate. |
| F4 | ~30 attend out of 270, and that number is an **estimate**. | Nobody actually knows attendance. Check-in data creates the first real numbers. |
| F5 | Meetings are **every other Saturday** in Abuja. | The schedule can be computed, so the organiser shouldn't have to post it by hand. |
| F6 | Members are on **phones**, often on mobile data. | Mobile-first, light pages, works on a weak connection, no app-store install. |
| F7 | The club already lives on **WhatsApp**. | Don't rebuild chat. Link out *to* WhatsApp and make things easy to share *into* it. |
| F8 | There's **one host** (organiser), a volunteer already known to members from WhatsApp. | Admin work must take minutes per meetup, not hours. The host is named in the app, which builds trust. |
| F9 | There's **one usual venue**, but it changes sometimes. | The venue is a default that the host can override for a single date in one tap. |
| F10 | SBC has **chapters in many cities**. | Build for Abuja only, but put a `chapter_id` on the data so other chapters could use it later without a rewrite. |

### The core loop

Everything orbits one action, which is **checking in with your book**:

```
  See next meetup  →  Show up  →  Check in with book  →  Read  →  (optionally) share
        ↑                                  │
        └────── passport + club shelf ◄────┘   (reasons to come back)
```

If check-in is slow or awkward, the data never exists and every other feature dies with it. So check-in gets the most design effort and has to take **under 15 seconds**.

---

## 2. Features (and the fact each one serves)

### For members
- **Next meetup card** (F5, F7): the date is auto-computed (every 14 days from an anchor), plus time, venue, a map link, and a "share to WhatsApp" button.
- **"I'm thinking of coming"** (F1, F4): an optional tap that shows a soft count ("11 people plan to come"). It isn't a booking and never blocks entry.
- **Check-in with your book** (F2, core loop): scan the QR code at the venue, search your title, tap the cover, and you're done. Covers come from Open Library, and you can type the title by hand as a fallback.
- **Tonight's shelf** (F2, F3): a live wall of every book in the room. Tap a book to see who's reading it. Quiet members are visible without having to speak.
- **Optional share** (F3): after the reading hour you can add a one-liner, a favourite quote, or a 1–5 rating. You can also skip it, which is the default.
- **Reading passport** (core loop): your meetups, the books you brought, and your streak, as a personal history you'd be sad to lose.
- **Club discovery** (F2): the most-brought books, "3 others are reading this", and a *want to read* list built from books you saw on the shelf.

### For the host
- **Host profile** (F8): the host's name and photo appear on the next-meetup card, with a link to the chapter's WhatsApp group.
- **Meetup controls** (F5, F8, F9): the usual venue is pre-filled every time. Change the venue for one date, shift the time, or cancel, without breaking the schedule.
- **QR display** (core loop): one screen to project or print at the venue.
- **Attendance insights** (F4): real headcounts per meetup, new vs returning members, regulars, and trends over time.
- **Announcement banner** (F7, F8): one line shown on the next-meetup card, for things like "Venue changed this week".

### Deliberate non-goals
| Not building | Why |
|---|---|
| Mandatory RSVP / waitlist | Contradicts F1, since there's no capacity problem to solve. |
| In-app chat or comments | WhatsApp already does this (F7). A second chat would split the club. |
| A "club book" or voting | Contradicts F2. |
| Public social feed, likes, followers | Pressure to perform contradicts F3. |
| Native iOS/Android apps | A PWA covers F6 without app-store friction. Revisit only if push notifications become essential. |

---

## 3. Architecture

```
 Phone (PWA)                     Supabase                          External
┌──────────────────┐    HTTPS   ┌───────────────────────────┐     ┌──────────────┐
│ Next.js app      │──────────► │ Postgres + Row Level Sec. │     │ Open Library │
│ (App Router, RSC)│            │ Auth (magic link / Google)│     │ Search API   │
│ Service worker   │ ◄────────  │ Realtime (shelf updates)  │     └──────▲───────┘
└──────────────────┘  websocket │ Storage (cover cache)     │            │
                                └─────────────▲─────────────┘            │
                                              │ server action: search ───┘
                                       Vercel (hosting, edge)
```

### Stack and the reasoning behind it
- **Next.js (App Router) + TypeScript**: server components keep the JavaScript sent to phones small (F6), and one codebase covers both UI and API.
- **Supabase**: Postgres, auth, realtime, and storage in one service with a generous free tier. Realtime powers *Tonight's shelf* without us running a socket server.
- **Tailwind CSS**: fast to iterate on, and the output stays small.
- **PWA (manifest + service worker)**: installable to the home screen and caches the app shell. Check-ins made while the connection is weak get queued and retried (F6).
- **Open Library API**: free, needs no key, and has good cover coverage. Results are cached in our `books` table, so each title is fetched once.
- **Vercel**: zero-ops deploys and preview URLs to show the organiser.

### Auth, chosen to minimise friction
SMS OTP costs money per message in Nigeria and delivery can be unreliable, so the default is **email magic link + Google sign-in**.

The bigger decision is that **you can check in before you have an account.** First-timers enter a display name, get a local guest identity, and can claim their history later by signing in. Forcing sign-up at the door would break F1.

### Time
All dates are stored in UTC and displayed in **Africa/Lagos (WAT, UTC+1)**, which Abuja uses. The meetup schedule is computed as `anchor_date + 14n` days, with per-date overrides.

---

## 4. Data model

```sql
chapters      (id, name, city, timezone, whatsapp_url)            -- one row today: SBC Abuja
members       (id, chapter_id, display_name, avatar_url, auth_user_id NULL, is_guest, created_at)
venues        (id, chapter_id, name, address, maps_url, is_default)
schedule      (id, chapter_id, anchor_date, interval_days = 14, default_start_time, default_venue_id)
meetups       (id, chapter_id, date, start_time, venue_id, status: scheduled|cancelled|moved,
               note, checkin_token, created_at)        -- venue_id overrides the default for one date
books         (id, open_library_key NULL, title, author, cover_url, created_at)
intents       (member_id, meetup_id, created_at)                 -- "thinking of coming"
checkins      (id, member_id, meetup_id, book_id, created_at)    -- the core table
shares        (id, checkin_id, kind: line|quote|rating, body, rating NULL, created_at)
want_to_read  (member_id, book_id, created_at)
roles         (member_id, chapter_id, role: host)
```

Notes:
- `meetups` rows are **materialised lazily** from `schedule`. A row exists once someone interacts with that date or the organiser edits it, so the calendar never needs a cron job.
- `checkins` has a unique constraint on `(member_id, meetup_id)`. You can update your book, but you can't check in twice.
- `checkin_token` rotates per meetup and is only accepted on the meetup's date, which is enough to stop remote check-ins without adding geofencing.
- Row Level Security: members write only their own rows, everyone reads shelf data, and only organisers write to `meetups`, `venues` and `schedule`.

---

## 5. Privacy

- The shelf shows **display names only**, never emails.
- A member can hide themselves from the shelf and still keep their own passport.
- Shares are attached to a check-in and can be deleted by their author at any time.
- No location tracking. The QR token proves presence instead.

---

## 6. Success metrics

We only measure what tells us the core loop works:

1. **Check-in rate** = check-ins ÷ people physically present (organiser estimates the headcount for the first few weeks). Target: **>70%** by meetup 4.
2. **Return rate**: members with ≥2 check-ins within 6 weeks.
3. **Time to check in**: median under 15 s (measured client-side).

If check-in rate stays low, we fix check-in before building anything else.

---

## 7. Roadmap

**Phase 0 — Prototype (this week)**
Clickable phone prototype with sample data, built to get the organiser's buy-in. No backend.

**Phase 1 — MVP (one meetup cycle)**
Next meetup card, guest + signed-in check-in, book search, tonight's shelf (realtime), organiser QR screen. Ship before a Saturday and test it live.

**Phase 2 — Reasons to return**
Reading passport, optional shares, want-to-read, "others reading this", installable PWA.

**Phase 3 — Organiser insights**
Attendance dashboard, announcement banner, date overrides, CSV export.

**Later, only if the data asks for it**
Push reminders the Friday before a meetup, year-in-review ("the club read 400 books in 2027"), and multiple chapters or cities.

---

## 8. Project structure

```
shelf/
├── app/
│   ├── (member)/
│   │   ├── page.tsx              # next meetup card
│   │   ├── checkin/[token]/      # QR landing → book search → confirm
│   │   ├── shelf/[meetupId]/     # tonight's shelf (realtime)
│   │   └── passport/             # personal history
│   ├── (organiser)/admin/        # meetup controls, QR, insights
│   └── api/books/search/         # Open Library proxy + cache
├── components/                   # BookCover, ShelfSpine, MeetupCard, ...
├── lib/
│   ├── schedule.ts               # every-other-Saturday logic (pure, unit-tested)
│   ├── supabase/                 # client + server helpers
│   └── books.ts                  # search, normalise, cache
├── supabase/
│   ├── migrations/               # schema + RLS policies
│   └── seed.sql                  # sample members, books, meetups
└── public/
    ├── manifest.webmanifest
    └── sw.js
```

---

## 9. Getting started

Prerequisites: Node 20+, pnpm, and the Supabase CLI.

```bash
git clone <repo-url> shelf && cd shelf
pnpm install

supabase start                 # local Postgres, auth, realtime
supabase db reset              # runs migrations + seed.sql

cp .env.example .env.local     # fill in the values below
pnpm dev                       # http://localhost:3000
```

`.env.local`

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # server only, never exposed to the client
NEXT_PUBLIC_APP_TIMEZONE=Africa/Lagos
SCHEDULE_ANCHOR_DATE=2026-10-24   # first confirmed SBC Abuja meetup; every 14 days from here
```

Testing:

```bash
pnpm test        # unit tests (schedule logic, book normalisation)
pnpm test:e2e    # Playwright: guest check-in flow on a mobile viewport
```

Check-in only opens on a meetup's date. To try it on another day, the e2e tests set `public.dev_clock` (service role only, empty in production) so that `chapter_today()` returns a meetup date, and clear it afterwards. Set `E2E_BASE_URL` if your dev server isn't on port 3000.

The service worker only registers in production builds (`pnpm build && pnpm start`), so offline behaviour can't be tested under `pnpm dev`. Run e2e against a production server too (`E2E_BASE_URL=http://localhost:<port>`): dev-mode compile times can push the 15-second check-in budget over.

To sign in as the local host, request a magic link for `host@example.test` and open it from the local inbox at http://localhost:55324.

---

## 10. Design direction

Warm paper and ink: off-white page tones, deep ink text, one accent colour taken from old cloth bindings. Books are shown as **spines on a shelf** in the room view and as **covers** when you tap in. A soft page-turn marks the end of the reading hour. Motion is minimal and respects `prefers-reduced-motion`. Everything is designed at 360 px wide first.

---

## 11. Decisions made

| Question | Answer | Effect on the build |
|---|---|---|
| Club name | **Silent Book Club (SBC), Abuja chapter** | App is branded "SBC Abuja"; `chapters` table added for future cities. |
| Venue | **One usual venue, occasionally changed** | Default venue + per-meetup override. |
| Host visibility | **Host is named** (already known on WhatsApp) | Host profile on the next-meetup card. |
| Anchor date | **Saturday 24 Oct 2026** | Schedule runs 24 Oct, 7 Nov, 21 Nov, 5 Dec… |

## 12. Still open

- Usual venue name and address, plus the usual start time.
- Whether SBC HQ has brand guidelines the chapter should follow.
- Rough real headcount at the next few meetups, as a baseline for the check-in-rate metric.
