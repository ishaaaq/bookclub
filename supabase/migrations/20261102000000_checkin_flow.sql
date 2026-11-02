-- Shelf · SBC Abuja: Phase 1 check-in flow.
--
--   * Member profiles are created through join_chapter(), never by direct insert, so a
--     client can't mark itself as a non-guest or join an arbitrary chapter.
--   * checkin_status() lets the QR landing page say whether check-in is open before the
--     member searches for a book.
--   * chapter_today() is the single "what day is it in this chapter" rule. It reads
--     dev_clock, which is empty in production and only set by local e2e tests.

-- ---------------------------------------------------------------------------
-- Member profiles

drop policy "create own member" on public.members;
revoke insert on public.members from anon, authenticated;

-- Creates (or renames) the caller's member profile in a chapter. Guests are Supabase
-- anonymous users; the JWT says which, so is_guest can't be forged.
create function public.join_chapter(p_chapter uuid, p_display_name text)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'sign in first' using errcode = '42501';
  end if;
  if not exists (select 1 from public.chapters where id = p_chapter) then
    raise exception 'unknown chapter' using errcode = '22023';
  end if;

  insert into public.members (chapter_id, display_name, auth_user_id, is_guest)
  values (p_chapter, btrim(p_display_name), auth.uid(),
          coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false))
  on conflict (chapter_id, auth_user_id) do update set display_name = excluded.display_name
  returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Today, per chapter

create table public.dev_clock (
  singleton boolean primary key default true check (singleton),
  today     date not null
);
alter table public.dev_clock enable row level security; -- no policies: service role only
revoke all on public.dev_clock from anon, authenticated;

create function public.chapter_today(p_chapter uuid)
returns date
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select today from public.dev_clock),
    (select (now() at time zone c.timezone)::date from public.chapters c where c.id = p_chapter)
  );
$$;

-- ---------------------------------------------------------------------------
-- Check-in

-- What the QR landing page needs. Holding the token is what proves presence, so this
-- reveals nothing a member at the venue can't already see.
create function public.checkin_status(p_token text)
returns table (
  meetup_id   uuid,
  chapter_id  uuid,
  date        date,
  start_time  time,
  status      public.meetup_status,
  venue_name  text,
  is_open     boolean
)
language sql stable security definer set search_path = ''
as $$
  select m.id, m.chapter_id, m.date, m.start_time, m.status, v.name,
         m.status <> 'cancelled' and m.date = public.chapter_today(m.chapter_id)
  from public.meetups m
  join public.venues v on v.id = m.venue_id
  where m.checkin_token = p_token;
$$;

create or replace function public.check_in(p_token text, p_book_id uuid)
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  v_meetup public.meetups%rowtype;
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
  if v_meetup.date <> public.chapter_today(v_meetup.chapter_id) then
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

revoke execute on function
  public.join_chapter(uuid, text),
  public.chapter_today(uuid),
  public.checkin_status(text)
from public, anon, authenticated;
grant execute on function public.chapter_today(uuid), public.checkin_status(text) to anon, authenticated;
grant execute on function public.join_chapter(uuid, text) to authenticated;
