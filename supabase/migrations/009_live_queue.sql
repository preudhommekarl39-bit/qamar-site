-- QAMAR : 009 : file d'attente réelle (phase 2). Tickets côté serveur, suivi en direct, postes PIN, caisse du jour, planning.
-- NON APPLIQUÉE. À exécuter une fois dans Supabase -> SQL Editor (projet qamar), après 001 -> 008. Rejouable sans casse :
-- if not exists / or replace / drop ... if exists ; aucune table supprimée, aucune donnée effacée.
-- Testée localement sous PGlite (tests/sql/live-queue.test.mjs), jamais contre le vrai projet.
--
-- Principes :
--   * la cliente ne lit QUE son ticket, par fonction, avec son jeton d'accès (my_ticket_live) ; jamais de lecture publique des noms ou téléphones ;
--   * les pages publiques (accueil, app, écran d'entrée) lisent un miroir anonyme de la file (queue_public : numéro, look, statut, heures,
--     aucune donnée personnelle) et la liste publique des coiffeuses (staff_public) ; ce sont les seules tables de la file publiées en temps réel ;
--   * la tablette partagée (station.html) est connectée avec un compte « poste » (rôle station) ; chaque coiffeuse la déverrouille avec son PIN
--     (bcrypt, table staff_pins illisible par tous), ce qui ouvre une session de poste liée à ce compte et à cette coiffeuse ;
--   * chaque action du personnel passe par une fonction q_* qui vérifie qui agit (session de poste ou compte connecté) et son rôle ;
--   * les fonctions 001 / 002 / 007 du personnel (clock_in, call_next, advance_ticket, confirm_cash, add_addon, remove_addon) sont retirées
--     au profit des q_* (même logique, plus la session de poste) : un seul chemin contrôlé.
-- NB : la valeur 'station' de l'enum est ajoutée ici et comparée en texte (role::text) pour que le script passe en une transaction.

create extension if not exists pgcrypto;

-- ---------- 1. Rôle « poste » et aides ----------
alter type staff_role add value if not exists 'station';

-- Compte de la tablette partagée : membre actif du personnel (lit la file), jamais coiffeuse ni gérante
create or replace function is_station() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where id = auth.uid() and active and role::text = 'station') $$;
create or replace function staff_is_manager(p_id uuid) returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where id = p_id and active and role::text in ('manager', 'owner')) $$;
create or replace function dubai_today() returns date language sql stable set search_path = public as
$$ select (now() at time zone 'Asia/Dubai')::date $$;

-- ---------- 2. Tickets : colonnes ajoutées ----------
alter table tickets add column if not exists public_ref uuid not null default gen_random_uuid();   -- clé du miroir public (pas l'id du ticket)
alter table tickets add column if not exists pings smallint not null default 0;                   -- « appeler à nouveau »
create unique index if not exists tickets_public_ref on tickets (public_ref);
create index if not exists tickets_day_idx on tickets (day, status);

-- ---------- 3. PIN des coiffeuses et sessions de poste ----------
-- Table à part (et non une colonne de staff) : staff est lisible par la gérante, un hash de PIN à 4 chiffres se casserait hors ligne.
create table if not exists staff_pins (
  staff_id uuid primary key references staff(id) on delete cascade,
  pin_hash text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);
alter table staff_pins enable row level security;
revoke all on staff_pins from public, anon, authenticated;

create table if not exists station_pin_attempts (
  id bigserial primary key,
  staff_id uuid,
  station_uid uuid,
  ok boolean not null,
  at timestamptz not null default now()
);
create index if not exists station_pin_attempts_staff on station_pin_attempts (staff_id, at desc);
create index if not exists station_pin_attempts_station on station_pin_attempts (station_uid, at desc);
alter table station_pin_attempts enable row level security;
revoke all on station_pin_attempts from public, anon, authenticated;

create table if not exists station_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,            -- sha256 du jeton remis à la tablette (le jeton lui-même n'est jamais stocké)
  staff_id uuid not null references staff(id) on delete cascade,
  station_uid uuid not null,                  -- compte connecté sur la tablette : un jeton volé ne sert à rien ailleurs
  seat smallint,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '14 hours',
  ended_at timestamptz
);
create index if not exists station_sessions_staff on station_sessions (staff_id) where ended_at is null;
alter table station_sessions enable row level security;
revoke all on station_sessions from public, anon, authenticated;

-- Qui agit : la coiffeuse de la session de poste (si p_session), sinon le compte connecté (jamais le compte « poste » lui-même)
create or replace function acting_staff(p_session uuid) returns uuid language plpgsql stable security definer set search_path = public, extensions as $$
declare v uuid;
begin
  if p_session is not null then
    select s.staff_id into v from station_sessions s join staff st on st.id = s.staff_id and st.active
     where s.token_hash = encode(digest(p_session::text, 'sha256'), 'hex') and s.station_uid = auth.uid()
       and s.ended_at is null and s.expires_at > now();
    if v is null then raise exception 'session_expired'; end if;
    return v;
  end if;
  if not is_staff() or is_station() then raise exception 'forbidden'; end if;
  return auth.uid();
end $$;

-- PIN : 4 chiffres, ni répétés (1111) ni suivis (1234, 4321). Gérante et propriétaire seulement. Journal sans le PIN ni son hash.
create or replace function admin_set_pin(p_staff uuid, p_pin text) returns text language plpgsql security definer set search_path = public, extensions as $$
declare s staff;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  select * into s from staff where id = p_staff;
  if not found or not s.active or s.role::text = 'station' then raise exception 'not_found'; end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then raise exception 'invalid_pin'; end if;
  if p_pin ~ '^(.)\1{3}$' or p_pin in ('0123', '1234', '2345', '3456', '4567', '5678', '6789', '9876', '8765', '7654', '6543', '5432', '4321', '3210') then raise exception 'weak_pin'; end if;
  insert into staff_pins (staff_id, pin_hash, updated_at, updated_by) values (p_staff, crypt(p_pin, gen_salt('bf', 8)), now(), auth.uid())
  on conflict (staff_id) do update set pin_hash = excluded.pin_hash, updated_at = now(), updated_by = auth.uid();
  -- un nouveau PIN ferme les sessions ouvertes et efface les échecs passés
  update station_sessions set ended_at = now() where staff_id = p_staff and ended_at is null;
  insert into audit_logs (actor, action, target, details) values (auth.uid(), 'set_pin:staff', p_staff::text, jsonb_build_object('pin', 'changed'));
  return 'ok';
end $$;

create or replace function admin_clear_pin(p_staff uuid) returns text language plpgsql security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  delete from staff_pins where staff_id = p_staff;
  update station_sessions set ended_at = now() where staff_id = p_staff and ended_at is null;
  insert into audit_logs (actor, action, target, details) values (auth.uid(), 'clear_pin:staff', p_staff::text, jsonb_build_object('pin', 'removed'));
  return 'ok';
end $$;

-- Qui a un PIN (sans le PIN) : pour le back-office
create or replace function admin_pin_status() returns table (staff_id uuid, has_pin boolean, updated_at timestamptz) language sql stable security definer set search_path = public as $$
  select s.id, p.staff_id is not null, p.updated_at from staff s left join staff_pins p on p.staff_id = s.id where is_manager()
$$;

-- Déverrouillage du poste. Ne lève JAMAIS d'exception sur un mauvais PIN (sinon l'échec ne serait pas compté : rollback).
-- Limites : 5 échecs pour une coiffeuse en 5 min, ou 20 échecs sur une même tablette en 15 min -> bloqué.
-- Succès : pointage (si pas déjà pointée) et session de poste de 14 h, liée à ce compte « poste ».
-- Réservé au compte « poste » (et à la gérante) : un compte de coiffeuse ne peut pas essayer le PIN d'une collègue depuis son téléphone.
-- Verrous (coiffeuse, puis tablette) pris AVANT de compter les échecs : des requêtes envoyées en parallèle ne contournent pas les limites.
create or replace function station_unlock(p_staff uuid, p_pin text, p_seat smallint default null) returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare h text; st staff; last_ok timestamptz; fails integer; sfails integer; tok uuid; sh shifts; exp timestamptz;
begin
  if not (is_station() or is_manager()) then raise exception 'forbidden'; end if;
  if p_seat is not null and not exists (select 1 from stations where seat = p_seat) then raise exception 'invalid_seat'; end if;
  perform pg_advisory_xact_lock(hashtext('qamar-pin-staff-' || coalesce(p_staff::text, '')));
  perform pg_advisory_xact_lock(hashtext('qamar-pin-station-' || auth.uid()::text));
  select max(at) into last_ok from station_pin_attempts where staff_id = p_staff and ok;
  select count(*) into fails from station_pin_attempts where staff_id = p_staff and not ok and at > greatest(now() - interval '5 minutes', coalesce(last_ok, '-infinity'));
  select count(*) into sfails from station_pin_attempts where station_uid = auth.uid() and not ok and at > now() - interval '15 minutes';
  if fails >= 5 or sfails >= 20 then return jsonb_build_object('ok', false, 'error', 'locked'); end if;
  select * into st from staff where id = p_staff and active and role::text <> 'station';
  select pin_hash into h from staff_pins where staff_id = p_staff;
  -- même travail bcrypt qu'il y ait un PIN ou non (pas d'indice par le temps de réponse)
  if st.id is null or h is null or p_pin is null or crypt(p_pin, coalesce(h, gen_salt('bf', 8))) <> h then
    insert into station_pin_attempts (staff_id, station_uid, ok) values (p_staff, auth.uid(), false);
    return jsonb_build_object('ok', false, 'error', 'pin');
  end if;
  insert into station_pin_attempts (staff_id, station_uid, ok) values (p_staff, auth.uid(), true);
  select * into sh from shifts where staff_id = p_staff and clock_out is null;
  if not found then
    insert into shifts (staff_id, seat) values (p_staff, p_seat) returning * into sh;
    insert into audit_logs (actor, action, target) values (p_staff, 'clock_in', coalesce(p_seat::text, ''));
  elsif p_seat is not null and sh.seat is distinct from p_seat then
    update shifts set seat = p_seat where id = sh.id returning * into sh;
  end if;
  tok := gen_random_uuid(); exp := now() + interval '14 hours';
  insert into station_sessions (token_hash, staff_id, station_uid, seat, expires_at)
  values (encode(digest(tok::text, 'sha256'), 'hex'), p_staff, auth.uid(), p_seat, exp);
  return jsonb_build_object('ok', true, 'session', tok, 'staff_id', p_staff, 'expires_at', exp, 'shift_in', sh.clock_in, 'seat', sh.seat);
end $$;

-- Verrouiller la tablette sans dépointer (fin de la session seulement)
create or replace function station_lock(p_session uuid) returns void language sql security definer set search_path = public, extensions as $$
  update station_sessions set ended_at = now()
   where token_hash = encode(digest(p_session::text, 'sha256'), 'hex') and station_uid = auth.uid() and ended_at is null
$$;

-- ---------- 4. Miroirs publics (aucune donnée personnelle), publiés en temps réel ----------
create table if not exists queue_public (
  ticket_ref uuid primary key,                 -- = tickets.public_ref (aléatoire), jamais l'id ni le jeton
  day date not null,
  num integer not null,
  status text not null,
  service_id text,
  extra_long boolean not null default false,
  party jsonb,                                 -- [{ serviceId, extraLong }] : looks seulement, pas de remise
  party_size smallint not null default 1,
  pref_staff uuid,
  assigned_staff uuid,
  seat smallint,
  pings smallint not null default 0,
  created_at timestamptz not null,
  called_at timestamptz,
  started_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table queue_public enable row level security;
drop policy if exists queue_public_read on queue_public;
create policy queue_public_read on queue_public for select to anon, authenticated using (day = dubai_today());
revoke all on queue_public from public, anon, authenticated;
grant select on queue_public to anon, authenticated;

create table if not exists staff_public (
  id uuid primary key references staff(id) on delete cascade,
  display_name text not null,
  specialty_en text, specialty_ar text, instagram text,
  on_shift boolean not null default false,
  shift_in timestamptz,
  seat smallint,
  updated_at timestamptz not null default now()
);
alter table staff_public enable row level security;
drop policy if exists staff_public_read on staff_public;
create policy staff_public_read on staff_public for select to anon, authenticated using (true);
revoke all on staff_public from public, anon, authenticated;
grant select on staff_public to anon, authenticated;

-- Miroir d'un ticket : présent tant qu'il occupe la file ou un fauteuil (waiting -> paid), retiré ensuite
create or replace function queue_public_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then delete from queue_public where ticket_ref = old.public_ref; return old; end if;
  if new.status::text in ('waiting', 'called', 'in_service', 'checkout', 'paid') then
    insert into queue_public (ticket_ref, day, num, status, service_id, extra_long, party, party_size, pref_staff, assigned_staff, seat, pings, created_at, called_at, started_at, updated_at)
    values (new.public_ref, new.day, new.num, new.status::text, new.service_id, new.extra_long,
            case when new.party is null then null else (select jsonb_agg(jsonb_build_object('serviceId', e.value->>'serviceId', 'extraLong', coalesce((e.value->>'extraLong')::boolean, false)) order by e.ord)
                                                         from jsonb_array_elements(new.party) with ordinality e(value, ord)) end,
            coalesce(jsonb_array_length(new.party), 1), new.pref_staff, new.assigned_staff, new.seat, new.pings, new.created_at, new.called_at, new.started_at, now())
    on conflict (ticket_ref) do update set status = excluded.status, service_id = excluded.service_id, extra_long = excluded.extra_long, party = excluded.party,
      party_size = excluded.party_size, pref_staff = excluded.pref_staff, assigned_staff = excluded.assigned_staff, seat = excluded.seat, pings = excluded.pings,
      called_at = excluded.called_at, started_at = excluded.started_at, updated_at = now();
  else
    delete from queue_public where ticket_ref = new.public_ref;
  end if;
  return new;
end $$;
drop trigger if exists tickets_queue_public on tickets;
create trigger tickets_queue_public after insert or update or delete on tickets for each row execute function queue_public_sync();

-- Une boisson ajoutée ne change pas le ticket : on touche son miroir pour réveiller les écrans abonnés
create or replace function queue_public_touch() returns trigger language plpgsql security definer set search_path = public as $$
begin
  update queue_public q set updated_at = now() from tickets t where t.id = coalesce(new.ticket_id, old.ticket_id) and q.ticket_ref = t.public_ref;
  return coalesce(new, old);
end $$;
drop trigger if exists ticket_addons_touch on ticket_addons;
create trigger ticket_addons_touch after insert or delete on ticket_addons for each row execute function queue_public_touch();

-- Liste publique des coiffeuses : actives, avec un PIN de poste (= elles prennent des clientes), jamais le compte « poste »
create or replace function staff_public_refresh(p_id uuid) returns void language plpgsql security definer set search_path = public as $$
declare s staff; sh shifts;
begin
  select * into s from staff where id = p_id;
  if s.id is null or not s.active or s.role::text = 'station' or not exists (select 1 from staff_pins where staff_id = p_id) then
    delete from staff_public where id = p_id; return;
  end if;
  select * into sh from shifts where staff_id = p_id and clock_out is null order by clock_in desc limit 1;
  insert into staff_public (id, display_name, specialty_en, specialty_ar, instagram, on_shift, shift_in, seat, updated_at)
  values (s.id, s.display_name, s.specialty_en, s.specialty_ar, s.instagram, sh.id is not null, sh.clock_in, sh.seat, now())
  on conflict (id) do update set display_name = excluded.display_name, specialty_en = excluded.specialty_en, specialty_ar = excluded.specialty_ar,
    instagram = excluded.instagram, on_shift = excluded.on_shift, shift_in = excluded.shift_in, seat = excluded.seat, updated_at = now();
end $$;
create or replace function staff_public_sync() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'staff' then
    if tg_op = 'DELETE' then delete from staff_public where id = old.id; return old; end if;
    perform staff_public_refresh(new.id); return new;
  end if;
  perform staff_public_refresh(case when tg_op = 'DELETE' then old.staff_id else new.staff_id end);
  return coalesce(new, old);
end $$;
drop trigger if exists staff_public_staff on staff;
create trigger staff_public_staff after insert or update or delete on staff for each row execute function staff_public_sync();
drop trigger if exists staff_public_pins on staff_pins;
create trigger staff_public_pins after insert or update or delete on staff_pins for each row execute function staff_public_sync();
drop trigger if exists staff_public_shifts on shifts;
create trigger staff_public_shifts after insert or update or delete on shifts for each row execute function staff_public_sync();

-- Remplissage initial (migration rejouée ou appliquée sur une base qui a déjà des tickets)
insert into queue_public (ticket_ref, day, num, status, service_id, extra_long, party_size, pref_staff, assigned_staff, seat, pings, created_at, called_at, started_at)
  select public_ref, day, num, status::text, service_id, extra_long, coalesce(jsonb_array_length(party), 1), pref_staff, assigned_staff, seat, pings, created_at, called_at, started_at
    from tickets where status::text in ('waiting', 'called', 'in_service', 'checkout', 'paid')
  on conflict (ticket_ref) do nothing;
select staff_public_refresh(id) from staff;

-- État de la file en chiffres, pour les pages simples (accueil, app, écran d'entrée). Aucune donnée personnelle.
-- L'attente détaillée par cliente est calculée dans la page avec le même planning que la démo (assets/store.js -> schedule).
create or replace view public_queue_status with (security_invoker = false) as
  select (select count(*) from queue_public where day = dubai_today() and status = 'waiting')::integer as waiting_tickets,
         (select coalesce(sum(party_size), 0) from queue_public where day = dubai_today() and status = 'waiting')::integer as waiting_people,
         (select count(*) from queue_public where day = dubai_today() and status in ('called', 'in_service'))::integer as in_chair,
         (select count(*) from staff_public where on_shift)::integer as stylists_on_shift,
         (select count(*) from staff_public sp where sp.on_shift and not exists (select 1 from queue_public q where q.day = dubai_today() and q.assigned_staff = sp.id and q.status in ('called', 'in_service', 'checkout', 'paid')))::integer as chairs_free,
         case when (select count(*) from staff_public where on_shift) = 0 then null
              else ceil((select coalesce(sum(party_size), 0) from queue_public where day = dubai_today() and status = 'waiting')::numeric
                        / (select count(*) from staff_public where on_shift)) * 35 end::integer as rough_wait_minutes,
         now() as at;
revoke all on public_queue_status from public, anon, authenticated;
grant select on public_queue_status to anon, authenticated;

-- Offre de lancement (compteur public des places à -70 %), lue par l'accueil et l'écran d'entrée
create or replace view public_offer with (security_invoker = false) as
  -- même compte que promo_uses (005), écrit ici : une vue exécute ses fonctions avec les droits de l'appelant (anon)
  select p.id, p.pct, p.max_uses, p.enabled,
         case when p.max_uses is null then null else (
           select coalesce(sum(case when t.party is null then 1 else (select count(*) from jsonb_array_elements(t.party) e where e.value->>'promoId' = p.id) end), 0)::integer
             from tickets t where t.status not in ('cancelled', 'noshow') and (p.starts_at is null or t.created_at >= p.starts_at)
              and ((t.party is null and t.promo_id = p.id) or t.party is not null)) end as used
    from promotions p where p.id in ('launch-first', 'launch', 'happy-hours', 'squad');
revoke all on public_offer from public, anon, authenticated;
grant select on public_offer to anon, authenticated;

-- Tables de la file : aucun droit direct pour anon (la RLS ne renvoyait déjà rien ; maintenant la lecture est refusée net)
revoke all on tickets, ticket_addons, ticket_events, shifts, payments, reviews, message_log from anon;

-- La vue 001 public_queue montrait prénom + initiale à tout le monde : réservée au personnel
revoke all on public_queue from anon;

-- Temps réel : seuls les miroirs sans données personnelles sont publiés (tickets et shifts sont retirés, 001)
do $$
begin
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'tickets') then alter publication supabase_realtime drop table tickets; end if;
  if exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'shifts') then alter publication supabase_realtime drop table shifts; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'queue_public') then alter publication supabase_realtime add table queue_public; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'staff_public') then alter publication supabase_realtime add table staff_public; end if;
end $$;

-- ---------- 5. Garde-fous à l'inscription (en plus de join_queue 005 : 3 par numéro et par jour) ----------
-- File pleine (60 tickets en attente) ou rafale (20 inscriptions en 2 minutes) : refus. Coiffeuse demandée inconnue : « la première libre ».
create or replace function tickets_join_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from tickets where status = 'waiting' and day = dubai_today()) >= 60 then raise exception 'queue_full'; end if;
  if (select count(*) from tickets where created_at > now() - interval '2 minutes') >= 20 then raise exception 'try_later'; end if;
  if new.pref_staff is not null and not exists (select 1 from staff_public where id = new.pref_staff) then new.pref_staff := null; end if;
  return new;
end $$;
drop trigger if exists tickets_join_guard on tickets;
create trigger tickets_join_guard before insert on tickets for each row execute function tickets_join_guard();

-- ---------- 6. Montant dû : calcul interne partagé (005), lu par la cliente via son jeton et par le personnel ----------
create or replace function ticket_amount(p_ticket uuid) returns table (base numeric, discount numeric, addons numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  t tickets; v_base numeric := 0; v_disc numeric := 0; v_add numeric := 0; v_free integer := 0;
  extra_long_aed constant numeric := 40;   -- = data.js -> extraLong.price
begin
  select * into t from tickets where id = p_ticket;
  if not found then return; end if;
  if t.party is null then
    select sv.price_aed + case when t.extra_long then extra_long_aed else 0 end, case when sv.free_matcha then 1 else 0 end
      into v_base, v_free from services sv where sv.id = t.service_id;
    v_base := coalesce(v_base, 0); v_free := coalesce(v_free, 0);
    v_disc := round(v_base * t.promo_pct / 100.0);
  else
    select coalesce(sum(l.b), 0), coalesce(sum(round(l.b * l.pct / 100.0)), 0), coalesce(sum(l.fm), 0)
      into v_base, v_disc, v_free
      from (select coalesce(sv.price_aed, 0) + case when coalesce((e.value->>'extraLong')::boolean, false) then extra_long_aed else 0 end as b,
                   coalesce((e.value->>'pct')::numeric, case when e.ord = 1 then t.promo_pct else 0 end) as pct,
                   case when sv.free_matcha then 1 else 0 end as fm
              from jsonb_array_elements(t.party) with ordinality as e(value, ord)
              left join services sv on sv.id = e.value->>'serviceId') l;
  end if;
  select coalesce(sum(case when a.is_matcha and a.rn <= v_free then 0 else a.price_aed end), 0) into v_add
    from (select ta.price_aed, coalesce(ad.kind = 'matcha', false) as is_matcha,
                 row_number() over (partition by coalesce(ad.kind = 'matcha', false) order by ta.id) as rn
            from ticket_addons ta left join addons ad on ad.id = ta.addon_id
           where ta.ticket_id = p_ticket) a;
  return query select v_base, v_disc, v_add,
    case when t.guarantee_free and t.party is null then 0 else v_base - v_disc end + v_add;
end $$;

create or replace function amount_due(p_ticket uuid) returns table (base numeric, discount numeric, addons numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
begin
  if not (is_staff() or (select auth.role()) = 'service_role') then return; end if;
  return query select * from ticket_amount(p_ticket);
end $$;

-- ---------- 7. Cliente : son ticket, par son jeton (lien ?t=<id>.<jeton>, ouvrable sur tout appareil) ----------
-- Jamais le téléphone complet (4 derniers chiffres) : un lien de ticket transféré ne révèle pas le numéro.
create or replace function ticket_json(t tickets, p_full boolean) returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', t.id, 'public_ref', t.public_ref, 'day', t.day, 'num', t.num, 'name', t.client_name,
    'phone', case when p_full then t.client_phone else case when t.client_phone is null then null else '+...' || right(t.client_phone, 4) end end,
    'service_id', t.service_id, 'extra_long', t.extra_long, 'party', t.party, 'pref_staff', t.pref_staff, 'assigned_staff', t.assigned_staff,
    'seat', t.seat, 'promo_id', t.promo_id, 'promo_pct', t.promo_pct, 'promo_code', t.promo_code, 'status', t.status, 'channel', t.channel,
    'perfume', t.perfume, 'hijab', t.hijab, 'guarantee_free', t.guarantee_free, 'pings', t.pings,
    'created_at', t.created_at, 'called_at', t.called_at, 'started_at', t.started_at, 'finished_at', t.finished_at, 'closed_at', t.closed_at,
    'addons', coalesce((select jsonb_agg(ta.addon_id order by ta.id) from ticket_addons ta where ta.ticket_id = t.id), '[]'::jsonb),
    'amount', (select to_jsonb(a) from ticket_amount(t.id) a),
    'payment', (select jsonb_build_object('method', p.method, 'total', p.amount_aed, 'discount', p.discount_aed, 'tip', p.tip_aed, 'paid_at', p.confirmed_at)
                  from payments p where p.ticket_id = t.id and p.status = 'confirmed' limit 1),
    'rating', (select r.stars from reviews r where r.ticket_id = t.id),
    'staff_name', (select display_name from staff where id = t.assigned_staff))
$$;

create or replace function my_ticket_live(p_ticket uuid, p_token uuid) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t tickets;
begin
  select * into t from tickets where id = p_ticket and access_token = p_token;
  if not found then return null; end if;
  return ticket_json(t, false);
end $$;

create or replace function my_add_addon(p_ticket uuid, p_token uuid, p_addon text) returns jsonb language plpgsql security definer set search_path = public as $$
declare t tickets; a addons;
begin
  select * into t from tickets where id = p_ticket and access_token = p_token for update;
  if not found then raise exception 'forbidden'; end if;
  if t.status not in ('waiting', 'called', 'in_service') then raise exception 'invalid_state'; end if;
  select * into a from addons where id = p_addon and active and kind in ('matcha', 'drink');
  if a.id is null then raise exception 'addon_unavailable'; end if;
  if (select count(*) from ticket_addons where ticket_id = p_ticket) >= 6 then raise exception 'too_many_addons'; end if;
  insert into ticket_addons (ticket_id, addon_id, price_aed) values (p_ticket, a.id, a.price_aed);
  insert into ticket_events (ticket_id, event) values (p_ticket, 'addon_by_client:' || a.id);
  return ticket_json(t, false);
end $$;

create or replace function my_set_perfume(p_ticket uuid, p_token uuid, p_perfume text) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_perfume not in ('oud', 'rose', 'musk') then raise exception 'invalid_perfume'; end if;
  update tickets set perfume = p_perfume where id = p_ticket and access_token = p_token and status in ('waiting', 'called', 'in_service');
  if not found then raise exception 'forbidden'; end if;
end $$;

-- Note après paiement (0 = passer) : clôt le ticket. Un avis par visite payée.
create or replace function my_rate(p_ticket uuid, p_token uuid, p_stars smallint, p_comment text) returns void language plpgsql security definer set search_path = public as $$
declare t tickets;
begin
  select * into t from tickets where id = p_ticket and access_token = p_token and status = 'paid' for update;
  if not found then raise exception 'forbidden'; end if;
  if p_stars between 1 and 5 then
    insert into reviews (ticket_id, staff_id, stars, comment) values (t.id, t.assigned_staff, p_stars, nullif(left(regexp_replace(coalesce(p_comment, ''), '[<>[:cntrl:]]', '', 'g'), 500), ''))
    on conflict (ticket_id) do nothing;
  end if;
  update tickets set status = 'done', closed_at = now() where id = t.id;
end $$;

-- ---------- 8. Personnel : actions sur la file (session de poste ou compte connecté) ----------
create or replace function q_clock_in(p_seat smallint default null, p_session uuid default null) returns shifts language plpgsql security definer set search_path = public as $$
declare me uuid := acting_staff(p_session); sh shifts;
begin
  select * into sh from shifts where staff_id = me and clock_out is null;
  if found then return sh; end if;
  insert into shifts (staff_id, seat) values (me, p_seat) returning * into sh;
  insert into audit_logs (actor, action, target) values (me, 'clock_in', coalesce(p_seat::text, ''));
  return sh;
end $$;

create or replace function q_clock_out(p_session uuid default null) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := acting_staff(p_session);
begin
  if exists (select 1 from tickets where assigned_staff = me and status in ('called', 'in_service', 'checkout', 'paid')) then raise exception 'client_in_progress'; end if;
  update shifts set clock_out = now(), closed_by = 'staff' where staff_id = me and clock_out is null;
  update station_sessions set ended_at = now() where staff_id = me and ended_at is null;
  insert into audit_logs (actor, action) values (me, 'clock_out');
end $$;

-- Appel : coiffeuse pointée, sans cliente en cours ; cliente en attente qui ne demande personne ou elle (SKIP LOCKED : jamais deux postes)
-- Tickets du jour seulement : un ticket oublié d'hier (q_close_stale non lancée) n'est jamais appelé.
create or replace function q_call(p_ticket uuid default null, p_session uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := acting_staff(p_session); t tickets; sh shifts;
begin
  perform pg_advisory_xact_lock(hashtext('qamar-call-' || me::text));   -- double appui : jamais deux clientes pour la même coiffeuse
  select * into sh from shifts where staff_id = me and clock_out is null;
  if sh.id is null then raise exception 'not_clocked_in'; end if;
  if exists (select 1 from tickets where assigned_staff = me and status in ('called', 'in_service', 'checkout', 'paid')) then raise exception 'busy'; end if;
  select * into t from tickets
   where status = 'waiting' and day = dubai_today() and (pref_staff is null or pref_staff = me) and (p_ticket is null or id = p_ticket)
   order by created_at for update skip locked limit 1;
  if t.id is null then return null; end if;
  update tickets set status = 'called', assigned_staff = me, seat = sh.seat, called_at = now() where id = t.id returning * into t;
  insert into ticket_events (ticket_id, event, actor) values (t.id, 'called', me);
  return ticket_json(t, true);
end $$;

-- Étapes d'un ticket. La coiffeuse n'agit que sur SES tickets ; « remove » (retirer de la file) et les tickets des autres : gérante.
create or replace function q_advance(p_ticket uuid, p_action text, p_session uuid default null) returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := acting_staff(p_session); mgr boolean := staff_is_manager(me); t tickets; g_minutes constant integer := 35;
begin
  select * into t from tickets where id = p_ticket for update;
  if t.id is null then raise exception 'not_found'; end if;
  if p_action = 'remove' then
    if not mgr then raise exception 'forbidden'; end if;
    if t.status not in ('waiting', 'called') then raise exception 'invalid_transition'; end if;
    update tickets set status = 'cancelled', closed_at = now() where id = t.id returning * into t;
  else
    if t.assigned_staff is distinct from me and not mgr then raise exception 'forbidden'; end if;
    if p_action = 'start' and t.status = 'called' then
      update tickets set status = 'in_service', started_at = now() where id = t.id returning * into t;
    elsif p_action = 'finish' and t.status = 'in_service' then
      update tickets set status = 'checkout', finished_at = now(),
        guarantee_free = (service_id = 'express' and party is null and now() - started_at > make_interval(mins => g_minutes))
        where id = t.id returning * into t;
    elsif p_action = 'noshow' and t.status = 'called' then
      update tickets set status = 'noshow', closed_at = now() where id = t.id returning * into t;
    elsif p_action = 'requeue' and t.status = 'called' then
      update tickets set status = 'waiting', assigned_staff = null, seat = null, called_at = null where id = t.id returning * into t;
    elsif p_action = 'renotify' and t.status = 'called' then
      update tickets set pings = least(pings + 1, 20) where id = t.id returning * into t;
    elsif p_action = 'toggle_long' and t.status in ('called', 'in_service') then
      update tickets set extra_long = not extra_long,
        party = case when party is null then null else jsonb_set(party, '{0,extraLong}', to_jsonb(not extra_long)) end
        where id = t.id returning * into t;
    else
      raise exception 'invalid_transition';
    end if;
  end if;
  insert into ticket_events (ticket_id, event, actor) values (t.id, p_action, me);
  return ticket_json(t, true);
end $$;

create or replace function q_set_details(p_ticket uuid, p_perfume text default null, p_hijab boolean default null, p_session uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := acting_staff(p_session);
begin
  if p_perfume is not null and p_perfume not in ('oud', 'rose', 'musk') then raise exception 'invalid_perfume'; end if;
  update tickets set perfume = coalesce(p_perfume, perfume), hijab = coalesce(p_hijab, hijab)
   where id = p_ticket and (assigned_staff = me or staff_is_manager(me)) and status in ('called', 'in_service', 'checkout');
  if not found then raise exception 'forbidden'; end if;
end $$;

-- Boissons (comme 007 add_addon : kind matcha / drink, 6 maximum, prix du catalogue)
create or replace function q_add_addon(p_ticket uuid, p_addon text, p_session uuid default null) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := acting_staff(p_session); t tickets; a addons;
begin
  select * into t from tickets where id = p_ticket and (assigned_staff = me or staff_is_manager(me)) for update;
  if t.id is null then raise exception 'forbidden'; end if;
  if t.status not in ('waiting', 'called', 'in_service') then raise exception 'invalid_state'; end if;
  select * into a from addons where id = p_addon and active and kind in ('matcha', 'drink');
  if a.id is null then raise exception 'addon_unavailable'; end if;
  if (select count(*) from ticket_addons where ticket_id = p_ticket) >= 6 then raise exception 'too_many_addons'; end if;
  insert into ticket_addons (ticket_id, addon_id, price_aed) values (p_ticket, a.id, a.price_aed);
  insert into ticket_events (ticket_id, event, actor) values (p_ticket, 'addon:' || a.id, me);
end $$;

create or replace function q_remove_addon(p_ticket uuid, p_addon text, p_session uuid default null) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := acting_staff(p_session); t tickets;
begin
  select * into t from tickets where id = p_ticket and (assigned_staff = me or staff_is_manager(me)) for update;
  if t.id is null or t.status::text in ('paid', 'done', 'cancelled', 'noshow') then raise exception 'invalid_state'; end if;
  delete from ticket_addons where id = (select max(id) from ticket_addons where ticket_id = p_ticket and addon_id = p_addon);
  insert into ticket_events (ticket_id, event, actor) values (p_ticket, 'addon_removed:' || p_addon, me);
end $$;

-- Paiement encaissé AU SALON : espèces, ou carte / Apple Pay validés sur le terminal de paiement du salon (la coiffeuse le confirme).
-- Montant recalculé par le serveur ; pourboire : 0 en espèces (donné en main propre), sinon plafonné (500 AED et le montant, 002).
-- Les paiements en ligne restent réservés au webhook du prestataire (functions/payment-webhook), non branché.
create or replace function q_record_payment(p_ticket uuid, p_method text, p_tip numeric default 0, p_session uuid default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid := acting_staff(p_session); t tickets; due record; v_tip numeric; p payments;
begin
  if p_method not in ('cash', 'card', 'applepay') then raise exception 'invalid_method'; end if;
  select * into t from tickets where id = p_ticket and (assigned_staff = me or staff_is_manager(me)) and status = 'checkout' for update;
  if t.id is null then raise exception 'forbidden'; end if;
  select * into due from ticket_amount(p_ticket);
  v_tip := case when p_method = 'cash' then 0 else greatest(0, least(round(coalesce(p_tip, 0)), 500, greatest(due.total, 0))) end;
  insert into payments (ticket_id, method, status, amount_aed, discount_aed, tip_aed, provider, confirmed_at, idempotency_key)
  values (p_ticket, p_method::pay_method, 'confirmed', due.total, due.discount, v_tip, case when p_method = 'cash' then 'cash' else 'salon-terminal' end, now(), 'salon-' || p_ticket)
  returning * into p;
  update tickets set status = 'paid' where id = p_ticket;
  insert into ticket_events (ticket_id, event, actor) values (p_ticket, 'paid:' || p_method, me);
  insert into audit_logs (actor, action, target, details) values (me, 'payment:' || p_method, p_ticket::text, jsonb_build_object('total', due.total, 'tip', v_tip));
  return jsonb_build_object('method', p.method, 'total', p.amount_aed, 'discount', p.discount_aed, 'tip', p.tip_aed, 'paid_at', p.confirmed_at);
end $$;

-- Note sur l'écran du poste (tournée vers la cliente), 0 = passer
create or replace function q_rate(p_ticket uuid, p_stars smallint, p_comment text, p_session uuid default null) returns void language plpgsql security definer set search_path = public as $$
declare me uuid := acting_staff(p_session); t tickets;
begin
  select * into t from tickets where id = p_ticket and (assigned_staff = me or staff_is_manager(me)) and status = 'paid' for update;
  if t.id is null then raise exception 'forbidden'; end if;
  if p_stars between 1 and 5 then
    insert into reviews (ticket_id, staff_id, stars, comment) values (t.id, t.assigned_staff, p_stars, nullif(left(regexp_replace(coalesce(p_comment, ''), '[<>[:cntrl:]]', '', 'g'), 500), ''))
    on conflict (ticket_id) do nothing;
  end if;
  update tickets set status = 'done', closed_at = now() where id = t.id;
end $$;

-- Tableau du salon pour les écrans du personnel : la journée de Dubaï (tickets, boissons, notes, pointages).
-- Montants et pourboires : tous pour la gérante ; sinon seulement ceux de la coiffeuse qui agit (session de poste).
create or replace function q_board(p_session uuid default null) returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid; mgr boolean; d date := dubai_today();
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  me := case when p_session is null then (case when is_station() then null else auth.uid() end) else acting_staff(p_session) end;
  mgr := me is not null and staff_is_manager(me);
  return jsonb_build_object(
    'tickets', coalesce((select jsonb_agg(ticket_json(t, true) - case when mgr or t.assigned_staff = me then '' else 'amount' end
                         || case when mgr or t.assigned_staff = me then '{}'::jsonb else jsonb_build_object('payment',
                              (select jsonb_build_object('method', p.method, 'paid_at', p.confirmed_at) from payments p where p.ticket_id = t.id and p.status = 'confirmed' limit 1)) end
                         order by t.created_at)
                         from tickets t where t.day = d or t.status in ('waiting', 'called', 'in_service', 'checkout', 'paid')), '[]'::jsonb),
    'shifts', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'staff_id', s.staff_id, 'seat', s.seat, 'in', s.clock_in, 'out', s.clock_out) order by s.clock_in)
                        from shifts s where (s.clock_out is null or s.clock_in >= (d::timestamp at time zone 'Asia/Dubai')) and (mgr or s.staff_id = me or s.clock_out is null)), '[]'::jsonb),
    'me', me, 'manager', mgr, 'at', now());
end $$;

-- Tickets oubliés d'un jour précédent (encore « en attente » ou « appelée ») : annulés. À lancer chaque nuit (pg_cron) ou par la gérante.
create or replace function q_close_stale() returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  -- Connexion directe à la base (SQL Editor, pg_cron) : session_user postgres et aucun jeton JWT. Jamais current_user, qui vaut
  -- toujours le propriétaire dans une fonction security definer (la condition laissait passer tout compte connecté).
  if not (is_manager() or (select auth.role()) = 'service_role'
          or (session_user = 'postgres' and coalesce(nullif(current_setting('request.jwt.claims', true), ''), nullif(current_setting('request.jwt.claim.role', true), '')) is null)) then raise exception 'forbidden'; end if;
  with c as (update tickets set status = 'cancelled', closed_at = now() where day < dubai_today() and status in ('waiting', 'called') returning 1) select count(*) into n from c;
  return n;
end $$;

-- ---------- 9. Caisse du jour (saisie par la gérante) ----------
create table if not exists cash_closings (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  cash_aed numeric(10,2) not null default 0 check (cash_aed >= 0 and cash_aed <= 1000000),
  card_aed numeric(10,2) not null default 0 check (card_aed >= 0 and card_aed <= 1000000),
  other_aed numeric(10,2) not null default 0 check (other_aed >= 0 and other_aed <= 1000000),
  expected jsonb,                               -- totaux du système au moment de la clôture, par moyen de paiement
  note text check (char_length(note) <= 500),
  closed_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table cash_closings enable row level security;
drop policy if exists cash_closings_read on cash_closings;
create policy cash_closings_read on cash_closings for select to authenticated using (is_manager());
revoke all on cash_closings from public, anon, authenticated;
grant select on cash_closings to authenticated;
drop trigger if exists cash_closings_touch on cash_closings;
create trigger cash_closings_touch before update on cash_closings for each row execute function touch_updated_at();
drop trigger if exists cash_closings_audit on cash_closings;
create trigger cash_closings_audit after insert or update or delete on cash_closings for each row execute function audit_row();

-- Totaux du système pour une journée de Dubaï : nombre, montant et pourboires par moyen de paiement
create or replace function cash_day_totals(p_day date) returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_object_agg(m, jsonb_build_object('count', n, 'total', tot, 'tips', tips)) from (
    select p.method::text m, count(*) n, sum(p.amount_aed) tot, sum(p.tip_aed) tips from payments p
     where p.status = 'confirmed' and (p.confirmed_at at time zone 'Asia/Dubai')::date = p_day group by p.method) x), '{}'::jsonb);
end $$;

create or replace function admin_close_cash(p_day date, p_cash numeric, p_card numeric, p_other numeric, p_note text) returns cash_closings
language plpgsql security definer set search_path = public as $$
declare r cash_closings;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if p_day is null or p_day > dubai_today() or p_day < dubai_today() - 60 then raise exception 'invalid_day'; end if;
  insert into cash_closings (day, cash_aed, card_aed, other_aed, expected, note, closed_by)
  values (p_day, coalesce(p_cash, 0), coalesce(p_card, 0), coalesce(p_other, 0), cash_day_totals(p_day),
          nullif(left(regexp_replace(trim(coalesce(p_note, '')), '[<>[:cntrl:]]', '', 'g'), 500), ''), auth.uid())
  on conflict (day) do update set cash_aed = excluded.cash_aed, card_aed = excluded.card_aed, other_aed = excluded.other_aed,
    expected = excluded.expected, note = excluded.note, closed_by = auth.uid()
  returning * into r;
  return r;
end $$;

-- ---------- 10. Planning simple de l'équipe ----------
create table if not exists staff_schedule (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff(id) on delete cascade,
  day date not null,
  start_time time not null,
  end_time time not null,
  note text check (char_length(note) <= 120),
  created_by uuid references staff(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_schedule_times check (end_time > start_time)
);
create unique index if not exists staff_schedule_unique on staff_schedule (staff_id, day, start_time);
create index if not exists staff_schedule_day on staff_schedule (day);
alter table staff_schedule enable row level security;
drop policy if exists staff_schedule_read on staff_schedule;
drop policy if exists staff_schedule_write on staff_schedule;
create policy staff_schedule_read on staff_schedule for select to authenticated using (is_staff());
create policy staff_schedule_write on staff_schedule for all to authenticated using (is_manager()) with check (is_manager());
revoke all on staff_schedule from public, anon, authenticated;
grant select, insert, update, delete on staff_schedule to authenticated;
drop trigger if exists staff_schedule_touch on staff_schedule;
create trigger staff_schedule_touch before update on staff_schedule for each row execute function touch_updated_at();
drop trigger if exists staff_schedule_audit on staff_schedule;
create trigger staff_schedule_audit after insert or update or delete on staff_schedule for each row execute function audit_row();

-- ---------- 11. Droits d'exécution ----------
-- Supabase accorde EXECUTE à anon et authenticated sur chaque nouvelle fonction : on retire tout, puis on accorde au cas par cas.
revoke all on function is_station(), staff_is_manager(uuid), dubai_today(), acting_staff(uuid), admin_set_pin(uuid, text), admin_clear_pin(uuid), admin_pin_status(),
  station_unlock(uuid, text, smallint), station_lock(uuid), queue_public_sync(), queue_public_touch(), staff_public_refresh(uuid), staff_public_sync(),
  tickets_join_guard(), ticket_amount(uuid), ticket_json(tickets, boolean), my_ticket_live(uuid, uuid), my_add_addon(uuid, uuid, text), my_set_perfume(uuid, uuid, text),
  my_rate(uuid, uuid, smallint, text), q_clock_in(smallint, uuid), q_clock_out(uuid), q_call(uuid, uuid), q_advance(uuid, text, uuid),
  q_set_details(uuid, text, boolean, uuid), q_add_addon(uuid, text, uuid), q_remove_addon(uuid, text, uuid), q_record_payment(uuid, text, numeric, uuid),
  q_rate(uuid, smallint, text, uuid), q_board(uuid), q_close_stale(), cash_day_totals(date), admin_close_cash(date, numeric, numeric, numeric, text)
  from public, anon, authenticated;
-- Fonctions du personnel 001 / 002 / 007 remplacées par les q_* (elles ignoraient la session de poste)
revoke all on function clock_in(smallint), clock_out(), call_next(uuid), advance_ticket(uuid, text), confirm_cash(uuid), add_addon(uuid, text), remove_addon(uuid, bigint)
  from public, anon, authenticated;
-- Cliente (clé anon) : son ticket par jeton
-- dubai_today() sert dans la politique RLS de queue_public : elle doit rester exécutable par anon
grant execute on function dubai_today() to anon, authenticated;
grant execute on function my_ticket_live(uuid, uuid), my_add_addon(uuid, uuid, text), my_set_perfume(uuid, uuid, text), my_rate(uuid, uuid, smallint, text) to anon, authenticated;
-- Personnel connecté (chaque fonction vérifie le rôle et la session)
grant execute on function is_station(), dubai_today(), station_unlock(uuid, text, smallint), station_lock(uuid), q_clock_in(smallint, uuid), q_clock_out(uuid),
  q_call(uuid, uuid), q_advance(uuid, text, uuid), q_set_details(uuid, text, boolean, uuid), q_add_addon(uuid, text, uuid), q_remove_addon(uuid, text, uuid),
  q_record_payment(uuid, text, numeric, uuid), q_rate(uuid, smallint, text, uuid), q_board(uuid), q_close_stale(),
  admin_set_pin(uuid, text), admin_clear_pin(uuid), admin_pin_status(), cash_day_totals(date), admin_close_cash(date, numeric, numeric, numeric, text) to authenticated;
grant execute on function ticket_amount(uuid), q_close_stale() to service_role;
