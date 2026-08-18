-- Zorg dat iedere saldoverandering een herkenbare reden en eventueel een trekking heeft.
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
      foreign key (trekking_id)
      references public.trekkings(id)
      on delete set null;
  end if;
end $$;

create index if not exists balance_adjustments_member_created_idx
  on public.balance_adjustments(member_id, created_at desc);

create or replace function public.set_trekking_participation(
  target_draw_date date,
  target_weekday text,
  should_participate boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_member_id uuid;
  target_trekking_id uuid;
  existing_participation_id uuid;
  current_balance numeric;
begin
  select id
  into current_member_id
  from public.members
  where user_id = auth.uid()
    and is_active = true
  limit 1;

  if current_member_id is null then
    raise exception 'Je account is niet gekoppeld aan een actief lid.';
  end if;

  insert into public.trekkings (draw_date, weekday)
  values (target_draw_date, target_weekday)
  on conflict (draw_date)
  do update set weekday = excluded.weekday
  returning id into target_trekking_id;

  if exists (
    select 1
    from public.trekkings
    where id = target_trekking_id
      and is_closed = true
  ) then
    raise exception 'Deze trekking is gesloten.';
  end if;

  select id
  into existing_participation_id
  from public.trekking_participations
  where trekking_id = target_trekking_id
    and member_id = current_member_id
  limit 1;

  if should_participate and existing_participation_id is null then
    select public.member_balance(current_member_id)
    into current_balance;

    if current_balance < 10 then
      raise exception 'Onvoldoende saldo om deel te nemen. Je hebt minimaal EUR 10,00 nodig.';
    end if;

    insert into public.trekking_participations (trekking_id, member_id, entry_cost)
    values (target_trekking_id, current_member_id, 10);

    insert into public.balance_adjustments (member_id, amount, action_type, trekking_id)
    values (current_member_id, -10, 'inschrijven_trekking', target_trekking_id);
  elsif not should_participate and existing_participation_id is not null then
    delete from public.trekking_participations
    where id = existing_participation_id;

    insert into public.balance_adjustments (member_id, amount, action_type, trekking_id)
    values (current_member_id, 10, 'uitschrijven_trekking', target_trekking_id);
  end if;
end;
$$;

create or replace function public.save_trekking_result(
  target_draw_date date,
  target_weekday text,
  target_numbers integer[],
  target_stars integer[],
  target_total_winnings numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_trekking_id uuid;
  participant_count integer;
  winnings_per_member numeric;
begin
  if not public.is_admin() then
    raise exception 'Alleen een beheerder kan trekkingresultaten opslaan.';
  end if;

  if coalesce(array_length(target_numbers, 1), 0) <> 5 then
    raise exception 'Vul precies 5 winnende nummers in.';
  end if;

  if coalesce(array_length(target_stars, 1), 0) <> 2 then
    raise exception 'Vul precies 2 sterren in.';
  end if;

  if target_total_winnings < 0 then
    raise exception 'De totale winst kan niet negatief zijn.';
  end if;

  insert into public.trekkings (draw_date, weekday)
  values (target_draw_date, target_weekday)
  on conflict (draw_date)
  do update set weekday = excluded.weekday
  returning id into target_trekking_id;

  if exists (
    select 1
    from public.trekkings
    where id = target_trekking_id
      and winnings_distributed_at is not null
  ) then
    raise exception 'Deze trekking is al verwerkt.';
  end if;

  select count(*)
  into participant_count
  from public.trekking_participations
  where trekking_id = target_trekking_id;

  if target_total_winnings > 0 and participant_count = 0 then
    raise exception 'Er zijn geen deelnemers om de winst over te verdelen.';
  end if;

  update public.trekkings
  set winning_numbers = target_numbers,
      winning_stars = target_stars,
      total_winnings = target_total_winnings,
      winnings_distributed_at = now(),
      is_closed = true
  where id = target_trekking_id;

  if target_total_winnings > 0 then
    winnings_per_member := round(target_total_winnings / participant_count, 2);

    insert into public.balance_adjustments (member_id, amount, action_type, trekking_id)
    select member_id, winnings_per_member, 'winst', target_trekking_id
    from public.trekking_participations
    where trekking_id = target_trekking_id;
  end if;
end;
$$;

grant execute on function public.set_trekking_participation(date, text, boolean) to authenticated;
grant execute on function public.save_trekking_result(date, text, integer[], integer[], numeric) to authenticated;

notify pgrst, 'reload schema';
