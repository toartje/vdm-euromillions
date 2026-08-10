-- Tijdelijke leesrechten voor LuckyPool fase 1.
-- Hiermee kan de app de tabellen tonen via de openbare anon key.
-- We vervangen dit later door echte login-gebaseerde rechten.

grant select on public.members to anon;
grant select on public.contributions to anon;

drop policy if exists "anon can read members" on public.members;
drop policy if exists "anon can read contributions" on public.contributions;

create policy "anon can read members"
on public.members
for select
to anon
using (true);

create policy "anon can read contributions"
on public.contributions
for select
to anon
using (true);
