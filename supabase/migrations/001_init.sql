-- QAMAR — schéma Supabase (PostgreSQL) : file d'attente, postes, pointage, paiements, avis, audit.
-- À appliquer avec `supabase db push` (voir DEPLOY.md). NON CONNECTÉ tant que config.js reste en mode 'demo'.
-- Principes :
--   * horodatages générés par le serveur (now()), fuseau d'affichage Asia/Dubai
--   * le navigateur n'écrit jamais directement dans les tables sensibles : il appelle des fonctions (RPC)
--     SECURITY DEFINER qui vérifient le rôle, l'état et recalculent les montants
--   * Row Level Security activée partout ; l'anonyme ne voit que ce qui est strictement public

create extension if not exists pgcrypto;

-- ---------- Rôles du personnel ----------
create type staff_role as enum ('stylist', 'manager');
create type ticket_status as enum ('waiting', 'called', 'in_service', 'checkout', 'paid', 'done', 'cancelled', 'noshow');
create type pay_status as enum ('pending', 'confirmed', 'failed', 'refunded');
create type pay_method as enum ('applepay', 'card', 'cash', 'bnpl');

create table staff (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  role staff_role not null default 'stylist',
  instagram text,
  specialty_en text, specialty_ar text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table stations (
  seat smallint primary key check (seat between 1 and 20),
  label text not null
);

-- ---------- Catalogue (miroir de assets/data.js, modifiable par la gérante) ----------
create table services (
  id text primary key,
  look_en text not null, look_ar text not null,
  name_en text not null, name_ar text not null,
  duration_min smallint not null check (duration_min between 5 and 45),   -- règle métier : 45 min maximum
  price_aed numeric(8,2) not null check (price_aed >= 0),
  from_hour smallint check (from_hour between 0 and 23),
  free_matcha boolean not null default false,
  active boolean not null default true
);

create table addons (
  id text primary key,
  name_en text not null, name_ar text not null,
  kind text not null,
  price_aed numeric(8,2) not null check (price_aed >= 0),
  active boolean not null default true
);

-- Promotions configurables, datées, désactivables (une seule s'applique : la plus avantageuse)
create table promotions (
  id text primary key,                         -- 'launch-first', 'launch', 'happy-hours'…
  label_en text not null, label_ar text not null,
  pct smallint not null check (pct between 0 and 100),
  starts_at timestamptz, ends_at timestamptz,
  max_uses integer,                            -- ex. 30 pour 'launch-first'
  days smallint[],                             -- 1 = lundi … 7 = dimanche (ISO)
  from_hour smallint, to_hour smallint,
  enabled boolean not null default false
);

-- ---------- Tickets (file d'attente) ----------
create table tickets (
  id uuid primary key default gen_random_uuid(),
  day date not null default (now() at time zone 'Asia/Dubai')::date,
  num integer not null,
  client_name text not null check (char_length(client_name) between 1 and 40),
  client_phone text check (client_phone ~ '^\+[0-9]{7,15}$'),
  access_token uuid not null default gen_random_uuid(),   -- permet à la cliente (et à elle seule) de suivre son ticket
  service_id text not null references services(id),
  extra_long boolean not null default false,
  pref_staff uuid references staff(id),
  assigned_staff uuid references staff(id),
  seat smallint references stations(seat),
  promo_id text references promotions(id),
  promo_pct smallint not null default 0,
  status ticket_status not null default 'waiting',
  channel text not null default 'qr' check (channel in ('qr', 'whatsapp', 'walkin')),
  perfume text, hijab boolean not null default false,
  guarantee_free boolean not null default false,
  created_at timestamptz not null default now(),
  called_at timestamptz, started_at timestamptz, finished_at timestamptz, closed_at timestamptz,
  unique (day, num)
);
create index tickets_status_idx on tickets (status, created_at);
-- une seule demande active par numéro de téléphone
create unique index tickets_one_active_per_phone on tickets (client_phone)
  where status in ('waiting', 'called', 'in_service', 'checkout');
-- une seule cliente active par coiffeuse (empêche le double appel)
create unique index tickets_one_active_per_staff on tickets (assigned_staff)
  where status in ('called', 'in_service', 'checkout');

create table ticket_addons (
  id bigserial primary key,
  ticket_id uuid not null references tickets(id) on delete cascade,
  addon_id text not null references addons(id),
  price_aed numeric(8,2) not null,
  created_at timestamptz not null default now()
);

create table ticket_events (
  id bigserial primary key,
  ticket_id uuid not null references tickets(id) on delete cascade,
  event text not null,
  actor uuid,
  at timestamptz not null default now()
);

-- ---------- Pointage ----------
create table shifts (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id),
  seat smallint references stations(seat),
  clock_in timestamptz not null default now(),
  clock_out timestamptz,
  closed_by text check (closed_by in ('staff', 'manager', 'auto'))
);
create unique index shifts_one_open on shifts (staff_id) where clock_out is null;  -- pas de double pointage

-- ---------- Paiements (confirmés UNIQUEMENT par webhook prestataire, ou par la coiffeuse pour les espèces) ----------
create table payments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references tickets(id),
  method pay_method not null,
  status pay_status not null default 'pending',
  amount_aed numeric(8,2) not null check (amount_aed >= 0),   -- recalculé par le serveur
  discount_aed numeric(8,2) not null default 0,
  tip_aed numeric(8,2) not null default 0 check (tip_aed >= 0),
  provider text, provider_ref text,
  idempotency_key text unique,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);
create unique index payments_one_confirmed on payments (ticket_id) where status = 'confirmed';

create table reviews (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null unique references tickets(id),       -- un avis par visite payée, donc par vraie cliente
  staff_id uuid references staff(id),
  stars smallint not null check (stars between 1 and 5),
  comment text check (char_length(comment) <= 500),
  created_at timestamptz not null default now()
);

create table message_log (                                      -- statut des messages WhatsApp, sans contenu personnel
  id bigserial primary key,
  ticket_id uuid references tickets(id) on delete set null,
  template text not null,
  provider_id text,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  unique (ticket_id, template)                                  -- pas de doublon d'appel
);

create table audit_logs (
  id bigserial primary key,
  actor uuid, action text not null, target text, details jsonb,
  at timestamptz not null default now()
);

-- ---------- Aides ----------
create or replace function is_staff() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where id = auth.uid() and active) $$;
create or replace function is_manager() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where id = auth.uid() and active and role = 'manager') $$;

-- Meilleure promotion applicable maintenant (une seule)
create or replace function best_promo() returns promotions language sql stable security definer set search_path = public as $$
  select p.* from promotions p
  where p.enabled
    and (p.starts_at is null or now() >= p.starts_at)
    and (p.ends_at is null or now() < p.ends_at)
    and (p.days is null or extract(isodow from now() at time zone 'Asia/Dubai')::smallint = any(p.days))
    and (p.from_hour is null or extract(hour from now() at time zone 'Asia/Dubai') >= p.from_hour)
    and (p.to_hour is null or extract(hour from now() at time zone 'Asia/Dubai') < p.to_hour)
    and (p.max_uses is null or (select count(*) from tickets t where t.promo_id = p.id and t.status not in ('cancelled','noshow')) < p.max_uses)
  order by p.pct desc limit 1
$$;

-- ---------- RPC publiques (cliente) ----------
create or replace function join_queue(p_name text, p_phone text, p_service text, p_extra_long boolean, p_pref uuid default null)
returns table (ticket_id uuid, access_token uuid, num integer) language plpgsql security definer set search_path = public as $$
declare s services; pr promotions; n integer; t tickets; d date := (now() at time zone 'Asia/Dubai')::date;
begin
  select * into s from services where id = p_service and active;
  if s is null then raise exception 'service_unavailable'; end if;
  if s.from_hour is not null and extract(hour from now() at time zone 'Asia/Dubai') < s.from_hour then raise exception 'service_unavailable'; end if;
  if p_phone !~ '^\+[0-9]{7,15}$' then raise exception 'invalid_phone'; end if;
  -- ticket actif existant → on le renvoie (idempotent)
  select * into t from tickets where client_phone = p_phone and status in ('waiting','called','in_service','checkout');
  if found then return query select t.id, t.access_token, t.num; return; end if;
  -- anti-abus : 3 inscriptions max par numéro et par jour
  if (select count(*) from tickets where client_phone = p_phone and day = d) >= 3 then raise exception 'too_many_requests'; end if;
  pr := best_promo();
  perform pg_advisory_xact_lock(hashtext('qamar-num-' || d::text));
  select coalesce(max(tickets.num), 0) + 1 into n from tickets where day = d;
  insert into tickets (num, client_name, client_phone, service_id, extra_long, pref_staff, promo_id, promo_pct)
  values (n, left(regexp_replace(trim(p_name), '[<>[:cntrl:]]', '', 'g'), 40), p_phone, s.id, coalesce(p_extra_long, false), p_pref, pr.id, coalesce(pr.pct, 0))
  returning * into t;
  insert into ticket_events (ticket_id, event) values (t.id, 'joined');
  return query select t.id, t.access_token, t.num;
end $$;

create or replace function my_ticket(p_ticket uuid, p_token uuid) returns tickets language sql stable security definer set search_path = public as
$$ select * from tickets where id = p_ticket and access_token = p_token $$;

create or replace function cancel_my_ticket(p_ticket uuid, p_token uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  update tickets set status = 'cancelled', closed_at = now() where id = p_ticket and access_token = p_token and status in ('waiting','called');
  if found then insert into ticket_events (ticket_id, event) values (p_ticket, 'cancelled_by_client'); end if;
end $$;

-- File publique anonymisée pour l'écran d'entrée (prénom + initiale, aucun téléphone)
create or replace view public_queue with (security_invoker = false) as
  select t.num, split_part(t.client_name, ' ', 1) || coalesce(' ' || left(nullif(split_part(t.client_name, ' ', 2), ''), 1) || '.', '') as display_name,
         t.status, t.seat, t.created_at, t.called_at, st.display_name as staff_name
  from tickets t left join staff st on st.id = t.assigned_staff
  where t.day = (now() at time zone 'Asia/Dubai')::date and t.status in ('waiting','called','in_service');

-- ---------- RPC personnel ----------
create or replace function clock_in(p_seat smallint) returns shifts language plpgsql security definer set search_path = public as $$
declare sh shifts;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into sh from shifts where staff_id = auth.uid() and clock_out is null;
  if found then return sh; end if;                                   -- pas de double pointage
  insert into shifts (staff_id, seat) values (auth.uid(), p_seat) returning * into sh;
  insert into audit_logs (actor, action, target) values (auth.uid(), 'clock_in', p_seat::text);
  return sh;
end $$;

create or replace function clock_out() returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  if exists (select 1 from tickets where assigned_staff = auth.uid() and status in ('called','in_service','checkout')) then raise exception 'client_in_progress'; end if;
  update shifts set clock_out = now(), closed_by = 'staff' where staff_id = auth.uid() and clock_out is null;
  insert into audit_logs (actor, action) values (auth.uid(), 'clock_out');
end $$;

-- Appel atomique de la prochaine cliente éligible (verrou + SKIP LOCKED : jamais deux postes pour la même cliente)
create or replace function call_next(p_ticket uuid default null) returns tickets language plpgsql security definer set search_path = public as $$
declare t tickets; sh shifts;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into sh from shifts where staff_id = auth.uid() and clock_out is null;
  if sh is null then raise exception 'not_clocked_in'; end if;
  select * into t from tickets
   where status = 'waiting' and (pref_staff is null or pref_staff = auth.uid())
     and (p_ticket is null or id = p_ticket)
   order by created_at for update skip locked limit 1;
  if t is null then return null; end if;
  update tickets set status = 'called', assigned_staff = auth.uid(), seat = sh.seat, called_at = now() where id = t.id returning * into t;
  insert into ticket_events (ticket_id, event, actor) values (t.id, 'called', auth.uid());
  return t;
end $$;

create or replace function advance_ticket(p_ticket uuid, p_action text) returns tickets language plpgsql security definer set search_path = public as $$
declare t tickets; g_minutes constant integer := 35;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into t from tickets where id = p_ticket and (assigned_staff = auth.uid() or is_manager()) for update;
  if t is null then raise exception 'not_found'; end if;
  if p_action = 'start' and t.status = 'called' then
    update tickets set status = 'in_service', started_at = now() where id = t.id returning * into t;
  elsif p_action = 'finish' and t.status = 'in_service' then
    -- garantie : prestation express, mesurée du début à la fin de la prestation (hors attente)
    update tickets set status = 'checkout', finished_at = now(),
      guarantee_free = (service_id = 'express' and now() - started_at > make_interval(mins => g_minutes))
      where id = t.id returning * into t;
  elsif p_action = 'noshow' and t.status = 'called' then
    update tickets set status = 'noshow', closed_at = now() where id = t.id returning * into t;
  elsif p_action = 'requeue' and t.status = 'called' then
    update tickets set status = 'waiting', assigned_staff = null, seat = null, called_at = null where id = t.id returning * into t;
  else
    raise exception 'invalid_transition';
  end if;
  insert into ticket_events (ticket_id, event, actor) values (t.id, p_action, auth.uid());
  return t;
end $$;

-- Montant dû recalculé par le serveur (jamais celui envoyé par le navigateur)
create or replace function amount_due(p_ticket uuid) returns table (base numeric, discount numeric, addons numeric, total numeric) language sql stable security definer set search_path = public as $$
  with t as (select * from tickets where id = p_ticket), s as (select sv.* from services sv join t on t.service_id = sv.id),
  b as (select s.price_aed + case when t.extra_long then 40 else 0 end as base, t.promo_pct, t.guarantee_free from t, s),
  a as (select coalesce(sum(price_aed), 0) as addons from ticket_addons where ticket_id = p_ticket)
  select b.base, round(b.base * b.promo_pct / 100.0), a.addons,
         case when b.guarantee_free then 0 else b.base - round(b.base * b.promo_pct / 100.0) end + a.addons
  from b, a
$$;

-- Espèces : seule la coiffeuse assignée peut confirmer
create or replace function confirm_cash(p_ticket uuid) returns payments language plpgsql security definer set search_path = public as $$
declare p payments; due record; t tickets;
begin
  select * into t from tickets where id = p_ticket and assigned_staff = auth.uid() and status = 'checkout' for update;
  if t is null then raise exception 'forbidden'; end if;
  select * into due from amount_due(p_ticket);
  insert into payments (ticket_id, method, status, amount_aed, discount_aed, confirmed_at, idempotency_key)
  values (p_ticket, 'cash', 'confirmed', due.total, due.discount, now(), 'cash-' || p_ticket) returning * into p;
  update tickets set status = 'paid' where id = p_ticket;
  insert into audit_logs (actor, action, target) values (auth.uid(), 'cash_confirmed', p_ticket::text);
  return p;
end $$;

create or replace function leave_review(p_ticket uuid, p_token uuid, p_stars smallint, p_comment text) returns void language plpgsql security definer set search_path = public as $$
declare t tickets;
begin
  select * into t from tickets where id = p_ticket and access_token = p_token and status = 'paid';
  if t is null then raise exception 'forbidden'; end if;
  insert into reviews (ticket_id, staff_id, stars, comment) values (t.id, t.assigned_staff, p_stars, left(p_comment, 500));
  update tickets set status = 'done', closed_at = now() where id = t.id;
end $$;

-- ---------- Row Level Security ----------
alter table staff enable row level security;
alter table stations enable row level security;
alter table services enable row level security;
alter table addons enable row level security;
alter table promotions enable row level security;
alter table tickets enable row level security;
alter table ticket_addons enable row level security;
alter table ticket_events enable row level security;
alter table shifts enable row level security;
alter table payments enable row level security;
alter table reviews enable row level security;
alter table message_log enable row level security;
alter table audit_logs enable row level security;

-- catalogue lisible par tous, modifiable par la gérante
create policy catalogue_read_services on services for select using (active or is_manager());
create policy catalogue_read_addons on addons for select using (active or is_manager());
create policy catalogue_read_promos on promotions for select using (enabled or is_manager());
create policy catalogue_read_stations on stations for select using (true);
create policy manager_write_services on services for all using (is_manager()) with check (is_manager());
create policy manager_write_addons on addons for all using (is_manager()) with check (is_manager());
create policy manager_write_promos on promotions for all using (is_manager()) with check (is_manager());

-- personnel : chacun voit son profil, la gérante voit tout
create policy staff_self on staff for select using (id = auth.uid() or is_manager());
create policy staff_manager_write on staff for all using (is_manager()) with check (is_manager());

-- tickets : aucun accès direct anonyme (passer par my_ticket / public_queue) ; personnel en lecture
create policy tickets_staff_read on tickets for select using (is_staff());
create policy ticket_addons_staff on ticket_addons for all using (is_staff()) with check (is_staff());
create policy ticket_events_staff on ticket_events for select using (is_staff());

create policy shifts_read on shifts for select using (staff_id = auth.uid() or is_manager());
create policy payments_read on payments for select using (is_manager() or exists (select 1 from tickets t where t.id = ticket_id and t.assigned_staff = auth.uid()));
create policy reviews_read on reviews for select using (is_manager() or staff_id = auth.uid());
create policy message_log_read on message_log for select using (is_manager());
create policy audit_read on audit_logs for select using (is_manager());

-- droits d'exécution
revoke all on all functions in schema public from public;
grant execute on function join_queue(text, text, text, boolean, uuid), my_ticket(uuid, uuid), cancel_my_ticket(uuid, uuid), leave_review(uuid, uuid, smallint, text) to anon, authenticated;
grant execute on function clock_in(smallint), clock_out(), call_next(uuid), advance_ticket(uuid, text), confirm_cash(uuid), amount_due(uuid), is_staff(), is_manager() to authenticated;
grant select on public_queue to anon, authenticated;

-- temps réel : le personnel s'abonne aux tickets et aux pointages
alter publication supabase_realtime add table tickets, shifts;

-- ---------- Données initiales ----------
insert into stations (seat, label) values (1,'Seat 1'),(2,'Seat 2'),(3,'Seat 3'),(4,'Seat 4'),(5,'Seat 5');
insert into promotions (id, label_en, label_ar, pct, max_uses, enabled) values
  ('launch-first', 'Opening offer', 'عرض الافتتاح', 70, 30, false),
  ('launch', 'Opening offer', 'عرض الافتتاح', 50, null, false);
insert into promotions (id, label_en, label_ar, pct, days, from_hour, to_hour, enabled) values
  ('happy-hours', 'Happy hours', 'ساعات السعادة', 20, '{1,2,3,4,5}', 10, 15, false);
-- Les services et options se chargent avec supabase/seed.sql (généré depuis assets/data.js).
