# QAMAR — Sécurité

## Principes
1. **Le navigateur n'est jamais cru sur parole.** Montants, remises, garanties, statuts et autorisations sont recalculés et vérifiés côté serveur (fonctions SQL `SECURITY DEFINER` + Row Level Security).
2. **Aucun secret dans le site.** Seule la clé publique `anon` de Supabase peut figurer dans `qamar/assets/config.js`. La clé `service_role`, les clés de paiement et le token WhatsApp vivent uniquement dans `supabase secrets`.
3. **Données minimales.** Prénom, numéro WhatsApp, visite. Pas de carte bancaire. L'écran public affiche prénom + initiale uniquement.

## Rôles (mode connecté)
| Rôle | Peut | Ne peut pas |
|---|---|---|
| Cliente (anonyme) | s'inscrire (`join_queue`), suivre SON ticket avec son `access_token`, l'annuler, laisser un avis après paiement | lire les autres tickets, voir des téléphones, modifier un prix |
| Coiffeuse | se pointer, appeler la prochaine cliente éligible, faire avancer SES tickets, confirmer un paiement en espèces | voir les pointages des autres, le CA global, exporter |
| Gérante | tout lire, gérer catalogue, promotions et personnel, exports | contourner les contraintes (double appel, double pointage) |

## Authentification du personnel
- Supabase Auth (e-mail + mot de passe fort, ou lien magique) sur les tablettes. Sessions persistantes par appareil, déconnexion = fin de pointage.
- Les PIN à 4 chiffres de la démo ne doivent **pas** être réutilisés en production. S'ils sont conservés pour la rapidité, ils doivent être vérifiés par une fonction serveur avec limitation de tentatives, jamais stockés dans le JS.

## Paiements
- Flux officiels du prestataire uniquement. Statut « payé » posé **par le webhook** (`supabase/functions/payment-webhook`) après vérification de signature, contrôle du montant recalculé et idempotence (`idempotency_key`).
- Aucun numéro de carte ni CVV ne transite par nos serveurs.

## WhatsApp
- Modèles approuvés par Meta, consentement de la cliente, un message par ticket et par type (contrainte unique), journal de statut sans contenu ni numéro.

## Protection côté navigateur
- Sorties échappées (`Q.esc`, `textContent`). Entrées nettoyées et limitées. Exports CSV neutralisés contre l'injection de formules.
- En-têtes HTTP dans `qamar/_headers` : CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy, noindex sur les écrans du personnel.

## Signaler une faille
Écrire à l'adresse de contact technique (à définir) — ne pas publier de détails avant correction.
