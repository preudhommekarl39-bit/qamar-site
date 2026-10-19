# QAMAR — Procédure de mise en production

Chaque étape indique **qui** doit agir. Ne pas passer `environment: 'production'` tant que les étapes 1 à 8 ne sont pas terminées : le site afficherait alors une erreur de configuration (voulu).

## 0. Décisions du propriétaire (bloquantes)
- [ ] Local signé → adresse exacte, horaires définitifs (`data.js → brand.hoursConfirmed = true`)
- [ ] Prix définitifs + régime de TVA (immatriculé ou non, prix TTC ou HT) — avec un expert-comptable aux EAU
- [ ] Prestataire de paiement (Network International, Checkout.com, Stripe…) et BNPL (Tabby, Tamara)
- [ ] Numéro WhatsApp Business (`data.js → brand.whatsapp`) et compte WhatsApp Business API (Meta)
- [ ] Root & Glow et Cut & Glow faisables en 45 min ? (sinon simplifier la prestation — la règle des 45 min ne change pas)
- [ ] Compte Instagram officiel confirmé (`brand.instagramConfirmed = true`)

## 1. Domaine et hébergement
- [ ] Vérifier la disponibilité puis acheter le domaine (ex. qamar.ae via un registraire accrédité .ae, ou un .com ; choisir selon la marque et la disponibilité — un .ae n'est pas automatiquement meilleur)
- [ ] Hébergement : GitHub Pages convient pour un site statique, mais ne permet pas d'envoyer des en-têtes de sécurité (CSP, HSTS…). Recommandé : **Cloudflare Pages** (gratuit, en-têtes via `_headers`, domaine personnalisé, HTTPS) ou Vercel (`vercel.json` déjà présent). Garder le même workflow de tests.
- [ ] DNS + HTTPS, redirection de l'ancienne URL GitHub Pages vers le domaine
- [ ] Changer `SITE_URL` dans `.github/workflows/site.yml` et `siteUrl` dans `assets/config.js`

## 2. Backend Supabase (préproduction puis production — deux projets séparés)
- [ ] Créer les projets, appliquer `supabase/migrations/001_init.sql` puis `002_hardening.sql` ; charger `supabase/seed.sql` (régénéré depuis `data.js`)
- [ ] Tester les politiques RLS avec un compte anonyme, une coiffeuse et la gérante (lecture/écriture refusées hors rôle)
- [ ] Comptes du personnel via Supabase Auth (e-mail + mot de passe ou lien magique), rôles `stylist` / `manager` ; **supprimer les PIN de démonstration**
- [ ] Protection anti-robot sur l'inscription à la file (ex. Cloudflare Turnstile) — la limite actuelle est de 3 tickets par numéro et par jour
- [ ] Sauvegardes automatiques (plan payant Supabase : point-in-time recovery) et test de restauration
- [ ] Brancher `assets/backend-supabase.js` (non testé à ce jour) et mettre `window.QAMAR_BACKEND_READY = true` seulement quand tout fonctionne
- [ ] Clé publique `anon` uniquement dans `config.js` ; `service_role`, clés de paiement et jeton WhatsApp uniquement dans `supabase secrets`

## 3. Paiements
- [ ] Adapter `verifySignature()` et `parseEvent()` du webhook au prestataire choisi (documentation officielle)
- [ ] Tester en mode test : paiement réussi, échoué, doublon, remboursement, montant modifié (doit être refusé), pourboire hors limites (refusé)
- [ ] Rapprochement quotidien des transactions (dashboard prestataire ↔ table `payments`)

## 4. WhatsApp
- [ ] Compte Meta Business vérifié, numéro, modèles de messages approuvés (EN + AR)
- [ ] Déployer `supabase/functions/whatsapp-notify`, puis `config.js → whatsapp.connected = true`

## 5. Juridique (à faire valider par un professionnel aux EAU)
- [ ] Mentions légales (licence, entité, adresse), politique de confidentialité (PDPL — décret-loi fédéral 45/2021, ou réglementation de la zone franche si applicable), conditions des promotions et du concours, abonnements et remboursements, consentement marketing
- [ ] Règlement du ticket doré / concours publié avant lancement

## 6. SEO et visibilité
- [ ] Search Console sur le domaine : déclarer `sitemap.xml`, vérifier l'indexation des pages EN et AR
- [ ] Fiche Google Business Profile (voir `GOOGLE-BUSINESS-PROFILE.md`), Apple Business Connect, Bing Places
- [ ] Vraies photos du salon et de l'équipe sur le site (remplacer les contenus provisoires)

## 7. Mesure d'audience (optionnel)
- [ ] Bandeau de consentement validé puis GA4 (voir `ANALYTICS.md`)

## 8. Applications mobiles
- [ ] Comptes Google Play Console (Organisation) et Apple Developer (Organisation), numéro D-U-N-S
- [ ] Clés de signature dans les secrets GitHub, builds signés, fiches des stores EN/AR, notifications natives « c'est ton tour »
- [ ] Publication uniquement après accord explicite du propriétaire

## 9. Tests finaux (la veille de l'ouverture)
- [ ] `node scripts/run-tests.mjs` vert + `tests.html` vert
- [ ] Parcours complet sur un vrai iPhone et un vrai Android (EN et AR) : inscription → appel → service → paiement réel de 1 AED en test → avis
- [ ] Postes coiffeuses et dashboard sur les vraies tablettes ; écran d'entrée sur la vraie TV
- [ ] `environment: 'production'` dans `config.js`, puis vérifier qu'aucune bannière d'erreur ne s'affiche
