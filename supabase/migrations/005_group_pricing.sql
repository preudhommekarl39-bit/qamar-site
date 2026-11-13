-- QAMAR — 005 : prix des visites de groupe et codes promo côté serveur (miroir exact de assets/store.js)
-- ⚠ Non exécuté : aucun projet Supabase n'est déployé. À appliquer après 001 → 004 (`supabase db push`), puis tester
--   en préproduction (voir supabase/README.md → « Avant l'ouverture »).
--
-- Règles reproduites (store.js → checkPromoCode / bestPromo / quote / groupQuote / pricing) :
--   • une seule remise par personne, la plus forte : code promo, lancement (−70 % pour les N premières PERSONNES,
--     puis −50 %), happy hours (lun–ven 10 h–15 h, heure de Dubaï), Squad (−25 % dès 4 personnes) ; jamais cumulées ;
--     à égalité de pourcentage : code > lancement > happy hours > Squad (ordre des candidats dans store.js) ;
--   • la k-ième personne d'un groupe compte les k−1 places « −70 % » prises avant elle dans ce même groupe ;
--   • base = prix de la prestation + 40 AED si cheveux très longs ; remise = round(base × pct / 100) ;
--   • une boisson matcha offerte par personne dont la prestation inclut le matcha (Night Glow) ;
--   • garantie 35 min : visites individuelles seulement.

-- 1. Catalogue des remises -------------------------------------------------------------------------------
alter table promotions add column if not exists min_people smallint not null default 1 check (min_people between 1 and 6);
insert into promotions (id, label_en, label_ar, pct, min_people, enabled) values
  ('squad', 'Squad', 'سكواد', 25, 4, false),
  -- ligne technique : sert de référence (tickets.promo_id) quand la remise retenue vient d'un code ; jamais choisie seule
  ('code', 'Promo code', 'كود خصم', 0, 1, false)
on conflict (id) do nothing;

-- Codes promo (miroir de data.js → promoCodes). Aucun accès anonyme : un code ne doit pas pouvoir être listé.
create table if not exists promo_codes (
  code text primary key check (code = upper(code) and char_length(code) between 2 and 32),
  pct smallint not null check (pct between 1 and 100),
  label_en text, label_ar text,
  valid_until date,                                   -- inclus, date de Dubaï ; null = sans limite
  min_people smallint not null default 1 check (min_people between 1 and 6),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
alter table promo_codes enable row level security;
drop policy if exists manager_all_promo_codes on promo_codes;
create policy manager_all_promo_codes on promo_codes for all using (is_manager()) with check (is_manager());
revoke all on promo_codes from anon;

-- 2. Tickets : code saisi (trace caisse). La remise par personne est dans party[i].promoId / party[i].pct
--    (calculée par le serveur, jamais reçue du navigateur) ; personne seule : promo_id / promo_pct comme avant.
alter table tickets add column if not exists promo_code text references promo_codes(code) on update cascade on delete set null;

-- 3. Places consommées par une remise : une place par PERSONNE (un groupe de 4 à −70 % en prend 4),
--    tickets annulés / absents exclus, comptées depuis promotions.starts_at (= remise à zéro du compteur).
create or replace function promo_uses(p_id text, p_since timestamptz default null) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when t.party is null then 1
                           else (select count(*) from jsonb_array_elements(t.party) e where e.value->>'promoId' = p_id) end), 0)::integer
  from tickets t
  where t.status not in ('cancelled', 'noshow')
    and (p_since is null or t.created_at >= p_since)
    and ((t.party is null and t.promo_id = p_id) or t.party is not null)
$$;

-- 4. Meilleure remise pour UNE personne (store.js → bestPromo). p_ahead = personnes du même groupe placées avant elle.
create or replace function person_promo(p_size integer, p_ahead integer default 0, p_code text default null, p_at timestamptz default now())
returns table (promo_id text, pct smallint)
language sql stable security definer set search_path = public as $$
  with loc as (select (p_at at time zone 'Asia/Dubai') as l),
  cands as (
    select 'code'::text as id, c.pct, 0 as prio
      from promo_codes c, loc
     where p_code is not null and c.code = upper(trim(p_code)) and c.enabled and c.pct > 0
       and (c.valid_until is null or loc.l::date <= c.valid_until)
       and p_size >= c.min_people
    union all
    select p.id, p.pct,
           case when p.id in ('launch-first', 'launch') then 1 when p.id = 'happy-hours' then 2 when p.id = 'squad' then 3 else 4 end
      from promotions p, loc
     where p.enabled and p.id <> 'code' and p.pct > 0
       and (p.starts_at is null or p_at >= p.starts_at)
       and (p.ends_at is null or p_at < p.ends_at)
       and (p.days is null or extract(isodow from loc.l)::smallint = any(p.days))
       and (p.from_hour is null or extract(hour from loc.l) >= p.from_hour)
       and (p.to_hour is null or extract(hour from loc.l) < p.to_hour)
       and p_size >= p.min_people
       and (p.max_uses is null or promo_uses(p.id, p.starts_at) + coalesce(p_ahead, 0) < p.max_uses)
  )
  select cands.id, cands.pct from cands order by cands.pct desc, cands.prio limit 1
$$;

-- best_promo (001) : même règle, personne seule sans code
create or replace function best_promo() returns promotions language sql stable security definer set search_path = public as $$
  select p.* from promotions p where p.id = (select x.promo_id from person_promo(1, 0, null, now()) x)
$$;

-- 5. Inscription : groupe de 1 à 6 personnes, chacune avec son look ; code promo facultatif.
--    p_party = [{ "serviceId": "glow", "extraLong": false }, ...] ; null = personne seule (p_service / p_extra_long).
--    Un code inconnu, expiré ou sous le minimum de personnes est ignoré (comme store.js), sans erreur.
drop function if exists join_queue(text, text, text, boolean, uuid);
create or replace function join_queue(p_name text, p_phone text, p_service text, p_extra_long boolean, p_pref uuid default null,
                                      p_party jsonb default null, p_promo_code text default null)
returns table (ticket_id uuid, access_token uuid, num integer) language plpgsql security definer set search_path = public as $$
declare
  s services; n integer; t tickets; e jsonb; v_people jsonb := '[]'::jsonb; v_size integer; v_code text;
  v_pid text; v_pct smallint; i integer;
  d date := (now() at time zone 'Asia/Dubai')::date;
  hr integer := extract(hour from now() at time zone 'Asia/Dubai');
begin
  if p_party is null or jsonb_typeof(p_party) = 'null' then
    p_party := jsonb_build_array(jsonb_build_object('serviceId', p_service, 'extraLong', coalesce(p_extra_long, false)));
  end if;
  if jsonb_typeof(p_party) <> 'array' then raise exception 'invalid_party'; end if;
  v_size := jsonb_array_length(p_party);
  if v_size < 1 or v_size > 6 then raise exception 'invalid_party'; end if;
  for e in select x.value from jsonb_array_elements(p_party) x loop
    if jsonb_typeof(e) <> 'object' or jsonb_typeof(e->'serviceId') is distinct from 'string' then raise exception 'invalid_party'; end if;
    if e ? 'extraLong' and jsonb_typeof(e->'extraLong') not in ('boolean', 'null') then raise exception 'invalid_party'; end if;
    select * into s from services where id = e->>'serviceId' and active;
    if not found then raise exception 'service_unavailable'; end if;
    if s.from_hour is not null and hr < s.from_hour then raise exception 'service_unavailable'; end if;
  end loop;
  if p_phone !~ '^\+[0-9]{7,15}$' then raise exception 'invalid_phone'; end if;
  if char_length(trim(coalesce(p_name, ''))) = 0 then raise exception 'invalid_name'; end if;

  -- verrou du jour AVANT de lire les remises et le ticket actif (002) : les places −70 % ne peuvent pas être dépassées
  perform pg_advisory_xact_lock(hashtext('qamar-num-' || d::text));
  select * into t from tickets where client_phone = p_phone and status in ('waiting','called','in_service','checkout');
  if found then return query select t.id, t.access_token, t.num; return; end if;
  if (select count(*) from tickets where client_phone = p_phone and day = d) >= 3 then raise exception 'too_many_requests'; end if;

  v_code := nullif(upper(trim(coalesce(p_promo_code, ''))), '');
  if v_code is not null and not exists (
       select 1 from promo_codes c where c.code = v_code and c.enabled and c.pct > 0
          and (c.valid_until is null or d <= c.valid_until) and v_size >= c.min_people) then
    v_code := null;
  end if;

  for i in 0 .. v_size - 1 loop
    e := p_party -> i;
    v_pid := null; v_pct := null;
    select x.promo_id, x.pct into v_pid, v_pct from person_promo(v_size, i, v_code, now()) x;
    v_people := v_people || jsonb_build_array(jsonb_build_object(
      'serviceId', e->>'serviceId', 'extraLong', coalesce((e->>'extraLong')::boolean, false),
      'promoId', v_pid, 'pct', coalesce(v_pct, 0)));
  end loop;

  select coalesce(max(tickets.num), 0) + 1 into n from tickets where day = d;
  insert into tickets (num, client_name, client_phone, service_id, extra_long, pref_staff, promo_id, promo_pct, party, promo_code)
  values (n, left(regexp_replace(trim(p_name), '[<>[:cntrl:]]', '', 'g'), 40), p_phone,
          v_people->0->>'serviceId', (v_people->0->>'extraLong')::boolean, p_pref,
          v_people->0->>'promoId', (v_people->0->>'pct')::smallint,
          case when v_size > 1 then v_people end, v_code)
  returning * into t;
  insert into ticket_events (ticket_id, event) values (t.id, case when v_size > 1 then 'joined:party:' || v_size else 'joined' end);
  return query select t.id, t.access_token, t.num;
end $$;

-- 6. Montant dû par personne (store.js → pricing). Réservé au personnel et au webhook (service_role), comme 002.
create or replace function amount_due(p_ticket uuid) returns table (base numeric, discount numeric, addons numeric, total numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  t tickets; v_base numeric := 0; v_disc numeric := 0; v_add numeric := 0; v_free integer := 0;
  extra_long_aed constant numeric := 40;   -- = data.js → extraLong.price
begin
  if not (is_staff() or (select auth.role()) = 'service_role') then return; end if;
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

  -- boissons : une matcha offerte par personne « free matcha », dans l'ordre d'ajout
  select coalesce(sum(case when a.is_matcha and a.rn <= v_free then 0 else a.price_aed end), 0) into v_add
    from (select ta.price_aed, coalesce(ad.kind = 'matcha', false) as is_matcha,
                 row_number() over (partition by coalesce(ad.kind = 'matcha', false) order by ta.id) as rn
            from ticket_addons ta left join addons ad on ad.id = ta.addon_id
           where ta.ticket_id = p_ticket) a;

  return query select v_base, v_disc, v_add,
    case when t.guarantee_free and t.party is null then 0 else v_base - v_disc end + v_add;
end $$;

-- 7. Droits : seules les RPC publiques sont exposées ; les fonctions internes ne le sont à personne
--    (sinon un anonyme pourrait tester des codes promo via person_promo).
revoke all on function promo_uses(text, timestamptz), person_promo(integer, integer, text, timestamptz), best_promo() from public, anon, authenticated;
revoke all on function join_queue(text, text, text, boolean, uuid, jsonb, text), amount_due(uuid) from public;
grant execute on function join_queue(text, text, text, boolean, uuid, jsonb, text) to anon, authenticated;
grant execute on function amount_due(uuid) to authenticated, service_role;
