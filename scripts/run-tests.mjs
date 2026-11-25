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
import { loadCore, loadJsonArticles, fetchSupabaseArticles, mergeArticles, siteContext, buildBlog, sitemapEntry } from './blog.mjs';
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
test('staff pages are noindex', () => ['admin.html', 'blog-admin.html', 'station.html', 'entrance.html', 'tests.html', 'queue.html'].every(f => /<meta name="robots" content="noindex/.test(readFileSync(f, 'utf8'))));
test('every indexable page has a unique title and a description', () => { const pages = ['index.html', 'privacy.html', 'legal.html']; const titles = pages.map(f => (readFileSync(f, 'utf8').match(/<title>([^<]+)<\/title>/) || [])[1]); return new Set(titles).size === pages.length && pages.every(f => /<meta name="description" content="[^"]{50,}"/.test(readFileSync(f, 'utf8'))); });
test('structured data contains no unconfirmed hours, address, rating or price', () => { const ld = (readFileSync('index.html', 'utf8').match(/application\/ld\+json"[^>]*>([^<]+)</) || [])[1]; const o = JSON.parse(ld); return !o.openingHours && !o.openingHoursSpecification && !o.address && !o.aggregateRating && !o.priceRange; });

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
} catch (e) { test('full build runs', () => 'build failed: ' + (e.stderr || e.message)); }

console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
