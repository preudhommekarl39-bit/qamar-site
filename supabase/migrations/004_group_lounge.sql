-- QAMAR — 004 : visites de groupe (un ticket, plusieurs personnes) et affluence en direct du salon
-- ⚠ Non exécuté : aucun projet Supabase n'est déployé. À appliquer avec `supabase db push` puis tester en préproduction.
-- ✓ Fait dans 005_group_pricing.sql : join_queue accepte p_party (+ code promo) et amount_due
--   recalcule le prix par personne comme assets/store.js → groupQuote.

-- 1. Groupe : [{ "serviceId": "express", "extraLong": false, "promo": {...} }, ...] — null = personne seule
alter table tickets add column if not exists party jsonb;
alter table tickets add column if not exists party_size smallint generated always as (coalesce(jsonb_array_length(party), 1)) stored;
alter table tickets add constraint tickets_party_max check (party is null or jsonb_array_length(party) between 2 and 6);

-- 2. Affluence du salon (une seule ligne) : réglée par le personnel, lue par tout le monde (aucune donnée personnelle)
create table if not exists salon_status (
  id smallint primary key default 1 check (id = 1),
  lounge_waiting smallint not null default 0 check (lounge_waiting between 0 and 30),
  chairs_free smallint check (chairs_free between 0 and 10),
  updated_at timestamptz not null default now(),
  updated_by uuid references staff(id)
);
insert into salon_status (id) values (1) on conflict do nothing;
alter table salon_status enable row level security;
create policy salon_status_public_read on salon_status for select using (true);

create or replace function set_lounge(p_waiting smallint, p_chairs_free smallint default null) returns salon_status
language plpgsql security definer set search_path = public as $$
declare r salon_status;
begin
  if not is_staff() then raise exception 'forbidden'; end if;
  update salon_status set lounge_waiting = greatest(0, least(30, p_waiting)), chairs_free = p_chairs_free,
         updated_at = now(), updated_by = auth.uid() where id = 1 returning * into r;
  insert into audit_logs (actor, action, target) values (auth.uid(), 'set_lounge', p_waiting::text);
  return r;
end $$;
grant execute on function set_lounge(smallint, smallint) to authenticated;
grant select on salon_status to anon, authenticated;

-- temps réel : les pages clientes reçoivent les changements d'affluence
alter publication supabase_realtime add table salon_status;
