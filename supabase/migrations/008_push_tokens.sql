-- QAMAR : 008 : jetons des notifications push de l'application (iPhone / Android).
-- ⚠ NON APPLIQUÉE. À appliquer seulement quand la file passe sur Supabase (phase 2), que les comptes Apple / Google existent
--   et que assets/config.js → push.enabled passe à true. Voir docs/stores/PUSH.md.
-- Principe :
--   - un jeton = un téléphone pour UN ticket (« c'est votre tour ») ; il est supprimé avec le ticket ou après 2 jours ;
--   - l'app enregistre son jeton par la fonction register_push_token, qui exige le jeton d'accès du ticket
--     (preuve que la cliente est bien la titulaire du ticket) ; le téléphone est recopié depuis le ticket, jamais fourni par l'app ;
--   - personne ne lit la table depuis le navigateur ou l'app : seule la fonction send-push (clé serveur) l'utilise ;
--   - aucun usage marketing : la table ne sert qu'aux alertes du ticket en cours.
-- Rejouable sans risque (if not exists / or replace / drop ... if exists).

create table if not exists push_tokens (
  id bigint generated always as identity primary key,
  token text not null,
  platform text not null,
  ticket_id uuid not null references tickets(id) on delete cascade,
  client_phone text,                                    -- recopié du ticket (pour effacer sur demande de la cliente)
  lang text not null default 'en',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 days'
);
alter table push_tokens drop constraint if exists push_tokens_platform_valid;
alter table push_tokens add constraint push_tokens_platform_valid check (platform in ('ios', 'android'));
alter table push_tokens drop constraint if exists push_tokens_token_valid;
alter table push_tokens add constraint push_tokens_token_valid check (char_length(token) between 32 and 4096 and token !~ '[[:space:]]');
alter table push_tokens drop constraint if exists push_tokens_lang_valid;
alter table push_tokens add constraint push_tokens_lang_valid check (lang in ('en', 'ar'));
create unique index if not exists push_tokens_token_ticket on push_tokens (token, ticket_id);
create index if not exists push_tokens_ticket on push_tokens (ticket_id);
create index if not exists push_tokens_expires on push_tokens (expires_at);

-- RLS activée, AUCUNE politique : ni lecture ni écriture directe pour anon / authenticated (la clé serveur contourne RLS)
alter table push_tokens enable row level security;
revoke all on push_tokens from public, anon, authenticated;

-- Enregistrement du jeton par l'app : vérifie le ticket ET son jeton d'accès, ticket encore actif, 5 appareils max par ticket
create or replace function register_push_token(p_token text, p_platform text, p_ticket uuid, p_access_token uuid, p_lang text default 'en')
returns text language plpgsql security definer set search_path = public as $$
declare tk tickets;
begin
  select * into tk from tickets where id = p_ticket and access_token = p_access_token;
  if not found then raise exception 'forbidden'; end if;
  if tk.status not in ('waiting', 'called', 'in_service', 'checkout') then return 'closed'; end if;
  if p_platform not in ('ios', 'android') then raise exception 'invalid_platform'; end if;
  if (select count(*) from push_tokens where ticket_id = p_ticket) >= 5 then return 'ok'; end if;
  insert into push_tokens (token, platform, ticket_id, client_phone, lang)
  values (trim(p_token), p_platform, p_ticket, tk.client_phone, case when p_lang = 'ar' then 'ar' else 'en' end)
  on conflict (token, ticket_id) do update set expires_at = now() + interval '2 days';
  return 'ok';
end $$;

-- L'app retire son jeton (cliente qui quitte la file ou coupe les notifications)
create or replace function unregister_push_token(p_token text, p_ticket uuid, p_access_token uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from tickets where id = p_ticket and access_token = p_access_token) then raise exception 'forbidden'; end if;
  delete from push_tokens where ticket_id = p_ticket and token = trim(p_token);
end $$;

-- Ménage : jetons expirés (à planifier avec pg_cron, ex. toutes les heures : select purge_push_tokens();)
create or replace function purge_push_tokens() returns integer language sql security definer set search_path = public as $$
  with d as (delete from push_tokens where expires_at < now() returning 1) select count(*)::integer from d
$$;

revoke all on function register_push_token(text, text, uuid, uuid, text), unregister_push_token(text, uuid, uuid), purge_push_tokens() from public;
grant execute on function register_push_token(text, text, uuid, uuid, text), unregister_push_token(text, uuid, uuid) to anon, authenticated;
