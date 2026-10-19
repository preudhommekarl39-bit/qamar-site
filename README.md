# QAMAR — Blowdry Lounge · Dubaï

Site public, parcours cliente, écrans du salon et applications mobiles. HTML/CSS/JavaScript natif, sans framework, bilingue anglais/arabe.
**Site en ligne :** https://preudhommekarl39-bit.github.io/qamar-site/ (version arabe : `ar.html`, générée au build).

> ⚠ **Mode démonstration.** Aucun serveur n'est branché : les tickets restent dans le navigateur, aucun paiement réel, aucun message WhatsApp. Prix, horaires, adresse et équipe sont provisoires.

| Page | Rôle |
|---|---|
| `index.html` | Site public (anglais ; `ar.html` est produite par `scripts/build-site.mjs`) |
| `queue.html` | Parcours cliente : look, coiffeuse, ticket, options, paiement (simulé), avis |
| `entrance.html` | Écran d'entrée (QR, file — prénom + initiale uniquement) |
| `station.html#seat1…5` | Tablettes des coiffeuses (pointage, appel, chrono, encaissement) |
| `admin.html` | Dashboard gérante |
| `privacy.html`, `legal.html` | Brouillons à faire valider par un juriste aux Émirats |
| `tests.html` | Tests du moteur dans le navigateur (les mêmes que la CI) |

## Où est quoi
- `assets/data.js` — **source unique** : prestations, prix, promotions, garantie, limites, coordonnées et drapeaux de confirmation (numéro WhatsApp vide = aucun lien ; `hoursConfirmed`, `instagramConfirmed`, `teamConfirmed`, `address`).
- `assets/config.js` — environnement (`demo`/`staging`/`production`), backend, mesure d'audience (désactivée).
- `assets/store.js` — moteur de file, prix, paiements simulés, i18n.
- `tests/engine-tests.js` — tests des règles commerciales et du moteur.
- `scripts/run-tests.mjs` — contrôle avant publication · `scripts/build-site.mjs` — construit `_site/` (page arabe, canonical, hreflang, sitemap, robots, données structurées).
- `supabase/` — schéma, sécurité (RLS), fonctions et webhooks du futur mode connecté (**non déployé**).
- `docs/` — rapport d'audit, stratégie SEO, Google Business Profile, analytics, mise en production, sécurité.
- `.github/workflows/site.yml` — tests puis publication du site · `apps.yml` — applications Android/iPhone (Capacitor).

## Vérifier
Ouvrir `tests.html` dans un navigateur, ou `node scripts/run-tests.mjs` (Node ≥ 18).

Codes PIN de démonstration (jamais en production) : Layla 1111 · Noor 2222 · Sara 3333 · Mariam 4444 · Yasmin 5555.
