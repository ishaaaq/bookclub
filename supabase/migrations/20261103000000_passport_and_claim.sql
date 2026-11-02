-- Shelf · SBC Abuja: Phase 2 (reasons to return).
--
--   * claim_guest() moves a guest's history onto the account they sign in with, so
--     checking in before signing up never costs anyone their passport (README §3).
--   * book_reader_counts() powers "N others in the club have brought this" without
--     revealing who.

-- ---------------------------------------------------------------------------
-- Claiming a guest's history

-- Service role only. The auth callback calls this after verifying a signed cookie that
-- proves the browser was signed in as p_guest_user.
create function public.claim_guest(p_guest_user uuid, p_user uuid)
returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  g        public.members%rowtype;
  v_target uuid;
begin
  if p_guest_user = p_user then
    return;
  end if;
  if not exists (select 1 from auth.users where id = p_guest_user and is_anonymous) then
    raise exception 'not a guest account' using errcode = '22023';
  end if;

  for g in select * from public.members where auth_user_id = p_guest_user loop
    select id into v_target from public.members where auth_user_id = p_user and chapter_id = g.chapter_id;

    if v_target is null then
      -- The account has no profile in this chapter yet: the guest profile becomes it.
      update public.members set auth_user_id = p_user, is_guest = false where id = g.id;
    else
      -- Both exist: move what the account doesn't already have, then drop the guest.
      -- Where both checked in at the same meetup, the account's check-in wins.
      update public.checkins c set member_id = v_target
      where c.member_id = g.id
        and not exists (select 1 from public.checkins x where x.member_id = v_target and x.meetup_id = c.meetup_id);
      insert into public.intents (member_id, meetup_id, created_at)
        select v_target, meetup_id, created_at from public.intents where member_id = g.id
        on conflict do nothing;
      insert into public.want_to_read (member_id, book_id, created_at)
        select v_target, book_id, created_at from public.want_to_read where member_id = g.id
        on conflict do nothing;
      delete from public.members where id = g.id;
    end if;
  end loop;
end;
$$;

-- An account that signs in directly (no guest history) is never a guest.
create function public.sync_guest_status()
returns void
language sql volatile security definer set search_path = ''
as $$
  update public.members
  set is_guest = coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false)
  where auth_user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Club discovery

-- How many distinct members have brought each book. Counts only, so hidden members
-- stay hidden.
create function public.book_reader_counts(p_chapter uuid, p_books uuid[])
returns table (book_id uuid, readers integer)
language sql stable security definer set search_path = ''
as $$
  select c.book_id, count(distinct c.member_id)::integer
  from public.checkins c
  join public.meetups m on m.id = c.meetup_id
  where m.chapter_id = p_chapter and c.book_id = any (p_books)
  group by c.book_id;
$$;

revoke execute on function
  public.claim_guest(uuid, uuid),
  public.sync_guest_status(),
  public.book_reader_counts(uuid, uuid[])
from public, anon, authenticated;
grant execute on function public.sync_guest_status() to authenticated;
grant execute on function public.book_reader_counts(uuid, uuid[]) to anon, authenticated;
