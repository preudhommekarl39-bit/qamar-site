// QAMAR — contrôle avant mise en ligne (Node ≥ 18, sans dépendance). Code de sortie ≠ 0 au moindre échec.
//   node scripts/run-tests.mjs
// 1. Tests du moteur et des règles commerciales (tests/engine-tests.js, les mêmes que tests.html)
// 2. Traductions : chaque clé utilisée existe en anglais ET en arabe ; la page arabe se génère sans trou
// 3. Liens internes : chaque fichier référencé existe
// 4. Garde-fous de contenu : pas de lieux interdits, pas de numéro fictif, pas de secret dans les fichiers publics
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { extractDict, translateHtml, localRefs } from './lib.mjs';

let pass = 0, fail = 0;
const test = (name, fn) => {
  let ok = false, msg = '';
  try { const r = fn(); ok = r === true; if (!ok) msg = ' — got ' + JSON.stringify(r); } catch (e) { msg = ' — ' + e.message; }
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + msg); ok ? pass++ : fail++;
};

// ---- 1. Moteur ----
console.log('Engine & business rules');
const store = new Map();
const ctx = {
  console, setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
  localStorage: { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) },
  navigator: {}, addEventListener: () => {},
  document: { documentElement: { dataset: {} }, addEventListener: () => {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }), body: { appendChild() {} } },
  QAMAR_TEST: true
};
ctx.window = ctx;
vm.createContext(ctx);
for (const f of ['assets/config.js', 'assets/data.js', 'assets/store.js', 'tests/engine-tests.js']) vm.runInContext(readFileSync(f, 'utf8'), ctx, { filename: f });
ctx.QAMAR_ENGINE_TESTS(test, ctx.Q);

// ---- 2. Traductions ----
console.log('Translations (EN/AR)');
for (const page of ['index.html', 'queue.html']) {
  const html = readFileSync(page, 'utf8'), dict = extractDict(html);
  test(`${page}: every dictionary entry has English and Arabic`, () => { const bad = Object.entries(dict).filter(([, v]) => !v || !String(v.en || '').trim() || !String(v.ar || '').trim()).map(([k]) => k); return bad.length ? bad : true; });
  test(`${page}: every data-i18n key exists in the dictionary`, () => { const used = [...html.matchAll(/data-i18n(?:-ph)?="([^"]+)"/g)].map(m => m[1]); const bad = [...new Set(used.filter(k => !dict[k]))]; return bad.length ? bad : true; });
}
test('index.html: the Arabic page builds with no missing translation', () => { const r = translateHtml(readFileSync('index.html', 'utf8'), extractDict(readFileSync('index.html', 'utf8')), 'ar'); return r.missing.length ? r.missing : (/[؀-ۿ]/.test(r.html) && r.html.includes('faq_q1') ? true : 'no arabic'); });

// ---- 3. Liens internes ----
console.log('Internal links');
const htmlFiles = readdirSync('.').filter(f => f.endsWith('.html'));
for (const f of htmlFiles) test(`${f}: every local href/src exists`, () => { const bad = localRefs(readFileSync(f, 'utf8')).filter(u => !existsSync(decodeURIComponent(u.replace(/^\.\//, '')) || '.')); return bad.length ? bad : true; });

// ---- 4. Garde-fous ----
console.log('Content & security guards');
const walk = d => readdirSync(d).flatMap(n => { const p = d + '/' + n; return statSync(p).isDirectory() ? walk(p) : [p]; });
const publicText = [...htmlFiles, 'manifest.webmanifest', 'sw.js', ...walk('assets').filter(p => /\.(js|css|json)$/.test(p))].map(p => [p, readFileSync(p, 'utf8')]);
test('no DMCC / JLT / metro in public files', () => { const bad = publicText.filter(([, t]) => /\bDMCC\b|\bJLT\b|\bmetro\b/i.test(t)).map(([p]) => p); return bad.length ? bad : true; });
test('no placeholder WhatsApp number', () => { const bad = publicText.filter(([, t]) => /971500000000/.test(t)).map(([p]) => p); return bad.length ? bad : true; });
test('no secret-looking value in public files', () => { const bad = publicText.filter(([, t]) => /service_role["']?\s*[:=]\s*["'][^"']+|sk_live_[0-9a-z]+|eyJhbGciOi[0-9A-Za-z_-]{20,}/i.test(t)).map(([p]) => p); return bad.length ? bad : true; });
test('staff pages are noindex', () => ['admin.html', 'station.html', 'entrance.html', 'tests.html', 'queue.html'].every(f => /<meta name="robots" content="noindex/.test(readFileSync(f, 'utf8'))));
test('every indexable page has a unique title and a description', () => { const pages = ['index.html', 'privacy.html', 'legal.html']; const titles = pages.map(f => (readFileSync(f, 'utf8').match(/<title>([^<]+)<\/title>/) || [])[1]); return new Set(titles).size === pages.length && pages.every(f => /<meta name="description" content="[^"]{50,}"/.test(readFileSync(f, 'utf8'))); });
test('structured data contains no unconfirmed hours, address, rating or price', () => { const ld = (readFileSync('index.html', 'utf8').match(/application\/ld\+json"[^>]*>([^<]+)</) || [])[1]; const o = JSON.parse(ld); return !o.openingHours && !o.openingHoursSpecification && !o.address && !o.aggregateRating && !o.priceRange; });

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
