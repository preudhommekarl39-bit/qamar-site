# Supabase (mode connecté)

Rien ici n'a encore été exécuté contre une vraie base. Le site tourne en mode `demo` (localStorage) tant que
`assets/config.js` → `backend: 'demo'`.

Migrations, dans l'ordre : `001_init` → `002_hardening` → `003_waitlist` → `004_group_lounge` → `005_group_pricing`.
La 005 fait accepter les groupes (1 à 6 personnes, un look chacune) et les codes promo à `join_queue`, et fait
calculer à `amount_due` le même total que `assets/store.js` : la meilleure remise par personne, sans cumul, le
supplément cheveux longs, une matcha offerte par personne Night Glow, et la garantie réservée aux visites seules.

## Avant l'ouverture

1. Créer le projet Supabase de préproduction, puis lancer `supabase link --project-ref <ref>`.
2. Lancer `supabase db push` (migrations 001 → 005), puis exécuter `seed.sql`.
3. Aligner les remises sur `assets/data.js` → `promotions` (elles sont désactivées par défaut) :
   ```sql
   update promotions set enabled = true where id in ('launch-first', 'launch', 'happy-hours', 'squad');
   update promotions set starts_at = now() where id = 'launch-first';  -- départ du compteur des 30 places à −70 %
   ```
4. Recopier les codes de `data.js` → `promoCodes`, s'il y en a, en majuscules :
   `insert into promo_codes (code, pct, label_en, label_ar, valid_until, min_people) values (...);`
5. Créer les comptes du personnel (Supabase Auth) et leurs lignes `staff`, avec au moins un `manager`.
6. Tester en préproduction :
   - une personne seule, puis un groupe de 4 pendant les happy hours (le Squad à −25 % doit l'emporter sur −20 %) ;
   - un groupe de 4 quand il reste 2 places à −70 % (attendu : 2 personnes à −70 % et 2 à −50 %) ;
   - un code valide, puis le même code expiré (il doit être ignoré sans erreur) ;
   - `party` à 7 personnes ou avec un look inconnu (attendu : `invalid_party` / `service_unavailable`) ;
   - `amount_due` doit donner le même total que la caisse en mode démo pour les mêmes tickets ;
   - un appel à `rpc('person_promo')` en anonyme doit être refusé.
7. Déployer `functions/payment-webhook` et ses secrets, puis passer `config.js` en `backend: 'supabase'` avec
   l'URL et la clé anon, et charger `assets/backend-supabase.js` avant `store.js`.

Le supplément cheveux longs (40 AED) et la garantie (35 min) sont écrits en dur dans le SQL : s'ils changent dans
`data.js`, il faut les changer aussi dans `amount_due` (005) et `advance_ticket` (001).

## État (13/11/2026)
Projet Supabase créé : **qamar** (org Voltaire, ref `seexwsitmwqfzuejskej`, https://seexwsitmwqfzuejskej.supabase.co, région auto = Sydney ap-southeast-2). Migrations 001→005 + seed appliquées via l'éditeur SQL (arabe corrigé en UTF-8, prix alignés sur data.js). Restent les étapes 3 à 7 (remises, codes, comptes du personnel, tests, bascule config.js) — le site reste en mode démo.

## Blog (journal)

Le journal est fait de **pages HTML statiques** générées au build (`scripts/blog.mjs`, appelé par `scripts/build-site.mjs`) :
`/blog/` et `/blog/ar/` (liste), `/blog/<slug>.html` et `/blog/ar/<slug>.html` (articles). Chaque article a son meta title,
sa meta description, canonical + hreflang EN/AR/x-default, un schéma `BlogPosting` + `BreadcrumbList`, l'auteur (« QAMAR team »
par défaut, jamais un faux expert), la vraie date de publication et de mise à jour, un lien vers sa page service, et il est
ajouté au `sitemap.xml`. La page service liée affiche en retour « From the journal ». Lien « Journal / المدونة » dans les pieds de page.
Un journal sans article publié est en `noindex` et absent du sitemap.

Deux sources, fusionnées au build (même slug dans les deux : la version modifiée le plus récemment gagne) :

1. **Fichiers du dépôt** `content/blog/<slug>.json` (publication par git, par Claude). Le nom du fichier doit être `<slug>.json`
   (sauf les modèles qui commencent par `_`, comme `_exemple.json`, toujours en brouillon). Format : voir `_exemple.json`.
   Un article JSON publié mais invalide fait échouer les tests et le build (rien n'est mis en ligne).
2. **Table Supabase `articles`**, remplie depuis `blog-admin.html`. Lue au build avec la clé publique anon : la RLS ne renvoie
   que les articles publiés. Si Supabase est injoignable ou la clé absente, le build continue avec les fichiers du dépôt.
   Un article Supabase invalide est ignoré (message dans le journal du build), sans bloquer le reste.
   Exception voulue : si la clé anon est renseignée et que Supabase ne répond pas, le build **échoue** (le site en ligne reste
   tel quel, avec ses articles Supabase) au lieu de redéployer un journal amputé. `BLOG_OFFLINE=1` force un build sans Supabase.

Format d'un article : `slug`, `status` (`draft` | `published`), `category` (`guides`, `hair-care`, `occasions`, `news`),
`title`, `summary`, `metaTitle`, `metaDescription` (chacun `{ "en": "…", "ar": "…" }`), `blocks.en` / `blocks.ar`
(liste de blocs : `{ "type": "p", "text" }`, `{ "type": "h2", "text" }`, `{ "type": "callout", "title", "text" }`,
`{ "type": "list", "items": [ … ] }`), `service` (slug d'une page de `services/`), `image` facultative
(`{ "src": "assets/img/…", "alt": { "en", "ar" }, "width", "height" }`), `author` (`{ "en", "ar", "type": "Organization" | "Person" }`),
`reviewedBy` (`{ "en", "ar" }`, nom réel ou vide), `datePublished`, `dateModified` (`AAAA-MM-JJ`).
Dans les textes : liens internes seulement, `[texte du lien](/services/walk-in-blow-dry-dubai.html)` (aussi `/areas/…`,
`/guides/…`, `/blog/…`, `/`, `/#club`) ; sur la page arabe ils pointent automatiquement vers la version arabe. Gras : `**texte**`.
Refusés par les contrôles : liens externes, emoji, tiret cadratin. La version arabe est facultative : sans elle, seule la page
anglaise est publiée (sans hreflang). Une `datePublished` dans le futur programme l'article (mis en ligne par le build de ce jour-là).

### Mise en ligne

- **Par JSON** : ajouter `content/blog/<slug>.json` avec `"status": "published"`, lancer `node scripts/run-tests.mjs`, committer
  et pousser sur `main` (accord de Karl) : le workflow `Site` publie aussitôt.
- **Par l'admin** : `https://qamarlounge.com/blog-admin.html` → se connecter → New article → onglets English / العربية,
  aperçus EN / AR (avec l'aperçu Google) → « Save draft » ou « Publish ». Le workflow `Site` tourne **toutes les heures**
  (`schedule`, à HH:07 UTC) et ne redéploie que si le contenu publié du journal a changé (`blog/content-hash.txt`) :
  **l'article est visible en ligne dans l'heure** (GitHub retarde parfois les tâches planifiées de quelques minutes).
  Pour le voir tout de suite : GitHub → Actions → Site → « Run workflow ».
- Retirer un article : « Unpublish » dans l'admin (ou `"status": "draft"` dans le JSON) ; il disparaît au build suivant.
- Les dates sont posées par la base : `date_published` à la première publication (si vide), `date_modified` seulement quand
  le texte, les métadonnées ou l'image changent (jamais de fausse mise à jour).
- Les tâches planifiées de GitHub ne tournent que depuis `main`, et GitHub les suspend après 60 jours sans activité sur
  le dépôt : un e-mail prévient, il suffit de les réactiver dans l'onglet Actions.

### À faire une fois (Karl)

1. **Appliquer la migration** : Supabase → projet `qamar` → SQL Editor → New query → coller tout
   `supabase/migrations/006_articles.sql` (copier avec `LANG=en_US.UTF-8 pbcopy < supabase/migrations/006_articles.sql`
   pour garder l'arabe intact) → Run. Elle crée `articles`, `blog_admins`, la fonction `is_blog_admin()`, le déclencheur des
   dates et les politiques RLS. Elle peut être rejouée sans casse.
2. **Coller la clé anon** : Supabase → Project Settings → API → clé `anon` `public` → dans `assets/config.js`,
   `supabaseAnonKey: '…'` (`supabaseUrl` est déjà rempli). Cette clé est faite pour être publique ; ne jamais y mettre la
   clé `service_role`. La file d'attente reste en mode démo tant que `backend` vaut `'demo'`.
3. **Créer son utilisateur admin** (aucun compte n'est créé par le site, il n'y a pas d'inscription) :
   - Supabase → Authentication → Users → « Add user » → « Create new user » → son e-mail + un mot de passe choisi par lui,
     cocher « Auto Confirm User » → Create.
   - Puis dans SQL Editor :
     ```sql
     insert into blog_admins (user_id, email)
     select id, email from auth.users where email = 'SON-EMAIL@exemple.com';
     ```
   - Vérifier : `select * from blog_admins;` doit montrer une ligne.
   - Pour retirer un admin : `delete from blog_admins where email = '…';`
4. **Désactiver les inscriptions** (obligatoire) : Authentication → Sign In / Providers (selon la version : Settings) →
   décocher « Enable sign-ups » / « Allow new users to sign up » → Save. Sinon n'importe qui pourrait créer un compte avec la
   clé anon ; ce compte n'aurait aucun droit d'écriture (il n'est pas dans `blog_admins`), mais il ne doit pas exister.
   Créer ensuite les comptes uniquement depuis Authentication → Users → Add user.
5. Tester : ouvrir `blog-admin.html`, se connecter, créer un brouillon, le publier, puis lancer « Run workflow » et vérifier
   `https://qamarlounge.com/blog/`.

Sécurité : lecture publique limitée aux articles `published` ; colonnes internes `created_by` / `updated_by` illisibles par anon comme par les comptes connectés ; brouillons lisibles par les seuls admins ;
insertion, modification et suppression réservées aux comptes présents dans `blog_admins` ; aucun secret dans le site.
`blog-admin.html` est en `noindex, nofollow` et hors du sitemap.
