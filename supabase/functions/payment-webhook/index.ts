// QAMAR — webhook de paiement (Supabase Edge Function, Deno).
// SEULE source de vérité pour marquer un paiement carte / Apple Pay / BNPL comme « confirmé ».
// Déploiement : supabase functions deploy payment-webhook --no-verify-jwt
// Secrets (jamais dans le code ni dans le site) : supabase secrets set PAYMENT_WEBHOOK_SECRET=... SUPABASE_SERVICE_ROLE_KEY=...
//
// ⚠ Gabarit générique : adaptez verifySignature() et parseEvent() au prestataire réellement choisi
// (Network International, Checkout.com, Stripe UAE, Tabby, Tamara…) en suivant SA documentation officielle.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const SECRET = Deno.env.get('PAYMENT_WEBHOOK_SECRET') ?? '';
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

async function verifySignature(raw: string, header: string | null): Promise<boolean> {
  if (!SECRET || !header) return false;
  // Exemple HMAC-SHA256 hexadécimal — à remplacer par le schéma exact du prestataire
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw));
  const hex = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
  // comparaison à temps constant
  if (hex.length !== header.length) return false;
  let diff = 0; for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

type PayEvent = { id: string; ticketId: string; status: 'confirmed' | 'failed' | 'refunded'; amount: number; tip: number; method: 'applepay' | 'card' | 'bnpl'; provider: string };
function parseEvent(body: any): PayEvent | null {
  // À adapter : correspondance entre le format du prestataire et notre modèle
  if (!body?.id || !body?.metadata?.ticket_id) return null;
  return { id: String(body.id), ticketId: String(body.metadata.ticket_id), status: body.status, amount: Number(body.amount) / 100, tip: Number(body.metadata.tip ?? 0) / 100, method: body.method ?? 'card', provider: body.provider ?? 'unknown' };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get('x-signature')))) return new Response('invalid signature', { status: 401 });
  let ev: PayEvent | null = null;
  try { ev = parseEvent(JSON.parse(raw)); } catch { /* corps invalide */ }
  if (!ev) return new Response('bad request', { status: 400 });

  // Idempotence : un même événement prestataire n'est traité qu'une fois
  const { data: existing } = await db.from('payments').select('id,status').eq('idempotency_key', ev.id).maybeSingle();
  if (existing && existing.status === ev.status) return new Response('ok (duplicate)', { status: 200 });

  // Le montant attendu est recalculé côté serveur ; un montant différent est rejeté
  const { data: due, error } = await db.rpc('amount_due', { p_ticket: ev.ticketId }).single();
  if (error || !due) return new Response('unknown ticket', { status: 404 });
  // Pourboire plafonné comme dans data.js (limits) : jamais négatif, 100 % du montant et 500 AED maximum
  if (!(ev.tip >= 0) || ev.tip > 500 || ev.tip > Number((due as any).total)) {
    await db.from('audit_logs').insert({ action: 'payment_tip_rejected', target: ev.ticketId, details: { tip: ev.tip } });
    return new Response('tip out of range', { status: 422 });
  }
  const expected = Number((due as any).total) + ev.tip;
  if (ev.status === 'confirmed' && Math.abs(expected - ev.amount) > 0.01) {
    await db.from('audit_logs').insert({ action: 'payment_amount_mismatch', target: ev.ticketId, details: { expected, received: ev.amount } });
    return new Response('amount mismatch', { status: 409 });
  }

  await db.from('payments').upsert({
    ticket_id: ev.ticketId, method: ev.method, status: ev.status, amount_aed: Number((due as any).total), discount_aed: Number((due as any).discount),
    tip_aed: ev.tip, provider: ev.provider, provider_ref: ev.id, idempotency_key: ev.id, confirmed_at: ev.status === 'confirmed' ? new Date().toISOString() : null
  }, { onConflict: 'idempotency_key' });
  if (ev.status === 'confirmed') await db.from('tickets').update({ status: 'paid' }).eq('id', ev.ticketId).eq('status', 'checkout');
  await db.from('audit_logs').insert({ action: `payment_${ev.status}`, target: ev.ticketId, details: { provider: ev.provider } });
  return new Response('ok', { status: 200 });
});
