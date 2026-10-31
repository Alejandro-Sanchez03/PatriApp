-- Base de datos de «Mi Patrimonio».
-- Cópialo entero en Supabase → SQL Editor → New query → Run.
-- Cada persona tiene una fila con todos sus datos; las reglas (RLS) hacen que
-- nadie pueda leer ni cambiar los datos de otra persona.

create table if not exists public.datos (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  contenido   jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);

-- La hora de la última modificación la pone siempre el servidor.
create or replace function public.datos_actualizado()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado := now();
  return new;
end;
$$;

drop trigger if exists datos_actualizado on public.datos;
create trigger datos_actualizado
  before insert or update on public.datos
  for each row execute function public.datos_actualizado();

alter table public.datos enable row level security;

drop policy if exists "ver mis datos" on public.datos;
drop policy if exists "crear mis datos" on public.datos;
drop policy if exists "cambiar mis datos" on public.datos;
drop policy if exists "borrar mis datos" on public.datos;

create policy "ver mis datos" on public.datos
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "crear mis datos" on public.datos
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cambiar mis datos" on public.datos
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "borrar mis datos" on public.datos
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Nadie sin sesión puede tocar la tabla.
revoke all on public.datos from anon;
grant select, insert, update, delete on public.datos to authenticated;
