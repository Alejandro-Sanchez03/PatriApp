-- PatriApp · actualización 9: gastos automáticos con Apple Pay (Atajos de iPhone)
-- Cópialo entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

create extension if not exists pgcrypto with schema extensions;

-- Código secreto de cada persona para el atajo (solo se guarda su huella, nunca el código).
create table if not exists public.atajo_tokens (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  token_hash text not null unique,
  creado     timestamptz not null default now()
);
alter table public.atajo_tokens enable row level security;
revoke all on public.atajo_tokens from anon, authenticated;

-- Pagos que llegan desde el atajo y esperan a que la app los apunte.
create table if not exists public.pagos_pendientes (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users (id) on delete cascade,
  importe_texto text not null,
  comercio      text,
  tarjeta       text,
  creado        timestamptz not null default now()
);
create index if not exists pagos_pendientes_usuario on public.pagos_pendientes (user_id, creado);
alter table public.pagos_pendientes enable row level security;
drop policy if exists "ver mis pagos" on public.pagos_pendientes;
drop policy if exists "borrar mis pagos" on public.pagos_pendientes;
create policy "ver mis pagos" on public.pagos_pendientes for select to authenticated using ((select auth.uid()) = user_id);
create policy "borrar mis pagos" on public.pagos_pendientes for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.pagos_pendientes from anon, authenticated;
grant select, delete on public.pagos_pendientes to authenticated;

-- Crea (o cambia) tu código. Devuelve el código una sola vez.
create or replace function public.crear_token_atajo()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  nuevo text := encode(extensions.gen_random_bytes(24), 'hex');
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  insert into public.atajo_tokens (user_id, token_hash)
  values (auth.uid(), encode(extensions.digest(nuevo, 'sha256'), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, creado = now();
  return nuevo;
end;
$$;

-- Desactiva: borra tu código y los pagos que no se hayan apuntado.
create or replace function public.desactivar_atajo()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Sin sesión'; end if;
  delete from public.atajo_tokens where user_id = auth.uid();
  delete from public.pagos_pendientes where user_id = auth.uid();
end;
$$;

-- ¿Tienes el atajo activado?
create or replace function public.estado_atajo()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (select 1 from public.atajo_tokens where user_id = auth.uid());
$$;

-- La llama el atajo del iPhone al pagar. Solo sirve para AÑADIR un pago a quien tenga ese código.
create or replace function public.apuntar_pago(token text, importe text, comercio text default null, tarjeta text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  dueno uuid;
begin
  select t.user_id into dueno from public.atajo_tokens t
  where t.token_hash = encode(extensions.digest(coalesce(apuntar_pago.token, ''), 'sha256'), 'hex');
  if dueno is null then raise exception 'Código no válido'; end if;
  if (select count(*) from public.pagos_pendientes p where p.user_id = dueno and p.creado > now() - interval '1 hour') >= 60 then
    raise exception 'Demasiados pagos seguidos';
  end if;
  insert into public.pagos_pendientes (user_id, importe_texto, comercio, tarjeta)
  values (dueno, left(coalesce(apuntar_pago.importe, ''), 40), left(apuntar_pago.comercio, 120), left(apuntar_pago.tarjeta, 60));
  return 'ok';
end;
$$;

revoke all on function public.crear_token_atajo() from public, anon;
revoke all on function public.desactivar_atajo() from public, anon;
revoke all on function public.estado_atajo() from public, anon;
revoke all on function public.apuntar_pago(text, text, text, text) from public;
grant execute on function public.crear_token_atajo() to authenticated;
grant execute on function public.desactivar_atajo() to authenticated;
grant execute on function public.estado_atajo() to authenticated;
grant execute on function public.apuntar_pago(text, text, text, text) to anon, authenticated;
