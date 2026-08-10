-- LuckyPool database basis
-- Eén vaste groep, dus geen aparte groups-table nodig.
-- We houden het simpel met leden en bijdragen.

create extension if not exists "pgcrypto";

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text,
  role text not null default 'lid' check (role in ('beheerder', 'lid')),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create unique index if not exists members_email_unique
  on public.members (email)
  where email is not null;

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric(10,2) not null check (amount > 0),
  contribution_date date not null default current_date,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists contributions_member_id_idx on public.contributions (member_id);
create index if not exists contributions_contribution_date_idx on public.contributions (contribution_date);

alter table public.members enable row level security;
alter table public.contributions enable row level security;

-- Voorlopig laten we deze tabellen nog uitgeschakeld voor openbare toegang.
-- In de volgende fase zetten we hier duidelijke policies op voor login en beheer.
