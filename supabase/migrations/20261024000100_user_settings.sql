-- Spec 005: user settings. See specs/005-user-settings/data-model.md and
-- contracts/rls-policies.md. Every table is RLS-protected; anon has no access.

-- Shared helpers ------------------------------------------------------------

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text
    constraint profiles_display_name_length
    check (display_name is null or char_length(btrim(display_name)) between 1 and 50),
  home_place_name text
    constraint profiles_home_place_name_length check (char_length(home_place_name) <= 120),
  home_lat double precision constraint profiles_home_lat_range check (home_lat between -90 and 90),
  home_lng double precision constraint profiles_home_lng_range check (home_lng between -180 and 180),
  theme text not null default 'system'
    constraint profiles_theme_valid check (theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_home_complete check ((home_lat is null) = (home_lng is null))
);

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- One profile per account, created as the account is.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- family_members ------------------------------------------------------------

create table public.family_members (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  nickname text not null
    constraint family_members_nickname_length check (char_length(btrim(nickname)) between 1 and 30),
  kind text not null constraint family_members_kind_valid check (kind in ('adult', 'child', 'dog')),
  birth_year smallint constraint family_members_birth_year_range check (birth_year between 1900 and 2100),
  birth_month smallint constraint family_members_birth_month_range check (birth_month between 1 and 12),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  -- Only children carry a birth month and year, and they always do (no full dates are stored).
  constraint family_members_birth_only_for_children check (
    (kind = 'child' and birth_year is not null and birth_month is not null)
    or (kind <> 'child' and birth_year is null and birth_month is null)
  )
);

create index family_members_profile_order on public.family_members (profile_id, sort_order);

-- Matches the URL state's family size cap. Locks the profile row so two
-- concurrent inserts can't both squeeze past the limit.
create function public.enforce_family_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from public.profiles where id = new.profile_id for update;
  if (select count(*) from public.family_members where profile_id = new.profile_id) >= 20 then
    raise exception 'A family can have at most 20 members';
  end if;
  return new;
end;
$$;

create trigger family_members_limit
before insert on public.family_members
for each row execute function public.enforce_family_limit();

-- saved_trips ---------------------------------------------------------------

create table public.saved_trips (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  activity_id text not null
    constraint saved_trips_activity_id_length check (char_length(activity_id) between 1 and 200),
  activity_name text not null
    constraint saved_trips_activity_name_length check (char_length(activity_name) between 1 and 200),
  saved_at timestamptz not null default now(),
  planned_for date,
  note text constraint saved_trips_note_length check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (profile_id, activity_id)
);

create index saved_trips_profile_order
on public.saved_trips (profile_id, planned_for, saved_at desc);

create trigger saved_trips_set_updated_at
before update on public.saved_trips
for each row execute function public.set_updated_at();

-- contact_preferences -------------------------------------------------------

create table public.contact_preferences (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  topic text not null
    constraint contact_preferences_topic_valid check (topic in ('product_news', 'nearby_digest')),
  opted_in boolean not null default false,
  frequency text
    constraint contact_preferences_frequency_valid check (frequency in ('weekly', 'monthly')),
  changed_at timestamptz not null default now(),
  primary key (profile_id, topic),
  constraint contact_preferences_frequency_only_digest
    check (frequency is null or topic = 'nearby_digest')
);

create function public.touch_contact_preference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.opted_in is distinct from old.opted_in then
    new.changed_at := now();
  end if;
  return new;
end;
$$;

create trigger contact_preferences_changed_at
before update on public.contact_preferences
for each row execute function public.touch_contact_preference();

-- Grants --------------------------------------------------------------------
-- Supabase grants everything on new public tables to anon and authenticated by
-- default; start from nothing and add back only what the policies need.

revoke all on table
  public.profiles,
  public.family_members,
  public.saved_trips,
  public.contact_preferences
from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, home_place_name, home_lat, home_lng, theme)
on public.profiles to authenticated;
grant select, insert, update, delete on
  public.family_members,
  public.saved_trips,
  public.contact_preferences
to authenticated;

revoke execute on function
  public.set_updated_at(),
  public.handle_new_user(),
  public.enforce_family_limit(),
  public.touch_contact_preference()
from public, anon, authenticated;

-- Row-level security ----------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.family_members enable row level security;
alter table public.saved_trips enable row level security;
alter table public.contact_preferences enable row level security;

create policy "Users read their own profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Users update their own profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Users manage their own family"
on public.family_members for all to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Users manage their own saved trips"
on public.saved_trips for all to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "Users manage their own contact preferences"
on public.contact_preferences for all to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));
