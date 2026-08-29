-- NYE Itineraries — unified schema
-- One shape for all trip types. What used to be four renderers is now configuration.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- allowlist
-- Only these emails may write. Read is open to anon.
create table if not exists editors (
  email text primary key,
  added_at timestamptz not null default now()
);

create or replace function is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from editors
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------------------------------------------------------------- settings
create table if not exists settings (
  key   text primary key,
  value jsonb not null
);

-- ---------------------------------------------------------------- itinerary
create table if not exists itineraries (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  icon        text,
  name        text not null,
  subtitle    text,
  countries   text,
  date_label  text,
  departure   text,
  note        text,
  owner_note  text,
  map_caption text,
  flag        text,
  tags        text[] not null default '{}',
  sort_order  int    not null default 0,
  published   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Variants = alternative date windows for the same trip.
-- Standard itineraries have exactly one; the old isWindowPair trips have two.
create table if not exists variants (
  id            uuid primary key default gen_random_uuid(),
  itinerary_id  uuid not null references itineraries(id) on delete cascade,
  label         text,
  date_range    text,
  day_dates     text[],
  flight_note   text,
  sort_order    int not null default 0,
  is_default    boolean not null default false
);
create index if not exists variants_itinerary_idx on variants(itinerary_id);

-- Map points. daytrips are just places with kind='daytrip' + from_code.
create table if not exists places (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  kind         text not null default 'route' check (kind in ('route','daytrip')),
  code         text,
  name         text not null,
  lat          double precision,
  lng          double precision,
  mode         text,
  tag          text,
  blurb        text,
  from_code    text,
  sort_order   int not null default 0
);
create index if not exists places_itinerary_idx on places(itinerary_id);

-- A stay = one city/base for a span of nights.
create table if not exists stays (
  id         uuid primary key default gen_random_uuid(),
  variant_id uuid not null references variants(id) on delete cascade,
  city       text not null,
  label      text,
  checkin    text,
  checkout   text,
  nights     int,
  sort_order int not null default 0
);
create index if not exists stays_variant_idx on stays(variant_id);

-- Candidate places to sleep for a stay. `selected` is the shared pick.
-- lat/lng replace the old localStorage-only "Add pin" coordinates.
create table if not exists stay_options (
  id          uuid primary key default gen_random_uuid(),
  stay_id     uuid not null references stays(id) on delete cascade,
  rank        int,
  source      text,
  name        text not null,
  total_eur   numeric(10,2),
  notes       text,
  extra_note  text,
  url         text,
  address     text,
  lat         double precision,
  lng         double precision,
  selected    boolean not null default false,
  sort_order  int not null default 0,
  updated_at  timestamptz not null default now()
);
create index if not exists stay_options_stay_idx on stay_options(stay_id);

-- Transport. GT priced per leg (cost2); the others priced per person for the
-- whole trip — both normalise to cost_total_eur for the whole party.
create table if not exists legs (
  id             uuid primary key default gen_random_uuid(),
  variant_id     uuid not null references variants(id) on delete cascade,
  route          text not null,
  mode           text,
  carrier        text,
  date           text,
  dep            text,
  arr            text,
  times          text,
  cost_total_eur numeric(10,2),
  note           text,
  sort_order     int not null default 0
);
create index if not exists legs_variant_idx on legs(variant_id);

create table if not exists days (
  id          uuid primary key default gen_random_uuid(),
  variant_id  uuid not null references variants(id) on delete cascade,
  day_no      int,
  date_label  text,
  title       text not null,
  description text,
  tags        text[] not null default '{}',
  sort_order  int not null default 0
);
create index if not exists days_variant_idx on days(variant_id);

-- Free-form blocks: warnings, "not included" cost notes.
create table if not exists notes (
  id           uuid primary key default gen_random_uuid(),
  itinerary_id uuid not null references itineraries(id) on delete cascade,
  kind         text not null check (kind in ('warning','not_included','info')),
  body         text not null,
  sort_order   int not null default 0
);
create index if not exists notes_itinerary_idx on notes(itinerary_id);

-- ---------------------------------------------------------------- RLS
alter table itineraries  enable row level security;
alter table variants     enable row level security;
alter table places       enable row level security;
alter table stays        enable row level security;
alter table stay_options enable row level security;
alter table legs         enable row level security;
alter table days         enable row level security;
alter table notes        enable row level security;
alter table settings     enable row level security;
alter table editors      enable row level security;

do $$
declare t text;
begin
  foreach t in array array['itineraries','variants','places','stays','stay_options','legs','days','notes','settings']
  loop
    execute format('drop policy if exists %I on %I', t || '_read', t);
    execute format('create policy %I on %I for select using (true)', t || '_read', t);
    execute format('drop policy if exists %I on %I', t || '_write', t);
    execute format('create policy %I on %I for all to authenticated using (is_editor()) with check (is_editor())', t || '_write', t);
  end loop;
end $$;

-- Editors table is readable only by editors, never by anon.
drop policy if exists editors_read on editors;
create policy editors_read on editors for select to authenticated using (is_editor());

-- ---------------------------------------------------------------- touch
create or replace function touch_updated_at() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists itineraries_touch on itineraries;
create trigger itineraries_touch before update on itineraries
  for each row execute function touch_updated_at();

drop trigger if exists stay_options_touch on stay_options;
create trigger stay_options_touch before update on stay_options
  for each row execute function touch_updated_at();
