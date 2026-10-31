-- PatriApp · actualización 8
-- Cópialo entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

-- 1. Historial de versiones: antes de cada cambio se guarda cómo estaban tus datos
--    (como mucho una versión por hora, y las 60 más recientes por persona).
create table if not exists public.datos_versiones (
  id        bigint generated always as identity primary key,
  user_id   uuid not null references auth.users (id) on delete cascade,
  contenido jsonb not null,
  creado    timestamptz not null default now()
);
create index if not exists datos_versiones_usuario on public.datos_versiones (user_id, creado desc);
alter table public.datos_versiones enable row level security;
drop policy if exists "ver mis versiones" on public.datos_versiones;
create policy "ver mis versiones" on public.datos_versiones
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.datos_versiones from anon, authenticated;
grant select on public.datos_versiones to authenticated;

create or replace function public.guardar_version()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.datos_versiones v
    where v.user_id = old.user_id and v.creado > now() - interval '1 hour'
  ) then
    insert into public.datos_versiones (user_id, contenido) values (old.user_id, old.contenido);
    delete from public.datos_versiones v
    where v.user_id = old.user_id
      and v.id not in (
        select w.id from public.datos_versiones w
        where w.user_id = old.user_id
        order by w.creado desc
        limit 60
      );
  end if;
  return new;
end;
$$;

drop trigger if exists datos_guardar_version on public.datos;
create trigger datos_guardar_version
  before update on public.datos
  for each row
  when (old.contenido is distinct from new.contenido)
  execute function public.guardar_version();

-- 2. Eliminar la propia cuenta desde la app (borra también sus datos y versiones).
create or replace function public.eliminar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sin sesión';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;
revoke all on function public.eliminar_mi_cuenta() from public, anon;
grant execute on function public.eliminar_mi_cuenta() to authenticated;

-- 3. Lista de ISIN de los fondos de todos los usuarios, SIN importes ni a quién pertenecen,
--    para que la búsqueda de precios de los lunes encuentre también los de los demás.
create table if not exists public.isins (
  isin   text primary key check (isin ~ '^[A-Z]{2}[A-Z0-9]{9}[0-9]$'),
  moneda text not null default 'EUR' check (moneda in ('EUR', 'USD')),
  creado timestamptz not null default now()
);
alter table public.isins enable row level security;
drop policy if exists "leer isins" on public.isins;
drop policy if exists "añadir isins" on public.isins;
create policy "leer isins" on public.isins for select to anon, authenticated using (true);
create policy "añadir isins" on public.isins for insert to authenticated with check (true);
revoke all on public.isins from anon, authenticated;
grant select on public.isins to anon, authenticated;
grant insert on public.isins to authenticated;
