-- PatriApp · actualización 11: notificaciones
-- Cópialo entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

-- Un registro por dispositivo con las notificaciones activadas y qué quiere recibir.
create table if not exists public.push_subs (
  id       bigint generated always as identity primary key,
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh   text not null,
  auth     text not null,
  prefs    jsonb not null default '{}'::jsonb,
  enviados jsonb not null default '{}'::jsonb,   -- avisos ya enviados (para no repetirlos)
  creado   timestamptz not null default now()
);
create index if not exists push_subs_usuario on public.push_subs (user_id);
alter table public.push_subs enable row level security;
drop policy if exists "ver mis avisos" on public.push_subs;
drop policy if exists "crear mis avisos" on public.push_subs;
drop policy if exists "cambiar mis avisos" on public.push_subs;
drop policy if exists "borrar mis avisos" on public.push_subs;
create policy "ver mis avisos" on public.push_subs for select to authenticated using ((select auth.uid()) = user_id);
create policy "crear mis avisos" on public.push_subs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "cambiar mis avisos" on public.push_subs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "borrar mis avisos" on public.push_subs for delete to authenticated using ((select auth.uid()) = user_id);
revoke all on public.push_subs from anon, authenticated;
grant select, insert, update, delete on public.push_subs to authenticated;
