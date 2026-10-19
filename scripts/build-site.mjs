// QAMAR — construit le site publié dans _site/ (exécuté par GitHub Actions avant chaque mise en ligne).
//   node scripts/build-site.mjs            → URL du site : SITE_URL (variable d'environnement) ou l'URL GitHub Pages actuelle
// Ce que fait le build (le code source reste inchangé) :
//   • ar.html : vraie page arabe indexable (textes traduits dans le HTML, lang="ar", dir="rtl")
//   • canonical + hreflang (en, ar, x-default) + og:url + images de partage en URL absolues
//   • données structurées HairSalon générées depuis assets/data.js (uniquement les informations confirmées)
//   • sitemap.xml et robots.txt pour l'URL du site
// Le jour où le domaine définitif est acheté : changer SITE_URL (workflow .github/workflows/site.yml), rien d'autre.
import { readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, existsSync, readdirSync } from 'node:fs';
import vm from 'node:vm';
import { extractDict, translateHtml, setHeadTag, setMeta } from './lib.mjs';

const SITE = (process.env.SITE_URL || 'https://preudhommekarl39-bit.github.io/qamar-site/').replace(/\/?$/, '/');
const OUT = '_site';
const PUBLIC = ['index.html', 'queue.html', 'privacy.html', 'legal.html', 'entrance.html', 'station.html', 'admin.html', 'tests.html', 'manifest.webmanifest', 'sw.js', '.nojekyll'];
const PUBLIC_DIRS = ['assets', 'tests'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of PUBLIC) if (existsSync(f)) cpSync(f, `${OUT}/${f}`);
for (const d of PUBLIC_DIRS) cpSync(d, `${OUT}/${d}`, { recursive: true });

// Données du salon (source unique) : on exécute assets/data.js dans un bac à sable
const sandbox = { window: {} };
vm.runInNewContext(readFileSync('assets/data.js', 'utf8'), sandbox);
const D = sandbox.window.QAMAR_DATA;
const B = D.brand;

const abs = p => SITE + p.replace(/^\.?\//, '');
const URLS = { en: SITE, ar: abs('ar.html') };
const hreflang = `<link rel="alternate" hreflang="en" href="${URLS.en}">\n<link rel="alternate" hreflang="ar" href="${URLS.ar}">\n<link rel="alternate" hreflang="x-default" href="${URLS.en}">`;

function jsonLd(lang) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'HairSalon',
    name: 'QAMAR Blowdry Lounge', alternateName: 'قمر',
    description: lang === 'ar' ? 'صالون سشوار بدون موعد يفتح قريباً في دبي.' : 'Walk-in blow-dry lounge opening soon in Dubai.',
    url: URLS[lang], logo: abs('assets/app/icon-512.png'), image: abs('assets/og-qamar.png'),
    areaServed: { '@type': 'City', name: 'Dubai' }, knowsLanguage: ['en', 'ar'], inLanguage: lang
  };
  // N'apparaissent que lorsqu'ils sont confirmés dans data.js
  if (B.hoursConfirmed && B.hours) ld.openingHoursSpecification = [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: String(B.hours.open).padStart(2, '0') + ':00', closes: B.hours.close >= 24 ? '23:59' : String(B.hours.close).padStart(2, '0') + ':00' }];
  if (B.instagramConfirmed && B.instagram) ld.sameAs = ['https://www.instagram.com/' + B.instagram + '/'];
  if (B.address) ld.address = { '@type': 'PostalAddress', ...B.address, addressCountry: 'AE' };
  if (B.phoneConfirmed && B.whatsapp) ld.telephone = '+' + B.whatsapp;
  return `<script type="application/ld+json" id="ldjson">${JSON.stringify(ld)}</script>`;
}

function seoHead(html, lang, url) {
  html = setHeadTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}">`);
  html = html.replace(/(<link rel="canonical"[^>]*>)/, `$1\n${hreflang}`);
  html = setMeta(html, 'property', 'og:url', url);
  html = html.replace(/<meta property="og:image" content="(?!https?:)([^"]+)">/, (m, p) => `<meta property="og:image" content="${abs(p)}">`);
  html = html.replace(/<script type="application\/ld\+json" id="ldjson">[\s\S]*?<\/script>/, jsonLd(lang));
  return html;
}

// ---- Accueil anglais ----
const indexSrc = readFileSync('index.html', 'utf8');
const dict = extractDict(indexSrc);
let en = indexSrc.replace(/<html lang="en" dir="ltr">/, '<html lang="en" dir="ltr" data-page-lang="en" data-lang-href-ar="ar.html">');
en = seoHead(en, 'en', URLS.en);
writeFileSync(`${OUT}/index.html`, en);

// ---- Accueil arabe ----
const { html: arBody, missing } = translateHtml(indexSrc, dict, 'ar');
if (missing.length) { console.error('Arabic translation missing for:', [...new Set(missing)].join(', ')); process.exit(1); }
let ar = arBody.replace(/<html lang="en" dir="ltr">/, '<html lang="ar" dir="rtl" data-page-lang="ar" data-lang-href-en="./">');
ar = ar.replace(/<title>[^<]*<\/title>/, '<title>قمر بلودراي لاونج دبي | سشوار بدون موعد وتسريحات شعر</title>');
ar = setMeta(ar, 'name', 'description', 'صالون سشوار بدون موعد يفتح قريباً في دبي. اختاري إطلالتك — سشوار سريع، تموجات هوليوود، فرد ناعم — وتابعي دورك في الطابور من هاتفك.');
ar = setMeta(ar, 'property', 'og:title', 'قمر بلودراي لاونج دبي — ادخلي. تألّقي.');
ar = setMeta(ar, 'property', 'og:description', 'صالون السشوار بدون موعد يفتح قريباً في دبي. كل إطلالة خلال ٤٥ دقيقة أو أقل.');
ar = setMeta(ar, 'property', 'og:image:alt', 'قمر بلودراي لاونج دبي — هلال ذهبي وأقواس على خلفية وردية');
ar = ar.replace('<meta property="og:locale" content="en_AE">', '<meta property="og:locale" content="ar_AE">').replace('<meta property="og:locale:alternate" content="ar_AE">', '<meta property="og:locale:alternate" content="en_AE">');
ar = seoHead(ar, 'ar', URLS.ar);
writeFileSync(`${OUT}/ar.html`, ar);

// ---- Pages légales : canonical ----
for (const f of ['privacy.html', 'legal.html']) {
  const h = readFileSync(f, 'utf8');
  writeFileSync(`${OUT}/${f}`, setHeadTag(h, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${abs(f)}">`));
}

// ---- Service worker : la page arabe fait partie du cache hors ligne ----
const sw = readFileSync('sw.js', 'utf8').replace("'./', 'index.html',", "'./', 'index.html', 'ar.html',");
writeFileSync(`${OUT}/sw.js`, sw);

// ---- robots.txt et sitemap.xml ----
writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\n\n# Les écrans du personnel portent <meta name="robots" content="noindex"> (robots.txt n'est pas une protection).\nSitemap: ${abs('sitemap.xml')}\n`);
const today = new Date().toISOString().slice(0, 10);
const alt = `\n    <xhtml:link rel="alternate" hreflang="en" href="${URLS.en}"/>\n    <xhtml:link rel="alternate" hreflang="ar" href="${URLS.ar}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${URLS.en}"/>`;
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url><loc>${URLS.en}</loc><lastmod>${today}</lastmod>${alt}
  </url>
  <url><loc>${URLS.ar}</loc><lastmod>${today}</lastmod>${alt}
  </url>
  <url><loc>${abs('privacy.html')}</loc><lastmod>${today}</lastmod></url>
  <url><loc>${abs('legal.html')}</loc><lastmod>${today}</lastmod></url>
</urlset>
`);

console.log(`Built ${OUT}/ for ${SITE}:`, readdirSync(OUT).join(', '));
