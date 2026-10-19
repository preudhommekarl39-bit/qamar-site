/* QAMAR — configuration publique.
   Ce fichier est servi au navigateur : n'y mettez JAMAIS de secret (clé service_role, clé de paiement, token WhatsApp).
   - backend: 'demo'      → tout tourne dans ce navigateur (localStorage), aucune donnée ne quitte l'appareil.
   - backend: 'supabase'  → nécessite supabaseUrl + supabaseAnonKey (clé publique « anon ») et les politiques RLS
                            de supabase/migrations appliquées. Voir DEPLOY.md. */
window.QAMAR_CONFIG = {
  environment: 'demo',    // 'demo' | 'staging' | 'production' — en 'production', le mode démo est signalé comme une erreur
  phase: 'preopening',    // 'preopening' (salon pas encore ouvert : textes « aperçu », horaires « prévus ») | 'open' (salon ouvert, infos confirmées)
  backend: 'demo',
  supabaseUrl: '',
  supabaseAnonKey: '',
  siteUrl: 'https://qamarlounge.com/',            // URL définitive (ex. https://qamar.ae) — sert aux balises canoniques et au QR d'entrée
  timeZone: 'Asia/Dubai', // UTC+4, pas d'heure d'été
  payments: { provider: null },  // ex. 'network-international' | 'checkout' | 'stripe' — aucun n'est branché
  whatsapp: { connected: false }, // passe à true seulement quand l'API WhatsApp Business est réellement connectée
  // Mesure d'audience : désactivée tant que la propriété GA4 et le bandeau de consentement ne sont pas validés.
  // Les événements sont documentés dans docs/ANALYTICS.md ; assets/track.js ne charge rien si enabled = false.
  analytics: { enabled: false, ga4Id: '' }
};
