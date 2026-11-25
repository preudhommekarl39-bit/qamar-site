// QAMAR : prix publics. Au build, les prix des looks, des extras et des boissons viennent de Supabase (vue public_prices,
// migration 007, lue avec la clé publique anon), modifiés depuis le back-office (office.html → Services / Add-ons).
// Ils sont recopiés dans _site/assets/data.js (même format que le fichier du dépôt, seuls les nombres changent),
// puis les pages services/ et areas/ sont régénérées (scripts/seo_pages.py) pour afficher les mêmes prix.
// Garde-fous : rien d'invalide ni de vide n'est publié. Au moindre doute (Supabase muet, vue absente, prix hors bornes,
// aucun look reconnu, fichier régénéré illisible), on garde les prix de assets/data.js.
// Ce qui reste dans data.js (textes, photos, ordre d'affichage, look visible ou non) : modifier le dépôt (demander à Claude).
import { createHash } from 'node:crypto';
import vm from 'node:vm';

export const PRICE_COLUMNS = 'kind,id,price_aed,duration_min,active,sort_order,updated_at';
export const PRICE_MAX = 5000;
// « Cheveux très longs » : montant écrit en dur dans amount_due (005), jamais piloté par la base
const NOT_FROM_DB = new Set(['long']);

export function runData(src) {
  const sb = { window: {} };
  vm.runInNewContext(src, sb);
  return sb.window.QAMAR_DATA;
}

export async function fetchSupabasePrices({ url, key, timeoutMs = 10000 } = {}) {
  if (!url || !key) return { ok: false, reason: 'Supabase not configured', rows: [] };
  try {
    const res = await fetch(url.replace(/\/$/, '') + '/rest/v1/public_prices?select=' + PRICE_COLUMNS, {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs)
    });
    if (res.status === 404) return { ok: false, missing: true, reason: 'view public_prices not found (migration 007 not applied yet)', rows: [] };
    if (!res.ok) {
      const t = await res.text().catch(() => '');
      if (/PGRST205|42P01|does not exist|Could not find the table/i.test(t)) return { ok: false, missing: true, reason: 'view public_prices not found (migration 007 not applied yet)', rows: [] };
      return { ok: false, reason: `Supabase HTTP ${res.status}`, rows: [] };
    }
    const rows = await res.json();
    if (!Array.isArray(rows)) return { ok: false, reason: 'Supabase: unexpected answer', rows: [] };
    return { ok: true, rows };
  } catch (e) { return { ok: false, reason: 'Supabase unreachable: ' + e.message, rows: [] }; }
}

// Prix actuels de data.js, sous une forme simple (sert aussi au hash de contenu)
export function currentPrices(D) {
  return {
    services: Object.fromEntries(D.services.map(s => [s.id, { price: s.price, duration: s.duration }])),
    addons: Object.fromEntries(D.addons.map(a => [a.id, a.price])),
    extras: Object.fromEntries(D.extras.map(x => [x.id, x.price])),
    ritual: D.ritual.price
  };
}

// Fusion pure : D (data.js) + lignes Supabase → prix à publier. Aucune erreur tolérée : une seule ligne invalide = tout data.js.
export function mergePrices(D, rows) {
  const errors = [], warnings = [], changes = [];
  const prices = currentPrices(D);
  if (!Array.isArray(rows)) return { ok: false, errors: ['rows is not a list'], warnings, changes, prices };
  const svcIds = new Set(D.services.map(s => s.id)), addIds = new Set(D.addons.map(a => a.id)), extIds = new Set(D.extras.map(x => x.id));
  let services = 0;
  const seen = new Set();
  for (const r of rows) {
    const id = r && typeof r.id === 'string' ? r.id : '';
    const where = `${r && r.kind}:${id || '?'}`;
    if (!r || !['service', 'addon'].includes(r.kind) || !/^[a-z][a-z0-9-]{1,30}$/.test(id)) { errors.push(`${where}: invalid row`); continue; }
    if (seen.has(where)) { errors.push(`${where}: duplicate`); continue; }
    seen.add(where);
    const p = Number(r.price_aed);
    if (!Number.isInteger(p) || p <= 0 || p > PRICE_MAX) { errors.push(`${where}: price must be a whole number between 1 and ${PRICE_MAX} AED (got ${r.price_aed})`); continue; }
    if (r.kind === 'service') {
      if (!svcIds.has(id)) { warnings.push(`${where}: not on the website yet (needs photos and texts in assets/data.js), ignored`); continue; }
      const d = Number(r.duration_min);
      if (!Number.isInteger(d) || d < 5 || d > (D.maxMinutes || 45)) { errors.push(`${where}: duration must be 5 to ${D.maxMinutes || 45} minutes (got ${r.duration_min})`); continue; }
      const cur = prices.services[id];
      if (cur.price !== p) changes.push({ kind: 'service', id, field: 'price', from: cur.price, to: p });
      if (cur.duration !== d) changes.push({ kind: 'service', id, field: 'duration', from: cur.duration, to: d });
      prices.services[id] = { price: p, duration: d };
      services++;
    } else if (id === 'ritual') {
      if (prices.ritual !== p) changes.push({ kind: 'ritual', id, field: 'price', from: prices.ritual, to: p });
      prices.ritual = p;
    } else if (addIds.has(id)) {
      if (prices.addons[id] !== p) changes.push({ kind: 'addon', id, field: 'price', from: prices.addons[id], to: p });
      prices.addons[id] = p;
    } else if (extIds.has(id) && !NOT_FROM_DB.has(id)) {
      if (prices.extras[id] !== p) changes.push({ kind: 'extra', id, field: 'price', from: prices.extras[id], to: p });
      prices.extras[id] = p;
    } else warnings.push(`${where}: not shown on the website, ignored`);
  }
  if (!errors.length && services === 0) errors.push('no look from Supabase matches the website menu (empty menu refused)');
  for (const id of svcIds) if (!seen.has('service:' + id)) warnings.push(`service:${id}: not in Supabase, data.js price kept`);
  return { ok: errors.length === 0, errors, warnings, changes, prices };
}

const reEsc = s => s.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
// Réécrit uniquement les nombres dans le texte de data.js (même mise en forme : scripts/seo_pages.py lit ce fichier par motifs)
export function patchDataSource(src, prices) {
  let out = src;
  const sub = (re, fn, what) => { const before = out; out = out.replace(re, fn); if (out === before && !re.test(before)) throw new Error('data.js: pattern not found for ' + what); };
  for (const [id, v] of Object.entries(prices.services))
    sub(new RegExp(`(\\{ id: '${reEsc(id)}', art:[^\\n]*?duration: )\\d+(, price: )\\d+`), (m, a, b) => `${a}${v.duration}${b}${v.price}`, 'service ' + id);
  for (const [id, p] of Object.entries({ ...prices.addons, ...prices.extras }))
    sub(new RegExp(`(\\{ id: '${reEsc(id)}', name: \\{[^\\n]*?\\}, price: )\\d+`), (m, a) => `${a}${p}`, 'addon ' + id);
  sub(/(ritual: \{ price: )\d+/, (m, a) => `${a}${prices.ritual}`, 'ritual');
  return out;
}

export const pricesHash = prices => createHash('sha256').update(JSON.stringify(prices)).digest('hex').slice(0, 16);

// Tout le chemin : renvoie le texte de data.js à publier (celui du dépôt en cas de doute) + ce qui a changé.
export function applyPrices({ src, rows, source = 'supabase' }) {
  const D = runData(src);
  const keep = (why, extra = {}) => ({ used: 'data.js', reason: why, source: src, data: D, changes: [], warnings: [], errors: [], prices: currentPrices(D), hash: pricesHash(currentPrices(D)), ...extra });
  if (!rows) return keep('no rows');
  const m = mergePrices(D, rows);
  if (!m.ok) return keep('invalid prices from ' + source, { errors: m.errors, warnings: m.warnings });
  if (!m.changes.length) return { ...keep('same prices'), used: source, warnings: m.warnings };
  let out, D2;
  try { out = patchDataSource(src, m.prices); D2 = runData(out); } catch (e) { return keep('could not rewrite data.js: ' + e.message, { errors: [e.message] }); }
  // Contrôle de l'aller-retour : même menu, mêmes looks, prix attendus
  const back = currentPrices(D2);
  if (D2.services.length !== D.services.length || D2.services.some((s, i) => s.id !== D.services[i].id) || JSON.stringify(back) !== JSON.stringify(m.prices))
    return keep('rewritten data.js did not match the expected prices', { errors: ['round trip mismatch'] });
  return { used: source, reason: 'prices updated', source: out, data: D2, changes: m.changes, warnings: m.warnings, errors: [], prices: m.prices, hash: pricesHash(m.prices) };
}
