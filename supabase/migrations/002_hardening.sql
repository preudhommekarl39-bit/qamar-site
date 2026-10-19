-- QAMAR — 002 : durcissement avant production (audit du 19/10/2026)
-- ⚠ Non exécuté à ce jour : aucun projet Supabase n'est déployé. À appliquer après 001_init.sql, puis tester
--   sur un environnement de préproduction (voir docs/MISE-EN-PRODUCTION.md).

-- 1) Inscription : le verrou du jour est pris AVANT de lire la promotion et le ticket actif.
--    Corrige deux courses : dépassement des 30 places à −70 % et double ticket pour un même numéro.
create or replace function join_queue(p_name text, p_phone text, p_service text, p_extra_long boolean, p_pref uuid default null)
returns table (ticket_id uuid, access_token uuid, num integer) language plpgsql security definer set search_path = public as $$
declare s services; pr promotions; n integer; t tickets; d date := (now() at time zone 'Asia/Dubai')::date;
begin
  select * into s from services where id = p_service and active;
  if s is null then raise exception 'service_unavailable'; end if;
  if s.from_hour is not null and extract(hour from now() at time zone 'Asia/Dubai') < s.from_hour then raise exception 'service_unavailable'; end if;
  if p_phone !~ '^\+[0-9]{7,15}$' then raise exception 'invalid_phone'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'invalid_name'; end if;
  perform pg_advisory_xact_lock(hashtext('qamar-num-' || d::text));
  select * into t from tickets where client_phone = p_phone and status in ('waiting','called','in_service','checkout');
  if found then return query select t.id, t.access_token, t.num; return; end if;
  if (select count(*) from tickets where client_phone = p_phone and day = d) >= 3 then raise exception 'too_many_requests'; end if;
  pr := best_promo();
  select coalesce(max(tickets.num), 0) + 1 into n from tickets where day = d;
  insert into tickets (num, client_name, client_phone, service_id, extra_long, pref_staff, promo_id, promo_pct)
  values (n, left(regexp_replace(trim(p_name), '[<>[:cntrl:]]', '', 'g'), 40), p_phone, s.id, coalesce(p_extra_long, false), p_pref, pr.id, coalesce(pr.pct, 0))
  returning * into t;
  insert into ticket_events (ticket_id, event) values (t.id, 'joined');
  return query select t.id, t.access_token, t.num;
end $$;

-- 2) Options (matcha…) : plus d'écriture directe. Le prix vient toujours du catalogue, jamais du poste.
drop policy if exists ticket_addons_staff on ticket_addons;
create policy ticket_addons_staff_read on ticket_addons for select using (is_staff());

create or replace function add_addon(p_ticket uuid, p_addon text) returns ticket_addons language plpgsql security definer set search_path = public as $$
declare t tickets; a addons; r ticket_addons;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into t from tickets where id = p_ticket and (assigned_staff = auth.uid() or is_manager()) for update;
  if t is null then raise exception 'not_found'; end if;
  if t.status not in ('waiting','called','in_service') then raise exception 'invalid_state'; end if;
  select * into a from addons where id = p_addon and active;
  if a is null then raise exception 'addon_unavailable'; end if;
  if (select count(*) from ticket_addons where ticket_id = p_ticket) >= 6 then raise exception 'too_many_addons'; end if;
  insert into ticket_addons (ticket_id, addon_id, price_aed) values (p_ticket, a.id, a.price_aed) returning * into r;
  insert into ticket_events (ticket_id, event, actor) values (p_ticket, 'addon:' || a.id, auth.uid());
  return r;
end $$;

create or replace function remove_addon(p_ticket uuid, p_line bigint) returns void language plpgsql security definer set search_path = public as $$
declare t tickets;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into t from tickets where id = p_ticket and (assigned_staff = auth.uid() or is_manager()) for update;
  if t is null or t.status in ('paid','done','cancelled','noshow') then raise exception 'invalid_state'; end if;
  delete from ticket_addons where id = p_line and ticket_id = p_ticket;
end $$;

-- 3) Montant dû : réservé au personnel et au webhook (service_role). Avant : tout compte connecté.
create or replace function amount_due(p_ticket uuid) returns table (base numeric, discount numeric, addons numeric, total numeric) language sql stable security definer set search_path = public as $$
  with t as (select * from tickets where id = p_ticket and (is_staff() or (select auth.role()) = 'service_role')),
  s as (select sv.* from services sv join t on t.service_id = sv.id),
  b as (select s.price_aed + case when t.extra_long then 40 else 0 end as base, t.promo_pct, t.guarantee_free from t, s),
  a as (select coalesce(sum(price_aed), 0) as addons from ticket_addons where ticket_id = p_ticket)
  select b.base, round(b.base * b.promo_pct / 100.0), a.addons,
         case when b.guarantee_free then 0 else b.base - round(b.base * b.promo_pct / 100.0) end + a.addons
  from b, a
$$;
-- NB : le supplément cheveux longs (40 AED) et la garantie (35 min) sont encore écrits en dur ici et dans
-- advance_ticket ; ils doivent rester identiques à assets/data.js (extraLong.price, guarantee.minutes).

-- 4) Plafond des pourboires (miroir de data.js → limits : 100 % du montant, 500 AED max)
alter table payments drop constraint if exists payments_tip_cap;
alter table payments add constraint payments_tip_cap check (tip_aed <= 500 and tip_aed <= greatest(amount_aed, 0));

revoke all on function add_addon(uuid, text), remove_addon(uuid, bigint) from public;
grant execute on function add_addon(uuid, text), remove_addon(uuid, bigint) to authenticated;
