-- Shelf · SBC Abuja: real chapter data for a hosted project (not the fictional seed.sql).
--
-- Run in the Supabase SQL editor after `supabase db push`. Safe to run again: it updates
-- what's there instead of duplicating it.
--
--   1. Replace HOST_EMAIL and HOST_NAME below. Keep real emails out of git: this repo is
--      public, so save a filled-in copy as chapter.local.sql (gitignored).
--   2. The host must have signed in once on the live site first (magic link), so their
--      auth user exists. If not, the script sets everything else up and says so; run it
--      again after they sign in.

do $$
declare
  host_email constant text := 'HOST_EMAIL';
  host_name  constant text := 'HOST_NAME';

  v_chapter uuid;
  v_venue   uuid;
  v_user    uuid;
  v_member  uuid;
begin
  -- Chapter (F10: one row today)
  select id into v_chapter from public.chapters where name = 'SBC Abuja';
  if v_chapter is null then
    insert into public.chapters (name, city, timezone)
    values ('SBC Abuja', 'Abuja', 'Africa/Lagos')
    returning id into v_chapter;
  end if;

  -- Usual venue (F9)
  select id into v_venue from public.venues where chapter_id = v_chapter and name = 'Lomo Coffee';
  if v_venue is null then
    update public.venues set is_default = false where chapter_id = v_chapter and is_default;
    insert into public.venues (chapter_id, name, address, maps_url, is_default)
    values (v_chapter, 'Lomo Coffee', 'Ebitu Ukiwe Street, Abuja', 'https://maps.app.goo.gl/9W7Kzm2hsdfRJ5XV9', true)
    returning id into v_venue;
  end if;

  -- Every other Saturday from 24 Oct 2026, 2 pm WAT (F5, README §11)
  insert into public.schedule (chapter_id, anchor_date, interval_days, default_start_time, default_venue_id)
  values (v_chapter, '2026-10-24', 14, '14:00', v_venue)
  on conflict (chapter_id) do update
    set default_start_time = excluded.default_start_time,
        default_venue_id   = excluded.default_venue_id;

  -- Host (F8)
  if host_email = 'HOST_EMAIL' then
    raise exception 'Fill in HOST_EMAIL and HOST_NAME first';
  end if;
  select id into v_user from auth.users where lower(email) = lower(host_email);
  if v_user is null then
    raise notice 'Chapter, venue and schedule are set. No account for % yet: sign in once on the live site, then run this again.', host_email;
    return;
  end if;

  insert into public.members (chapter_id, display_name, auth_user_id, is_guest)
  values (v_chapter, host_name, v_user, false)
  on conflict (chapter_id, auth_user_id) do update set is_guest = false
  returning id into v_member;

  insert into public.roles (member_id, chapter_id, role)
  values (v_member, v_chapter, 'host')
  on conflict do nothing;

  raise notice '% is now the host of SBC Abuja.', host_name;
end;
$$;
