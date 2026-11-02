# CLAUDE.md

Shelf: a mobile-first PWA for **Silent Book Club Abuja**. [README.md](README.md) is the source of truth. Read it before building anything.

## Stack
- **Next.js (App Router) + TypeScript**: server components by default
- **Tailwind CSS**
- **Supabase**: Postgres + Row Level Security, Auth (email magic link, Google, anonymous sign-in for guests), Realtime (tonight's shelf), Storage (cover cache)
- **Open Library** search API (no key), proxied and cached in `books`
- **Vercel** hosting; PWA via `public/manifest.webmanifest` + `public/sw.js`
- **Vitest** (unit), **Playwright** (e2e, mobile viewport)

## Commands
```bash
pnpm install
supabase start                  # local Postgres/auth/realtime (needs Docker)
supabase db reset               # apply migrations + seed.sql
cp .env.example .env.local      # fill from `supabase status`
pnpm dev                        # http://localhost:3000
pnpm test                       # Vitest unit tests
pnpm test:watch
pnpm test:e2e                   # Playwright (added with the check-in flow)
pnpm lint
pnpm build
supabase migration new <name>   # new migration in supabase/migrations/
```

## Folder structure
```
app/(member)/               member pages: next meetup, checkin/[token], shelf/[meetupId], passport
app/(organiser)/admin/      host: meetup controls, QR, insights
app/api/books/search/       Open Library proxy + cache
components/                 shared UI (BookCover, ShelfSpine, MeetupCard, ...)
lib/schedule.ts             every-other-Saturday logic (pure, unit-tested)
lib/supabase/               server + browser Supabase clients
lib/books.ts                book search, normalise, cache
supabase/migrations/        schema + RLS
supabase/seed.sql           fictional sample members, books, meetups
public/                     manifest, service worker
```

## Rules
- **Mobile-first, designed at 360px wide.** Check layouts at 360px before anything wider.
- **Keep client JavaScript small.** Prefer server components. Add `"use client"` only for real interactivity, and keep those components leaf-sized.
- **All times displayed in Africa/Lagos** (WAT, UTC+1). Store in UTC (`timestamptz`), meetup dates as `date`. Never rely on the server's or browser's local timezone.
- **Every feature must trace back to a fact (F1–F10) in README §1**, and must respect the non-goals: no mandatory RSVP, no in-app chat/comments, no club book or voting, no public feed/likes/followers, no native apps.
- Guests are Supabase **anonymous** users (`members.is_guest = true`). RLS is keyed on `auth.uid()` for everyone.
- Schedule overrides never move a meetup's date. They change venue/time/note or cancel. `lib/schedule.ts` and the SQL `is_meetup_date()` must stay in sync.
- Never expose `meetups.checkin_token` or `SUPABASE_SERVICE_ROLE_KEY` to the client. The shelf shows display names only, never emails, and honours `members.hide_from_shelf`.
- Motion is minimal and respects `prefers-reduced-motion`. Use original visuals, not official SBC marks.
