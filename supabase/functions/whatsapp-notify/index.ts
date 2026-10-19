// QAMAR — envoi des messages WhatsApp (Supabase Edge Function, Deno) via WhatsApp Business Cloud API (Meta).
// Déclenchée par un Database Webhook sur tickets (UPDATE) ou appelée par le personnel authentifié.
// Secrets : supabase secrets set WHATSAPP_TOKEN=... WHATSAPP_PHONE_ID=... SUPABASE_SERVICE_ROLE_KEY=...
//
// Règles plateforme : un message initié par l'entreprise hors fenêtre de 24 h exige un MODÈLE approuvé par Meta
// et le consentement de la cliente. Les noms de modèles ci-dessous sont des exemples à créer dans le Business Manager.
// Tant que WHATSAPP_TOKEN n'est pas défini, la fonction répond 'not_configured' : AUCUN envoi n'est simulé.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const TOKEN = Deno.env.get('WHATSAPP_TOKEN');
const PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID');
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const TEMPLATES: Record<string, string> = {
  joined: 'qamar_queue_joined',      // « Vous êtes n°{1}, attente estimée {2} min »
  almost: 'qamar_queue_almost',      // « Plus que {1} personne(s) avant vous »
  called: 'qamar_queue_called'       // « C'est votre tour : siège {1} avec {2} »
};

Deno.serve(async (req) => {
  if (!TOKEN || !PHONE_ID) return Response.json({ status: 'not_configured' }, { status: 503 });
  const { record, old_record } = await req.json().catch(() => ({}));
  if (!record?.id || !record?.client_phone) return Response.json({ status: 'ignored' });

  let kind: string | null = null, params: string[] = [];
  if (record.status === 'called' && old_record?.status !== 'called') {
    const { data: st } = await db.from('staff').select('display_name').eq('id', record.assigned_staff).maybeSingle();
    kind = 'called'; params = [String(record.seat ?? ''), st?.display_name ?? 'QAMAR'];
  } else if (record.status === 'waiting' && !old_record) {
    kind = 'joined'; params = [String(record.num), '—'];
  }
  if (!kind) return Response.json({ status: 'ignored' });

  // Anti-doublon : un message par ticket et par type (contrainte unique sur message_log)
  const { error: dup } = await db.from('message_log').insert({ ticket_id: record.id, template: kind, status: 'queued' });
  if (dup) return Response.json({ status: 'duplicate' });

  const res = await fetch(`https://graph.facebook.com/v20.0/${PHONE_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp', to: record.client_phone.replace('+', ''), type: 'template',
      template: { name: TEMPLATES[kind], language: { code: 'en' }, components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }] }
    })
  });
  const out = await res.json().catch(() => ({}));
  // On journalise le statut et l'identifiant du message, jamais son contenu ni le numéro
  await db.from('message_log').update({ status: res.ok ? 'sent' : 'failed', provider_id: out?.messages?.[0]?.id ?? null }).eq('ticket_id', record.id).eq('template', kind);
  return Response.json({ status: res.ok ? 'sent' : 'failed' }, { status: res.ok ? 200 : 502 });
});
