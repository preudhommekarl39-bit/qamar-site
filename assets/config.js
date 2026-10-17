/* QAMAR — configuration publique.
   Ce fichier est servi au navigateur : n'y mettez JAMAIS de secret (clé service_role, clé de paiement, token WhatsApp).
   - backend: 'demo'      → tout tourne dans ce navigateur (localStorage), aucune donnée ne quitte l'appareil.
   - backend: 'supabase'  → nécessite supabaseUrl + supabaseAnonKey (clé publique « anon ») et les politiques RLS
                            de supabase/migrations appliquées. Voir DEPLOY.md. */
window.QAMAR_CONFIG = {
  backend: 'demo',
  supabaseUrl: '',
  supabaseAnonKey: '',
  siteUrl: '',            // URL définitive (ex. https://qamar.ae) — sert aux balises canoniques et au QR d'entrée
  timeZone: 'Asia/Dubai', // UTC+4, pas d'heure d'été
  payments: { provider: null },  // ex. 'network-international' | 'checkout' | 'stripe' — aucun n'est branché
  whatsapp: { connected: false } // passe à true seulement quand l'API WhatsApp Business est réellement connectée
};
