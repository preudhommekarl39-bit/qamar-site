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

const SITE = (process.env.SITE_URL || 'https://qamarlounge.com/').replace(/\/?$/, '/');
const OUT = '_site';
const PUBLIC = ['index.html', 'queue.html', 'privacy.html', 'legal.html', 'entrance.html', 'station.html', 'admin.html', 'tests.html', 'manifest.webmanifest', 'sw.js', '.nojekyll', 'llms.txt', 'googlee7662b1241ccf348.html', 'de2cfe638b66c13233e988a305c0c8d8.txt'];
const PUBLIC_DIRS = ['assets', 'tests', 'guides', 'services', 'areas'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT);
for (const f of PUBLIC) if (existsSync(f)) cpSync(f, `${OUT}/${f}`);
for (const d of PUBLIC_DIRS) cpSync(d, `${OUT}/${d}`, { recursive: true });

// Données du salon (source unique) : on exécute assets/data.js dans un bac à sable
const sandbox = { window: {} };
vm.runInNewContext(readFileSync('assets/data.js', 'utf8'), sandbox);
const D = sandbox.window.QAMAR_DATA;
vm.runInNewContext(readFileSync('assets/config.js', 'utf8'), sandbox);
const CFG = sandbox.window.QAMAR_CONFIG;
const B = D.brand;

const abs = p => SITE + p.replace(/^\.?\//, '');
const URLS = { en: SITE, ar: abs('ar.html') };
const hreflang = `<link rel="alternate" hreflang="en" href="${URLS.en}">\n<link rel="alternate" hreflang="ar" href="${URLS.ar}">\n<link rel="alternate" hreflang="x-default" href="${URLS.en}">`;

function jsonLd(lang) {
  const ld = {
    '@context': 'https://schema.org', '@type': 'HairSalon', '@id': SITE + '#salon', mainEntityOfPage: URLS[lang],
    name: 'QAMAR Blowdry Lounge', alternateName: 'قمر',
    description: lang === 'ar' ? 'صالون سشوار بدون موعد يفتح قريباً في دبي.' : 'Walk-in blow-dry lounge opening soon in Dubai.',
    url: SITE, logo: abs('assets/app/icon-512.png'), image: abs('assets/og-qamar.png'),
    areaServed: { '@type': 'City', name: 'Dubai' }, knowsLanguage: ['en', 'ar'], inLanguage: lang,
    slogan: lang === 'ar' ? 'ادخلي متعبة. اخرجي جاهزة.' : 'Walk in tired. Walk out ready.',
    knowsAbout: ['blow-dry', 'blowout', 'hair styling', 'women-only salon', 'walk-in salon'],
    hasOfferCatalog: { '@type': 'OfferCatalog', name: lang === 'ar' ? 'الخدمات' : 'Services', itemListElement: (lang === 'ar'
      ? ['سشوار بدون موعد', 'دشّ خاص', 'كيّ الملابس والعباية والحجاب بالبخار وتعطيرها', 'تسريحات للمناسبات', 'أظافر', 'مشروب مجاني']
      : ['Walk-in blow-dry', 'Private shower', 'Outfit, abaya and hijab steaming and perfuming', 'Event hairstyling', 'Nails', 'Complimentary drink']
    ).map(n => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: n } })) }
  };
  // N'apparaissent que lorsqu'ils sont confirmés dans data.js
  if (B.hoursConfirmed && B.hours) ld.openingHoursSpecification = [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], opens: String(B.hours.open).padStart(2, '0') + ':00', closes: B.hours.close >= 24 ? '23:59' : String(B.hours.close).padStart(2, '0') + ':00' }];
  if (B.instagramConfirmed && B.instagram) ld.sameAs = ['https://www.instagram.com/' + B.instagram + '/'];
  if (B.address) ld.address = { '@type': 'PostalAddress', ...B.address, addressCountry: 'AE' };
  if (B.phoneConfirmed && B.whatsapp) ld.telephone = '+' + B.whatsapp;
  return `<script type="application/ld+json" id="ldjson">${JSON.stringify(ld)}</script>`;
}

// Vidéos (balisage VideoObject + sitemap vidéo) : la page arabe pointe vers les versions arabes
const VIDEOS = [
  { id: 'opening', dur: { en: 'PT28S', ar: 'PT29S' },
    name: { en: 'The QAMAR ritual: walk-in blow-dry lounge in Dubai', ar: 'طقوس قمر: صالون سشوار بدون موعد في دبي' },
    desc: { en: 'No appointment, just walk in: a private shower while your clothes and hijab are steamed and perfumed, a blow-dry in 45 minutes or less and a matcha on us. QAMAR Blowdry Lounge, opening March 2027 in Dubai.',
            ar: 'بدون موعد، فقط ادخلي: دش خاص بينما نكوي ملابسكِ وحجابكِ بالبخار ونعطّرها، سشوار في ٤٥ دقيقة أو أقل وماتشا على حسابنا. قمر بلودراي لاونج، الافتتاح مارس ٢٠٢٧ في دبي.' } }
];
const vfile = (v, lang, ext) => `assets/video/qamar-${v.id}${lang === 'ar' ? '-ar' : ''}${ext}`;
const UPLOAD = '2026-11-12T12:00:00+04:00';
function extraLd(lang) {
  const videos = VIDEOS.map(v => ({ '@type': 'VideoObject', name: v.name[lang], description: v.desc[lang], thumbnailUrl: abs(vfile(v, lang, '-poster.jpg')), contentUrl: abs(vfile(v, lang, '.mp4')), uploadDate: UPLOAD, duration: v.dur[lang], inLanguage: lang, about: { '@id': SITE + '#salon' }, publisher: { '@type': 'Organization', name: 'QAMAR Blowdry Lounge', logo: { '@type': 'ImageObject', url: abs('assets/app/icon-512.png') } } }));
  const faq = Object.keys(dict).filter(k => /^faq_q\d+$/.test(k)).sort((a, b) => +a.slice(5) - +b.slice(5)).filter(k => dict['faq_a' + k.slice(5)])
    .map(k => ({ '@type': 'Question', name: dict[k][lang], acceptedAnswer: { '@type': 'Answer', text: dict['faq_a' + k.slice(5)][lang].replace(/<[^>]+>/g, '') } }));
  const graph = [...videos, { '@type': 'FAQPage', inLanguage: lang, mainEntity: faq }, { '@type': 'WebSite', name: 'QAMAR Blowdry Lounge', alternateName: 'قمر', url: SITE, inLanguage: ['en', 'ar'], publisher: { '@id': SITE + '#salon' } }];
  return `<script type="application/ld+json" id="ldjson-extra">${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })}</script>`;
}

function stripSocial(html) {
  if (B.instagramConfirmed) return html;
  return html.replace(/<div data-social>[\s\S]*?<\/div>/g, '').replace(/<a [^>]*data-social>[^<]*<\/a>/g, '').replace(/<span class="kicker" data-social>[^<]*<\/span>/g, '');
}

function seoHead(html, lang, url) {
  html = stripSocial(html);
  html = setHeadTag(html, /<link rel="canonical"[^>]*>/, `<link rel="canonical" href="${url}">`);
  html = html.replace(/(<link rel="canonical"[^>]*>)/, `$1\n${hreflang}`);
  html = setMeta(html, 'property', 'og:url', url);
  html = html.replace(/<meta property="og:image" content="(?!https?:)([^"]+)">/, (m, p) => `<meta property="og:image" content="${abs(p)}">`);
  html = html.replace(/<script type="application\/ld\+json" id="ldjson">[\s\S]*?<\/script>/, jsonLd(lang) + '\n' + extraLd(lang));
  return html;
}

// ---- Accueil anglais ----
const indexSrc = readFileSync('index.html', 'utf8');
const dict = extractDict(indexSrc);
if (CFG.phase !== 'open') Object.assign(dict, extractDict(indexSrc, 'dictPre')); // même règle que la page : textes de préouverture
let en = translateHtml(indexSrc, dict, 'en').html.replace(/<html lang="en" dir="ltr">/, '<html lang="en" dir="ltr" data-page-lang="en" data-lang-href-ar="ar.html">');
en = seoHead(en, 'en', URLS.en);
writeFileSync(`${OUT}/index.html`, en);

// ---- Accueil arabe ----
const { html: arBody, missing } = translateHtml(indexSrc, dict, 'ar');
if (missing.length) { console.error('Arabic translation missing for:', [...new Set(missing)].join(', ')); process.exit(1); }
let ar = arBody.replace(/<html lang="en" dir="ltr">/, '<html lang="ar" dir="rtl" data-page-lang="ar" data-lang-href-en="./">');
ar = ar.replace(/<title>[^<]*<\/title>/, '<title>سشوار دبي بدون موعد | صالون نسائي قرب الشيخ زايد – قمر</title>');
ar = setMeta(ar, 'name', 'description', 'قمر بلودراي لاونج: صالون سشوار نسائي بدون موعد قرب شارع الشيخ زايد في دبي. تسريحتكِ في ٤٥ دقيقة أو أقل، دشّ خاص ومشروب على حسابنا. الافتتاح مارس ٢٠٢٧.');
ar = setMeta(ar, 'property', 'og:title', 'قمر بلودراي لاونج دبي — ادخلي… واخرجي متألقة.');
ar = setMeta(ar, 'property', 'og:description', 'صالون السشوار بدون موعد يفتح قريباً في دبي. كل إطلالة خلال ٤٥ دقيقة أو أقل.');
ar = setMeta(ar, 'property', 'og:image:alt', 'قمر بلودراي لاونج دبي — هلال ذهبي وأقواس على خلفية وردية');
ar = ar.replace('<meta property="og:locale" content="en_AE">', '<meta property="og:locale" content="ar_AE">').replace('<meta property="og:locale:alternate" content="ar_AE">', '<meta property="og:locale:alternate" content="en_AE">');
ar = ar.replace(/<video src="([^"]+)" poster="([^"]+)" data-src-ar="([^"]+)" data-poster-ar="([^"]+)"/g, '<video src="$3" poster="$4" data-src-ar="$3" data-poster-ar="$4"');
ar = ar.replace(/href="guides\/([a-z-]+)\.html" data-guide=/g, 'href="guides/ar/$1.html" data-guide=');
ar = ar.replace('href="services/" data-i18n="ft_services"', 'href="services/ar/" data-i18n="ft_services"');
ar = ar.replaceAll('family=Cormorant+Garamond:wght@400;500&family=Yellowtail&display=swap', 'family=Cormorant+Garamond:wght@400;500&family=Tajawal:wght@400;500;700&family=Yellowtail&family=Amiri&display=swap');
if (!ar.includes('family=Tajawal')) { console.error('Arabic fonts (Tajawal + Amiri) not added to ar.html'); process.exit(1); }
ar = setMeta(ar, 'name', 'twitter:title', 'قمر بلودراي لاونج دبي — ادخلي… واخرجي متألقة.');
ar = setMeta(ar, 'name', 'twitter:description', 'صالون سشوار نسائي بدون موعد قرب شارع الشيخ زايد في دبي: دشّ خاص، ملابسكِ بالبخار، وسشوار في ٤٥ دقيقة. الافتتاح مارس ٢٠٢٧.');
ar = setMeta(ar, 'property', 'og:description', 'صالون سشوار نسائي بدون موعد قرب شارع الشيخ زايد في دبي: دشّ خاص، ملابسكِ بالبخار، وسشوار في ٤٥ دقيقة. الافتتاح مارس ٢٠٢٧.');
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
const xe = t => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const secs = d => d.replace(/\D/g, '');
const vsm = lang => VIDEOS.map(v => `\n    <video:video><video:thumbnail_loc>${abs(vfile(v, lang, '-poster.jpg'))}</video:thumbnail_loc><video:title>${xe(v.name[lang])}</video:title><video:description>${xe(v.desc[lang])}</video:description><video:content_loc>${abs(vfile(v, lang, '.mp4'))}</video:content_loc><video:duration>${secs(v.dur[lang])}</video:duration><video:publication_date>${UPLOAD}</video:publication_date><video:family_friendly>yes</video:family_friendly></video:video>`).join('');
const alt = `\n    <xhtml:link rel="alternate" hreflang="en" href="${URLS.en}"/>\n    <xhtml:link rel="alternate" hreflang="ar" href="${URLS.ar}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${URLS.en}"/>`;
writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  <url><loc>${URLS.en}</loc><lastmod>${today}</lastmod>${alt}${vsm('en')}
  </url>
  <url><loc>${URLS.ar}</loc><lastmod>${today}</lastmod>${alt}${vsm('ar')}
  </url>
${['services', 'areas'].flatMap(d => readdirSync(d).filter(f => f.endsWith('.html')).sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b))).map(f => { const p = f === 'index.html' ? '' : f; const en = abs(`${d}/${p}`), arU = abs(`${d}/ar/${p}`); const has = existsSync(`${d}/ar/${f}`); const a = has ? `\n    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>\n    <xhtml:link rel="alternate" hreflang="ar" href="${arU}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${en}"/>` : ''; return `  <url><loc>${en}</loc><lastmod>${today}</lastmod>${a}\n  </url>\n` + (has ? `  <url><loc>${arU}</loc><lastmod>${today}</lastmod>${a}\n  </url>\n` : ''); })).join('')}${readdirSync('guides').filter(f => f.endsWith('.html')).map(f => { const en = abs('guides/' + f), arU = abs('guides/ar/' + f); const has = existsSync('guides/ar/' + f); const a = has ? `\n    <xhtml:link rel="alternate" hreflang="en" href="${en}"/>\n    <xhtml:link rel="alternate" hreflang="ar" href="${arU}"/>` : ''; return `  <url><loc>${en}</loc><lastmod>${today}</lastmod>${a}\n  </url>\n` + (has ? `  <url><loc>${arU}</loc><lastmod>${today}</lastmod>${a}\n  </url>\n` : ''); }).join('')}</urlset>
`);

console.log(`Built ${OUT}/ for ${SITE}:`, readdirSync(OUT).join(', '));
