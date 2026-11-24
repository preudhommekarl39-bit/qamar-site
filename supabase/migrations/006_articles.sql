-- QAMAR : 006 : journal (blog). Table « articles » alimentée par blog-admin.html, lue au build par scripts/blog.mjs.
-- À exécuter UNE fois dans Supabase → SQL Editor (projet qamar), après 001 → 005. Rejouable sans casse (if not exists / or replace).
-- Sécurité :
--   • lecture publique (clé anon) : uniquement les articles « published », et sans les colonnes internes (created_by, updated_by) ;
--   • écriture : uniquement les utilisateurs Supabase Auth inscrits dans blog_admins (ajoutés à la main, voir supabase/README.md, section Blog) ;
--   • aucune clé secrète côté site : le panneau utilise la clé anon + la session de l'admin connecté.

create extension if not exists pgcrypto;

-- ---- Liste des admins du blog ----
create table if not exists blog_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);
alter table blog_admins enable row level security;
drop policy if exists blog_admins_self_read on blog_admins;
create policy blog_admins_self_read on blog_admins for select to authenticated using (user_id = auth.uid());
revoke all on blog_admins from anon;
grant select on blog_admins to authenticated;   -- chaque admin ne voit que sa propre ligne (politique ci-dessus) ; aucun ajout possible depuis le site

create or replace function is_blog_admin() returns boolean language sql stable security definer set search_path = public as
$$ select exists (select 1 from blog_admins where user_id = auth.uid()) $$;
revoke all on function is_blog_admin() from public, anon;
grant execute on function is_blog_admin() to authenticated;

-- ---- Articles ----
create table if not exists articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 90),
  status text not null default 'draft' check (status in ('draft', 'published')),
  category text not null default 'guides' check (category in ('guides', 'hair-care', 'occasions', 'news')),
  title_en text not null default '', title_ar text not null default '',
  summary_en text not null default '', summary_ar text not null default '',
  meta_title_en text not null default '', meta_title_ar text not null default '',
  meta_description_en text not null default '', meta_description_ar text not null default '',
  blocks_en jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks_en) = 'array'),
  blocks_ar jsonb not null default '[]'::jsonb check (jsonb_typeof(blocks_ar) = 'array'),
  service text not null default '',                      -- slug de la page service liée (services/<slug>.html)
  image_src text, image_alt_en text, image_alt_ar text,   -- facultatif : assets/img/… ou https://…
  image_width int check (image_width between 1 and 10000), image_height int check (image_height between 1 and 10000),
  author_en text not null default 'QAMAR team', author_ar text not null default 'فريق قمر',
  author_type text not null default 'Organization' check (author_type in ('Organization', 'Person')),
  reviewed_by_en text, reviewed_by_ar text,
  date_published date,                                    -- posée automatiquement à la première publication si vide
  date_modified date,                                     -- posée automatiquement quand le contenu change (jamais à la main)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  updated_by uuid,
  constraint articles_published_complete check (
    status = 'draft' or (title_en <> '' and summary_en <> '' and meta_description_en <> '' and jsonb_array_length(blocks_en) > 0 and service <> '' and date_published is not null))
);
create index if not exists articles_status_date on articles (status, date_published desc);

-- Dates honnêtes : date_modified ne bouge que si le texte, les métadonnées ou l'image changent (heure de Dubaï)
create or replace function articles_stamp() returns trigger language plpgsql set search_path = public as $$
declare today date := (now() at time zone 'Asia/Dubai')::date;
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if new.status = 'published' and new.date_published is null then new.date_published := today; end if;
  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
    new.date_modified := today;
  elsif (new.title_en, new.title_ar, new.summary_en, new.summary_ar, new.meta_title_en, new.meta_title_ar, new.meta_description_en, new.meta_description_ar,
         new.blocks_en, new.blocks_ar, new.service, new.image_src, new.image_alt_en, new.image_alt_ar, new.image_width, new.image_height, new.author_en, new.author_ar, new.reviewed_by_en, new.reviewed_by_ar, new.category)
        is distinct from
        (old.title_en, old.title_ar, old.summary_en, old.summary_ar, old.meta_title_en, old.meta_title_ar, old.meta_description_en, old.meta_description_ar,
         old.blocks_en, old.blocks_ar, old.service, old.image_src, old.image_alt_en, old.image_alt_ar, old.image_width, old.image_height, old.author_en, old.author_ar, old.reviewed_by_en, old.reviewed_by_ar, old.category) then
    new.date_modified := today;
  else
    new.date_modified := old.date_modified;
    new.created_by := old.created_by;
  end if;
  if new.date_published is not null and (new.date_modified is null or new.date_modified < new.date_published) then new.date_modified := new.date_published; end if;
  return new;
end $$;
drop trigger if exists articles_stamp on articles;
create trigger articles_stamp before insert or update on articles for each row execute function articles_stamp();

alter table articles enable row level security;
drop policy if exists articles_public_read on articles;
drop policy if exists articles_admin_read on articles;
drop policy if exists articles_admin_insert on articles;
drop policy if exists articles_admin_update on articles;
drop policy if exists articles_admin_delete on articles;
create policy articles_public_read  on articles for select to anon, authenticated using (status = 'published');
create policy articles_admin_read   on articles for select to authenticated using (is_blog_admin());
create policy articles_admin_insert on articles for insert to authenticated with check (is_blog_admin());
create policy articles_admin_update on articles for update to authenticated using (is_blog_admin()) with check (is_blog_admin());
create policy articles_admin_delete on articles for delete to authenticated using (is_blog_admin());

revoke all on articles from public, anon, authenticated;
-- Lecture : mêmes colonnes publiques pour anon et authenticated (jamais created_by / updated_by).
-- Les politiques décident des lignes : articles_public_read (publiés, pour tous) ; articles_admin_read (brouillons, admins seulement).
grant select (id, slug, status, category, title_en, title_ar, summary_en, summary_ar, meta_title_en, meta_title_ar, meta_description_en, meta_description_ar,
              blocks_en, blocks_ar, service, image_src, image_alt_en, image_alt_ar, image_width, image_height, author_en, author_ar, author_type, reviewed_by_en, reviewed_by_ar,
              date_published, date_modified, updated_at) on articles to anon, authenticated;
-- Écriture : grant séparé, filtré par les politiques articles_admin_insert / _update / _delete (is_blog_admin()).
-- Un compte connecté absent de blog_admins ne peut rien écrire.
grant insert, update, delete on articles to authenticated;
