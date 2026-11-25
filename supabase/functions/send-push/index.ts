// QAMAR : notifications push de l'app (Supabase Edge Function, Deno). ÉBAUCHE DOCUMENTÉE, NON DÉPLOYÉE.
// Envoie « c'est votre tour » aux téléphones enregistrés pour un ticket (table push_tokens, migration 008).
// Déclenchement prévu : Database Webhook sur tickets (UPDATE), comme whatsapp-notify.
// iPhone : APNs directement (jeton APNs natif, clé .p8 « Apple Push Notifications service »).
// Android : Firebase Cloud Messaging HTTP v1 (compte de service Firebase).
// Secrets (supabase secrets set ...), jamais dans le dépôt :
//   APNS_KEY_P8 (contenu du .p8), APNS_KEY_ID, APPLE_TEAM_ID, APNS_TOPIC=com.qamarlounge.app, APNS_SANDBOX=1 (builds Xcode de debug seulement)
//   FCM_SERVICE_ACCOUNT_JSON (JSON du compte de service Firebase)
//   SUPABASE_SERVICE_ROLE_KEY (fourni par Supabase)
// Tant qu'une plateforme n'a pas ses secrets, ses jetons sont ignorés (statut not_configured) : AUCUN envoi n'est simulé.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const env = (k: string) => Deno.env.get(k) || '';
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const TEXT = {
  en: { title: 'QAMAR: your wait is over', body: (s: string) => `Go to seat ${s}` },
  ar: { title: 'قمر: انتهى انتظاركِ', body: (s: string) => `توجّهي إلى المقعد ${s}` }
};

const b64url = (b: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof b === 'string' ? new TextEncoder().encode(b) : new Uint8Array(b);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const pemToDer = (pem: string) => Uint8Array.from(atob(pem.replace(/-----[^-]+-----|\s/g, '')), c => c.charCodeAt(0));
async function jwt(header: object, claims: object, pem: string, alg: 'ES256' | 'RS256') {
  const key = await crypto.subtle.importKey('pkcs8', pemToDer(pem),
    alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const data = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign(alg === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : 'RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  return `${data}.${b64url(sig)}`; // ECDSA WebCrypto = r||s, le format attendu par ES256
}

// --- APNs (iPhone) ---
async function sendApns(token: string, title: string, body: string, ticketId: string) {
  if (!env('APNS_KEY_P8') || !env('APNS_KEY_ID') || !env('APPLE_TEAM_ID')) return 'not_configured';
  const auth = await jwt({ alg: 'ES256', kid: env('APNS_KEY_ID') }, { iss: env('APPLE_TEAM_ID'), iat: Math.floor(Date.now() / 1000) }, env('APNS_KEY_P8'), 'ES256');
  const host = env('APNS_SANDBOX') === '1' ? 'api.sandbox.push.apple.com' : 'api.push.apple.com';
  const res = await fetch(`https://${host}/3/device/${token}`, {
    method: 'POST',
    headers: { authorization: `bearer ${auth}`, 'apns-topic': env('APNS_TOPIC') || 'com.qamarlounge.app', 'apns-push-type': 'alert', 'apns-priority': '10' },
    body: JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, ticket: ticketId })
  });
  return res.ok ? 'sent' : res.status === 410 || res.status === 400 ? 'invalid' : 'failed';
}

// --- FCM HTTP v1 (Android) ---
let fcmCache: { token: string; exp: number } | null = null;
async function fcmAccessToken(sa: { client_email: string; private_key: string }) {
  if (fcmCache && fcmCache.exp > Date.now() + 60_000) return fcmCache.token;
  const now = Math.floor(Date.now() / 1000);
  const assertion = await jwt({ alg: 'RS256', typ: 'JWT' }, { iss: sa.client_email, scope: 'https://www.googleapis.com/auth/firebase.messaging', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }, sa.private_key, 'RS256');
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }) });
  const j = await r.json();
  fcmCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return fcmCache.token;
}
async function sendFcm(token: string, title: string, body: string, ticketId: string) {
  if (!env('FCM_SERVICE_ACCOUNT_JSON')) return 'not_configured';
  const sa = JSON.parse(env('FCM_SERVICE_ACCOUNT_JSON'));
  const res = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
    method: 'POST',
    headers: { authorization: `Bearer ${await fcmAccessToken(sa)}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message: { token, notification: { title, body }, data: { ticket: ticketId }, android: { priority: 'HIGH' } } })
  });
  return res.ok ? 'sent' : res.status === 404 ? 'invalid' : 'failed';
}

Deno.serve(async (req) => {
  // Appel réservé au webhook de la base (clé serveur dans l'en-tête Authorization)
  if (req.headers.get('authorization') !== `Bearer ${env('SUPABASE_SERVICE_ROLE_KEY')}`) return Response.json({ status: 'forbidden' }, { status: 401 });
  const { record, old_record } = await req.json().catch(() => ({}));
  if (!record?.id || record.status !== 'called' || old_record?.status === 'called') return Response.json({ status: 'ignored' });

  const { data: tokens } = await db.from('push_tokens').select('id, token, platform, lang').eq('ticket_id', record.id).gt('expires_at', new Date().toISOString());
  const out: Record<string, number> = {};
  for (const t of tokens ?? []) {
    const tx = TEXT[t.lang === 'ar' ? 'ar' : 'en'];
    const status = t.platform === 'ios'
      ? await sendApns(t.token, tx.title, tx.body(String(record.seat ?? '')), record.id)
      : await sendFcm(t.token, tx.title, tx.body(String(record.seat ?? '')), record.id);
    if (status === 'invalid') await db.from('push_tokens').delete().eq('id', t.id); // jeton périmé : effacé
    out[status] = (out[status] || 0) + 1;
  }
  // Aucun contenu ni jeton dans la réponse ou les journaux : seulement des compteurs
  return Response.json({ status: 'done', ...out });
});
