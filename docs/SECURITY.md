# QAMAR — Sécurité

## Principes
1. **Le navigateur n'est jamais cru sur parole.** Montants, remises, garanties, statuts et autorisations sont recalculés et vérifiés côté serveur (fonctions SQL `SECURITY DEFINER` + Row Level Security).
2. **Aucun secret dans le site.** Seule la clé publique `anon` de Supabase peut figurer dans `qamar/assets/config.js`. La clé `service_role`, les clés de paiement et le token WhatsApp vivent uniquement dans `supabase secrets`.
3. **Données minimales.** Prénom, numéro WhatsApp, visite. Pas de carte bancaire. L'écran public affiche prénom + initiale uniquement.

## Rôles (mode connecté)
| Rôle | Peut | Ne peut pas |
|---|---|---|
| Cliente (anonyme) | s'inscrire (`join_queue`), suivre SON ticket avec son `access_token` (`my_ticket_live`, téléphone masqué), l'annuler, ajouter une boisson, laisser un avis après paiement ; lire la file anonyme (`queue_public` : numéro, look, statut) | lire les tables (droits retirés), les autres tickets, des noms ou téléphones, modifier un prix |
| Compte « poste » (`station`, 009) | lire la file du jour (tablette), ouvrir une session de poste avec le PIN d'une coiffeuse | agir seul sur un ticket, back-office, PIN, caisse |
| Coiffeuse | se pointer (PIN sur la tablette), appeler la prochaine cliente éligible, faire avancer SES tickets, encaisser au poste (espèces, terminal) | retirer une cliente de la file, agir sur la cliente d'une autre, voir les pointages et montants des autres, la caisse |
| Gérante (`manager`) | tout lire, gérer catalogue, prix, codes promo, demandes (événements, Club), statut du salon | modifier l'équipe ou les rôles (lecture seule), le journal ; contourner les contraintes (double appel, double pointage) |
| Propriétaire (`owner`, 007) | tout ce que fait la gérante + équipe (invitation, rôle, désactivation), journal, suppression de demandes | retirer la dernière propriétaire active |

Back-office `office.html` (migration 007) : écritures du personnel par RLS ou fonctions `SECURITY DEFINER` vérifiant le rôle, chaque changement
tracé dans `audit_logs` (avant / après). Les invitations passent par la fonction Edge `invite-staff` (seul endroit où la clé secrète existe,
fournie par Supabase) qui vérifie que l'appelante est `owner`. La démo locale (`#local-demo`) ne se charge que sur localhost.

## Authentification du personnel
- Supabase Auth (e-mail + mot de passe fort, ou lien magique) sur les tablettes. Sessions persistantes par appareil, déconnexion = fin de pointage.
- Les PIN à 4 chiffres de la démo ne doivent **pas** être réutilisés en production. S'ils sont conservés pour la rapidité, ils doivent être vérifiés par une fonction serveur avec limitation de tentatives, jamais stockés dans le JS.

## File réelle (migration 009)
- **Ticket = lien porteur.** `queue.html?t=<id>.<jeton>` (jeton UUID v4, 122 bits) suffit à suivre le ticket : c'est ce qui permet la reprise sur
  un autre appareil. Ce lien ne montre que le prénom, le look et le statut ; le téléphone est masqué (4 derniers chiffres). Le jeton n'est jamais
  publié (temps réel, écran d'entrée) et ne quitte l'appareil que si la cliente partage son lien.
- **Temps réel sans données personnelles.** Seules `queue_public`, `staff_public` et `salon_status` sont publiées ; une page qui reçoit un
  événement relit ce qui la concerne par une fonction contrôlée. `tickets`, `shifts` et `payments` ne sont plus publiées.
- **PIN de la tablette.** 4 chiffres (refus de 1111, 1234, 4321…), hash bcrypt dans `staff_pins` (aucune politique : illisible par tous, y compris
  la propriétaire), comparaison dans `station_unlock` uniquement. Freins : 5 échecs par coiffeuse en 5 min, 20 échecs par tablette en 15 min
  (les échecs sont enregistrés même en cas d'erreur : la fonction ne lève pas d'exception sur un mauvais PIN). La session de poste (14 h) est
  stockée en sha256 et n'est valable que depuis le compte « poste » qui l'a ouverte ; nouveau PIN ou dépointage = sessions fermées.
- **Encaissement au poste.** Sans prestataire en ligne, la coiffeuse enregistre espèces ou carte / Apple Pay validés sur le terminal du salon
  (`q_record_payment`) : montant recalculé par le serveur, pourboire plafonné, un seul paiement par ticket, trace dans `audit_logs`. La caisse
  du jour (`cash_closings`) compare ces totaux aux montants comptés par la gérante. Les PIN de démo de `data.js` restent refusés en production.
- **Anti-abus inscription.** 3 tickets par numéro et par jour (002/005), 60 tickets en attente au total, 20 inscriptions en 2 minutes. Une
  protection anti-robot (Turnstile) reste à ajouter si des faux tickets apparaissent.

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
