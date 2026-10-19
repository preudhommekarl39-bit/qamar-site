# QAMAR — Mesure d'audience

**État : désactivée.** `assets/config.js → analytics.enabled = false`, aucun identifiant. `assets/track.js` ne charge rien et n'envoie rien.

## Activer (après décision du propriétaire)
1. Créer une propriété GA4 pour le domaine définitif, récupérer l'identifiant `G-XXXXXXX`.
2. Mettre en place un **bandeau de consentement** (accepter / refuser, aussi simple l'un que l'autre) qui écrit `localStorage['qamar:consent'] = 'granted'` uniquement en cas d'accord. Faire valider le texte par un juriste (loi fédérale EAU sur les données personnelles, PDPL — décret-loi 45/2021).
3. Ajouter `https://www.googletagmanager.com` et `https://*.google-analytics.com` à la politique de sécurité (CSP) de l'hébergeur.
4. `analytics: { enabled: true, ga4Id: 'G-XXXXXXX' }` puis vérifier dans GA4 → DebugView.

## Événements (aucune donnée personnelle)
| Événement | Déclencheur | Paramètres |
|---|---|---|
| `join_queue_click` | Bouton « Join the queue » | `location` : hero_nav, top_bar, mobile_menu |
| `whatsapp_click` | Lien WhatsApp (seulement si un vrai numéro est configuré) | `location` : contact, floating, mobile_menu |
| `join_queue` | Ticket créé dans `queue.html` | `service`, `stylist_choice` (first_free/chosen), `demo` |
| (auto) `page_language` | Ajouté à chaque événement | en / ar |

Un clic = un événement (délégation unique sur `[data-track]`). Jamais de prénom, de téléphone, de numéro de ticket ni d'identifiant de cliente.

Google Search Console n'a pas besoin de consentement (aucun traceur sur le site) : à configurer dès l'achat du domaine. Google Tag Manager n'est pas nécessaire à ce stade.
