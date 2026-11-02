-- Shelf · SBC Abuja: local sample data.
-- FICTIONAL: every person here is made up. Venue names are placeholders until the host
-- confirms the real venue and start time (README §12).
--
-- Local logins (magic link via the local inbox at http://localhost:54324, or password):
--   host@example.test   / password123   → Amaka O., host
--   member@example.test / password123   → Tunde B., member
-- Check-in tokens are fixed for local testing: dev-2026-11-07 etc.

-- ---------------------------------------------------------------------------
-- Chapter, venues, schedule

insert into public.chapters (id, name, city, timezone, whatsapp_url) values
  ('c0000000-0000-4000-8000-000000000001', 'SBC Abuja', 'Abuja', 'Africa/Lagos',
   'https://chat.whatsapp.com/placeholder-sbc-abuja');

insert into public.venues (id, chapter_id, name, address, maps_url, is_default) values
  ('e0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001',
   'Usual venue (placeholder — confirm with host)', 'Wuse 2, Abuja',
   'https://maps.google.com/?q=Wuse+2,+Abuja', true),
  ('e0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001',
   'Alternate venue (placeholder)', 'Maitama, Abuja',
   'https://maps.google.com/?q=Maitama,+Abuja', false);

insert into public.schedule (chapter_id, anchor_date, interval_days, default_start_time, default_venue_id) values
  ('c0000000-0000-4000-8000-000000000001', '2026-10-24', 14, '16:00',
   'e0000000-0000-4000-8000-000000000001');

-- ---------------------------------------------------------------------------
-- Auth users for the two signed-in members

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
) values
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'host@example.test', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', 'f0000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'member@example.test', extensions.crypt('password123', extensions.gen_salt('bf')), now(),
   '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.id in ('f0000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000002');

-- ---------------------------------------------------------------------------
-- Members (display names only; most are guests who just showed up, F1)

insert into public.members (id, chapter_id, display_name, auth_user_id, is_guest, hide_from_shelf, created_at)
select m.id::uuid, 'c0000000-0000-4000-8000-000000000001', m.name, m.auth::uuid, m.auth is null, m.hidden,
       '2026-10-24 15:00:00+00'::timestamptz + (m.n * interval '1 minute')
from (values
  (1,  'a0000000-0000-4000-8000-000000000001', 'Amaka O.',    'f0000000-0000-4000-8000-000000000001', false),
  (2,  'a0000000-0000-4000-8000-000000000002', 'Tunde B.',    'f0000000-0000-4000-8000-000000000002', false),
  (3,  'a0000000-0000-4000-8000-000000000003', 'Zainab B.',   null, false),
  (4,  'a0000000-0000-4000-8000-000000000004', 'Chidi E.',    null, false),
  (5,  'a0000000-0000-4000-8000-000000000005', 'Halima A.',   null, false),
  (6,  'a0000000-0000-4000-8000-000000000006', 'Femi A.',     null, false),
  (7,  'a0000000-0000-4000-8000-000000000007', 'Ngozi N.',    null, false),
  (8,  'a0000000-0000-4000-8000-000000000008', 'Ibrahim M.',  null, false),
  (9,  'a0000000-0000-4000-8000-000000000009', 'Kemi O.',     null, false),
  (10, 'a0000000-0000-4000-8000-000000000010', 'Emeka O.',    null, false),
  (11, 'a0000000-0000-4000-8000-000000000011', 'Aisha Y.',    null, false),
  (12, 'a0000000-0000-4000-8000-000000000012', 'Seun A.',     null, false),
  (13, 'a0000000-0000-4000-8000-000000000013', 'Chiamaka U.', null, false),
  (14, 'a0000000-0000-4000-8000-000000000014', 'Yusuf D.',    null, false),
  (15, 'a0000000-0000-4000-8000-000000000015', 'Funmi O.',    null, false),
  (16, 'a0000000-0000-4000-8000-000000000016', 'Obinna C.',   null, false),
  (17, 'a0000000-0000-4000-8000-000000000017', 'Hauwa S.',    null, false),
  (18, 'a0000000-0000-4000-8000-000000000018', 'Bola A.',     null, false),
  (19, 'a0000000-0000-4000-8000-000000000019', 'Ifeoma N.',   null, false),
  (20, 'a0000000-0000-4000-8000-000000000020', 'Musa G.',     null, false),
  (21, 'a0000000-0000-4000-8000-000000000021', 'Tolu A.',     null, false),
  (22, 'a0000000-0000-4000-8000-000000000022', 'Nkechi I.',   null, false),
  (23, 'a0000000-0000-4000-8000-000000000023', 'Sadiq L.',    null, true),  -- hidden from the shelf
  (24, 'a0000000-0000-4000-8000-000000000024', 'Ada O.',      null, false)
) as m(n, id, name, auth, hidden);

insert into public.roles (member_id, chapter_id, role) values
  ('a0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'host');

-- ---------------------------------------------------------------------------
-- Books (real titles; Open Library keys and covers are filled by the real search later)

insert into public.books (id, title, author) values
  ('b0000000-0000-4000-8000-000000000001', 'Purple Hibiscus', 'Chimamanda Ngozi Adichie'),
  ('b0000000-0000-4000-8000-000000000002', 'Half of a Yellow Sun', 'Chimamanda Ngozi Adichie'),
  ('b0000000-0000-4000-8000-000000000003', 'Americanah', 'Chimamanda Ngozi Adichie'),
  ('b0000000-0000-4000-8000-000000000004', 'Things Fall Apart', 'Chinua Achebe'),
  ('b0000000-0000-4000-8000-000000000005', 'The Joys of Motherhood', 'Buchi Emecheta'),
  ('b0000000-0000-4000-8000-000000000006', 'Stay With Me', 'Ayọ̀bámi Adébáyọ̀'),
  ('b0000000-0000-4000-8000-000000000007', 'My Sister, the Serial Killer', 'Oyinkan Braithwaite'),
  ('b0000000-0000-4000-8000-000000000008', 'Season of Crimson Blossoms', 'Abubakar Adam Ibrahim'),
  ('b0000000-0000-4000-8000-000000000009', 'The Fishermen', 'Chigozie Obioma'),
  ('b0000000-0000-4000-8000-000000000010', 'An Orchestra of Minorities', 'Chigozie Obioma'),
  ('b0000000-0000-4000-8000-000000000011', 'Freshwater', 'Akwaeke Emezi'),
  ('b0000000-0000-4000-8000-000000000012', 'The Girl with the Louding Voice', 'Abi Daré'),
  ('b0000000-0000-4000-8000-000000000013', 'Children of Blood and Bone', 'Tomi Adeyemi'),
  ('b0000000-0000-4000-8000-000000000014', 'Every Day Is for the Thief', 'Teju Cole'),
  ('b0000000-0000-4000-8000-000000000015', 'Lagoon', 'Nnedi Okorafor'),
  ('b0000000-0000-4000-8000-000000000016', 'Binti', 'Nnedi Okorafor'),
  ('b0000000-0000-4000-8000-000000000017', 'So Long a Letter', 'Mariama Bâ'),
  ('b0000000-0000-4000-8000-000000000018', 'Homegoing', 'Yaa Gyasi'),
  ('b0000000-0000-4000-8000-000000000019', 'Born a Crime', 'Trevor Noah'),
  ('b0000000-0000-4000-8000-000000000020', 'Atomic Habits', 'James Clear'),
  ('b0000000-0000-4000-8000-000000000021', 'Sapiens', 'Yuval Noah Harari'),
  ('b0000000-0000-4000-8000-000000000022', 'Becoming', 'Michelle Obama'),
  ('b0000000-0000-4000-8000-000000000023', 'The Alchemist', 'Paulo Coelho'),
  ('b0000000-0000-4000-8000-000000000024', 'Klara and the Sun', 'Kazuo Ishiguro'),
  ('b0000000-0000-4000-8000-000000000025', 'Tomorrow, and Tomorrow, and Tomorrow', 'Gabrielle Zevin');

-- ---------------------------------------------------------------------------
-- Meetups: the held anchor, the next one, a moved one and a cancelled one

insert into public.meetups (id, chapter_id, date, start_time, venue_id, status, note, checkin_token) values
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', '2026-10-24', '16:00',
   'e0000000-0000-4000-8000-000000000001', 'scheduled', null, 'dev-2026-10-24'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000001', '2026-11-07', '16:00',
   'e0000000-0000-4000-8000-000000000001', 'scheduled', null, 'dev-2026-11-07'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000001', '2026-11-21', '16:00',
   'e0000000-0000-4000-8000-000000000002', 'moved', 'Venue changed this week: we''re in Maitama', 'dev-2026-11-21'),
  ('d0000000-0000-4000-8000-000000000004', 'c0000000-0000-4000-8000-000000000001', '2026-12-05', '16:00',
   'e0000000-0000-4000-8000-000000000001', 'cancelled', 'No meetup this week. See you on 19 Dec!', 'dev-2026-12-05');

-- ---------------------------------------------------------------------------
-- 24 Oct check-ins (16:00 WAT = 15:00 UTC). Two people brought Americanah.

insert into public.checkins (id, member_id, meetup_id, book_id, created_at)
select c.id::uuid, c.member::uuid, 'd0000000-0000-4000-8000-000000000001', c.book::uuid,
       '2026-10-24 15:02:00+00'::timestamptz + (c.n * interval '70 seconds')
from (values
  (1,  '90000000-0000-4000-8000-000000000001', 'a0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000006'),
  (2,  '90000000-0000-4000-8000-000000000002', 'a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000019'),
  (3,  '90000000-0000-4000-8000-000000000003', 'a0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000003'),
  (4,  '90000000-0000-4000-8000-000000000004', 'a0000000-0000-4000-8000-000000000004', 'b0000000-0000-4000-8000-000000000009'),
  (5,  '90000000-0000-4000-8000-000000000005', 'a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000008'),
  (6,  '90000000-0000-4000-8000-000000000006', 'a0000000-0000-4000-8000-000000000006', 'b0000000-0000-4000-8000-000000000020'),
  (7,  '90000000-0000-4000-8000-000000000007', 'a0000000-0000-4000-8000-000000000007', 'b0000000-0000-4000-8000-000000000003'),
  (8,  '90000000-0000-4000-8000-000000000008', 'a0000000-0000-4000-8000-000000000008', 'b0000000-0000-4000-8000-000000000021'),
  (9,  '90000000-0000-4000-8000-000000000009', 'a0000000-0000-4000-8000-000000000009', 'b0000000-0000-4000-8000-000000000007'),
  (10, '90000000-0000-4000-8000-000000000010', 'a0000000-0000-4000-8000-000000000010', 'b0000000-0000-4000-8000-000000000004'),
  (11, '90000000-0000-4000-8000-000000000011', 'a0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000012'),
  (12, '90000000-0000-4000-8000-000000000012', 'a0000000-0000-4000-8000-000000000012', 'b0000000-0000-4000-8000-000000000015'),
  (13, '90000000-0000-4000-8000-000000000013', 'a0000000-0000-4000-8000-000000000013', 'b0000000-0000-4000-8000-000000000018'),
  (14, '90000000-0000-4000-8000-000000000014', 'a0000000-0000-4000-8000-000000000017', 'b0000000-0000-4000-8000-000000000017'),
  (15, '90000000-0000-4000-8000-000000000015', 'a0000000-0000-4000-8000-000000000023', 'b0000000-0000-4000-8000-000000000024')  -- hidden member
) as c(n, id, member, book);

-- Optional shares (F3): most people skipped, which is the default.
insert into public.shares (checkin_id, kind, body, rating, created_at) values
  ('90000000-0000-4000-8000-000000000001', 'line',   'Couldn''t put it down. Yejide''s voice stays with you.', null, '2026-10-24 16:10:00+00'),
  ('90000000-0000-4000-8000-000000000001', 'rating', null, 5, '2026-10-24 16:10:30+00'),
  ('90000000-0000-4000-8000-000000000003', 'quote',  'You can''t write an honest novel about race in this country.', null, '2026-10-24 16:12:00+00'),
  ('90000000-0000-4000-8000-000000000004', 'rating', null, 4, '2026-10-24 16:14:00+00'),
  ('90000000-0000-4000-8000-000000000009', 'line',   'Darkly funny. Read it in one sitting.', null, '2026-10-24 16:15:00+00');

-- Want to read: books people spotted on the shelf.
insert into public.want_to_read (member_id, book_id, created_at) values
  ('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000006', '2026-10-24 16:20:00+00'),
  ('a0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000007', '2026-10-24 16:21:00+00'),
  ('a0000000-0000-4000-8000-000000000005', 'b0000000-0000-4000-8000-000000000003', '2026-10-24 16:25:00+00'),
  ('a0000000-0000-4000-8000-000000000011', 'b0000000-0000-4000-8000-000000000008', '2026-10-24 16:30:00+00');

-- ---------------------------------------------------------------------------
-- "Thinking of coming" for 7 Nov (F1, F4)

insert into public.intents (member_id, meetup_id, created_at)
select m.id::uuid, 'd0000000-0000-4000-8000-000000000002', '2026-10-26 18:00:00+00'::timestamptz + (m.n * interval '23 minutes')
from (values
  (1, 'a0000000-0000-4000-8000-000000000001'),
  (2, 'a0000000-0000-4000-8000-000000000002'),
  (3, 'a0000000-0000-4000-8000-000000000003'),
  (4, 'a0000000-0000-4000-8000-000000000007'),
  (5, 'a0000000-0000-4000-8000-000000000010'),
  (6, 'a0000000-0000-4000-8000-000000000018'),
  (7, 'a0000000-0000-4000-8000-000000000019'),
  (8, 'a0000000-0000-4000-8000-000000000020'),
  (9, 'a0000000-0000-4000-8000-000000000024')
) as m(n, id);
