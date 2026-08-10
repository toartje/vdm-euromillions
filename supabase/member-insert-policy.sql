-- Tijdelijke schrijfrechten voor het toevoegen van leden.
-- Alleen nodig zolang we nog geen login-systeem hebben.

drop policy if exists "anon can insert members" on public.members;

create policy "anon can insert members"
on public.members
for insert
to anon
with check (true);
