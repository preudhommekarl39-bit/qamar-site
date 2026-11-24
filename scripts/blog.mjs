// QAMAR : blog : génère les pages statiques du journal (EN + AR) dans _site/blog/.
// Deux sources fusionnées au build :
//   (a) content/blog/<slug>.json dans le dépôt (publication par git) ;
//   (b) la table Supabase « articles » (panneau blog-admin.html), lue avec la clé publique anon : la RLS ne renvoie que les articles publiés.
// Si Supabase est injoignable ou non configuré, on garde (a) et le build continue.
// Les brouillons ne sont JAMAIS écrits dans _site.
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

export function loadCore(file = 'assets/blog-core.js') {
  const sb = { window: {} };
  vm.runInNewContext(readFileSync(file, 'utf8'), sb);
  return sb.window.QAMAR_BLOG;
}
const B = loadCore();

// ---- Sources ----
export function loadJsonArticles(dir = 'content/blog') {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => {
    let raw;
    try { raw = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')); } catch (e) { throw new Error(`${dir}/${f}: invalid JSON (${e.message})`); }
    const a = B.normalize({ ...raw, source: `${dir}/${f}` });
    if (!f.startsWith('_') && f !== a.slug + '.json') throw new Error(`${dir}/${f}: the file name must be "<slug>.json" ("${a.slug}.json")`);
    return a;
  });
}

// Colonnes lisibles avec la clé anon (migration 006)
export const PUBLIC_COLUMNS = 'slug,status,category,title_en,title_ar,summary_en,summary_ar,meta_title_en,meta_title_ar,meta_description_en,meta_description_ar,blocks_en,blocks_ar,service,image_src,image_alt_en,image_alt_ar,image_width,image_height,author_en,author_ar,author_type,reviewed_by_en,reviewed_by_ar,date_published,date_modified,updated_at';

export async function fetchSupabaseArticles({ url, key, timeoutMs = 10000 } = {}) {
  if (!url || !key) return { ok: false, reason: 'Supabase not configured (supabaseUrl / supabaseAnonKey empty)', articles: [] };
  try {
    const res = await fetch(url.replace(/\/$/, '') + '/rest/v1/articles?select=' + PUBLIC_COLUMNS + '&status=eq.published&order=date_published.desc', {
      headers: { apikey: key, Authorization: 'Bearer ' + key, Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs)
    });
    if (!res.ok) return { ok: false, reason: `Supabase HTTP ${res.status}`, articles: [] };
    const rows = await res.json();
    if (!Array.isArray(rows)) return { ok: false, reason: 'Supabase: unexpected answer', articles: [] };
    return { ok: true, articles: rows.map(B.fromRow) };
  } catch (e) { return { ok: false, reason: 'Supabase unreachable: ' + e.message, articles: [] }; }
}

// Même slug dans les deux sources : la version modifiée le plus récemment gagne (à égalité : Supabase, l'admin).
export function mergeArticles(jsonArts, dbArts) {
  const map = new Map();
  for (const a of jsonArts) map.set(a.slug, a);
  for (const a of dbArts) {
    const cur = map.get(a.slug);
    if (!cur || (a.dateModified || '') >= (cur.dateModified || '')) map.set(a.slug, a);
  }
  return [...map.values()];
}

// ---- Contexte du site (pages existantes, pour les liens internes) ----
export function siteContext(root = '.') {
  const list = d => (existsSync(`${root}/${d}`) ? readdirSync(`${root}/${d}`).filter(f => f.endsWith('.html') && f !== 'index.html').map(f => f.slice(0, -5)) : []);
  const pages = { services: list('services'), areas: list('areas'), guides: list('guides') };
  const arPages = { services: list('services/ar'), areas: list('areas/ar'), guides: list('guides/ar') };
  const h1 = f => { try { const m = readFileSync(`${root}/${f}`, 'utf8').match(/<h1>([\s\S]*?)<\/h1>/); return m ? m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim() : ''; } catch (_) { return ''; } };
  const serviceName = (slug, lang) => (lang === 'ar' && arPages.services.includes(slug) ? h1(`services/ar/${slug}.html`) : h1(`services/${slug}.html`)) || slug;
  const style = f => { const m = readFileSync(`${root}/${f}`, 'utf8').match(/<style>([\s\S]*?)<\/style>/); if (!m) throw new Error('blog: CSS not found in ' + f); return m[1]; };
  return { pages, arPages, serviceName, css: { en: style('services/index.html'), ar: style('services/ar/index.html') } };
}

// ---- Rendu ----
const UI = {
  en: { dir: 'ltr', loc: 'en_AE', journal: 'Journal', home: 'Home', hub: 'Services & areas', other: 'العربية', brand: 'QAMAR', by: 'By', published: 'Published', updated: 'Updated', reviewed: 'Reviewed by', related: 'Related service', more: 'More from the journal', all: 'All articles', cta: 'Discover QAMAR', looks: 'See all looks', club: 'QAMAR Club', privacy: 'Privacy', legal: 'Legal notice', sign: '© QAMAR Blowdry Lounge · Dubai',
        idxTitle: 'Journal: blow-dry and hair tips in Dubai | QAMAR', idxH1: 'The QAMAR journal', idxLead: 'Practical guides on blow-dries, hair care in the Dubai climate and getting ready fast, written by the QAMAR team.', idxDesc: 'Guides from the QAMAR team on blow-dries, hair care in the Dubai heat and humidity, and getting ready fast. A women-only walk-in lounge opening March 2027.', empty: 'Our first articles are on their way.', read: 'Read the article' },
  ar: { dir: 'rtl', loc: 'ar_AE', journal: 'المدونة', home: 'الرئيسية', hub: 'الخدمات والمناطق', other: 'English', brand: 'قمر', by: 'بقلم', published: 'نُشر في', updated: 'آخر تحديث', reviewed: 'راجعته', related: 'الخدمة المرتبطة', more: 'المزيد من المدونة', all: 'كل المقالات', cta: 'اكتشفي قمر', looks: 'كل الإطلالات', club: 'نادي قمر', privacy: 'الخصوصية', legal: 'إشعار قانوني', sign: '© قمر بلودراي لاونج · دبي',
        idxTitle: 'مدونة قمر: نصائح السشوار والعناية بالشعر في دبي', idxH1: 'مدونة قمر', idxLead: 'أدلة عملية عن السشوار والعناية بالشعر في طقس دبي والاستعداد بسرعة، يكتبها فريق قمر.', idxDesc: 'أدلة من فريق قمر عن السشوار والعناية بالشعر في حرّ دبي ورطوبتها والاستعداد بسرعة. صالون نسائي بدون موعد يفتح في مارس ٢٠٢٧.', empty: 'أولى مقالاتنا في الطريق.', read: 'اقرئي المقال' }
};
const EXTRA_CSS = '.crumbs{align-items:center}.kicker{font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:var(--rose-ink);margin:28px 0 0;font-weight:500}[dir=rtl] .kicker{letter-spacing:0}.byline{font-size:15px;color:var(--ink2);margin:0 0 8px}.byline span{display:inline-block}.byline span+span:before{content:"·";margin-inline:8px}.callout{background:#fff;border:1px solid var(--line);border-inline-start:4px solid var(--rose);border-radius:16px;padding:4px 22px;margin:32px 0}.callout-t{font-weight:500;margin-bottom:0}article h2{scroll-margin-top:16px}.posts{list-style:none;padding:0;margin:28px 0;display:grid;gap:16px}.posts li{position:relative;background:#fff;border:1px solid var(--line);border-radius:18px;padding:6px 22px 14px;margin:0}.posts h2{font-size:26px;margin:6px 0}.posts h2 a{color:var(--ink);text-decoration:none}.posts h2 a::after{content:"";position:absolute;inset:0;border-radius:inherit}.posts p{margin:4px 0;color:var(--ink2)}.posts .kicker{margin-top:12px}.posts li:hover{border-color:var(--rose)}.empty{background:#fff;border:1px dashed var(--line);border-radius:18px;padding:18px 22px}';

export const dubaiToday = () => new Date(Date.now() + 4 * 3600e3).toISOString().slice(0, 10);
const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const iso = d => d + 'T00:00:00+04:00';

function head({ lang, title, desc, canonical, alt, ld, P, css, robots = 'index, follow, max-image-preview:large', ogType = 'article', ogImage }) {
  const u = UI[lang], t = B.esc(title), d = B.esc(desc);
  const fonts = `https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500&family=Jost:wght@300;500${lang === 'ar' ? '&family=Tajawal:wght@300;400;500' : ''}&display=swap`;
  const altLinks = alt ? `\n<link rel="alternate" hreflang="en" href="${alt.en}"><link rel="alternate" hreflang="ar" href="${alt.ar}"><link rel="alternate" hreflang="x-default" href="${alt.en}">` : '';
  return `<!doctype html>
<html lang="${lang}" dir="${u.dir}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${canonical}">${altLinks}
<meta property="og:type" content="${ogType}"><meta property="og:site_name" content="QAMAR Blowdry Lounge"><meta property="og:locale" content="${u.loc}"><meta property="og:title" content="${t}"><meta property="og:description" content="${d}"><meta property="og:image" content="${ogImage}"><meta property="og:url" content="${canonical}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}"><meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${ogImage}">
<meta name="theme-color" content="#F3D3D6">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<link rel="icon" href="${P}assets/app/favicon-32.png" type="image/png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preload" as="style" href="${fonts}" onload="this.onload=null;this.rel='stylesheet'"><noscript><link rel="stylesheet" href="${fonts}"></noscript>
<style>${css}${EXTRA_CSS}</style>
</head>
<body>`;
}

function chrome(lang, P, otherHref) {
  const u = UI[lang], ar = lang === 'ar';
  const home = ar ? `${P}ar.html` : P, hub = `${P}services/${ar ? 'ar/' : ''}`, blog = `${P}blog/${ar ? 'ar/' : ''}`;
  const other = otherHref ? `<a href="${otherHref}" hreflang="${ar ? 'en' : 'ar'}" lang="${ar ? 'en' : 'ar'}">${u.other}</a>` : '';
  return {
    home, hub, blog,
    header: `<header><div class="w"><a class="brand" href="${home}" translate="no">QAMAR</a><nav><a href="${blog}">${u.journal}</a><a href="${hub}">${u.hub}</a>${other}</nav></div></header>`,
    footer: `<footer><div class="w"><span translate="no">${u.sign}</span><nav><a href="${home}">${u.home}</a><a href="${home}#looks">${u.looks}</a><a href="${home}#club">${u.club}</a><a href="${hub}">${u.hub}</a><a href="${blog}">${u.journal}</a><a href="${P}privacy.html">${u.privacy}</a><a href="${P}legal.html">${u.legal}</a></nav></div></footer>\n</body>\n</html>\n`
  };
}

/* Construit le journal.
   opts : { out: '_site', site: 'https://qamarlounge.com/', articles: [...] (toutes sources, tous statuts), ctx: siteContext() }
   Renvoie { published, sitemap: [{ loc, lastmod, alt }], hash, errors } */
export function buildBlog({ out, site, articles, ctx, today = dubaiToday() }) {
  const abs = p => site + p;
  const services = ctx.pages.services;
  // Publiés seulement, et dont la date de publication est arrivée (une date future = article programmé, mis en ligne par le build planifié)
  const pub = articles.filter(a => a.status === 'published' && !(a.datePublished > today));
  const slugsAr = new Set(pub.filter(B.hasArabic).map(a => a.slug)), slugsEn = new Set(pub.map(a => a.slug));
  const exists = p => {
    const m = p.match(B.ALLOWED_PATH); if (!m) return false;
    const [, dir, slug] = m;
    if (!dir) return true;
    if (!slug) return dir === 'services' || dir === 'blog';
    return dir === 'blog' ? slugsEn.has(slug) : (ctx.pages[dir] || []).includes(slug);
  };
  const errors = [];
  const ok = pub.filter(a => { const e = B.validate(a, { services, exists }); if (e.length) errors.push({ slug: a.slug, source: a.source, errors: e }); return !e.length; })
    .sort((a, b) => (b.datePublished || '').localeCompare(a.datePublished || '') || a.slug.localeCompare(b.slug));

  // Lien interne d'un bloc → href relatif à la page (AR : version arabe si elle existe)
  const resolver = (lang, P) => path => {
    const m = path.match(B.ALLOWED_PATH); if (!m) return null;
    const [, dir, slug, hash = ''] = m;
    const ar = lang === 'ar';
    if (!dir) return (ar ? `${P}ar.html` : P || './') + hash;
    if (!slug) return `${P}${dir}/${ar && dir !== 'guides' ? 'ar/' : ''}${hash}`;
    const hasAr = dir === 'blog' ? slugsAr.has(slug) : (ctx.arPages[dir] || []).includes(slug);
    return `${P}${dir}/${ar && hasAr ? 'ar/' : ''}${slug}.html${hash}`;
  };

  mkdirSync(`${out}/blog/ar`, { recursive: true });
  // Pages existantes pour le panneau admin (liste des services, aide aux liens internes) : données publiques, sans contenu d'article
  writeFileSync(`${out}/blog/link-targets.json`, JSON.stringify({
    services: services.map(s => ({ slug: s, en: ctx.serviceName(s, 'en'), ar: ctx.serviceName(s, 'ar') })),
    areas: ctx.pages.areas.map(s => ({ slug: s })), guides: ctx.pages.guides.map(s => ({ slug: s }))
  }));
  const sitemap = [];
  const urlOf = (slug, lang) => abs(`blog/${lang === 'ar' ? 'ar/' : ''}${slug}.html`);

  for (const a of ok) {
    const hasAr = B.hasArabic(a);
    const alt = hasAr ? { en: urlOf(a.slug, 'en'), ar: urlOf(a.slug, 'ar') } : null;
    for (const lang of hasAr ? ['en', 'ar'] : ['en']) {
      const u = UI[lang], P = lang === 'ar' ? '../../' : '../', url = urlOf(a.slug, lang);
      const other = hasAr ? (lang === 'ar' ? `../${a.slug}.html` : `ar/${a.slug}.html`) : null;
      const c = chrome(lang, P, other);
      const title = a.metaTitle[lang] || `${a.title[lang]} | ${u.brand}`;
      const desc = a.metaDescription[lang];
      const cat = (B.CATEGORIES[a.category] || {})[lang] || a.category;
      const imgAbs = a.image ? (a.image.src.startsWith('https://') ? a.image.src : abs(a.image.src)) : abs('assets/og-qamar.png');
      const author = { '@type': a.author.type, name: a.author[lang] || a.author.en, ...(a.author.type === 'Organization' ? { url: site } : {}) };
      const svcUrl = abs(`services/${lang === 'ar' && ctx.arPages.services.includes(a.service) ? 'ar/' : ''}${a.service}.html`);
      const blogIdx = abs(`blog/${lang === 'ar' ? 'ar/' : ''}`);
      const crumbs = [[u.brand, lang === 'ar' ? abs('ar.html') : site, c.home], [u.journal, blogIdx, c.blog], [a.title[lang], url, null]];
      const ld = { '@context': 'https://schema.org', '@graph': [
        { '@type': 'WebPage', '@id': url + '#webpage', url, name: title, description: desc, inLanguage: lang, isPartOf: { '@type': 'WebSite', name: 'QAMAR Blowdry Lounge', url: site }, breadcrumb: { '@id': url + '#breadcrumb' },
          ...(a.reviewedBy[lang] ? { reviewedBy: { '@type': 'Person', name: a.reviewedBy[lang] } } : {}) },
        { '@type': 'BlogPosting', '@id': url + '#article', headline: a.title[lang].slice(0, 110), description: desc, inLanguage: lang, articleSection: cat,
          image: [imgAbs], datePublished: iso(a.datePublished), dateModified: iso(a.dateModified || a.datePublished),
          author, publisher: { '@type': 'Organization', '@id': site + '#salon', name: 'QAMAR Blowdry Lounge', logo: { '@type': 'ImageObject', url: abs('assets/app/icon-512.png') } },
          mainEntityOfPage: { '@id': url + '#webpage' }, about: { '@type': 'Service', name: ctx.serviceName(a.service, lang), url: svcUrl }, wordCount: B.words(a.blocks[lang]) },
        { '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: crumbs.map(([n, it], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: it })) }
      ] };
      const bad = [];
      const body = B.renderBlocks(a.blocks[lang], resolver(lang, P), bad);
      const updated = a.dateModified && a.dateModified !== a.datePublished;
      const byline = `<p class="byline"><span>${u.by} ${B.esc(a.author[lang] || a.author.en)}</span><span>${u.published} <time datetime="${a.datePublished}">${B.formatDate(a.datePublished, lang)}</time></span>${updated ? `<span>${u.updated} <time datetime="${a.dateModified}">${B.formatDate(a.dateModified, lang)}</time></span>` : ''}${a.reviewedBy[lang] ? `<span>${u.reviewed} ${B.esc(a.reviewedBy[lang])}</span>` : ''}<span>${B.readingLabel(B.readingMinutes(a.blocks[lang]), lang)}</span></p>`;
      const imgSrc = a.image ? (a.image.src.startsWith('https://') ? a.image.src : P + a.image.src) : '';
      const fig = a.image ? `<figure><img src="${B.esc(imgSrc)}" alt="${B.esc(a.image.alt[lang] || a.image.alt.en)}"${a.image.width ? ` width="${a.image.width}" height="${a.image.height}"` : ''} fetchpriority="high" decoding="async"></figure>` : '';
      const svcHref = resolver(lang, P)(`/services/${a.service}.html`);
      const others = ok.filter(o => o.slug !== a.slug && (lang === 'en' || B.hasArabic(o))).slice(0, 3);
      const crumbHtml = '<ol class="crumbs">' + crumbs.map(([n, , h]) => (h ? `<li><a href="${h}">${B.esc(n)}</a></li>` : `<li aria-current="page">${B.esc(n)}</li>`)).join('') + '</ol>';
      const html = head({ lang, title, desc, canonical: url, alt, ld, P, css: ctx.css[lang], ogImage: imgAbs }) + `
${c.header}
<main class="w">
${crumbHtml}
<article>
<p class="kicker">${B.esc(cat)}</p>
<h1>${B.esc(a.title[lang])}</h1>
<p class="lead">${B.esc(a.summary[lang])}</p>
${byline}
${fig}
${body}
</article>
<div class="box"><h2>${u.related}</h2><p><a href="${svcHref}">${B.esc(ctx.serviceName(a.service, lang))}</a></p></div>
<a class="cta" href="${c.home}">${u.cta}</a>
<div class="more"><h2>${u.more}</h2>${others.length ? '<ul>' + others.map(o => `<li><a href="${o.slug}.html">${B.esc(o.title[lang])}</a></li>`).join('') + '</ul>' : ''}<p><a href="./">${u.all}</a></p></div>
</main>
${c.footer}`;
      if (bad.length) errors.push({ slug: a.slug, source: a.source, errors: bad.map(p => 'link refused: ' + p) });
      writeFileSync(`${out}/blog/${lang === 'ar' ? 'ar/' : ''}${a.slug}.html`, html);
      sitemap.push({ loc: url, lastmod: a.dateModified || a.datePublished, alt });
    }
  }

  // Pages sommaires /blog/ et /blog/ar/
  for (const lang of ['en', 'ar']) {
    const u = UI[lang], P = lang === 'ar' ? '../../' : '../';
    const list = ok.filter(a => lang === 'en' || B.hasArabic(a));
    const url = abs(`blog/${lang === 'ar' ? 'ar/' : ''}`);
    const alt = { en: abs('blog/'), ar: abs('blog/ar/') };
    const c = chrome(lang, P, lang === 'ar' ? '../' : 'ar/');
    const crumbs = [[u.brand, lang === 'ar' ? abs('ar.html') : site, c.home], [u.journal, url, null]];
    const ld = { '@context': 'https://schema.org', '@graph': [
      { '@type': 'CollectionPage', '@id': url + '#webpage', url, name: u.idxTitle, description: u.idxDesc, inLanguage: lang, isPartOf: { '@type': 'WebSite', name: 'QAMAR Blowdry Lounge', url: site }, breadcrumb: { '@id': url + '#breadcrumb' },
        ...(list.length ? { mainEntity: { '@type': 'ItemList', itemListElement: list.map((a, i) => ({ '@type': 'ListItem', position: i + 1, url: urlOf(a.slug, lang), name: a.title[lang] })) } } : {}) },
      { '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: crumbs.map(([n, it], i) => ({ '@type': 'ListItem', position: i + 1, name: n, item: it })) }
    ] };
    const cards = list.length ? '<ul class="posts">' + list.map(a => `<li><p class="kicker">${B.esc((B.CATEGORIES[a.category] || {})[lang] || a.category)} · <time datetime="${a.datePublished}">${B.formatDate(a.datePublished, lang)}</time></p><h2><a href="${a.slug}.html">${B.esc(a.title[lang])}</a></h2><p>${B.esc(a.summary[lang])}</p></li>`).join('') + '</ul>' : `<p class="empty">${u.empty}</p>`;
    const crumbHtml = '<ol class="crumbs">' + crumbs.map(([n, , h]) => (h ? `<li><a href="${h}">${B.esc(n)}</a></li>` : `<li aria-current="page">${B.esc(n)}</li>`)).join('') + '</ol>';
    // Journal vide : page en noindex et absente du sitemap (pas de page creuse indexée)
    const html = head({ lang, title: u.idxTitle, desc: u.idxDesc, canonical: url, alt, ld, P, css: ctx.css[lang], robots: list.length ? 'index, follow, max-image-preview:large' : 'noindex, follow', ogType: 'website', ogImage: abs('assets/og-qamar.png') }) + `
${c.header}
<main class="w">
${crumbHtml}
<h1>${u.idxH1}</h1>
<p class="lead">${u.idxLead}</p>
${cards}
<a class="cta" href="${c.home}">${u.cta}</a>
</main>
${c.footer}`;
    writeFileSync(`${out}/blog/${lang === 'ar' ? 'ar/' : ''}index.html`, html);
    if (list.length) sitemap.unshift({ loc: url, lastmod: list.map(a => a.dateModified || a.datePublished).sort().pop(), alt });
  }

  // Empreinte du contenu publié : le workflow planifié ne redéploie que si elle change
  const hash = createHash('sha256').update(JSON.stringify(ok.map(a => { const { source, updatedAt, ...rest } = a; return rest; }))).digest('hex');
  writeFileSync(`${out}/blog/content-hash.txt`, hash + '\n');
  return { published: ok, sitemap, hash, errors };
}

// Liste des articles publiés liés à une page service (pour le lien retour depuis la page service)
export function articlesForService(published, service) {
  return published.filter(a => a.service === service);
}

export const sitemapEntry = ({ loc, lastmod, alt }) => `  <url><loc>${xmlEsc(loc)}</loc><lastmod>${lastmod}</lastmod>${alt ? `\n    <xhtml:link rel="alternate" hreflang="en" href="${xmlEsc(alt.en)}"/>\n    <xhtml:link rel="alternate" hreflang="ar" href="${xmlEsc(alt.ar)}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${xmlEsc(alt.en)}"/>` : ''}\n  </url>\n`;
