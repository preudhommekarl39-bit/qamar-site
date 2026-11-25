# Supabase (mode connecté)

Rien ici n'a encore été exécuté contre une vraie base. Le site tourne en mode `demo` (localStorage) tant que
`assets/config.js` → `backend: 'demo'`.

Migrations, dans l'ordre : `001_init` → `002_hardening` → `003_waitlist` → `004_group_lounge` → `005_group_pricing` → `006_articles` → `007_backoffice` (back-office, voir plus bas).
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

## Back-office (office.html) : migration 007

Page unique du personnel : `https://qamarlounge.com/office.html` (connexion e-mail + mot de passe, même compte et même session que
`blog-admin.html`, pas d'inscription). Le menu dépend du rôle (`assets/office-core.js`, testé) :

| Rôle | Voit et modifie | Lecture seule |
|---|---|---|
| `owner` (Karl) | tout : statut du salon, demandes d'événements, Club, looks et prix, extras, codes promo, équipe (invitations, rôles, désactivation), journal d'activité, blog | |
| `manager` | statut du salon, demandes, Club, looks et prix, extras, codes promo | équipe, journal d'activité |
| `stylist` | son profil (spécialités, Instagram, mot de passe) | |

Les droits réels sont dans la base (RLS + fonctions de la 007) ; le menu ne fait que l'affichage.
Démo locale avec fausses données (localhost seulement, jamais en ligne) : `python3 -m http.server 8791` depuis `_site/` puis
`http://localhost:8791/office.html#local-demo-owner` (ou `-manager`, `-stylist`). Captures : `docs/captures-office/`.

### Ce que crée la 007 (rejouable, n'efface rien)
- valeur `owner` de l'enum `staff_role` ; `is_owner()` ; `is_manager()` = manager **ou** owner ; `is_blog_admin()` = `blog_admins` **ou** owner ;
- `staff` : colonnes `email`, `updated_at` ; écriture directe retirée (la 001 laissait une gérante se donner n'importe quel rôle) :
  `admin_update_staff` et `admin_link_staff` (owner seulement, jamais sans owner active), `update_my_profile` (chacun son profil) ;
- `services` / `addons` : `sort_order`, `updated_at`, prix entiers 1 à 5000 AED, noms EN + AR obligatoires ; extras à l'unité et rituel ajoutés
  dans `addons` (`kind` = `extra` / `ritual`) ; pas de suppression (on désactive) ; vue publique `public_prices` (prix, durée, actif, ordre) ;
- `salon_status` : `mode` (preopening / open / closed), `message_en`, `message_ar`, `wait_minutes` ; fonction `admin_set_salon_status` (owner + manager) ;
- tables `event_requests` et `club_members` (statut new / contacted / confirmed / declined, notes, contact), RLS : lecture et écriture owner + manager,
  suppression owner ; dépôt public possible par `request_event` / `request_club` (validation, limites anti-abus) ;
- `audit_row()` : chaque changement du catalogue, des codes, de l'équipe et des statuts de demandes est écrit dans `audit_logs` (qui, quoi, avant / après ;
  pour les demandes, seulement le statut, pas les données personnelles).

### À faire une fois (assistant de Karl)
1. **Migration** : SQL Editor → coller tout `supabase/migrations/007_backoffice.sql` (copier avec `LANG=en_US.UTF-8 pbcopy < supabase/migrations/007_backoffice.sql`) → Run.
2. **Karl owner** (requête séparée, APRÈS l'étape 1, remplacer l'e-mail) :
   ```sql
   insert into staff (id, display_name, role, email, active)
   select id, 'Karl', 'owner', email, true from auth.users where email = 'EMAIL-DE-KARL'
   on conflict (id) do update set role = 'owner', active = true, email = excluded.email;
   select id, display_name, role, active from staff;   -- vérifier : une ligne owner
   ```
3. **Auth → URL Configuration** : ajouter `https://qamarlounge.com/office.html` aux *Redirect URLs* (garder `blog-admin.html`) et mettre
   *Site URL* = `https://qamarlounge.com/office.html` (les invitations envoyées depuis le tableau de bord y mènent : écran « Choose your password »).
4. **Fonction d'invitation** `supabase/functions/invite-staff` : Edge Functions → Deploy a new function → nom `invite-staff` → coller
   `index.ts` → laisser **Verify JWT** activé → Deploy (ou `supabase functions deploy invite-staff`). `SUPABASE_URL`, `SUPABASE_ANON_KEY` et la
   clé secrète sont fournies automatiquement par Supabase : **aucun secret à copier**. Facultatif (Edge Functions → Secrets) :
   `OFFICE_URL` (défaut `https://qamarlounge.com/office.html`), `ALLOWED_ORIGINS` (défaut `https://qamarlounge.com`).
   Tant qu'elle n'est pas déployée, Team → Invite affiche la méthode manuelle : Authentication → Users → *Invite user*, puis
   « Link an account invited from Supabase » (ou `insert into staff (id, display_name, role, email) select id, 'Prénom', 'stylist', email from auth.users where email = '…';`).
5. Tester : se connecter sur `office.html`, changer un prix de test, vérifier `Activity log`, puis GitHub → Actions → Site → *Run workflow* :
   le journal du build affiche `Prices: … change(s)` et le prix est en ligne.

### Prix : du back-office au site
Au build (`scripts/prices.mjs`, appelé par `build-site.mjs`), la vue `public_prices` est lue avec la clé anon. Les prix et durées des looks, des extras,
du rituel et des matchas sont réécrits dans `_site/assets/data.js` (seuls les nombres changent ; le dépôt n'est pas modifié), puis
`scripts/seo_pages.py` régénère `_site/services/` et `_site/areas/` avec ces prix. Le build planifié (toutes les heures) redéploie si
`content-hash.txt` (journal + prix) change : **un prix modifié est en ligne dans l'heure**.
Garde-fous : vue absente (007 pas encore passée), `BLOG_OFFLINE=1` ou `PRICES_OFFLINE=1` → prix de `data.js` ; une seule ligne invalide (prix 0,
non entier, durée > 45 min…) ou aucun look reconnu → **tous** les prix de `data.js` (jamais de menu vide) ; Supabase en erreur → build arrêté,
le site en ligne garde ses prix. Restent dans `data.js` (demander une mise à jour du site) : textes, photos, ajout ou retrait d'un look sur le site,
supplément cheveux longs (40 AED, écrit en dur dans `amount_due`).

### Demandes d'événements et Club
Le formulaire « Book an event » du site prépare un message WhatsApp et **ne stocke rien** (c'est ce que dit `privacy.html` : en préouverture,
rien de ce qui est tapé n'est envoyé à QAMAR). Il n'est donc pas branché sur `request_event` : l'équipe saisit les demandes reçues
(WhatsApp, Instagram, téléphone) dans le back-office. Pour brancher plus tard, après mise à jour de la politique de confidentialité :
`sb.rpc('request_event', { p_type, p_date, p_guests, p_name, p_phone, p_email, p_note, p_lang, p_consent_version })`
(idem `request_club(p_name, p_phone, p_email, p_tier, p_lang, p_consent_version)`) ; réponse `ok`, erreurs `invalid_*`, `contact_required`, `try_later`.

### Phase 2 (pas encore fait) : PIN de la tablette
La tablette partagée (`station.html`) garde ses PIN de démo. Prévu : une colonne `staff.pin_hash` (bcrypt via `crypt()`), une fonction
`station_unlock(p_staff, p_pin)` appelée par la tablette connectée avec un compte « poste » dédié, limitée en tentatives, qui renvoie l'identité
de la coiffeuse pour `clock_in` / `call_next`. Le PIN n'est jamais stocké ni comparé dans la page.
