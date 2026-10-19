-- QAMAR — 003 : liste d'attente de préouverture (« prévenez-moi de l'ouverture »)
-- ⚠ Non exécuté : aucun projet Supabase n'est déployé. Le formulaire du site ne sera affiché qu'après application
--   de cette migration, tests en préproduction et validation du texte de consentement par un juriste (PDPL).
-- Principe : la visiteuse s'inscrit volontairement ; personne ne peut lire la liste depuis le navigateur ;
--   une seule inscription par contact ; données minimales ; suppression automatique après l'ouverture.

create table if not exists waitlist (
  id uuid primary key default gen_random_uuid(),
  contact text not null,                       -- e-mail OU numéro WhatsApp au format +XXXXXXXX
  contact_kind text not null check (contact_kind in ('email', 'whatsapp')),
  first_name text check (char_length(first_name) <= 40),
  lang text not null default 'en' check (lang in ('en', 'ar')),
  consent_text_version text not null,          -- version exacte du texte de consentement affiché
  consent_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (contact)
);
alter table waitlist enable row level security;
-- aucune politique de lecture/écriture publique : seul le rôle « manager » lit la liste
create policy waitlist_manager_read on waitlist for select using (is_manager());
create policy waitlist_manager_delete on waitlist for delete using (is_manager());

-- Inscription : validation serveur, idempotente, limite globale anti-robot (à compléter par Cloudflare Turnstile)
create or replace function join_waitlist(p_contact text, p_kind text, p_first_name text, p_lang text, p_consent_version text)
returns text language plpgsql security definer set search_path = public as $$
declare c text := lower(trim(p_contact));
begin
  if p_consent_version is null or char_length(p_consent_version) = 0 then raise exception 'consent_required'; end if;
  if p_kind = 'email' and c !~ '^[^@\s]+@[^@\s]+\.[a-z]{2,}$' then raise exception 'invalid_contact'; end if;
  if p_kind = 'whatsapp' and c !~ '^\+[0-9]{7,15}$' then raise exception 'invalid_contact'; end if;
  if p_kind not in ('email', 'whatsapp') then raise exception 'invalid_contact'; end if;
  -- frein simple : 300 inscriptions max par heure au total (un robot ne peut pas remplir la table)
  if (select count(*) from waitlist where created_at > now() - interval '1 hour') >= 300 then raise exception 'try_later'; end if;
  insert into waitlist (contact, contact_kind, first_name, lang, consent_text_version)
  values (c, p_kind, left(regexp_replace(trim(coalesce(p_first_name, '')), '[<>[:cntrl:]]', '', 'g'), 40), coalesce(nullif(p_lang, ''), 'en'), p_consent_version)
  on conflict (contact) do nothing;
  return 'ok'; -- même réponse si déjà inscrite : on ne révèle pas qui est dans la liste
end $$;

revoke all on function join_waitlist(text, text, text, text, text) from public;
grant execute on function join_waitlist(text, text, text, text, text) to anon, authenticated;

-- Conservation : à exécuter (tâche planifiée pg_cron ou manuelle) 90 jours après l'ouverture
-- delete from waitlist where created_at < now() - interval '180 days';
