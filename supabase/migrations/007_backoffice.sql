-- QAMAR : 007 : back-office (office.html). Rôles owner / manager / stylist, équipe, catalogue et prix, codes promo,
-- demandes d'événements, Club QAMAR, statut du salon, journal d'activité.
-- À exécuter UNE fois dans Supabase → SQL Editor (projet qamar), après 001 → 006. Rejouable sans casse :
-- if not exists / or replace / drop policy if exists ; aucune table supprimée, aucune donnée effacée.
-- Sécurité :
--   • RLS stricte sur chaque nouvelle table ; l'anonyme n'écrit QUE par des fonctions (request_event, request_club) qui valident tout ;
--   • rôles : owner = tout (dont l'équipe et le journal), manager = catalogue, demandes, statut, équipe en lecture, stylist = son profil ;
--   • toute modification du catalogue, de l'équipe et des demandes laisse une trace dans audit_logs (qui, quoi, avant / après) ;
--   • aucune clé secrète ici ni dans le site : les invitations passent par la fonction Edge invite-staff (voir supabase/README.md).
-- NB : la valeur 'owner' de l'enum est ajoutée ici ; elle est comparée en texte (role::text) dans les fonctions pour que le script
--      passe en une seule transaction. Passer Karl en owner se fait APRÈS, dans une requête séparée (voir supabase/README.md).

create extension if not exists pgcrypto;

-- ---------- 1. Rôles ----------
alter type staff_role add value if not exists 'owner';

alter table staff add column if not exists email text;
alter table staff add column if not exists updated_at timestamptz not null default now();
alter table staff drop constraint if exists staff_instagram_format;
alter table staff add constraint staff_instagram_format check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$') not valid;
alter table staff drop constraint if exists staff_specialty_len;
alter table staff add constraint staff_specialty_len check (char_length(coalesce(specialty_en, '')) <= 60 and char_length(coalesce(specialty_ar, '')) <= 60) not valid;

create or replace function is_owner() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where id = auth.uid() and active and role::text = 'owner') $$;
-- La propriétaire a tous les droits de la gérante (les politiques existantes qui utilisent is_manager() l'incluent)
create or replace function is_manager() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from staff where id = auth.uid() and active and role::text in ('manager', 'owner')) $$;
-- Journal : les admins historiques (blog_admins) ET la propriétaire
create or replace function is_blog_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from blog_admins where user_id = auth.uid()) or is_owner() $$;

-- ---------- 2. Aides communes : horodatage et journal d'activité ----------
create or replace function touch_updated_at() returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end $$;

-- Trace avant / après. Argument 'slim' : seulement le statut (demandes de clientes : pas de données personnelles dans le journal).
create or replace function audit_row() returns trigger language plpgsql security definer set search_path = public as $$
declare r jsonb := to_jsonb(coalesce(new, old)); b jsonb; a jsonb;
begin
  if tg_op <> 'INSERT' then b := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then a := to_jsonb(new); end if;
  if tg_nargs > 0 and tg_argv[0] = 'slim' then
    b := case when b is null then null else jsonb_build_object('status', b->'status') end;
    a := case when a is null then null else jsonb_build_object('status', a->'status') end;
  end if;
  insert into audit_logs (actor, action, target, details)
  values (auth.uid(), lower(tg_op) || ':' || tg_table_name, coalesce(r->>'id', r->>'code'), jsonb_build_object('before', b, 'after', a));
  return coalesce(new, old);
end $$;

-- ---------- 3. Équipe : écriture uniquement par fonctions (owner) ----------
-- 001 laissait la gérante tout écrire dans staff, y compris se donner un rôle : remplacé par des fonctions contrôlées.
drop policy if exists staff_manager_write on staff;
drop policy if exists staff_self on staff;
create policy staff_self on staff for select to authenticated using (id = auth.uid() or is_manager());
revoke insert, update, delete on staff from anon, authenticated;
revoke all on staff from anon;
grant select on staff to authenticated;

drop trigger if exists staff_touch on staff;
create trigger staff_touch before update on staff for each row execute function touch_updated_at();
drop trigger if exists staff_audit on staff;
create trigger staff_audit after insert or update or delete on staff for each row execute function audit_row();

create or replace function admin_update_staff(p_id uuid, p_display_name text, p_role text, p_active boolean,
                                              p_specialty_en text default null, p_specialty_ar text default null, p_instagram text default null)
returns staff language plpgsql security definer set search_path = public as $$
declare cur staff; r staff;
begin
  if not is_owner() then raise exception 'forbidden'; end if;
  if p_role not in ('owner', 'manager', 'stylist') then raise exception 'invalid_role'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) not between 1 and 40 then raise exception 'invalid_name'; end if;
  -- jamais sans propriétaire active : les lignes owner actives sont verrouillées (dans un ordre fixe, avant la ligne visée)
  -- puis comptées ; deux propriétaires qui se rétrogradent en même temps ne peuvent pas passer toutes les deux
  perform 1 from staff where role::text = 'owner' and active order by id for update;
  select * into cur from staff where id = p_id for update;
  if not found then raise exception 'not_found'; end if;
  if cur.role::text = 'owner' and cur.active and (p_role <> 'owner' or not coalesce(p_active, false))
     and not exists (select 1 from staff where role::text = 'owner' and active and id <> p_id) then raise exception 'last_owner'; end if;
  update staff set display_name = left(regexp_replace(trim(p_display_name), '[<>[:cntrl:]]', '', 'g'), 40),
         role = p_role::staff_role, active = coalesce(p_active, false),
         specialty_en = nullif(left(regexp_replace(trim(coalesce(p_specialty_en, '')), '[<>[:cntrl:]]', '', 'g'), 60), ''),
         specialty_ar = nullif(left(regexp_replace(trim(coalesce(p_specialty_ar, '')), '[<>[:cntrl:]]', '', 'g'), 60), ''),
         instagram = nullif(regexp_replace(trim(coalesce(p_instagram, '')), '^@', ''), '')
   where id = p_id returning * into r;
  return r;
end $$;

-- Rattache un compte déjà invité depuis le tableau de bord Supabase (solution de secours si invite-staff n'est pas déployée)
create or replace function admin_link_staff(p_email text, p_display_name text, p_role text) returns staff
language plpgsql security definer set search_path = public as $$
declare uid uuid; r staff;
begin
  if not is_owner() then raise exception 'forbidden'; end if;
  if p_role not in ('owner', 'manager', 'stylist') then raise exception 'invalid_role'; end if;
  if char_length(trim(coalesce(p_display_name, ''))) not between 1 and 40 then raise exception 'invalid_name'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then raise exception 'no_account'; end if;
  if exists (select 1 from staff where id = uid) then raise exception 'already_staff'; end if;
  insert into staff (id, display_name, role, email, active)
  values (uid, left(regexp_replace(trim(p_display_name), '[<>[:cntrl:]]', '', 'g'), 40), p_role::staff_role, lower(trim(p_email)), true)
  returning * into r;
  return r;
end $$;

-- Chaque membre de l'équipe peut corriger son Instagram et ses spécialités (pas son nom affiché ni son rôle)
create or replace function update_my_profile(p_specialty_en text, p_specialty_ar text, p_instagram text) returns staff
language plpgsql security definer set search_path = public as $$
declare r staff;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  update staff set specialty_en = nullif(left(regexp_replace(trim(coalesce(p_specialty_en, '')), '[<>[:cntrl:]]', '', 'g'), 60), ''),
         specialty_ar = nullif(left(regexp_replace(trim(coalesce(p_specialty_ar, '')), '[<>[:cntrl:]]', '', 'g'), 60), ''),
         instagram = nullif(regexp_replace(trim(coalesce(p_instagram, '')), '^@', ''), '')
   where id = auth.uid() returning * into r;
  return r;
end $$;

-- ---------- 4. Catalogue : ordre, validation, journal ----------
alter table services add column if not exists sort_order smallint not null default 100;
alter table services add column if not exists updated_at timestamptz not null default now();
alter table addons add column if not exists sort_order smallint not null default 100;
alter table addons add column if not exists updated_at timestamptz not null default now();

-- Prix entiers en AED, > 0 et plafonnés ; noms EN + AR obligatoires, sans balise (le site les affiche)
alter table services drop constraint if exists services_price_valid;
alter table services add constraint services_price_valid check (price_aed > 0 and price_aed <= 5000 and price_aed = round(price_aed)) not valid;
alter table services drop constraint if exists services_names_valid;
alter table services add constraint services_names_valid check (
  char_length(trim(look_en)) between 1 and 60 and char_length(trim(look_ar)) between 1 and 60
  and char_length(trim(name_en)) between 1 and 80 and char_length(trim(name_ar)) between 1 and 80
  and (look_en || look_ar || name_en || name_ar) !~ '[<>]') not valid;
alter table services drop constraint if exists services_id_format;
alter table services add constraint services_id_format check (id ~ '^[a-z][a-z0-9-]{1,30}$') not valid;
alter table addons drop constraint if exists addons_price_valid;
alter table addons add constraint addons_price_valid check (price_aed > 0 and price_aed <= 5000 and price_aed = round(price_aed)) not valid;
alter table addons drop constraint if exists addons_names_valid;
alter table addons add constraint addons_names_valid check (
  char_length(trim(name_en)) between 1 and 120 and char_length(trim(name_ar)) between 1 and 120 and (name_en || name_ar) !~ '[<>]') not valid;
alter table addons drop constraint if exists addons_kind_valid;
alter table addons add constraint addons_kind_valid check (kind in ('matcha', 'drink', 'extra', 'ritual', 'other')) not valid;
alter table addons drop constraint if exists addons_id_format;
alter table addons add constraint addons_id_format check (id ~ '^[a-z][a-z0-9-]{1,30}$') not valid;
alter table promo_codes drop constraint if exists promo_codes_labels_valid;
alter table promo_codes add constraint promo_codes_labels_valid check (char_length(coalesce(label_en, '')) <= 60 and char_length(coalesce(label_ar, '')) <= 60 and (coalesce(label_en, '') || coalesce(label_ar, '')) !~ '[<>]') not valid;

-- Extras à l'unité et rituel complet (data.js → extras, ritual) : leurs prix deviennent modifiables depuis le back-office.
-- « Cheveux très longs » (40 AED) n'y est PAS : ce montant est écrit en dur dans amount_due (005), il reste dans data.js.
insert into addons (id, name_en, name_ar, kind, price_aed, sort_order) values
  ('shower', 'Private shower (towel and products)', 'دشّ خاص (منشفة ومستحضرات)', 'extra', 49, 10),
  ('steam', 'Outfit steamed: dress, abaya or hijab (per piece)', 'كيّ بالبخار: فستان أو عباءة أو شيلة (للقطعة)', 'extra', 35, 20),
  ('scent', 'Outfit lightly perfumed', 'تعطير الملابس', 'extra', 15, 30),
  ('hairscent', 'Hair perfume: oud, rose or white musk', 'عطر الشعر: عود أو ورد أو مسك أبيض', 'extra', 20, 40),
  ('coffee', 'Coffee, tea or karak', 'قهوة أو شاي أو كرك', 'extra', 20, 50),
  ('matcha', 'Matcha or fresh juice', 'ماتشا أو عصير طازج', 'extra', 25, 60),
  ('touchup', 'Touch-up within 48 hours', 'لمسة خلال ٤٨ ساعة', 'extra', 59, 70),
  ('nails', 'Express nails (polish change)', 'أظافر سريعة (تغيير الطلاء)', 'extra', 79, 80),
  ('ritual', 'Complete ritual: shower, 1 piece steamed and perfumed, hair perfume, coffee or tea', 'الطقوس الكاملة: دشّ، قطعة بالبخار ومعطّرة، عطر الشعر، قهوة أو شاي', 'ritual', 79, 90)
on conflict (id) do nothing;
-- Ordre initial des looks = ordre de data.js (seulement s'il n'a jamais été réglé)
update services s set sort_order = o.n from (values ('express', 10), ('glow', 20), ('waves', 30), ('sleek', 40), ('night', 50), ('sos', 60), ('care', 70), ('cut', 80), ('root', 90), ('mini', 100)) as o(id, n)
 where s.id = o.id and s.sort_order = 100 and o.n <> 100;

-- Tickets : seules les boissons (kind 'matcha' / 'drink') s'ajoutent à un ticket, comme dans store.js (D.addons) : les extras et le
-- rituel ajoutés ci-dessus servent aux prix du site et ne changent ni la caisse ni amount_due (005). Une matcha offerte « Night Glow »
-- reste une ligne kind = 'matcha' ; l'extra « matcha » (kind 'extra', « Matcha or fresh juice ») ne peut pas être mis sur un ticket.
-- Corps identique à 002, seul le filtre sur kind est ajouté.
create or replace function add_addon(p_ticket uuid, p_addon text) returns ticket_addons language plpgsql security definer set search_path = public as $$
declare t tickets; a addons; r ticket_addons;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  select * into t from tickets where id = p_ticket and (assigned_staff = auth.uid() or is_manager()) for update;
  if t is null then raise exception 'not_found'; end if;
  if t.status not in ('waiting','called','in_service') then raise exception 'invalid_state'; end if;
  select * into a from addons where id = p_addon and active and kind in ('matcha', 'drink');
  if a is null then raise exception 'addon_unavailable'; end if;
  if (select count(*) from ticket_addons where ticket_id = p_ticket) >= 6 then raise exception 'too_many_addons'; end if;
  insert into ticket_addons (ticket_id, addon_id, price_aed) values (p_ticket, a.id, a.price_aed) returning * into r;
  insert into ticket_events (ticket_id, event, actor) values (p_ticket, 'addon:' || a.id, auth.uid());
  return r;
end $$;
revoke all on function add_addon(uuid, text) from public, anon;
grant execute on function add_addon(uuid, text) to authenticated;

-- Écriture : propriétaire et gérante (politiques 001 / 005, is_manager() inclut owner). Pas de suppression de look ni d'option :
-- on les désactive (les tickets passés y font référence).
revoke delete on services, addons from anon, authenticated;
revoke insert, update on services, addons from anon;
grant select on services, addons to anon, authenticated;
grant insert, update on services, addons to authenticated;
revoke all on promo_codes from anon;
grant select, insert, update, delete on promo_codes to authenticated;

drop trigger if exists services_touch on services;
create trigger services_touch before update on services for each row execute function touch_updated_at();
drop trigger if exists addons_touch on addons;
create trigger addons_touch before update on addons for each row execute function touch_updated_at();
drop trigger if exists services_audit on services;
create trigger services_audit after insert or update or delete on services for each row execute function audit_row();
drop trigger if exists addons_audit on addons;
create trigger addons_audit after insert or update or delete on addons for each row execute function audit_row();
drop trigger if exists promo_codes_audit on promo_codes;
create trigger promo_codes_audit after insert or update or delete on promo_codes for each row execute function audit_row();

-- Prix publics lus au build (scripts/prices.mjs, clé anon) : colonnes sûres seulement, aucune donnée interne.
create or replace view public_prices with (security_invoker = false) as
  select 'service'::text as kind, id, price_aed, duration_min, active, sort_order, updated_at from services
  union all
  select 'addon'::text, id, price_aed, null::smallint, active, sort_order, updated_at from addons;
revoke all on public_prices from public, anon, authenticated;
grant select on public_prices to anon, authenticated;

-- ---------- 5. Statut du salon (004 : affluence) : mode, message, attente estimée ----------
alter table salon_status add column if not exists mode text not null default 'preopening';
alter table salon_status add column if not exists message_en text;
alter table salon_status add column if not exists message_ar text;
alter table salon_status add column if not exists wait_minutes smallint;
alter table salon_status drop constraint if exists salon_status_mode_valid;
alter table salon_status add constraint salon_status_mode_valid check (mode in ('preopening', 'open', 'closed')) not valid;
alter table salon_status drop constraint if exists salon_status_message_valid;
alter table salon_status add constraint salon_status_message_valid check (char_length(coalesce(message_en, '')) <= 160 and char_length(coalesce(message_ar, '')) <= 160 and (coalesce(message_en, '') || coalesce(message_ar, '')) !~ '[<>]') not valid;
alter table salon_status drop constraint if exists salon_status_wait_valid;
alter table salon_status add constraint salon_status_wait_valid check (wait_minutes is null or wait_minutes between 0 and 240) not valid;
insert into salon_status (id) values (1) on conflict do nothing;

create or replace function admin_set_salon_status(p_mode text, p_message_en text, p_message_ar text, p_wait_minutes smallint,
                                                  p_lounge_waiting smallint default null, p_chairs_free smallint default null)
returns salon_status language plpgsql security definer set search_path = public as $$
declare b salon_status; r salon_status;
begin
  if not is_manager() then raise exception 'forbidden'; end if;
  if p_mode not in ('preopening', 'open', 'closed') then raise exception 'invalid_mode'; end if;
  select * into b from salon_status where id = 1;
  update salon_status set mode = p_mode,
         message_en = nullif(left(regexp_replace(trim(coalesce(p_message_en, '')), '[<>[:cntrl:]]', '', 'g'), 160), ''),
         message_ar = nullif(left(regexp_replace(trim(coalesce(p_message_ar, '')), '[<>[:cntrl:]]', '', 'g'), 160), ''),
         wait_minutes = case when p_wait_minutes is null then null else greatest(0, least(240, p_wait_minutes)) end,
         lounge_waiting = coalesce(greatest(0, least(30, p_lounge_waiting)), lounge_waiting),
         chairs_free = case when p_chairs_free is null then chairs_free else greatest(0, least(10, p_chairs_free)) end,
         updated_at = now(), updated_by = auth.uid()
   where id = 1 returning * into r;
  insert into audit_logs (actor, action, target, details) values (auth.uid(), 'update:salon_status', '1', jsonb_build_object('before', to_jsonb(b), 'after', to_jsonb(r)));
  return r;
end $$;

-- ---------- 6. Demandes d'événements (mariage, anniversaire, groupe…) ----------
create table if not exists event_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  event_type text not null check (event_type in ('wedding', 'henna', 'engagement', 'bridal_shower', 'birthday', 'graduation', 'baby', 'eid', 'shoot', 'corporate', 'other')),
  event_date date,
  guests smallint check (guests between 1 and 60),
  name text not null check (char_length(name) between 1 and 60),
  phone text check (phone ~ '^\+[0-9]{7,15}$'),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  note text check (char_length(note) <= 500),
  lang text not null default 'en' check (lang in ('en', 'ar')),
  source text not null default 'website' check (source in ('website', 'whatsapp', 'instagram', 'phone', 'walk-in', 'other')),
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'declined')),
  staff_notes text check (char_length(staff_notes) <= 2000),
  consent_text_version text,
  handled_by uuid references staff(id) on delete set null,
  constraint event_requests_contact check (phone is not null or email is not null)
);
create index if not exists event_requests_status_idx on event_requests (status, created_at desc);
alter table event_requests enable row level security;
drop policy if exists event_requests_staff_read on event_requests;
drop policy if exists event_requests_staff_insert on event_requests;
drop policy if exists event_requests_staff_update on event_requests;
drop policy if exists event_requests_owner_delete on event_requests;
create policy event_requests_staff_read on event_requests for select to authenticated using (is_manager());
create policy event_requests_staff_insert on event_requests for insert to authenticated with check (is_manager());
create policy event_requests_staff_update on event_requests for update to authenticated using (is_manager()) with check (is_manager());
create policy event_requests_owner_delete on event_requests for delete to authenticated using (is_owner());
revoke all on event_requests from public, anon, authenticated;
grant select, insert, update, delete on event_requests to authenticated;
drop trigger if exists event_requests_touch on event_requests;
create trigger event_requests_touch before update on event_requests for each row execute function touch_updated_at();
drop trigger if exists event_requests_audit on event_requests;
create trigger event_requests_audit after insert or update or delete on event_requests for each row execute function audit_row('slim');

-- Dépôt public (clé anon) : validation serveur, limites anti-abus, même réponse dans tous les cas valides.
create or replace function request_event(p_type text, p_date date, p_guests integer, p_name text, p_phone text, p_email text,
                                         p_note text, p_lang text, p_consent_version text)
returns text language plpgsql security definer set search_path = public as $$
declare ph text := nullif(regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g'), ''); em text := nullif(lower(trim(coalesce(p_email, ''))), '');
        d date := (now() at time zone 'Asia/Dubai')::date;
begin
  if p_consent_version is null or char_length(p_consent_version) = 0 then raise exception 'consent_required'; end if;
  if p_type not in ('wedding', 'henna', 'engagement', 'bridal_shower', 'birthday', 'graduation', 'baby', 'eid', 'shoot', 'corporate', 'other') then raise exception 'invalid_type'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'invalid_name'; end if;
  if ph is null and em is null then raise exception 'contact_required'; end if;
  if ph is not null and ph !~ '^\+[0-9]{7,15}$' then raise exception 'invalid_phone'; end if;
  if em is not null and (em !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' or char_length(em) > 120) then raise exception 'invalid_email'; end if;
  if p_date is not null and (p_date < d or p_date > d + 730) then raise exception 'invalid_date'; end if;
  if p_guests is not null and (p_guests < 1 or p_guests > 60) then raise exception 'invalid_guests'; end if;
  -- freins : 3 demandes par contact et par jour, 60 par heure au total
  if (select count(*) from event_requests where created_at > now() - interval '1 day' and (phone = ph or email = em)) >= 3 then raise exception 'try_later'; end if;
  if (select count(*) from event_requests where created_at > now() - interval '1 hour') >= 60 then raise exception 'try_later'; end if;
  insert into event_requests (event_type, event_date, guests, name, phone, email, note, lang, source, consent_text_version)
  values (p_type, p_date, p_guests, left(regexp_replace(trim(p_name), '[<>[:cntrl:]]', '', 'g'), 60), ph, em,
          nullif(left(regexp_replace(trim(coalesce(p_note, '')), '[<>[:cntrl:]]', '', 'g'), 500), ''),
          case when p_lang = 'ar' then 'ar' else 'en' end, 'website', left(p_consent_version, 40));
  return 'ok';
end $$;

-- ---------- 7. Club QAMAR : demandes d'adhésion et membres ----------
create table if not exists club_members (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 60),
  phone text check (phone ~ '^\+[0-9]{7,15}$'),
  email text check (email ~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$'),
  tier text not null default 'undecided' check (tier in ('crescent', 'half', 'full', 'undecided')),
  founding boolean not null default false,
  lang text not null default 'en' check (lang in ('en', 'ar')),
  source text not null default 'website' check (source in ('website', 'whatsapp', 'instagram', 'phone', 'walk-in', 'other')),
  status text not null default 'new' check (status in ('new', 'contacted', 'confirmed', 'declined')),
  staff_notes text check (char_length(staff_notes) <= 2000),
  consent_text_version text,
  handled_by uuid references staff(id) on delete set null,
  constraint club_members_contact check (phone is not null or email is not null)
);
create index if not exists club_members_status_idx on club_members (status, created_at desc);
alter table club_members enable row level security;
drop policy if exists club_members_staff_read on club_members;
drop policy if exists club_members_staff_insert on club_members;
drop policy if exists club_members_staff_update on club_members;
drop policy if exists club_members_owner_delete on club_members;
create policy club_members_staff_read on club_members for select to authenticated using (is_manager());
create policy club_members_staff_insert on club_members for insert to authenticated with check (is_manager());
create policy club_members_staff_update on club_members for update to authenticated using (is_manager()) with check (is_manager());
create policy club_members_owner_delete on club_members for delete to authenticated using (is_owner());
revoke all on club_members from public, anon, authenticated;
grant select, insert, update, delete on club_members to authenticated;
drop trigger if exists club_members_touch on club_members;
create trigger club_members_touch before update on club_members for each row execute function touch_updated_at();
drop trigger if exists club_members_audit on club_members;
create trigger club_members_audit after insert or update or delete on club_members for each row execute function audit_row('slim');

create or replace function request_club(p_name text, p_phone text, p_email text, p_tier text, p_lang text, p_consent_version text)
returns text language plpgsql security definer set search_path = public as $$
declare ph text := nullif(regexp_replace(coalesce(p_phone, ''), '[\s()-]', '', 'g'), ''); em text := nullif(lower(trim(coalesce(p_email, ''))), '');
begin
  if p_consent_version is null or char_length(p_consent_version) = 0 then raise exception 'consent_required'; end if;
  if char_length(trim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'invalid_name'; end if;
  if ph is null and em is null then raise exception 'contact_required'; end if;
  if ph is not null and ph !~ '^\+[0-9]{7,15}$' then raise exception 'invalid_phone'; end if;
  if em is not null and (em !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' or char_length(em) > 120) then raise exception 'invalid_email'; end if;
  if coalesce(p_tier, 'undecided') not in ('crescent', 'half', 'full', 'undecided') then raise exception 'invalid_tier'; end if;
  -- une demande ouverte par contact (on ne révèle pas si elle existe déjà) ; 60 par heure au total
  if exists (select 1 from club_members where status in ('new', 'contacted', 'confirmed') and (phone = ph or email = em)) then return 'ok'; end if;
  if (select count(*) from club_members where created_at > now() - interval '1 hour') >= 60 then raise exception 'try_later'; end if;
  insert into club_members (name, phone, email, tier, lang, source, consent_text_version)
  values (left(regexp_replace(trim(p_name), '[<>[:cntrl:]]', '', 'g'), 60), ph, em, coalesce(p_tier, 'undecided'),
          case when p_lang = 'ar' then 'ar' else 'en' end, 'website', left(p_consent_version, 40));
  return 'ok';
end $$;

-- ---------- 8. Journal d'activité : lecture propriétaire + gérante (001 : audit_read using is_manager()) ----------
revoke all on audit_logs from anon;
revoke insert, update, delete on audit_logs from authenticated;
grant select on audit_logs to authenticated;

-- ---------- 9. Droits d'exécution ----------
revoke all on function is_owner(), touch_updated_at(), audit_row(), admin_update_staff(uuid, text, text, boolean, text, text, text),
  admin_link_staff(text, text, text), update_my_profile(text, text, text),
  admin_set_salon_status(text, text, text, smallint, smallint, smallint),
  request_event(text, date, integer, text, text, text, text, text, text), request_club(text, text, text, text, text, text) from public, anon;
grant execute on function is_owner(), is_manager(), is_staff(), is_blog_admin(), admin_update_staff(uuid, text, text, boolean, text, text, text),
  admin_link_staff(text, text, text), update_my_profile(text, text, text),
  admin_set_salon_status(text, text, text, smallint, smallint, smallint) to authenticated;
grant execute on function request_event(text, date, integer, text, text, text, text, text, text), request_club(text, text, text, text, text, text) to anon, authenticated;
