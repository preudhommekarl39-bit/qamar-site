/* QAMAR — configuration publique.
   Ce fichier est servi au navigateur : n'y mettez JAMAIS de secret (clé service_role, clé de paiement, token WhatsApp).
   - backend: 'demo'      → tout tourne dans ce navigateur (localStorage), aucune donnée ne quitte l'appareil.
   - backend: 'supabase'  → nécessite supabaseUrl + supabaseAnonKey (clé publique « anon ») et les politiques RLS
                            de supabase/migrations appliquées. Voir DEPLOY.md. */
window.QAMAR_CONFIG = {
  environment: 'demo',    // 'demo' | 'staging' | 'production' — en 'production', le mode démo est signalé comme une erreur
  phase: 'preopening',    // 'preopening' (salon pas encore ouvert : textes « aperçu », horaires « prévus ») | 'open' (salon ouvert, infos confirmées)
  backend: 'demo',
  supabaseUrl: 'https://seexwsitmwqfzuejskej.supabase.co', // projet « qamar » (sert au journal dès maintenant ; la file d'attente reste en démo tant que backend = 'demo')
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlZXh3c2l0bXdxZnp1ZWpza2VqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ1Njk1NzQsImV4cCI6MjExMDE0NTU3NH0.XQxsYqosgFhcpOL5C2uXxkY2SJX_kdQM133I7bwu1eY',    // clé publique « anon » (Supabase → Project Settings → API) : à coller ici, elle est faite pour être publique. JAMAIS la clé service_role.
  siteUrl: 'https://qamarlounge.com/',            // URL définitive (ex. https://qamar.ae) — sert aux balises canoniques et au QR d'entrée
  timeZone: 'Asia/Dubai', // UTC+4, pas d'heure d'été
  payments: { provider: null },  // ex. 'network-international' | 'checkout' | 'stripe' — aucun n'est branché
  // Applications natives (Capacitor) : liens App Store / Google Play, vides tant que les apps ne sont pas publiées.
  // Dès qu'un lien est rempli, le QR du salon (go.html) propose « Ouvrir dans l'app QAMAR » sur ce téléphone, sans réimprimer le QR.
  appStore: { ios: '', android: '' },
  whatsapp: { connected: false }, // passe à true seulement quand l'API WhatsApp Business est réellement connectée
  // Mesure d'audience : désactivée tant que la propriété GA4 et le bandeau de consentement ne sont pas validés.
  // Les événements sont documentés dans docs/ANALYTICS.md ; assets/track.js ne charge rien si enabled = false.
  analytics: { enabled: false, ga4Id: '' }
};
