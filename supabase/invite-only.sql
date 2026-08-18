-- LuckyPool invite-only policies and balance request support.
-- Run this after the base schema exists.

create extension if not exists "pgcrypto";

alter table public.members
  add column if not exists user_id uuid;

create unique index if not exists members_user_id_unique
  on public.members (user_id)
  where user_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'members_user_id_fkey'
  ) then
    alter table public.members
      add constraint members_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end $$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.members m
    where m.user_id = auth.uid()
      and m.role = 'beheerder'
      and m.is_active = true
  );
$$;

alter table public.members enable row level security;
alter table public.contributions enable row level security;

create table if not exists public.trekkings (
  id uuid primary key default gen_random_uuid(),
  draw_date date not null unique,
  weekday text not null check (weekday in ('dinsdag', 'vrijdag')),
  status text not null default 'open' check (status in ('open', 'gesloten', 'resultaat_ingevuld', 'verwerkt')),
  winning_numbers integer[] ,
  winning_stars integer[] ,
  total_prize numeric(12,2),
  bought_ticket_image_url text,
  payout_ticket_image_url text,
  created_at timestamptz not null default now()
);

create index if not exists trekkings_draw_date_idx on public.trekkings (draw_date);

alter table public.trekkings enable row level security;

create table if not exists public.balance_requests (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  request_type text not null check (request_type in ('storten', 'uitbetalen')),
  amount numeric(10,2),
  status text not null default 'open' check (status in ('open', 'afgehandeld')),
  created_at timestamptz not null default now(),
  handled_at timestamptz
);

alter table public.balance_requests
  add column if not exists amount numeric(10,2);

alter table public.balance_requests
  drop constraint if exists balance_requests_amount_check;

alter table public.balance_requests
  add constraint balance_requests_amount_check
  check (amount is null or amount > 0);

create index if not exists balance_requests_member_id_idx on public.balance_requests (member_id);
create index if not exists balance_requests_status_idx on public.balance_requests (status);
create unique index if not exists balance_requests_one_open_per_member_idx
  on public.balance_requests (member_id)
  where status = 'open';

alter table public.balance_requests enable row level security;

create table if not exists public.balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  amount numeric(10,2) not null check (amount <> 0),
  action_type text,
  trekking_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.balance_adjustments
  add column if not exists action_type text;

alter table public.balance_adjustments
  add column if not exists trekking_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'balance_adjustments_trekking_id_fkey'
  ) then
    alter table public.balance_adjustments
      add constraint balance_adjustments_trekking_id_fkey
      foreign key (trekking_id) references public.trekkings(id) on delete set null;
  end if;
end $$;

create index if not exists balance_adjustments_member_id_idx on public.balance_adjustments (member_id);
create index if not exists balance_adjustments_created_at_idx on public.balance_adjustments (created_at);
create index if not exists balance_adjustments_trekking_id_idx on public.balance_adjustments (trekking_id);
create index if not exists balance_adjustments_action_type_idx on public.balance_adjustments (action_type);

alter table public.balance_adjustments enable row level security;

create or replace function public.member_balance(p_member_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select sum(c.amount)
        from public.contributions c
        where c.member_id = p_member_id
      ),
      0
    )
    +
    coalesce(
      (
        select sum(a.amount)
        from public.balance_adjustments a
        where a.member_id = p_member_id
      ),
      0
    );
$$;

create or replace function public.prevent_negative_balance_adjustment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
begin
  select public.member_balance(new.member_id) into v_balance;

  if v_balance + new.amount < 0 then
    raise exception 'Onvoldoende saldo.';
  end if;

  return new;
end;
$$;

drop trigger if exists balance_adjustments_prevent_negative on public.balance_adjustments;
create trigger balance_adjustments_prevent_negative
before insert on public.balance_adjustments
for each row
execute function public.prevent_negative_balance_adjustment();

create table if not exists public.trekking_participations (
  id uuid primary key default gen_random_uuid(),
  trekking_id uuid not null references public.trekkings(id) on delete cascade,
  member_id uuid not null references public.members(id) on delete cascade,
  is_playing boolean not null default true,
  joined_at timestamptz not null default now(),
  left_at timestamptz
);

create unique index if not exists trekking_participations_unique
  on public.trekking_participations (trekking_id, member_id);

create index if not exists trekking_participations_trekking_id_idx
  on public.trekking_participations (trekking_id);

create index if not exists trekking_participations_member_id_idx
  on public.trekking_participations (member_id);

alter table public.trekking_participations enable row level security;

drop policy if exists "members can read own member row" on public.members;
drop policy if exists "admin can manage members" on public.members;
drop policy if exists "members can read contributions" on public.contributions;
drop policy if exists "admin can manage contributions" on public.contributions;
drop policy if exists "members can create balance requests" on public.balance_requests;
drop policy if exists "members can read own balance requests" on public.balance_requests;
drop policy if exists "admin can read all balance requests" on public.balance_requests;
drop policy if exists "admin can manage balance requests" on public.balance_requests;
drop policy if exists "admin can read balance adjustments" on public.balance_adjustments;
drop policy if exists "admin can manage balance adjustments" on public.balance_adjustments;
drop policy if exists "members can read own balance adjustments" on public.balance_adjustments;
drop policy if exists "members can read trekkings" on public.trekkings;
drop policy if exists "admin can manage trekkings" on public.trekkings;
drop policy if exists "members can read own trekking participations" on public.trekking_participations;
drop policy if exists "admin can read all trekking participations" on public.trekking_participations;
drop policy if exists "members can read all member rows" on public.members;
drop policy if exists "members can read all trekking participations" on public.trekking_participations;

create policy "members can read active member rows"
on public.members
for select
to authenticated
using (
  is_active = true
  or is_admin()
);

create policy "admin can manage members"
on public.members
for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "members can read contributions"
on public.contributions
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = member_id
      and (m.user_id = auth.uid() or is_admin())
  )
);

create policy "admin can manage contributions"
on public.contributions
for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "members can create balance requests"
on public.balance_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.members m
    where m.id = member_id
      and m.user_id = auth.uid()
      and m.is_active = true
  )
  and (
    request_type = 'storten'
    or (
      request_type = 'uitbetalen'
      and amount <= public.member_balance(member_id)
    )
  )
);

create policy "members can read own balance requests"
on public.balance_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = member_id
      and m.user_id = auth.uid()
  )
);

create policy "admin can read all balance requests"
on public.balance_requests
for select
to authenticated
using (is_admin());

create policy "admin can manage balance requests"
on public.balance_requests
for update
to authenticated
using (is_admin())
with check (is_admin());

create policy "admin can read balance adjustments"
on public.balance_adjustments
for select
to authenticated
using (is_admin());

create policy "admin can manage balance adjustments"
on public.balance_adjustments
for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "members can read own balance adjustments"
on public.balance_adjustments
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = member_id
      and m.user_id = auth.uid()
    )
);

create policy "members can read trekkings"
on public.trekkings
for select
to authenticated
using (true);

create policy "admin can manage trekkings"
on public.trekkings
for all
to authenticated
using (is_admin())
with check (is_admin());

create policy "members can read active trekking participations"
on public.trekking_participations
for select
to authenticated
using (
  exists (
    select 1
    from public.members m
    where m.id = member_id
      and (m.is_active = true or is_admin())
  )
);

create policy "admin can read all trekking participations"
on public.trekking_participations
for select
to authenticated
using (is_admin());

create or replace function public.set_trekking_participation(
  p_draw_date date,
  p_weekday text,
  p_is_playing boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_member_id uuid;
  v_trekking_id uuid;
  v_trekking_status text;
  v_current_is_playing boolean;
begin
  if p_weekday not in ('dinsdag', 'vrijdag') then
    raise exception 'Ongeldige trekkingsdag.';
  end if;

  select m.id
  into v_member_id
  from public.members m
  where m.user_id = auth.uid()
    and m.is_active = true;

  if v_member_id is null then
    raise exception 'Je account is nog niet gekoppeld.';
  end if;

  select t.id, t.status
  into v_trekking_id, v_trekking_status
  from public.trekkings t
  where t.draw_date = p_draw_date;

  if found then
    if v_trekking_status <> 'open' then
      raise exception 'Deze trekking is gesloten.';
    end if;

    update public.trekkings
    set weekday = p_weekday
    where id = v_trekking_id;
  else
    insert into public.trekkings (draw_date, weekday)
    values (p_draw_date, p_weekday)
    returning id, status into v_trekking_id, v_trekking_status;
  end if;

  select tp.is_playing
  into v_current_is_playing
  from public.trekking_participations tp
  where tp.trekking_id = v_trekking_id
    and tp.member_id = v_member_id;

  if p_is_playing then
    if v_current_is_playing is distinct from true and public.member_balance(v_member_id) < 10 then
      raise exception 'Onvoldoende saldo om mee te spelen.';
    end if;

    insert into public.trekking_participations (
      trekking_id,
      member_id,
      is_playing,
      joined_at,
      left_at
    )
    values (
      v_trekking_id,
      v_member_id,
      true,
      now(),
      null
    )
    on conflict (trekking_id, member_id) do update
      set is_playing = true,
          joined_at = coalesce(public.trekking_participations.joined_at, now()),
          left_at = null;

    if v_current_is_playing is distinct from true then
      insert into public.balance_adjustments (
        member_id,
        amount,
        action_type,
        trekking_id,
        created_by
      )
      values (
        v_member_id,
        -10.00,
        'inschrijven_trekking',
        v_trekking_id,
        auth.uid()
      );
    end if;
  else
    if v_current_is_playing = true then
      update public.trekking_participations
      set is_playing = false,
          left_at = now()
      where trekking_id = v_trekking_id
        and member_id = v_member_id;

      insert into public.balance_adjustments (member_id, amount, action_type, trekking_id, created_by)
      values (v_member_id, 10.00, 'uitschrijven_trekking', v_trekking_id, auth.uid());
    end if;
  end if;
end;
$$;

create or replace function public.save_trekking_result(
  p_draw_date date,
  p_weekday text,
  p_winning_numbers integer[],
  p_winning_stars integer[],
  p_total_prize numeric,
  p_bought_ticket_image_url text,
  p_payout_ticket_image_url text,
  p_distribute_winnings boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trekking_id uuid;
  v_trekking_status text;
  v_participant_count integer;
  v_total_cents integer;
  v_share_cents integer;
  v_remainder integer;
  v_participant record;
begin
  if p_weekday not in ('dinsdag', 'vrijdag') then
    raise exception 'Ongeldige trekkingsdag.';
  end if;

  select t.id, t.status
  into v_trekking_id, v_trekking_status
  from public.trekkings t
  where t.draw_date = p_draw_date;

  if found then
    if v_trekking_status = 'verwerkt' then
      raise exception 'Deze trekking is al verwerkt.';
    end if;

    update public.trekkings
    set weekday = p_weekday,
        winning_numbers = p_winning_numbers,
        winning_stars = p_winning_stars,
        total_prize = p_total_prize,
        bought_ticket_image_url = p_bought_ticket_image_url,
        payout_ticket_image_url = p_payout_ticket_image_url,
        status = case
          when p_distribute_winnings and coalesce(p_total_prize, 0) > 0 then 'verwerkt'
          else 'resultaat_ingevuld'
        end
    where id = v_trekking_id;
  else
    insert into public.trekkings (
      draw_date,
      weekday,
      winning_numbers,
      winning_stars,
      total_prize,
      bought_ticket_image_url,
      payout_ticket_image_url,
      status
    )
    values (
      p_draw_date,
      p_weekday,
      p_winning_numbers,
      p_winning_stars,
      p_total_prize,
      p_bought_ticket_image_url,
      p_payout_ticket_image_url,
      case
        when p_distribute_winnings and coalesce(p_total_prize, 0) > 0 then 'verwerkt'
        else 'resultaat_ingevuld'
      end
    )
    returning id, status into v_trekking_id, v_trekking_status;
  end if;

  if p_distribute_winnings then
    if coalesce(p_total_prize, 0) <= 0 then
      raise exception 'Geef een geldige totale winst in.';
    end if;

    select count(*)
    into v_participant_count
    from public.trekking_participations tp
    where tp.trekking_id = v_trekking_id
      and tp.is_playing = true;

    if v_participant_count = 0 then
      raise exception 'Er zijn nog geen deelnemers om de winst te verdelen.';
    end if;

    v_total_cents := round(coalesce(p_total_prize, 0) * 100);
    v_share_cents := v_total_cents / v_participant_count;
    v_remainder := mod(v_total_cents, v_participant_count);

    for v_participant in
      select
        tp.member_id,
        row_number() over (order by tp.joined_at, tp.member_id) as rn
      from public.trekking_participations tp
      where tp.trekking_id = v_trekking_id
        and tp.is_playing = true
      order by tp.joined_at, tp.member_id
    loop
      insert into public.balance_adjustments (
        member_id,
        amount,
        action_type,
        trekking_id,
        created_by
      )
      values (
        v_participant.member_id,
        ((v_share_cents + case when v_participant.rn <= v_remainder then 1 else 0 end)::numeric / 100),
        'winst',
        v_trekking_id,
        auth.uid()
      );
    end loop;
  end if;
end;
$$;

grant execute on function public.set_trekking_participation(date, text, boolean) to authenticated;
grant execute on function public.save_trekking_result(date, text, integer[], integer[], numeric, text, text, boolean) to authenticated;

insert into storage.buckets (id, name, public)
values ('trekking-fotos', 'Trekking foto''s', true)
on conflict (id) do update
set name = excluded.name,
    public = excluded.public;

drop policy if exists "public can read trekking fotos" on storage.objects;
drop policy if exists "admin can upload trekking fotos" on storage.objects;
drop policy if exists "admin can update trekking fotos" on storage.objects;
drop policy if exists "admin can delete trekking fotos" on storage.objects;

create policy "public can read trekking fotos"
on storage.objects
for select
to public
using (bucket_id = 'trekking-fotos');

create policy "admin can upload trekking fotos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'trekking-fotos'
  and public.is_admin()
);

create policy "admin can update trekking fotos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'trekking-fotos'
  and public.is_admin()
)
with check (
  bucket_id = 'trekking-fotos'
  and public.is_admin()
);

create policy "admin can delete trekking fotos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'trekking-fotos'
  and public.is_admin()
);
