# QAMAR — Blowdry Lounge · Dubaï (site + système du salon)

Site statique (HTML/CSS/JS, sans framework), bilingue anglais/arabe, prêt pour Cloudflare Pages.

| Page | Rôle |
|---|---|
| `index.html` | Site vitrine |
| `queue.html` | Parcours cliente après scan du QR (look, coiffeuse, ticket, options, paiement, avis) |
| `entrance.html` | Écran d'accueil (QR, attente, appels, postes — prénom + initiale uniquement) |
| `station.html#seat1…5` | Tablettes des coiffeuses (pointage, appel, chrono, encaissement) |
| `admin.html` | Dashboard gérante (direct, file, équipe, historique filtrable, exports CSV sûrs) |
| `privacy.html`, `legal.html` | Brouillons à valider juridiquement |
| `tests.html` | 26 tests automatiques du moteur |

- **Mode démo par défaut** (`assets/config.js`) : données dans le navigateur, aucun paiement ni message réel.
- **Règles commerciales** : une seule source, `assets/data.js → promotions` (lancement, Happy Hours, garantie, plafonds).
- **Mode connecté** : `../supabase/` (schéma, RLS, fonctions, webhooks) et `../DEPLOY.md`. À lire aussi : `../AUDIT.md`, `../SECURITY.md`.

Codes PIN de démo (test uniquement) : Layla 1111 · Noor 2222 · Sara 3333 · Mariam 4444 · Yasmin 5555.
