-- Shelf · SBC Abuja: initial schema + Row Level Security (README §4, §5).
--
-- Conventions
--   * Instants are timestamptz (UTC); meetup dates are `date` in the chapter's timezone.
--   * Guests are Supabase anonymous users, so auth.uid() identifies every member.
--   * Overrides never move a meetup off the schedule grid (see is_meetup_date, which
--     must stay in sync with lib/schedule.ts).
--   * Writes that need validation (check-in, lazy meetup creation) go through
--     security-definer functions instead of direct table writes.

-- ---------------------------------------------------------------------------
-- Types

create type public.meetup_status as enum ('scheduled', 'cancelled', 'moved');
create type public.share_kind as enum ('line', 'quote', 'rating');
create type public.role_kind as enum ('host');

-- ---------------------------------------------------------------------------
-- Tables

create table public.chapters (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  city         text not null,
  timezone     text not null default 'Africa/Lagos',
  whatsapp_url text
);

create table public.members (
  id              uuid primary key default gen_random_uuid(),
  chapter_id      uuid not null references public.chapters (id) on delete cascade,
  display_name    text not null check (char_length(btrim(display_name)) between 1 and 60),
  avatar_url      text,
  auth_user_id    uuid references auth.users (id) on delete set null,
  is_guest        boolean not null default true,
  hide_from_shelf boolean not null default false,
  created_at      timestamptz not null default now(),
  unique (chapter_id, auth_user_id)
);

create table public.venues (
  id         uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  name       text not null,
  address    text,
  maps_url   text,
  is_default boolean not null default false
);
create unique index venues_one_default_per_chapter on public.venues (chapter_id) where is_default;

create table public.schedule (
  id                 uuid primary key default gen_random_uuid(),
  chapter_id         uuid not null unique references public.chapters (id) on delete cascade,
  anchor_date        date not null check (extract(isodow from anchor_date) = 6), -- a Saturday
  interval_days      integer not null default 14 check (interval_days > 0 and interval_days % 7 = 0),
  default_start_time time not null,
  default_venue_id   uuid not null references public.venues (id)
);

create table public.meetups (
  id            uuid primary key default gen_random_uuid(),
  chapter_id    uuid not null references public.chapters (id) on delete cascade,
  date          date not null,
  start_time    time not null,
  venue_id      uuid not null references public.venues (id),
  status        public.meetup_status not null default 'scheduled',
  note          text check (char_length(note) <= 200),
  checkin_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_at    timestamptz not null default now(),
  unique (chapter_id, date)
);

create table public.books (
  id               uuid primary key default gen_random_uuid(),
  open_library_key text unique,
  title            text not null check (char_length(btrim(title)) between 1 and 300),
  author           text,
  cover_url        text,
  created_at       timestamptz not null default now()
);

create table public.intents (
  member_id  uuid not null references public.members (id) on delete cascade,
  meetup_id  uuid not null references public.meetups (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, meetup_id)
);
create index intents_meetup_idx on public.intents (meetup_id);

create table public.checkins (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.members (id) on delete cascade,
  meetup_id  uuid not null references public.meetups (id) on delete cascade,
  book_id    uuid not null references public.books (id),
  created_at timestamptz not null default now(),
  unique (member_id, meetup_id) -- update your book, never check in twice
);
create index checkins_meetup_idx on public.checkins (meetup_id);
create index checkins_book_idx on public.checkins (book_id);

create table public.shares (
  id         uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references public.checkins (id) on delete cascade,
  kind       public.share_kind not null,
  body       text check (char_length(body) <= 500),
  rating     smallint,
  created_at timestamptz not null default now(),
  check (
    (kind = 'rating' and rating between 1 and 5)
    or (kind <> 'rating' and rating is null and char_length(btrim(body)) > 0)
  )
);
create index shares_checkin_idx on public.shares (checkin_id);

create table public.want_to_read (
  member_id  uuid not null references public.members (id) on delete cascade,
  book_id    uuid not null references public.books (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (member_id, book_id)
);

create table public.roles (
  member_id  uuid not null references public.members (id) on delete cascade,
  chapter_id uuid not null references public.chapters (id) on delete cascade,
  role       public.role_kind not null,
  primary key (member_id, chapter_id, role)
);

-- ---------------------------------------------------------------------------
-- Helper functions (security definer: they read tables without RLS recursion)

create function public.my_member_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.members where auth_user_id = auth.uid();
$$;

create function public.current_member_id(p_chapter uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select id from public.members where auth_user_id = auth.uid() and chapter_id = p_chapter;
$$;

create function public.is_host(p_chapter uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.roles r
    join public.members m on m.id = r.member_id
    where m.auth_user_id = auth.uid() and r.chapter_id = p_chapter and r.role = 'host'
  );
$$;

-- Visible to the caller if: not hidden from the shelf, or it's the caller, or the caller hosts the chapter.
create function public.member_is_visible(p_member uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.members m
    where m.id = p_member
      and (not m.hide_from_shelf or m.auth_user_id = auth.uid() or public.is_host(m.chapter_id))
  );
$$;

-- The schedule grid rule. Mirrors isMeetupDate() in lib/schedule.ts.
create function public.is_meetup_date(p_chapter uuid, p_date date)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.schedule s
    where s.chapter_id = p_chapter
      and p_date >= s.anchor_date
      and (p_date - s.anchor_date) % s.interval_days = 0
  );
$$;

-- Soft "N people plan to come" count without exposing who (F1, F3).
create function public.intent_count(p_meetup uuid)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer from public.intents where meetup_id = p_meetup;
$$;

-- Lazily materialise a meetup row for a grid date, using schedule defaults (§4 note).
create function public.ensure_meetup(p_chapter uuid, p_date date)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_tz text;
begin
  if not public.is_meetup_date(p_chapter, p_date) then
    raise exception '% is not a scheduled meetup date', p_date using errcode = '22023';
  end if;
  select timezone into v_tz from public.chapters where id = p_chapter;
  if p_date > (now() at time zone v_tz)::date + 366 then
    raise exception 'meetup date % is too far ahead', p_date using errcode = '22023';
  end if;

  insert into public.meetups (chapter_id, date, start_time, venue_id)
  select s.chapter_id, p_date, s.default_start_time, s.default_venue_id
  from public.schedule s where s.chapter_id = p_chapter
  on conflict (chapter_id, date) do nothing;

  select id into v_id from public.meetups where chapter_id = p_chapter and date = p_date;
  return v_id;
end;
$$;

-- Check in with a book. The QR token proves presence; it's only accepted on the meetup's
-- date in the chapter's timezone. Re-checking in changes the book (unique member+meetup).
create function public.check_in(p_token text, p_book_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_meetup public.meetups%rowtype;
  v_tz     text;
  v_member uuid;
  v_id     uuid;
begin
  select * into v_meetup from public.meetups where checkin_token = p_token;
  if not found then
    raise exception 'invalid check-in code' using errcode = '22023';
  end if;
  if v_meetup.status = 'cancelled' then
    raise exception 'this meetup was cancelled' using errcode = '22023';
  end if;

  select timezone into v_tz from public.chapters where id = v_meetup.chapter_id;
  if v_meetup.date <> (now() at time zone v_tz)::date then
    raise exception 'check-in is only open on the day of the meetup' using errcode = '22023';
  end if;

  v_member := public.current_member_id(v_meetup.chapter_id);
  if v_member is null then
    raise exception 'no member profile for this chapter' using errcode = '42501';
  end if;

  insert into public.checkins (member_id, meetup_id, book_id)
  values (v_member, v_meetup.id, p_book_id)
  on conflict (member_id, meetup_id) do update set book_id = excluded.book_id
  returning id into v_id;
  return v_id;
end;
$$;

-- The QR screen's token, for hosts only.
create function public.meetup_checkin_token(p_meetup uuid)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_chapter uuid;
  v_token   text;
begin
  select chapter_id, checkin_token into v_chapter, v_token from public.meetups where id = p_meetup;
  if v_chapter is null or not public.is_host(v_chapter) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return v_token;
end;
$$;

-- Meetups stay on the grid and never change date.
create function public.meetups_guard()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.date <> old.date then
    raise exception 'a meetup''s date cannot change; cancel it instead' using errcode = '22023';
  end if;
  if not public.is_meetup_date(new.chapter_id, new.date) then
    raise exception '% is not a scheduled meetup date', new.date using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger meetups_guard
before insert or update on public.meetups
for each row execute function public.meetups_guard();

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function
  public.my_member_ids(),
  public.current_member_id(uuid),
  public.is_host(uuid),
  public.member_is_visible(uuid),
  public.is_meetup_date(uuid, date),
  public.intent_count(uuid)
to anon, authenticated;
grant execute on function
  public.ensure_meetup(uuid, date),
  public.check_in(text, uuid),
  public.meetup_checkin_token(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Column privileges

-- checkin_token must never be readable through the API; hosts use meetup_checkin_token().
revoke select on public.meetups from anon, authenticated;
grant select (id, chapter_id, date, start_time, venue_id, status, note, created_at)
  on public.meetups to anon, authenticated;

-- Members can't rewrite who they are or which chapter they belong to.
revoke update on public.members from anon, authenticated;
grant update (display_name, avatar_url, hide_from_shelf) on public.members to authenticated;

-- auth_user_id stays server-side; clients use current_member_id().
revoke select on public.members from anon, authenticated;
grant select (id, chapter_id, display_name, avatar_url, is_guest, hide_from_shelf, created_at)
  on public.members to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security

alter table public.chapters     enable row level security;
alter table public.members      enable row level security;
alter table public.venues       enable row level security;
alter table public.schedule     enable row level security;
alter table public.meetups      enable row level security;
alter table public.books        enable row level security;
alter table public.intents      enable row level security;
alter table public.checkins     enable row level security;
alter table public.shares       enable row level security;
alter table public.want_to_read enable row level security;
alter table public.roles        enable row level security;

-- Public reference data
create policy "chapters readable" on public.chapters for select using (true);
create policy "books readable"    on public.books    for select using (true);
create policy "roles readable"    on public.roles    for select using (true); -- the host is named (F8)

-- Host-managed: venues, schedule, meetups
create policy "venues readable"    on public.venues for select using (true);
create policy "hosts insert venues" on public.venues for insert to authenticated with check (public.is_host(chapter_id));
create policy "hosts update venues" on public.venues for update to authenticated using (public.is_host(chapter_id)) with check (public.is_host(chapter_id));
create policy "hosts delete venues" on public.venues for delete to authenticated using (public.is_host(chapter_id));

create policy "schedule readable"    on public.schedule for select using (true);
create policy "hosts update schedule" on public.schedule for update to authenticated using (public.is_host(chapter_id)) with check (public.is_host(chapter_id));

create policy "meetups readable"     on public.meetups for select using (true);
create policy "hosts insert meetups" on public.meetups for insert to authenticated with check (public.is_host(chapter_id));
create policy "hosts update meetups" on public.meetups for update to authenticated using (public.is_host(chapter_id)) with check (public.is_host(chapter_id));

-- Members: hidden members are invisible to others (but not to themselves or the host)
create policy "members visible" on public.members for select using (public.member_is_visible(id));
create policy "create own member" on public.members for insert to authenticated
  with check (auth_user_id = auth.uid());
create policy "update own member" on public.members for update to authenticated
  using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());

-- Check-ins: the shelf. Writes go through check_in(); you can remove your own.
create policy "checkins visible" on public.checkins for select using (public.member_is_visible(member_id));
create policy "delete own checkin" on public.checkins for delete to authenticated
  using (member_id in (select public.my_member_ids()));

-- Shares: opt-in, attached to a check-in, deletable by the author at any time.
create policy "shares visible" on public.shares for select using (
  exists (select 1 from public.checkins c where c.id = checkin_id and public.member_is_visible(c.member_id))
);
create policy "author writes shares" on public.shares for insert to authenticated with check (
  exists (select 1 from public.checkins c where c.id = checkin_id and c.member_id in (select public.my_member_ids()))
);
create policy "author updates shares" on public.shares for update to authenticated using (
  exists (select 1 from public.checkins c where c.id = checkin_id and c.member_id in (select public.my_member_ids()))
);
create policy "author deletes shares" on public.shares for delete to authenticated using (
  exists (select 1 from public.checkins c where c.id = checkin_id and c.member_id in (select public.my_member_ids()))
);

-- Intents: your own rows; everyone else sees only intent_count(). Hosts see all.
create policy "own or host reads intents" on public.intents for select using (
  member_id in (select public.my_member_ids())
  or exists (select 1 from public.meetups m where m.id = meetup_id and public.is_host(m.chapter_id))
);
create policy "own intents insert" on public.intents for insert to authenticated
  with check (member_id in (select public.my_member_ids()));
create policy "own intents delete" on public.intents for delete to authenticated
  using (member_id in (select public.my_member_ids()));

-- Want to read: a personal list.
create policy "own want_to_read" on public.want_to_read for all to authenticated
  using (member_id in (select public.my_member_ids()))
  with check (member_id in (select public.my_member_ids()));

-- Books are written server-side (Open Library cache) with the service role; no client policy.

-- ---------------------------------------------------------------------------
-- Realtime: tonight's shelf

alter publication supabase_realtime add table public.checkins;
