-- RLS and constraint contract for spec 005 (specs/005-user-settings/contracts/rls-policies.md).
-- Two users, A and B, plus the anonymous role. Runs in a transaction and rolls back.
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Fixtures -----------------------------------------------------------------
insert into auth.users (id, email, aud, role, instance_id)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@trips.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@trips.test', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

-- Case 6: a profile is created for every new auth user.
select results_eq(
  $$select theme from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'$$,
  $$values ('system')$$,
  'new auth user gets a profile with theme system'
);

-- Seed one row per table for B, as the table owner.
insert into public.family_members (profile_id, nickname, kind)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'B adult', 'adult');
insert into public.saved_trips (profile_id, activity_id, activity_name)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'b-activity', 'B activity');
insert into public.contact_preferences (profile_id, topic, opted_in)
values ('bbbbbbbb-0000-0000-0000-000000000002', 'product_news', true);

-- Act as A ------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

-- Case 1: A can manage their own rows in every table.
select lives_ok(
  $$update public.profiles set display_name = 'Alex', theme = 'dark' where id = auth.uid()$$,
  'A can update own profile'
);
select results_eq(
  $$select display_name, theme from public.profiles$$,
  $$values ('Alex'::text, 'dark'::text)$$,
  'A sees exactly their own profile'
);
select lives_ok(
  $$insert into public.family_members (profile_id, nickname, kind, birth_year, birth_month)
    values (auth.uid(), 'Kid', 'child', 2019, 5)$$,
  'A can add a child family member'
);
select lives_ok(
  $$update public.family_members set nickname = 'Kiddo' where profile_id = auth.uid()$$,
  'A can update own family member'
);
select lives_ok(
  $$insert into public.saved_trips (profile_id, activity_id, activity_name, note)
    values (auth.uid(), 'a-activity', 'A activity', 'Bring wellies')$$,
  'A can save a trip'
);
select lives_ok(
  $$update public.saved_trips set planned_for = '2026-11-07' where profile_id = auth.uid()$$,
  'A can update own saved trip'
);
select lives_ok(
  $$insert into public.contact_preferences (profile_id, topic, opted_in, frequency)
    values (auth.uid(), 'nearby_digest', true, 'monthly')$$,
  'A can set a contact preference'
);
select lives_ok(
  $$delete from public.saved_trips where profile_id = auth.uid() and activity_id = 'a-activity'$$,
  'A can delete own saved trip'
);

-- Case 2: A sees none of B's rows.
select is((select count(*) from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint, 'A cannot see B profile');
select is((select count(*) from public.family_members where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint, 'A cannot see B family');
select is((select count(*) from public.saved_trips where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint, 'A cannot see B saved trips');
select is((select count(*) from public.contact_preferences where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 0::bigint, 'A cannot see B contact preferences');

-- Case 3: A cannot write rows that belong to B.
select throws_ok(
  $$insert into public.family_members (profile_id, nickname, kind) values ('bbbbbbbb-0000-0000-0000-000000000002', 'Intruder', 'adult')$$,
  '42501', null, 'A cannot insert family member for B'
);
select throws_ok(
  $$insert into public.saved_trips (profile_id, activity_id, activity_name) values ('bbbbbbbb-0000-0000-0000-000000000002', 'x', 'X')$$,
  '42501', null, 'A cannot insert saved trip for B'
);
select throws_ok(
  $$insert into public.contact_preferences (profile_id, topic, opted_in) values ('bbbbbbbb-0000-0000-0000-000000000002', 'nearby_digest', true)$$,
  '42501', null, 'A cannot insert contact preference for B'
);
select throws_ok(
  $$update public.family_members set profile_id = 'bbbbbbbb-0000-0000-0000-000000000002' where profile_id = auth.uid()$$,
  '42501', null, 'A cannot move own family member to B'
);
select throws_ok(
  $$insert into public.profiles (id) values (gen_random_uuid())$$,
  '42501', null, 'A cannot insert profiles directly'
);

-- Case 4: A's updates and deletes of B's rows affect nothing (checked as owner below).
update public.profiles set display_name = 'Hacked' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.family_members set nickname = 'Hacked' where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002';
delete from public.saved_trips where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.contact_preferences set opted_in = false where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select throws_ok(
  $$delete from public.profiles where id = auth.uid()$$,
  '42501', null, 'A cannot delete profiles directly'
);

-- Case 8: constraints reject bad data.
select throws_ok(
  $$insert into public.family_members (profile_id, nickname, kind) values (auth.uid(), 'No birth', 'child')$$,
  '23514', null, 'child needs birth month and year'
);
select throws_ok(
  $$insert into public.family_members (profile_id, nickname, kind, birth_year, birth_month) values (auth.uid(), 'Grown', 'adult', 1990, 1)$$,
  '23514', null, 'adult must not have a birth date'
);
select throws_ok(
  $$insert into public.family_members (profile_id, nickname, kind) values (auth.uid(), repeat('n', 31), 'adult')$$,
  '23514', null, 'nickname longer than 30 is rejected'
);
select throws_ok(
  $$insert into public.saved_trips (profile_id, activity_id, activity_name, note) values (auth.uid(), 'long', 'Long', repeat('n', 501))$$,
  '23514', null, 'note longer than 500 is rejected'
);
select throws_ok(
  $$update public.profiles set theme = 'neon' where id = auth.uid()$$,
  '23514', null, 'unknown theme is rejected'
);
select throws_ok(
  $$update public.profiles set display_name = '   ' where id = auth.uid()$$,
  '23514', null, 'blank display name is rejected'
);
select throws_ok(
  $$update public.profiles set home_lat = 51.5 where id = auth.uid()$$,
  '23514', null, 'home lat without lng is rejected'
);
select throws_ok(
  $$insert into public.contact_preferences (profile_id, topic, opted_in, frequency) values (auth.uid(), 'product_news', true, 'weekly')$$,
  '23514', null, 'frequency only allowed for the digest'
);
select lives_ok(
  $$insert into public.family_members (profile_id, nickname, kind)
    select auth.uid(), 'Member ' || g, 'adult' from generate_series(1, 19) g$$,
  'A can have up to 20 family members'
);
select throws_ok(
  $$insert into public.family_members (profile_id, nickname, kind) values (auth.uid(), 'One too many', 'adult')$$,
  'P0001', 'A family can have at most 20 members', '21st family member is rejected'
);

-- Back to owner: B's rows are untouched -------------------------------------
reset role;
select results_eq(
  $$select coalesce(display_name, '') from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  $$values ('')$$,
  'B profile unchanged by A'
);
select results_eq(
  $$select nickname from public.family_members where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  $$values ('B adult')$$,
  'B family unchanged by A'
);
select is((select count(*) from public.saved_trips where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'), 1::bigint, 'B saved trip not deleted by A');
select results_eq(
  $$select opted_in from public.contact_preferences where profile_id = 'bbbbbbbb-0000-0000-0000-000000000002'$$,
  $$values (true)$$,
  'B contact preference unchanged by A'
);

-- Case 5: the anonymous role has no access at all.
set local role anon;
select throws_ok($$select * from public.profiles$$, '42501', null, 'anon cannot read profiles');
select throws_ok($$select * from public.family_members$$, '42501', null, 'anon cannot read family members');
select throws_ok($$select * from public.saved_trips$$, '42501', null, 'anon cannot read saved trips');
select throws_ok($$select * from public.contact_preferences$$, '42501', null, 'anon cannot read contact preferences');
reset role;

-- Case 7: deleting the auth user removes everything.
delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is((select count(*) from public.profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'profile removed with user');
select is((select count(*) from public.family_members where profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'family removed with user');
select is((select count(*) from public.saved_trips where profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'saved trips removed with user');
select is((select count(*) from public.contact_preferences where profile_id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0::bigint, 'contact preferences removed with user');

select * from finish();
rollback;
