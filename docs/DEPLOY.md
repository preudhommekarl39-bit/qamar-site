# QAMAR — Déploiement

## Structure
```
qamar/            ← site statique publié (Cloudflare Pages : dossier de sortie)
  index.html  queue.html  entrance.html  station.html  admin.html
  privacy.html  legal.html  tests.html  robots.txt  _headers
  assets/  config.js  data.js  store.js  backend-supabase.js  qamar.css  sakura.js  stage-fx.js  rituals-fx.js
supabase/         ← JAMAIS publié avec le site
  migrations/001_init.sql   seed.sql
  functions/payment-webhook/   functions/whatsapp-notify/
AUDIT.md  SECURITY.md  DEPLOY.md  .env.example
```

## 1. Site en mode démo (aujourd'hui)
```
npx wrangler pages deploy qamar --project-name qamar
```
Aucun backend nécessaire. Les données restent dans le navigateur de chaque appareil.

## 2. Passer en mode connecté
1. Créer un projet Supabase (région la plus proche des Émirats disponible).
2. `supabase link --project-ref <ref>` puis `supabase db push` (applique `migrations/001_init.sql`), puis exécuter `seed.sql`.
3. Créer les comptes du personnel dans Auth, puis insérer une ligne par personne dans `staff` (rôle `stylist` ou `manager`).
4. Activer les promotions voulues dans la table `promotions` (elles sont créées désactivées).
5. Dans `qamar/assets/config.js` : `backend: 'supabase'`, `supabaseUrl`, `supabaseAnonKey` (clé **anon** uniquement), `siteUrl`.
6. Ajouter dans chaque page, avant `store.js` :
   `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>` et `<script src="assets/backend-supabase.js"></script>`.
7. Brancher les pages sur `window.QAMAR_BACKEND`. L'interface est décrite en tête de `backend-supabase.js` : mêmes actions que la démo. **Ce branchement reste à faire et à tester** : la démo n'utilise pas encore le connecteur.

## 3. Paiements
1. Choisir un prestataire disponible aux Émirats et ouvrir le compte marchand (Apple Pay nécessite la validation du domaine).
2. Adapter `verifySignature()` et `parseEvent()` dans `supabase/functions/payment-webhook/index.ts` selon sa documentation officielle.
3. `supabase secrets set PAYMENT_WEBHOOK_SECRET=…` puis `supabase functions deploy payment-webhook --no-verify-jwt`, et déclarer l'URL du webhook chez le prestataire.

## 4. WhatsApp
1. Compte WhatsApp Business Platform (Meta), numéro dédié, modèles `qamar_queue_joined`, `qamar_queue_almost`, `qamar_queue_called` approuvés.
2. `supabase secrets set WHATSAPP_TOKEN=… WHATSAPP_PHONE_ID=…` puis `supabase functions deploy whatsapp-notify`.
3. Créer un Database Webhook sur `tickets` (UPDATE et INSERT) vers la fonction.

## 5. SEO, à faire quand le domaine est confirmé
- `siteUrl` dans `config.js`, balise `<link rel="canonical">`, `sitemap.xml`, ligne `Sitemap:` dans `robots.txt`.
- Compléter les données structurées (adresse, téléphone, URL) **seulement une fois confirmées**.
- Ajouter les vraies photos (WebP, dimensions explicites, `loading="lazy"`), et une image de partage 1200×630.
