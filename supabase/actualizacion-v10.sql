-- PatriApp · actualización 10: «último pago recibido» en Pagos con Apple Pay
-- Cópialo entero en Supabase → SQL Editor → New query → Run. Se puede ejecutar más de una vez.

alter table public.atajo_tokens add column if not exists ultimo_pago timestamptz;
alter table public.atajo_tokens add column if not exists ultimo_importe text;
alter table public.atajo_tokens add column if not exists ultimo_comercio text;
alter table public.atajo_tokens add column if not exists recibidos integer not null default 0;

-- Igual que antes, pero además anota cuándo llegó el último pago y con qué datos.
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
  update public.atajo_tokens set ultimo_pago = now(), ultimo_importe = left(coalesce(apuntar_pago.importe, ''), 40),
    ultimo_comercio = left(apuntar_pago.comercio, 120), recibidos = recibidos + 1
  where user_id = dueno;
  return 'ok';
end;
$$;

-- Estado del atajo para la pantalla de la app.
create or replace function public.info_atajo()
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
    'activo', true, 'ultimo_pago', t.ultimo_pago, 'ultimo_importe', t.ultimo_importe,
    'ultimo_comercio', t.ultimo_comercio, 'recibidos', t.recibidos)
  from public.atajo_tokens t where t.user_id = auth.uid();
$$;

revoke all on function public.apuntar_pago(text, text, text, text) from public;
grant execute on function public.apuntar_pago(text, text, text, text) to anon, authenticated;
revoke all on function public.info_atajo() from public, anon;
grant execute on function public.info_atajo() to authenticated;
