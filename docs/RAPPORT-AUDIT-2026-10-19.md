# QAMAR — Rapport d'audit et d'amélioration (19/10/2026)

Mission : audit intégral, corrections, SEO international et local, conversion, accessibilité, sécurité et préparation à la production — en conservant l'identité visuelle (rose pâle, or, arches, verre dépoli, sakura, rubans de satin) et HTML/CSS/JS natif.

## 1. Résumé exécutif
**État initial.** Un site vitrine soigné et un système de salon complet en **mode démonstration** (données dans le navigateur). Fondations solides (moteur à états, règles centralisées, échappement XSS, CSV protégé, schéma Supabase avec RLS). Mais plusieurs affichages **promettaient des choses fausses** (WhatsApp vers un numéro fictif, formulaire de concours qui jetait les données en affichant « vous êtes en lice », page cliente annonçant des messages WhatsApp jamais envoyés, prix « TTC » sans régime fiscal confirmé), et le SEO était minimal (pas de canonical, pas de hreflang, pas de sitemap, arabe non indexable car injecté en JavaScript).

**Risques principaux traités.** Honnêteté de la démo (P0/P1), fuite de messages vers un inconnu (numéro fictif), configuration pouvant faire passer la démo pour réelle, courses et abus côté serveur (préparé), SEO arabe inexistant, contrastes insuffisants.

**Niveau réel de préparation.** Site public : **prêt pour une préouverture honnête**. Production commerciale : **non prête** — elle dépend d'un local, d'un backend déployé, d'un prestataire de paiement, d'un compte WhatsApp Business, de validations juridiques et fiscales (voir §7 et `MISE-EN-PRODUCTION.md`).

## 2. Audit initial (problèmes vérifiés sauf mention « hypothèse »)
| Gravité | Fichier / page | Problème observé | Conséquence | Correction |
|---|---|---|---|---|
| P0 | `index.html`, `data.js` | Tous les liens WhatsApp pointaient vers +971 50 000 0000 (fictif) | Messages de clientes envoyés à un inconnu potentiel | ✅ Numéro vide = aucun lien ; `Q.waLink()` central |
| P0 | `index.html` (concours) | Données jetées, toast « your name is in the running » | Fausse promesse, collecte sans destination | ✅ Formulaire fermé tant que WhatsApp n'est pas actif, puis message préparé envoyé par la cliente |
| P0 | `store.js`, `config.js` | `backend: 'supabase'` suffisait à retirer le mot « démo » alors que tout restait dans le navigateur | Paiements simulés présentés comme réels | ✅ Démo tant que le connecteur n'est pas prêt + erreurs de configuration explicites |
| P1 | `queue.html` | « We'll WhatsApp you » alors qu'aucun envoi n'existe ; aucune mention « aperçu » à l'arrivée | Fausse attente des clientes | ✅ Textes conditionnés à `whatsapp.connected` + bandeau d'aperçu |
| P1 | `index.html`, `legal.html` | « Prices incl. VAT » sans régime confirmé | Affirmation fiscale non vérifiée | ✅ « TVA à confirmer » (EN/AR) |
| P1 | SEO global | Pas de canonical, hreflang, sitemap ; og:image relative et carrée ; JSON-LD avec horaires non confirmés | Indexation et partage dégradés, données non vérifiées | ✅ Voir §4 |
| P1 | Arabe | Texte arabe injecté uniquement en JavaScript sur la même URL | Version arabe peu indexable | ✅ `ar.html` générée au build |
| P1 | `supabase` (hypothèse : non déployé, non exécuté) | Course entre inscriptions (dépassement des 30 places −70 %, doublon de numéro) ; options insérables par toute coiffeuse avec un prix libre ; `amount_due` lisible par tout compte connecté ; pourboire non plafonné dans le webhook | Abus possibles en production | ✅ `002_hardening.sql` + plafond dans le webhook (non exécutés) |
| P2 | Accessibilité | Rose foncé et gris-rose < 4,5:1 sur petits textes ; pas de lien d'évitement ni de `<main>` ; changements de ticket non annoncés | Lisibilité, lecteurs d'écran | ✅ Couleurs foncées, skip link, `<main>`, annonce `aria-live` |
| P2 | Contenu | Pas de FAQ | Questions sans réponse, SEO | ✅ 9 questions EN + AR, réponses honnêtes |
| P2 | Performance | 4 familles de polices Google dont 2 inutilisées | Téléchargements inutiles | ✅ Amiri et Jost retirés |
| P2 | CI | Tests uniquement dans le navigateur, publication sans contrôle | Régressions publiables | ✅ Tests en Node + build bloquant avant publication |
| P2 | `index.html` (hypothèse) | Grille des looks et prix rendus en JavaScript | Moins robuste pour l'indexation | ⏳ Rendu au build recommandé (§7) |
| P3 | CSS | `.wa-fab` restait visible avec `hidden` | Bouton vers rien | ✅ `[hidden]` global |
| P3 | Mobile RTL ≤ 420 px | Bouton « انضمي للطابور » chevauchait le mot QAMAR | Visuel cassé | ✅ |

## 3. Modifications réalisées
| Fichiers | Amélioration | Résultat / test |
|---|---|---|
| `assets/data.js` | `whatsapp` vide par défaut ; drapeaux `hoursConfirmed`, `instagramConfirmed`, `phoneConfirmed`, `address` | Aucune info non confirmée publiée |
| `assets/store.js` | `Q.waLink`, garde de mode démo, `configError`, sélecteur de langue navigant entre `/` et `ar.html`, `aria-pressed` | Tests « no WhatsApp link », « stays in demo », « production error » |
| `assets/config.js` | `environment`, `analytics` désactivé | Test « analytics off » |
| `index.html` | Titre/description/OG, JSON-LD vérifié, FAQ, liens WhatsApp conditionnels, formulaires honnêtes, TVA, contrastes, skip link, `<main>`, polices, attributs de mesure | Vérifié en local et en ligne (EN, AR, 375 px, desktop) |
| `queue.html` | Bandeau d'aperçu, textes WhatsApp conditionnels, annonce vocale, titre/description, `noindex` | Parcours complet testé : file → appel → service → paiement simulé → avis |
| `legal.html`, `privacy.html` | Titres, TVA | — |
| `assets/track.js` (nouveau) | Mesure GA4 désactivée, consentement obligatoire, aucune donnée personnelle | Ne charge rien par défaut |
| `assets/og-qamar.png` (nouveau) | Image de partage 1200×630 aux couleurs de la marque | HTTP 200 en ligne |
| `tests/engine-tests.js` (nouveau) | 42 tests (26 → 42) partagés navigateur + CI | 42/42 |
| `scripts/run-tests.mjs`, `lib.mjs`, `build-site.mjs` (nouveaux) | Contrôle avant publication ; build `_site/` avec `ar.html`, canonical, hreflang, sitemap, robots, JSON-LD | CI : 61/61 |
| `.github/workflows/site.yml` (nouveau), `apps.yml` | Publication seulement si les tests passent ; tests avant les apps | Exécuté avec succès |
| `supabase/migrations/002_hardening.sql`, `payment-webhook` | Durcissement serveur | **Non exécuté** (pas de projet Supabase) |
| `docs/*` | Stratégie SEO, Google Business Profile, analytics, mise en production, ce rapport | — |

## 4. SEO
- **Technique :** titres et descriptions uniques ; `canonical` absolu ; `hreflang` en/ar/x-default réciproques (HTML + sitemap) ; `sitemap.xml` ; `robots.txt` ; Open Graph complet ; `HairSalon` JSON-LD sans données non confirmées ; pages internes en `noindex` ; FAQ visible.
- **Architecture linguistique :** `/` (anglais) et `ar.html` (arabe, texte dans le HTML initial, `lang="ar" dir="rtl"`). Le sélecteur ouvre la page équivalente en gardant la section (`#faq`) ; dans l'app native et sur les autres pages, la langue change sur place.
- **Ouvert :** domaine définitif (la limite `github.io` empêche notamment la prise en compte du `robots.txt`), Search Console, rendu au build des looks/prix, relecture native de l'arabe, contenus et photos réels.
- **Stratégie de mots-clés et plan de contenu :** `SEO-STRATEGIE.md`. **Aucun volume ni classement n'a été mesuré.**

## 5. Sécurité
- **Vérifié et corrigé :** liens vers numéro fictif ; démo pouvant se faire passer pour réelle ; collecte de données sans destination ; mesure d'audience sans consentement impossible par conception.
- **Préparé (non exécuté) :** verrou avant promotion et ticket actif, options via RPC avec prix du catalogue, `amount_due` réservé au personnel et au webhook, plafond des pourboires (contrainte SQL + webhook).
- **Déjà présents et revérifiés par les tests :** échappement des noms, CSV neutralisé (`= + - @`, tabulation, retour chariot), noms publics « prénom + initiale », un ticket actif par numéro, transitions d'état strictes, appels refusés hors pointage, blocage après 5 PIN faux.
- **Risques résiduels :** PIN de démonstration dans le code public (inévitable en démo, interdits en production) ; pas d'en-têtes de sécurité sur GitHub Pages ; pas d'anti-robot sur l'inscription ; `backend-supabase.js` jamais testé contre un vrai projet.

## 6. Tests
| Commande / vérification | Résultat |
|---|---|
| `tests.html` (navigateur, avant) | 26/26 |
| `tests.html` (navigateur, après) | **42/42** |
| `node scripts/run-tests.mjs` (GitHub Actions) | **61/61** (42 moteur + traductions EN/AR, clés i18n, page arabe, liens internes de 8 pages, lieux interdits, numéro fictif, secrets, noindex, titres/descriptions, JSON-LD) |
| Build + déploiement GitHub Pages | Réussi ; `/`, `ar.html`, `sitemap.xml`, `robots.txt`, image OG : HTTP 200 |
| Vérifications manuelles (navigateur intégré) | Accueil EN/AR, menu mobile, bascule de langue en ligne, FAQ, formulaires fermés, parcours cliente démo complet, annonces vocales, débordement horizontal = 0 à 375 px, contrastes recalculés |
| Mesures (laboratoire, onglet en arrière-plan) | 12 requêtes, HTML 128 Ko, JS 146 Ko, CLS 0. **LCP et INP non mesurables de façon fiable** dans cet environnement : à mesurer avec PageSpeed Insights sur le domaine définitif |
| Non exécuté | SQL Supabase et fonctions Edge (aucun projet), tests sur vrais appareils iOS/Android, lecteur d'écran réel (VoiceOver/TalkBack), relecture arabe par une locutrice |

## 7. Actions restantes
| Priorité | Action | Dépend de |
|---|---|---|
| P0 | Ne pas ouvrir la file au public avant le backend réel (sinon les tickets n'arrivent pas au salon) | Propriétaire + prestataire technique |
| P0 | Supprimer les PIN de démo, comptes du personnel Supabase Auth | Backend |
| P1 | Acheter le domaine, migrer (Cloudflare Pages recommandé pour les en-têtes de sécurité), Search Console | Propriétaire |
| P1 | Adresse, horaires, prix, TVA, numéro WhatsApp confirmés dans `data.js` | Décision commerciale, comptable |
| P1 | Déployer Supabase (préprod puis prod) avec `001` + `002`, tests RLS, anti-robot, sauvegardes | Compte externe |
| P1 | Prestataire de paiement + webhook adapté + tests de paiement | Décision commerciale, prestataire |
| P1 | Validation juridique : confidentialité, mentions, promotions, concours, consentement | Juriste EAU |
| P2 | Fiche Google Business Profile ~90 jours avant l'ouverture, avis honnêtes | Ouverture réelle |
| P2 | Rendu au build de la grille des looks et de la carte des prix | Technique |
| P2 | Relecture native de l'arabe (site, FAQ, méta) et ajout de « استشوار » | Locutrice |
| P2 | Vraies photos (salon, équipe, résultats) | Ouverture réelle |
| P2 | Bandeau de consentement puis GA4 | Juriste + propriétaire |
| P3 | Minification au build, pages services et guide beauté après l'ouverture | Technique, contenu |

## 8. Mise en production
Checklist complète : `MISE-EN-PRODUCTION.md` (domaine, DNS, hébergement, backend, secrets, authentification, paiements, WhatsApp, horaires, adresse, téléphone, prix, mentions, confidentialité, Search Console, analytics, Google Business Profile, sauvegardes, tests finaux).

## 9. Résultat commercial attendu (bénéfices attendus, non mesurés)
1. **Visibilité organique :** page arabe réellement indexable + hreflang = accès aux recherches arabophones, un public peu servi par des sites bilingues bien faits ; le domaine définitif et la fiche Google auront le plus gros impact local (« blow dry near me » se joue sur Google Maps).
2. **Confiance et conversion :** une préouverture honnête (pas de faux lien, pas de fausse promesse) évite des avis négatifs dès l'ouverture ; la FAQ lève les freins (rendez-vous, durée, prix, paiement, adresse).
3. **Contacts :** dès que le numéro WhatsApp est renseigné, tous les liens et formulaires s'activent sans modification de code.
4. **Fidélisation :** fondations en place (règle d'une seule remise testée, garantie limitée à l'express, pourboires plafonnés) ; programmes (carte, abonnement, parrainage) à automatiser côté serveur après validation des conditions.
5. **Mesure :** événements prêts ; aucune donnée tant que le consentement et GA4 ne sont pas validés.
