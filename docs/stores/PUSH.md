# Notifications push (désactivées)

Aujourd'hui l'app utilise seulement des **notifications locales** (créées par le téléphone lui-même) :
« c'est votre tour » quand le ticket passe à « appelé » pendant que l'app tourne, rappel « bientôt votre tour » programmé quand
l'app passe en arrière-plan, et rappel choisi par la cliente sur l'accueil. Aucun compte Apple ou Google n'est nécessaire pour cela.

Le **push distant** (alerte même app fermée, envoyée par le serveur) est préparé mais coupé :

| Pièce | Fichier | État |
| --- | --- | --- |
| Interrupteur | `assets/config.js` → `push: { enabled: false }` | coupé |
| Code de l'app | `assets/native.js` → `registerPush()` (s'active seulement si `push.enabled`, `backend = 'supabase'` et ticket serveur avec jeton d'accès) | prêt |
| Base | `supabase/migrations/008_push_tokens.sql` (table `push_tokens`, RLS sans politique, RPC `register_push_token` qui vérifie le jeton d'accès du ticket) | **non appliquée** |
| Envoi | `supabase/functions/send-push/` (APNs pour iPhone, FCM HTTP v1 pour Android) | **non déployée** |
| Projet natif | `QAMAR_PUSH=1` pour `scripts/patch-native.mjs` (capacité Push iOS + AppDelegate), secret `GOOGLE_SERVICES_JSON_BASE64` pour Android | à activer |

## Pour l'activer (phase 2, après l'ouverture et les comptes)

1. File d'attente sur Supabase (`backend: 'supabase'`, phase 2) : sans ticket serveur, rien à notifier.
2. Apple : Certificates, IDs & Profiles → Keys → nouvelle clé « Apple Push Notifications service (APNs) ». Garder le fichier .p8 (téléchargeable une seule fois).
3. Firebase (gratuit) : créer un projet, ajouter l'app Android `com.qamarlounge.app`, télécharger `google-services.json`, et créer un compte de service (rôle « Firebase Cloud Messaging API Admin ») → fichier JSON.
4. Secrets GitHub : `GOOGLE_SERVICES_JSON_BASE64` (contenu de google-services.json encodé en base64). Dans le workflow de release, ajouter `QAMAR_PUSH: '1'` aux variables d'environnement de l'étape « Projet iOS ».
5. Secrets Supabase (`supabase secrets set`) : `APNS_KEY_P8`, `APNS_KEY_ID`, `APPLE_TEAM_ID`, `APNS_TOPIC=com.qamarlounge.app`, `FCM_SERVICE_ACCOUNT_JSON`.
6. Appliquer la migration 008, déployer `send-push`, créer le Database Webhook (tickets, UPDATE) vers la fonction avec l'en-tête `Authorization: Bearer <clé service>`, et planifier `select purge_push_tokens();` toutes les heures (pg_cron).
7. Passer `push.enabled` à `true`, mettre à jour les fiches « confidentialité » (Device ID, voir REVIEW-AND-PRIVACY.md), publier une nouvelle version.

Important : sur Android, appeler l'enregistrement push sans `google-services.json` fait planter l'app. C'est pour cela que tout reste coupé
tant que l'étape 3 n'est pas faite.
