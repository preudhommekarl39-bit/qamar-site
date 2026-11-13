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
