// QAMAR — contrôle avant mise en ligne (Node ≥ 18, sans dépendance). Code de sortie ≠ 0 au moindre échec.
//   node scripts/run-tests.mjs
// 1. Tests du moteur et des règles commerciales (tests/engine-tests.js, les mêmes que tests.html)
// 2. Traductions : chaque clé utilisée existe en anglais ET en arabe ; la page arabe se génère sans trou
// 3. Liens internes : chaque fichier référencé existe
// 4. Garde-fous de contenu : pas de lieux interdits, pas de numéro fictif, pas de secret dans les fichiers publics
import { readFileSync, existsSync, readdirSync, statSync, mkdtempSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyPrices, mergePrices, patchDataSource, runData, fetchSupabasePrices } from './prices.mjs';
import { loadCore, loadJsonArticles, fetchSupabaseArticles, mergeArticles, siteContext, buildBlog, sitemapEntry } from './blog.mjs';
import vm from 'node:vm';
import { extractDict, translateHtml, localRefs, fillPriceTokens } from './lib.mjs';

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
const BUILT = /^(?:\.\/)?blog\//; // journal : pages générées au build (contrôlées plus bas)
for (const f of htmlFiles) test(`${f}: every local href/src exists`, () => { const bad = localRefs(readFileSync(f, 'utf8')).filter(u => !BUILT.test(u) && !existsSync(decodeURIComponent(u.replace(/^\.\//, '')) || '.')); return bad.length ? bad : true; });

// ---- 4. Garde-fous ----
console.log('Content & security guards');
const walk = d => readdirSync(d).flatMap(n => { const p = d + '/' + n; return statSync(p).isDirectory() ? walk(p) : [p]; });
const publicText = [...htmlFiles, 'manifest.webmanifest', 'sw.js', ...walk('assets').filter(p => /\.(js|css|json)$/.test(p))].map(p => [p, readFileSync(p, 'utf8')]);
test('no DMCC / JLT / metro in public files', () => { const bad = publicText.filter(([, t]) => /\bDMCC\b|\bJLT\b|\bmetro\b/i.test(t)).map(([p]) => p); return bad.length ? bad : true; });
test('no placeholder WhatsApp number', () => { const bad = publicText.filter(([, t]) => /971500000000/.test(t)).map(([p]) => p); return bad.length ? bad : true; });
// Un JWT n'est accepté que s'il s'agit de la clé publique « anon » de Supabase (faite pour être servie au navigateur).
const jwtRole = j => { try { return JSON.parse(Buffer.from(j.split('.')[1], 'base64url').toString()).role; } catch { return null; } };
test('no secret-looking value in public files', () => { const bad = publicText.filter(([, t]) => /service_role["']?\s*[:=]\s*["'][^"']+|sk_live_[0-9a-z]+|sb_secret_/i.test(t) || (t.match(/eyJhbGciOi[0-9A-Za-z_-]{10,}\.[0-9A-Za-z_-]+\.[0-9A-Za-z_-]*/g) || []).some(j => jwtRole(j) !== 'anon')).map(([p]) => p); return bad.length ? bad : true; });
test('staff pages are noindex', () => ['admin.html', 'blog-admin.html', 'office.html', 'station.html', 'entrance.html', 'tests.html', 'queue.html'].every(f => /<meta name="robots" content="noindex/.test(readFileSync(f, 'utf8'))));
test('every indexable page has a unique title and a description', () => { const pages = ['index.html', 'privacy.html', 'legal.html']; const titles = pages.map(f => (readFileSync(f, 'utf8').match(/<title>([^<]+)<\/title>/) || [])[1]); return new Set(titles).size === pages.length && pages.every(f => /<meta name="description" content="[^"]{50,}"/.test(readFileSync(f, 'utf8'))); });
test('structured data contains no unconfirmed hours, address, rating or price', () => { const ld = (readFileSync('index.html', 'utf8').match(/application\/ld\+json"[^>]*>([^<]+)</) || [])[1]; const o = JSON.parse(ld); return !o.openingHours && !o.openingHoursSpecification && !o.address && !o.aggregateRating && !o.priceRange; });

// ---- 4b. QR intelligent (go.html) et application ----
console.log('Smart QR & app');
{
  const go = readFileSync('go.html', 'utf8');
  const goScript = [...go.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).join('\n');
  // Exécute le script de go.html dans un faux navigateur : renvoie l'URL de redirection (ou null) et l'état de l'écran « app »
  const runGo = ({ search = '', ua = 'Mozilla/5.0 (Macintosh)', store = { ios: '', android: '' }, standalone = false, native = false }) => {
    const els = {}; const el = id => (els[id] = els[id] || { id, hidden: id === 'app', textContent: '', href: '' });
    let replaced = null;
    const w = { QAMAR_CONFIG: { appStore: store }, URLSearchParams, location: { search, hash: '', replace: u => { replaced = u; } },
      navigator: { userAgent: ua, platform: /iPhone/.test(ua) ? 'iPhone' : 'MacIntel', maxTouchPoints: 0, standalone, language: 'en' },
      matchMedia: () => ({ matches: standalone }), localStorage: { getItem: () => null }, document: { getElementById: el, documentElement: {} } };
    if (native) w.Capacitor = { isNativePlatform: () => true };
    w.window = w; vm.runInNewContext(goScript, w);
    return { replaced, app: !!els.app && !els.app.hidden, store: els.store && els.store.href, web: els.web && els.web.href };
  };
  const IOS = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', AND = 'Mozilla/5.0 (Linux; Android 14; Pixel 8)';
  test('go.html: noindex, tiny, no external font/script, noscript fallback to the queue', () => /<meta name="robots" content="noindex/.test(go) && go.length < 8000 && !/<(script|link)[^>]+(src|href)="https?:/.test(go) && /<noscript><meta http-equiv="refresh" content="0; url=queue\.html\?source=qr">/.test(go));
  test('go.html today (no store links): instant location.replace to queue.html?source=qr, query params kept', () => runGo({}).replaced === 'queue.html?source=qr' && runGo({ search: '?look=glow' }).replaced === 'queue.html?look=glow&source=qr' && runGo({ search: '?source=card' }).replaced === 'queue.html?source=card' && runGo({ ua: IOS }).replaced === 'queue.html?source=qr');
  test('go.html with store links: iPhone/Android see "Open in the QAMAR app" + their store + browser link, no redirect', () => { const st = { ios: 'https://apps.apple.com/app/id1', android: 'https://play.google.com/store/apps/details?id=x' }; const i = runGo({ ua: IOS, store: st }), a = runGo({ ua: AND, store: st }), d = runGo({ store: st });
    return i.replaced === null && i.app && i.store === st.ios && i.web === 'queue.html?source=qr' && a.replaced === null && a.store === st.android && d.replaced === 'queue.html?source=qr'; });
  test('go.html inside the installed app (standalone or Capacitor): straight to the queue', () => { const st = { ios: 'https://apps.apple.com/app/id1', android: 'x' }; return runGo({ ua: IOS, store: st, standalone: true }).replaced === 'queue.html?source=qr' && runGo({ ua: AND, store: st, native: true }).replaced === 'queue.html?source=qr'; });
  test('go.html: Universal Links / App Links documented, no fake .well-known file', () => /apple-app-site-association/.test(go) && /assetlinks\.json/.test(go) && !existsSync('.well-known/apple-app-site-association') && !existsSync('.well-known/assetlinks.json'));
  test('go/index.html forwards /go and /go/ to go.html with the query string', () => { const g = readFileSync('go/index.html', 'utf8'); return /location\.replace\('\.\.\/go\.html' \+ location\.search \+ location\.hash\)/.test(g) && /noindex/.test(g); });
  const cfgCtx = { window: {} }; vm.runInNewContext(readFileSync('assets/config.js', 'utf8'), cfgCtx);
  test('config.js: appStore.ios and appStore.android keys exist (empty until the apps are published)', () => { const a = cfgCtx.window.QAMAR_CONFIG.appStore; return !!a && 'ios' in a && 'android' in a && a.ios === '' && a.android === ''; });
  const ent = readFileSync('entrance.html', 'utf8');
  test('entrance.html: QR points to go.html (not queue.html), text says join + get the app in EN and AR', () => /Q\.qr\(document\.getElementById\('qr'\), siteUrl \+ 'go\.html'/.test(ent) && !/siteUrl \+ 'queue\.html'/.test(ent) && /get the QAMAR app/.test(ent) && /حمّلي تطبيق قمر/.test(ent));
  const qc = readFileSync('qr-card.html', 'utf8');
  test('qr-card.html: printable A6/A5 card, qrcodejs from cdnjs, QR to siteUrl + go.html, EN + AR, noindex', () => /<meta name="robots" content="noindex/.test(qc) && /cdnjs\.cloudflare\.com\/ajax\/libs\/qrcodejs\/1\.0\.0\/qrcode\.min\.js/.test(qc) && /siteUrl \+ 'go\.html'/.test(qc) && /@page \{ size: A6/.test(qc) && /A5/.test(qc) && /@media print/.test(qc) && /<b>Scan to join the queue<\/b>\s*<em class="app">Get the app<\/em>/.test(qc) && /امسحي الرمز للانضمام للطابور/.test(qc));
  test('admin.html links the counter QR card next to the entrance screen', () => { const a = readFileSync('admin.html', 'utf8'); return /href="entrance\.html" >Entrance screen ↗<\/a>\s*<a href="qr-card\.html"/.test(a) && /href="qr-card\.html" ><b>Counter card<\/b>/.test(a); });
  const visible = h => h.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '');
  test('go.html and qr-card.html: no em dash and no emoji in the page', () => [go, qc].every(h => !/[—\u{1F300}-\u{1FAFF}]/u.test(visible(h))));
  const qh = readFileSync('queue.html', 'utf8'), qd = extractDict(qh), app = readFileSync('assets/app.js', 'utf8');
  test('queue.html: install card after joining (EN + AR), reuses app.js install, dismiss remembered with try/catch', () => ['app_t', 'app_s', 'app_btn', 'app_later', 'app_sheet', 'app_ios', 'tk_missing'].every(k => qd[k] && qd[k].en && /[؀-ۿ]/.test(qd[k].ar))
    && /\$\{appCard\(code\)\}/.test(qh) && /QamarApp\.install\(/.test(qh) && !/beforeinstallprompt|\.prompt\(\)/.test(qh) && /try \{ return !!localStorage\.getItem\(APP_OFF\)/.test(qh) && /A\.standalone \|\| !A\.isMobile \|\| appOff\(\)/.test(qh) && /html\.is-app \.app-card/.test(qh));
  test('queue.html: iPhone users are told the ticket stays in Safari (ticket code shown); phase 2 noted', () => /A\.isIOS \? `<p class="ios">\$\{t\('app_ios', \{ c: code \}\)\}/.test(qh) && /\{c\}/.test(qd.app_ios.en) && /\{c\}/.test(qd.app_ios.ar) && /Supabase \(phase 2\)/.test(qh));
  test('queue.html: new app texts have no em dash and no emoji', () => ['app_t', 'app_s', 'app_btn', 'app_later', 'app_sheet', 'app_ios', 'tk_missing'].every(k => !/[—\u{1F300}-\u{1FAFF}]/u.test(qd[k].en + qd[k].ar)));
  test('app.js exposes install() (native Android prompt, else the sheet) and the platform flags', () => /window\.QamarApp = \{ open, install, isIOS, isMobile, standalone/.test(app) && /async function install\(opts\)/.test(app));
  test('sw.js precaches go.html; build-site and build-www publish the new pages', () => /CORE = \[[^\]]*'go\.html'/.test(readFileSync('sw.js', 'utf8')) && /'go\.html', 'qr-card\.html'/.test(readFileSync('scripts/build-site.mjs', 'utf8')) && /PUBLIC_DIRS = \[[^\]]*'go'/.test(readFileSync('scripts/build-site.mjs', 'utf8')) && /'go\.html'/.test(readFileSync('scripts/build-www.mjs', 'utf8')));
}
// ---- 5. Journal (blog) ----
console.log('Journal (blog)');
{
  const BC = loadCore();
  const ctx = siteContext();
  const SITE = 'https://qamarlounge.com/';
  const repo = loadJsonArticles();
  const ex = repo.find(a => a.source.endsWith('_exemple.json'));
  const services = ctx.pages.services;
  test('content/blog/_exemple.json exists and is a draft', () => !!ex && ex.status === 'draft');
  test('every article file in content/blog passes the checks', () => { const bad = repo.map(a => [a.source, BC.validate(a, { services })]).filter(([, e]) => e.length); return bad.length ? bad : true; });
  // Copie publiée de l'exemple, construite dans un dossier temporaire
  const tmp = mkdtempSync(join(tmpdir(), 'qamar-blog-'));
  const pubEx = { ...ex, status: 'published', source: 'test' };
  const r = buildBlog({ out: tmp, site: SITE, articles: [pubEx], ctx, today: '2026-12-31' });
  const read = p => (existsSync(join(tmp, p)) ? readFileSync(join(tmp, p), 'utf8') : '');
  const en = read(`blog/${ex.slug}.html`), ar = read(`blog/ar/${ex.slug}.html`);
  const ld = h => JSON.parse((h.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/) || [])[1] || '{}');
  test('a published example builds its English and Arabic pages', () => r.errors.length === 0 && en.includes('<html lang="en" dir="ltr">') && ar.includes('<html lang="ar" dir="rtl">') && r.published.length === 1);
  test('article pages: canonical + hreflang en, ar and x-default', () => [en, ar].every(h => h.includes(`hreflang="en" href="${SITE}blog/${ex.slug}.html"`) && h.includes(`hreflang="ar" href="${SITE}blog/ar/${ex.slug}.html"`) && h.includes('hreflang="x-default"')) && en.includes(`<link rel="canonical" href="${SITE}blog/${ex.slug}.html">`) && ar.includes(`<link rel="canonical" href="${SITE}blog/ar/${ex.slug}.html">`));
  test('article pages: meta title and meta description', () => en.includes(`<title>${BC.esc(ex.metaTitle.en)}</title>`) && en.includes(`<meta name="description" content="${BC.esc(ex.metaDescription.en)}">`) && ar.includes(`<title>${BC.esc(ex.metaTitle.ar)}</title>`));
  test('article schema: valid BlogPosting (headline, dates, author, publisher, image) + BreadcrumbList', () => {
    return [[en, 'en'], [ar, 'ar']].every(([h, l]) => {
      const g = ld(h)['@graph'] || [], art = g.find(n => n['@type'] === 'BlogPosting'), bc = g.find(n => n['@type'] === 'BreadcrumbList');
      return ld(h)['@context'] === 'https://schema.org' && art && art.headline === ex.title[l] && art.headline.length <= 110 && /^\d{4}-\d{2}-\d{2}T00:00:00\+04:00$/.test(art.datePublished) && art.dateModified >= art.datePublished
        && art.author && art.author.name === ex.author[l] && art.publisher && art.publisher.logo && art.image.every(u => u.startsWith('https://')) && art.mainEntityOfPage
        && bc && bc.itemListElement.length === 3 && bc.itemListElement.every((it, i) => it.position === i + 1 && it.item.startsWith('https://'));
    });
  });
  test('article shows an honest author and real dates', () => en.includes('By QAMAR team') && en.includes('<time datetime="2026-11-25">25 November 2026</time>') && ar.includes('بقلم فريق قمر') && ar.includes('٢٠٢٦'));
  test('article links to its service page (EN and AR versions)', () => en.includes('href="../services/walk-in-blow-dry-dubai.html"') && ar.includes('href="../../services/ar/walk-in-blow-dry-dubai.html"') && ar.includes('href="../../ar.html#club"'));
  test('article pages: Journal link in header and footer, every local link exists', () => [[en, 'blog'], [ar, 'blog/ar']].every(([h, dir]) => (h.match(/<footer>[\s\S]*?<\/footer>/) || [''])[0].includes('blog/') && localRefs(h).every(u => { const p = join(dir, u).split('#')[0]; return p === 'ar.html' || (p.startsWith('blog') ? existsSync(join(tmp, p)) || existsSync(join(tmp, p, 'index.html')) : existsSync(p.endsWith('/') || !p.includes('.') ? join(p, 'index.html') : p)); })));
  test('journal index lists the article in EN and AR', () => read('blog/index.html').includes(`href="${ex.slug}.html"`) && read('blog/ar/index.html').includes(`href="${ex.slug}.html"`) && read('blog/index.html').includes('index, follow'));
  test('sitemap entries contain both article URLs with alternates', () => { const xml = r.sitemap.map(sitemapEntry).join(''); return xml.includes(`<loc>${SITE}blog/${ex.slug}.html</loc>`) && xml.includes(`<loc>${SITE}blog/ar/${ex.slug}.html</loc>`) && xml.includes(`<loc>${SITE}blog/</loc>`) && xml.includes('<lastmod>2026-11-25</lastmod>'); });
  rmSync(tmp, { recursive: true, force: true });
  // Brouillons, dates futures, contenu refusé
  const tmp2 = mkdtempSync(join(tmpdir(), 'qamar-blog-'));
  const r2 = buildBlog({ out: tmp2, site: SITE, articles: [ex, { ...pubEx, slug: 'future-post', datePublished: '2099-01-01', dateModified: '2099-01-01' }], ctx });
  test('drafts and future-dated articles are never written; an empty journal is noindex', () => r2.published.length === 0 && !existsSync(join(tmp2, `blog/${ex.slug}.html`)) && !existsSync(join(tmp2, 'blog/future-post.html')) && r2.sitemap.length === 0 && readFileSync(join(tmp2, 'blog/index.html'), 'utf8').includes('noindex'));
  rmSync(tmp2, { recursive: true, force: true });
  test('checks refuse external links, em dashes and emoji', () => { const bad = BC.validate({ ...pubEx, blocks: { en: [{ type: 'p', text: 'See [x](https://example.com) \u2014 now \u{1F600}' }], ar: ex.blocks.ar } }, { services }); return bad.some(e => /not allowed/.test(e)) && bad.some(e => /em dash/.test(e)) && bad.some(e => /emoji/.test(e)); });
  test('article text is escaped (no HTML injection)', () => BC.renderBlocks([{ type: 'p', text: '<script>alert(1)</script> [a](javascript:alert(1))' }], () => 'x').indexOf('<script') < 0 && !/href="javascript/.test(BC.renderBlocks([{ type: 'p', text: '[a](javascript:alert(1))' }], p => p)));
  test('merge: the most recently modified version of a slug wins', () => { const a = { slug: 's', dateModified: '2026-12-01', source: 'json' }, b = { slug: 's', dateModified: '2026-12-02', source: 'supabase' }; return mergeArticles([a], [b])[0].source === 'supabase' && mergeArticles([b], [{ ...a, dateModified: '2026-11-01' }])[0].source === 'supabase' && mergeArticles([a], []).length === 1; });
  test('Supabase row <-> article round trip', () => { const back = BC.fromRow(BC.toRow(ex)); return JSON.stringify({ ...back, source: '', updatedAt: '' }) === JSON.stringify({ ...BC.normalize(ex), source: '', updatedAt: '' }); });
}
const unreachable = await fetchSupabaseArticles({ url: 'http://127.0.0.1:9', key: 'anon', timeoutMs: 3000 });
const notConfigured = await fetchSupabaseArticles({ url: '', key: '' });
test('Supabase unreachable or not configured: no crash, repo articles kept', () => unreachable.ok === false && unreachable.articles.length === 0 && notConfigured.ok === false);
{
  const sql = readFileSync('supabase/migrations/006_articles.sql', 'utf8');
  test('migration 006: RLS on, public read = published only, writes = blog admins only', () => /alter table articles enable row level security/.test(sql) && /alter table blog_admins enable row level security/.test(sql)
    && /for select to anon, authenticated using \(status = 'published'\)/.test(sql) && ['insert', 'update', 'delete'].every(op => new RegExp(`for ${op} to authenticated (using|with check) \\(is_blog_admin\\(\\)\\)`).test(sql)) && !/for (insert|update|delete) to anon/.test(sql) && !/service_role/.test(sql));
  const adm = readFileSync('blog-admin.html', 'utf8');
  test('blog-admin.html: noindex, anon key only, no sign-up', () => /<meta name="robots" content="noindex, nofollow">/.test(adm) && !/service_role|signUp\(/.test(adm) && /signInWithPassword/.test(adm));
}
{
  const sql = readFileSync('supabase/migrations/006_articles.sql', 'utf8');
  const grants = [...sql.matchAll(/grant select \(([^)]*)\) on articles to ([^;]+);/g)];
  test('migration 006: authenticated and anon read only public columns; writes granted separately', () => grants.length === 1 && /anon, authenticated/.test(grants[0][2]) && !/created_by|updated_by/.test(grants[0][1])
    && !/grant select[^;(]*on articles/.test(sql) && /grant insert, update, delete on articles to authenticated;/.test(sql) && /articles_admin_read\s+on articles for select to authenticated using \(is_blog_admin\(\)\)/.test(sql));
  test('blog-admin.html never selects * on articles', () => !/from\('articles'\)\.select\('\*'\)|\.select\(\)\.single/.test(readFileSync('blog-admin.html', 'utf8')));
}
// ---- 6. Back-office (office.html, migration 007, prix au build) ----
console.log('Back-office');
{
  const sql = readFileSync('supabase/migrations/007_backoffice.sql', 'utf8');
  const code = sql.replace(/--[^\n]*/g, '');
  const tables = [...code.matchAll(/create table\s+(?:if not exists\s+)?(\w+)/gi)].map(m => m[1]);
  test('migration 007: present, creates event_requests and club_members', () => tables.includes('event_requests') && tables.includes('club_members'));
  test('migration 007: re-runnable (if not exists, or replace, drop policy/trigger before create)', () => {
    const bad = [];
    if (/create table (?!if not exists)/i.test(code)) bad.push('create table without if not exists');
    if (/create (?:unique )?index (?!if not exists)/i.test(code)) bad.push('create index without if not exists');
    if (/create function/i.test(code) || /create view/i.test(code)) bad.push('create without or replace');
    if (/add column (?!if not exists)/i.test(code)) bad.push('add column without if not exists');
    if (/add value (?!if not exists)/i.test(code)) bad.push('enum value without if not exists');
    for (const m of code.matchAll(/create policy (\w+) on (\w+)/gi)) if (!new RegExp(`drop policy if exists ${m[1]} on ${m[2]}`, 'i').test(code)) bad.push('policy ' + m[1]);
    for (const m of code.matchAll(/create trigger (\w+)/gi)) if (!new RegExp(`drop trigger if exists ${m[1]} on`, 'i').test(code)) bad.push('trigger ' + m[1]);
    for (const m of code.matchAll(/add constraint (\w+)/gi)) if (!new RegExp(`drop constraint if exists ${m[1]}`, 'i').test(code)) bad.push('constraint ' + m[1]);
    return bad.length ? bad : true;
  });
  test('migration 007: never drops or empties data', () => !/drop table|drop column|truncate|delete from (?!event_requests|club_members)/i.test(code) && !/drop type/i.test(code));
  test('migration 007: RLS enabled on every new table, no policy for anon writes', () => tables.every(t => new RegExp(`alter table ${t} enable row level security`, 'i').test(code)) && !/for (insert|update|delete|all) to anon/i.test(code) && tables.every(t => new RegExp(`revoke all on ${t} from public, anon`, 'i').test(code)));
  test('migration 007: every security definer function sets search_path = public', () => { const fns = code.split(/create or replace function/i).slice(1); const bad = fns.filter(f => /security definer/i.test(f.split('$$')[0]) && !/set search_path = public/i.test(f.split('$$')[0])).map(f => f.trim().split('(')[0]); return bad.length ? bad : true; });
  test('migration 007: owner role, is_owner(), managers include owner, blog access = blog_admins or owner', () => /add value if not exists 'owner'/.test(code) && /function is_owner\(\)/.test(code) && /role::text in \('manager', 'owner'\)/.test(code) && /from blog_admins where user_id = auth\.uid\(\)\) or is_owner\(\)/.test(code));
  test('migration 007: staff writes only through owner-checked functions; public writes only through RPCs', () => /drop policy if exists staff_manager_write on staff/.test(code) && /revoke insert, update, delete on staff from anon, authenticated/.test(code)
    && (code.match(/if not is_owner\(\) then raise exception 'forbidden'/g) || []).length >= 2 && /grant execute on function request_event\([^)]*\), request_club\([^)]*\) to anon, authenticated/.test(code));
  test('migration 007: catalogue, team and requests are audited (before / after)', () => ['services', 'addons', 'promo_codes', 'staff', 'event_requests', 'club_members'].every(t => new RegExp(`after insert or update or delete on ${t} for each row execute function audit_row`).test(code)) && /'before', b, 'after', a/.test(code));
  test('migration 007: public price view exposes only safe columns', () => { const v = (code.match(/create or replace view public_prices[\s\S]*?;/) || [''])[0]; return !!v && !/\*/.test(v) && !/name_|look_|created_by|updated_by/.test(v) && /grant select on public_prices to anon, authenticated/.test(code); });
  test('migration 007: no secret in SQL', () => !/service_role|eyJhbGciOi/.test(sql));
  test('migration 007: the add-ons it inserts fit its own name limit (else the whole migration is rolled back)', () => {
    const lim = Number((code.match(/addons_names_valid check \(\s*char_length\(trim\(name_en\)\) between 1 and (\d+)/) || [])[1]);
    const ins = (code.match(/insert into addons \(id, name_en, name_ar[^;]*;/) || [''])[0];
    const names = [...ins.matchAll(/\('[a-z-]+', '([^']*)', '([^']*)'/g)].flatMap(m => [m[1], m[2]]);
    const bad = names.filter(n => [...n].length > lim);
    return lim > 0 && names.length >= 18 && (bad.length ? bad : true);
  });

  const fn = readFileSync('supabase/functions/invite-staff/index.ts', 'utf8');
  test('invite-staff function: checks an owner JWT, invites by e-mail, secret key from the environment only', () => /auth\.getUser\(\)/.test(fn) && /role !== 'owner'/.test(fn) && /inviteUserByEmail\(email, \{ redirectTo: OFFICE_URL/.test(fn) && /Deno\.env\.get\('SUPABASE_SERVICE_ROLE_KEY'\)/.test(fn) && !/eyJhbGciOi/.test(fn));

  const off = readFileSync('office.html', 'utf8'), demoJs = readFileSync('assets/office-demo.js', 'utf8'), coreJs = readFileSync('assets/office-core.js', 'utf8');
  test('office.html: noindex, anon key only, no sign-up, no secret key name anywhere in the back-office files', () => /<meta name="robots" content="noindex, nofollow">/.test(off) && /signInWithPassword/.test(off) && !/signUp\(/.test(off) && ![off, demoJs, coreJs].some(t => /service_role|SERVICE_ROLE|sb_secret_/i.test(t)));
  test('office.html: invite and recovery links, "Forgot password?"', () => /type'\) \|\| ''\) \? linkHash/.test(off) && /resetPasswordForEmail/.test(off) && /Choose your password/.test(off) && /Forgot password\?/.test(off));
  test('office.html: the local demo loads only on localhost, and refuses other hosts itself', () => { const gate = "/^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)"; return off.includes('const local = ' + gate) && off.includes('if (local && demoMatch)') && (off.match(/src = 'assets\/office-demo\.js'/g) || []).length === 1 && !/<script[^>]+office-demo/.test(off) && demoJs.includes('if (!' + gate + ') return;'); });
  test('office.html: no emoji and no em dash in the page', () => !/[—\u{1F300}-\u{1FAFF}☀-➿]/u.test(off));
  test('build publishes office.html', () => /'office\.html'/.test(readFileSync('scripts/build-site.mjs', 'utf8')));

  const sbx = {}; vm.runInNewContext(coreJs, sbx); const O = sbx.QAMAR_OFFICE;
  const ids = r => O.menuFor(r).map(m => m.id);
  test('menu per role: owner sees everything, including team edits and the journal', () => O.MENU.every(m => ids('owner').includes(m.id)) && O.canEdit('owner', 'team') && O.canSee('owner', 'journal'));
  test('menu per role: manager runs the menu and requests, team read-only, no journal', () => ['services', 'addons', 'promos', 'events', 'club', 'status', 'team'].every(i => ids('manager').includes(i)) && !O.canEdit('manager', 'team') && O.canEdit('manager', 'services') && !O.canSee('manager', 'journal'));
  test('menu per role: stylist sees only her profile and the tablet; unknown role sees nothing', () => JSON.stringify(ids('stylist')) === JSON.stringify(['profile', 'station']) && !O.canEdit('stylist', 'services') && O.menuFor('admin').length === 0 && O.menuFor(undefined).length === 0 && O.home('stylist') === 'profile');
  const svc = { id: 'express', look_en: 'Qamar Express', look_ar: 'قمر إكسبريس', name_en: 'Express Blow-Dry', name_ar: 'سشوار سريع', duration_min: 35, price_aed: 139, from_hour: null, sort_order: 10 };
  test('validation: a correct look passes; price 0, decimal price, missing or non-Arabic AR name, 50 min are refused', () => O.validateService(svc).length === 0 && O.validateService({ ...svc, price_aed: 0 }).length === 1 && O.validateService({ ...svc, price_aed: 139.5 }).length === 1
    && O.validateService({ ...svc, look_ar: '' }).length === 1 && O.validateService({ ...svc, name_ar: 'Express' }).length === 1 && O.validateService({ ...svc, duration_min: 50 }).length === 1 && O.validateService({ ...svc, look_en: '<b>x</b>' }).length === 1);
  test('validation: promo codes, requests and invitations', () => O.validatePromoCode({ code: 'glow10', pct: 10, min_people: 1 }).length === 0 && O.validatePromoCode({ code: 'GLOW 10', pct: 0, min_people: 9 }).length === 3
    && O.validateRequest({ name: 'A', phone: '+971501234567', status: 'new', source: 'whatsapp', event_type: 'wedding', guests: 6 }, 'event').length === 0 && O.validateRequest({ name: 'A', status: 'new', source: 'whatsapp', tier: 'half' }, 'club').length === 1
    && O.validateInvite({ email: 'x@example.com', display_name: 'Noor', role: 'stylist' }).length === 0 && O.validateInvite({ email: 'x', display_name: '', role: 'boss' }).length === 3 && O.waHref('+971 50 123 4567') === 'https://wa.me/971501234567' && O.waHref('050') === '');

  // Prix au build
  const src = readFileSync('assets/data.js', 'utf8'), D = runData(src);
  const rows = D.services.map(x => ({ kind: 'service', id: x.id, price_aed: x.price, duration_min: x.duration, active: true }));
  const up = applyPrices({ src, rows: rows.map(r => r.id === 'express' ? { ...r, price_aed: 149 } : r).concat([{ kind: 'addon', id: 'shower', price_aed: 55 }, { kind: 'addon', id: 'ritual', price_aed: 89 }, { kind: 'addon', id: 'long', price_aed: 99 }, { kind: 'service', id: 'brand-new', price_aed: 100, duration_min: 30 }]) });
  test('prices: Supabase prices are written into data.js (same format, only numbers change)', () => up.used === 'supabase' && up.data.services.find(x => x.id === 'express').price === 149 && up.data.extras.find(x => x.id === 'shower').price === 55 && up.data.ritual.price === 89
    && up.data.extras.find(x => x.id === 'long').price === D.extras.find(x => x.id === 'long').price && up.source.split('\n').length === src.split('\n').length && /\{ id: 'express', art:[^\n]*duration: 35, price: 149,/.test(up.source));
  test('prices: same prices = data.js untouched', () => { const r = applyPrices({ src, rows }); return r.source === src && r.changes.length === 0; });
  test('prices: invalid or empty data falls back to data.js (never an empty or broken menu)', () => [[], [{ kind: 'service', id: 'express', price_aed: 0, duration_min: 35 }], [{ kind: 'service', id: 'express', price_aed: 139.5, duration_min: 35 }], [{ kind: 'service', id: 'express', price_aed: 139, duration_min: 90 }], [{ kind: 'service', id: 'brand-new', price_aed: 100, duration_min: 30 }], [{ id: 'x' }], null]
    .every(rs => { const r = applyPrices({ src, rows: rs }); return r.used === 'data.js' && r.source === src; }) && mergePrices(D, 'nope').ok === false);
  test('prices: data.js patterns used by scripts/seo_pages.py still match after a rewrite', () => { const t = patchDataSource(src, up.prices); return (t.match(/\{ id: '[a-z]+', art:.*?duration: \d+, price: \d+/g) || []).length === D.services.length && /ritual: \{ price: 89/.test(t); });
  const pUnreach = await fetchSupabasePrices({ url: 'http://127.0.0.1:9', key: 'anon', timeoutMs: 3000 }), pNone = await fetchSupabasePrices({ url: '', key: '' });
  test('prices: Supabase unreachable or not configured, no crash', () => pUnreach.ok === false && !pUnreach.missing && pNone.ok === false && pUnreach.rows.length === 0);
  // Accueil : prix cités dans les textes = data.js (ou back-office au build)
  const idx = readFileSync('index.html', 'utf8'), idict = extractDict(idx);
  test('home page: price texts are tokens filled from data.js, none hard-typed', () => idict.n1price.en === '{{price:night}} AED' && idict.w2b.en === '{{referral:credit}} AED' && /\{\{club:from\}\}/.test(idict.rd_q6.en) && /\{\{club:from\}\}/.test(idict.rd_q6.ar)
    && !Object.values(idict).some(v => /\d+\s*AED|[٠-٩]+\s*درهم/.test(v.en + v.ar) && !/\{\{/.test(v.en + v.ar)) ? true : Object.entries(idict).filter(([k, v]) => /\d+\s*AED|[٠-٩]+\s*درهم/.test(v.en + v.ar)).map(([k]) => k));
  test('home page: tokens follow a back-office price (EN and Arabic digits); unknown token stops the build', () => { const D2 = JSON.parse(JSON.stringify(D)); D2.services.find(x => x.id === 'night').price = 199; const d = fillPriceTokens({ n: { en: '{{price:night}} AED', ar: '{{price:night}} درهماً' }, c: { en: '{{club:from}}', ar: 'x' } }, D2); let threw = false; try { fillPriceTokens({ x: { en: '{{price:nope}}', ar: '' } }, D); } catch { threw = true; } return d.n.en === '199 AED' && d.n.ar === '١٩٩ درهماً' && d.c.en === '329' && threw; });
  test('README: the alignment SQL before 007 matches data.js prices', () => { const rd = readFileSync('supabase/README.md', 'utf8'); const blk = (rd.match(/-- data\.js prices \(generated\)([\s\S]*?)-- end/) || [])[1] || ''; return D.services.every(x => blk.includes(`('${x.id}', ${x.price}, ${x.duration})`)) && D.addons.every(a => blk.includes(`('${a.id}', ${a.price})`)); });
  test('migration 007: extras and ritual are seeded at the data.js prices', () => D.extras.filter(x => x.id !== 'long').every(x => new RegExp(`\\('${x.id}', '[^']*', '[^']*', 'extra', ${x.price},`).test(code)) && new RegExp(`\\('ritual', '[^']*', '[^']*', 'ritual', ${D.ritual.price},`).test(code));
  test('migration 007: only drinks go on a ticket (free Night Glow matcha unchanged), last-owner check locks owner rows first', () => /from addons where id = p_addon and active and kind in \('matcha', 'drink'\)/.test(code)
    && code.indexOf("perform 1 from staff where role::text = 'owner' and active order by id for update") > code.indexOf('function admin_update_staff') && code.indexOf("perform 1 from staff where role::text = 'owner' and active order by id for update") < code.indexOf("select * into cur from staff where id = p_id for update"));
  test('activity log: readable items, whole AED prices, no technical id', () => { const lk = { staff: [{ id: 'u1', display_name: 'Layla' }], services: [{ id: 'glow', look_en: 'Qamar Glow' }], event_requests: [{ id: 'e1', event_type: 'wedding', event_date: '2027-01-05', name: 'Amal' }], club_members: [], addons: [] };
    return O.auditItem({ action: 'update:staff', target: 'u1' }, lk) === 'Layla' && O.auditItem({ action: 'update:services', target: 'glow' }, lk) === 'Qamar Glow' && O.auditItem({ action: 'update:event_requests', target: 'e1' }, lk) === 'Wedding on 5 Jan 2027 · Amal'
      && O.auditItem({ action: 'update:club_members', target: 'c9' }, lk) === 'Club request (deleted)' && O.auditChange({ before: { price_aed: 169.0, updated_at: 'a' }, after: { price_aed: 179, updated_at: 'b' } }) === 'Price: 169 → 179 AED'
      && O.auditChange({ before: { status: 'new' }, after: { status: 'contacted' } }) === 'Status: New → Contacted' && !/—/.test(O.auditChange({ before: { duration_min: 35 }, after: { duration_min: 40 } })); });
  test('workflow: the hourly rebuild redeploys when the journal OR prices change', () => { const y = readFileSync('.github/workflows/site.yml', 'utf8'); return /\$\{SITE_URL\}content-hash\.txt/.test(y) && /_site\/content-hash\.txt/.test(y); });
}
// Clé anon renseignée + Supabase muet : le build doit échouer (pas de redéploiement sans les articles de l'admin)
{
  const out = mkdtempSync(join(tmpdir(), 'qamar-site-'));
  let code = 0, err = '';
  try { execFileSync(process.execPath, ['scripts/build-site.mjs'], { env: { ...process.env, BLOG_OFFLINE: '', SITE_OUT: out, SUPABASE_URL: 'http://127.0.0.1:9', SUPABASE_ANON_KEY: 'test-anon-key' }, stdio: 'pipe', timeout: 60000 }); }
  catch (e) { code = e.status; err = String(e.stderr || ''); }
  test('build fails when the anon key is set but Supabase does not answer', () => code === 1 && /Supabase is configured but did not answer/.test(err) ? true : { code, err: err.slice(-200) });
  rmSync(out, { recursive: true, force: true });
}
// Build complet hors ligne : aucun brouillon en ligne, admin hors sitemap
try {
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { env: { ...process.env, BLOG_OFFLINE: '1', SITE_URL: 'https://qamarlounge.com/' }, stdio: 'pipe' });
  const sm = readFileSync('_site/sitemap.xml', 'utf8');
  const drafts = loadJsonArticles().filter(a => a.status === 'draft').map(a => a.slug);
  test('full build: no draft page in _site/blog and none in the sitemap', () => drafts.every(s => !existsSync(`_site/blog/${s}.html`) && !existsSync(`_site/blog/ar/${s}.html`) && !sm.includes(`/blog/${s}.html`)));
  test('full build: sitemap is well formed and excludes the admin pages', () => sm.startsWith('<?xml') && sm.trim().endsWith('</urlset>') && (sm.match(/<url>/g) || []).length === (sm.match(/<\/url>/g) || []).length && !/admin\.html|blog-admin/.test(sm));
  test('full build: Journal link in EN and AR footers (home, services, guides)', () => readFileSync('_site/index.html', 'utf8').includes('href="blog/" data-i18n="ft_blog"') && readFileSync('_site/ar.html', 'utf8').includes('href="blog/ar/" data-i18n="ft_blog">المدونة') && readFileSync('_site/services/walk-in-blow-dry-dubai.html', 'utf8').includes('<a href="../blog/">Journal</a>') && readFileSync('_site/guides/ar/steam-abaya-hijab.html', 'utf8').includes('blog/ar/">المدونة'));
  test('full build: blog-admin.html is published with noindex', () => /noindex/.test(readFileSync('_site/blog-admin.html', 'utf8')));
  test('full build: home pages show data.js prices in the visible text (no token left)', () => { const night = runData(readFileSync('assets/data.js', 'utf8')).services.find(x => x.id === 'night').price; const vis = f => readFileSync(f, 'utf8').replace(/<script[\s\S]*?<\/script>/g, ''); return !/\{\{/.test(vis('_site/index.html')) && !/\{\{/.test(vis('_site/ar.html')) && vis('_site/index.html').includes(`data-i18n="n1price">${night} AED<`) && vis('_site/ar.html').includes(`data-i18n="n1price">${Number(night).toLocaleString('ar-EG')} درهماً<`); });
  test('full build offline: data.js prices kept, price data valid, content hash written', () => readFileSync('_site/assets/data.js', 'utf8') === readFileSync('assets/data.js', 'utf8') && /^[0-9a-f]{16}\n$/.test(readFileSync('_site/content-hash.txt', 'utf8')) && /^[0-9a-f]{16}\n$/.test(readFileSync('_site/assets/prices-hash.txt', 'utf8'))
    && runData(readFileSync('_site/assets/data.js', 'utf8')).services.every(x => Number.isInteger(x.price) && x.price > 0 && x.duration <= 45));
  test('full build: go.html, go/index.html and qr-card.html are published, out of the sitemap; sw.js keeps go.html', () => ['go.html', 'go/index.html', 'qr-card.html'].every(f => existsSync('_site/' + f)) && !/go\.html|qr-card/.test(sm) && /'go\.html'/.test(readFileSync('_site/sw.js', 'utf8')));
  test('full build: office.html is published with noindex and out of the sitemap', () => /noindex/.test(readFileSync('_site/office.html', 'utf8')) && !/office\.html/.test(sm));
} catch (e) { test('full build runs', () => 'build failed: ' + (e.stderr || e.message)); }

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
