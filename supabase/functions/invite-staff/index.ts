// QAMAR : invitation d'un membre de l'équipe (Supabase Edge Function, Deno). Appelée par office.html → Team → Invite.
// La clé secrète du projet n'existe QUE ici (variable fournie automatiquement par Supabase aux fonctions Edge) : jamais dans le site.
// 1. vérifie le jeton (JWT) de l'appelant : il doit être une propriétaire active (staff.role = 'owner') ;
// 2. envoie l'e-mail d'invitation Supabase (auth.admin.inviteUserByEmail), lien de retour = page du back-office ;
// 3. crée la ligne staff (rôle choisi, active) et écrit le journal d'activité.
// Déploiement : voir supabase/README.md, section « Back-office ». Option : secret OFFICE_URL (par défaut https://qamarlounge.com/office.html)
// et ALLOWED_ORIGINS (origines autorisées, séparées par des virgules ; par défaut https://qamarlounge.com).
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const URL_ = Deno.env.get('SUPABASE_URL')!;
const ANON = Deno.env.get('SUPABASE_ANON_KEY')!;
const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const OFFICE_URL = Deno.env.get('OFFICE_URL') || 'https://qamarlounge.com/office.html';
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') || 'https://qamarlounge.com').split(',').map(s => s.trim()).filter(Boolean);
const ROLES = ['owner', 'manager', 'stylist'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;

function cors(req: Request): Record<string, string> {
  const o = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGINS.includes(o) ? o : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}
const reply = (req: Request, body: unknown, status = 200) => Response.json(body, { status, headers: cors(req) });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(req) });
  if (req.method !== 'POST') return reply(req, { error: 'method_not_allowed' }, 405);

  // Qui appelle ? (jeton de la session du back-office)
  const auth = req.headers.get('Authorization') || '';
  if (!auth.startsWith('Bearer ')) return reply(req, { error: 'not_signed_in' }, 401);
  const asCaller = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: who, error: whoErr } = await asCaller.auth.getUser();
  if (whoErr || !who?.user) return reply(req, { error: 'not_signed_in' }, 401);

  const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
  const { data: me } = await admin.from('staff').select('id, role, active').eq('id', who.user.id).maybeSingle();
  if (!me || !me.active || me.role !== 'owner') return reply(req, { error: 'forbidden' }, 403);

  // Données reçues : validées ici, jamais crues sur parole
  const body = await req.json().catch(() => ({}));
  const email = String(body?.email || '').trim().toLowerCase();
  const name = String(body?.display_name || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 40);
  const role = String(body?.role || 'stylist');
  if (!EMAIL_RE.test(email) || email.length > 120) return reply(req, { error: 'invalid_email' }, 400);
  if (!name) return reply(req, { error: 'invalid_name' }, 400);
  if (!ROLES.includes(role)) return reply(req, { error: 'invalid_role' }, 400);

  const { data: inv, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: OFFICE_URL, data: { display_name: name } });
  if (invErr || !inv?.user) {
    const already = /already been registered|already registered|exists/i.test(invErr?.message || '');
    return reply(req, { error: already ? 'already_registered' : 'invite_failed', detail: invErr?.message || '' }, already ? 409 : 502);
  }

  const { error: insErr } = await admin.from('staff').insert({ id: inv.user.id, display_name: name, role, email, active: true });
  if (insErr) return reply(req, { error: /duplicate/i.test(insErr.message) ? 'already_staff' : 'staff_insert_failed', detail: insErr.message }, 409);
  await admin.from('audit_logs').insert({ actor: who.user.id, action: 'invite:staff', target: inv.user.id, details: { email, role, display_name: name } });

  return reply(req, { status: 'invited', id: inv.user.id, email, role });
});
