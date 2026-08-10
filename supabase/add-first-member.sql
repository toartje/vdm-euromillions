-- LuckyPool testlid
-- Dit kun je veilig opnieuw uitvoeren.

insert into public.members (
  id,
  full_name,
  email,
  role,
  is_active
)
values (
  '11111111-1111-1111-1111-111111111111',
  'Test Lid',
  'test@luckypool.local',
  'beheerder',
  true
)
on conflict (id) do update
set
  full_name = excluded.full_name,
  email = excluded.email,
  role = excluded.role,
  is_active = excluded.is_active;
