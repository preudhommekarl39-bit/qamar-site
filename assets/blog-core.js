/* QAMAR : blog : règles partagées entre le panneau blog-admin.html (navigateur) et le build (scripts/blog.mjs, via vm).
   Aucune dépendance. Ne contient aucun secret.
   Format d'un article (fichier content/blog/<slug>.json ou ligne de la table Supabase « articles ») : voir supabase/README.md, section Blog. */
(function (root) {
  'use strict';
  const CATEGORIES = {
    guides: { en: 'Guides', ar: 'أدلة' },
    'hair-care': { en: 'Hair care', ar: 'العناية بالشعر' },
    occasions: { en: 'Occasions', ar: 'مناسبات' },
    news: { en: 'QAMAR news', ar: 'أخبار قمر' }
  };
  const BLOCK_TYPES = ['p', 'h2', 'callout', 'list'];
  const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  // Liens internes autorisés dans les blocs : [texte](/services/xxx.html), /areas/…, /guides/…, /blog/…, / ou /#ancre
  const LINK_RE = /\[([^\]\n]+)\]\(([^)\s]+)\)/g;
  const ALLOWED_PATH = /^\/(?:(services|areas|guides|blog)\/(?:([a-z0-9-]+)\.html)?)?(#[a-z0-9-]+)?$/;
  const LANGS = ['en', 'ar'];

  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const str = v => (v == null ? '' : String(v)).trim();
  const pair = v => ({ en: str(v && v.en), ar: str(v && v.ar) });

  // Bloc normalisé : { type, text } ; liste : { type:'list', items:[…] } ; encadré : { type:'callout', title, text }
  function normBlock(b) {
    if (!b || !BLOCK_TYPES.includes(b.type)) return null;
    if (b.type === 'list') {
      const items = (Array.isArray(b.items) ? b.items : String(b.text || '').split('\n')).map(str).filter(Boolean);
      return { type: 'list', items };
    }
    if (b.type === 'callout') return { type: 'callout', title: str(b.title), text: str(b.text) };
    return { type: b.type, text: str(b.text) };
  }
  const normBlocks = list => (Array.isArray(list) ? list : []).map(normBlock).filter(b => b && (b.type === 'list' ? b.items.length : b.text));

  // Article canonique (champs absents = chaînes vides)
  function normalize(a) {
    a = a || {};
    const img = a.image && str(a.image.src) ? { src: str(a.image.src), alt: pair(a.image.alt), width: +a.image.width && +a.image.height ? +a.image.width : null, height: +a.image.width && +a.image.height ? +a.image.height : null } : null;
    return {
      slug: str(a.slug), status: a.status === 'published' ? 'published' : 'draft', category: str(a.category) || 'guides',
      title: pair(a.title), summary: pair(a.summary), metaTitle: pair(a.metaTitle), metaDescription: pair(a.metaDescription),
      blocks: { en: normBlocks(a.blocks && a.blocks.en), ar: normBlocks(a.blocks && a.blocks.ar) },
      service: str(a.service), image: img,
      author: { en: str(a.author && a.author.en) || 'QAMAR team', ar: str(a.author && a.author.ar) || 'فريق قمر', type: a.author && a.author.type === 'Person' ? 'Person' : 'Organization' },
      reviewedBy: pair(a.reviewedBy),
      datePublished: str(a.datePublished), dateModified: str(a.dateModified) || str(a.datePublished),
      updatedAt: str(a.updatedAt) || '', source: a.source || ''
    };
  }

  // L'article a-t-il une version arabe complète ?
  const hasArabic = a => !!(a.title.ar && a.blocks.ar.length);

  // Texte en ligne : échappé, puis **gras** et liens internes autorisés. resolve(path) → href relatif, ou null si refusé.
  function inline(text, resolve, bad) {
    let out = '', last = 0;
    String(text || '').replace(LINK_RE, (m, label, path, i) => {
      out += fmt(text.slice(last, i));
      const href = ALLOWED_PATH.test(path) && resolve ? resolve(path) : null;
      if (href) out += `<a href="${esc(href)}">${fmt(label)}</a>`;
      else { out += fmt(label); if (bad) bad.push(path); }
      last = i + m.length; return m;
    });
    return out + fmt(String(text || '').slice(last));
  }
  const fmt = s => esc(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

  function renderBlocks(blocks, resolve, bad) {
    return normBlocks(blocks).map(b => {
      if (b.type === 'h2') return `<h2>${esc(b.text.replace(LINK_RE, '$1'))}</h2>`;
      if (b.type === 'list') return '<ul>' + b.items.map(x => `<li>${inline(x, resolve, bad)}</li>`).join('') + '</ul>';
      const paras = b.text.split(/\n\s*\n/).map(p => `<p>${inline(p.trim(), resolve, bad).replace(/\n/g, '<br>')}</p>`).join('');
      if (b.type === 'callout') return `<aside class="callout">${b.title ? `<p class="callout-t">${esc(b.title)}</p>` : ''}${paras}</aside>`;
      return paras;
    }).join('\n');
  }

  const plain = blocks => normBlocks(blocks).map(b => (b.type === 'list' ? b.items.join(' ') : (b.title ? b.title + ' ' : '') + b.text)).join(' ').replace(LINK_RE, '$1');
  const words = blocks => plain(blocks).split(/\s+/).filter(Boolean).length;
  const readingMinutes = blocks => Math.max(1, Math.round(words(blocks) / 200));

  // Liens présents dans les blocs (pour la validation)
  function linksOf(blocks) {
    const out = [];
    normBlocks(blocks).forEach(b => [b.text, b.title, ...(b.items || [])].forEach(t => String(t || '').replace(LINK_RE, (m, l, p) => { out.push(p); return m; })));
    return out;
  }

  /* Contrôle d'un article. ctx.services : liste des pages services existantes (slugs) ; ctx.exists(path) : la cible d'un lien existe.
     Renvoie une liste d'erreurs (vide = publiable). Les brouillons sont contrôlés de la même façon, mais le build ne bloque que sur les publiés. */
  function validate(raw, ctx) {
    ctx = ctx || {};
    const a = normalize(raw), e = [];
    if (!SLUG_RE.test(a.slug)) e.push('slug: lowercase letters, digits and hyphens only (e.g. walk-in-blow-dry-guide)');
    if (!CATEGORIES[a.category]) e.push('category: one of ' + Object.keys(CATEGORIES).join(', '));
    if (!a.title.en) e.push('title.en is required');
    if (!a.summary.en) e.push('summary.en is required');
    if (!a.metaDescription.en) e.push('metaDescription.en is required');
    if (!a.blocks.en.length) e.push('blocks.en: at least one block');
    const anyAr = a.title.ar || a.summary.ar || a.metaDescription.ar || a.blocks.ar.length;
    if (anyAr) ['title', 'summary', 'metaDescription'].forEach(k => { if (!a[k].ar) e.push(k + '.ar is required when the Arabic version is started'); });
    if (anyAr && !a.blocks.ar.length) e.push('blocks.ar: at least one block when the Arabic version is started');
    LANGS.forEach(l => {
      const mt = a.metaTitle[l] || a.title[l];
      if (mt && mt.length > 70) e.push(`metaTitle.${l}: ${mt.length} characters, keep it under 70`);
      if (a.metaDescription[l] && a.metaDescription[l].length > 170) e.push(`metaDescription.${l}: ${a.metaDescription[l].length} characters, keep it under 170`);
    });
    if (!a.service) e.push('service: choose the linked service page');
    else if (ctx.services && !ctx.services.includes(a.service)) e.push('service: unknown service page "' + a.service + '"');
    if (a.status === 'published' && !DATE_RE.test(a.datePublished)) e.push('datePublished: YYYY-MM-DD required to publish');
    if (a.datePublished && !DATE_RE.test(a.datePublished)) e.push('datePublished: YYYY-MM-DD');
    if (a.dateModified && !DATE_RE.test(a.dateModified)) e.push('dateModified: YYYY-MM-DD');
    if (DATE_RE.test(a.datePublished) && DATE_RE.test(a.dateModified) && a.dateModified < a.datePublished) e.push('dateModified is before datePublished');
    if (a.image && !/^(https:\/\/|assets\/)/.test(a.image.src)) e.push('image.src: a path under assets/ or an https:// URL');
    if (a.image && !a.image.alt.en) e.push('image.alt.en is required when there is an image');
    LANGS.forEach(l => linksOf(a.blocks[l]).forEach(p => {
      if (!ALLOWED_PATH.test(p)) e.push(`blocks.${l}: link "${p}" is not allowed (internal links only: /services/…, /areas/…, /guides/…, /blog/…)`);
      else if (ctx.exists && !ctx.exists(p)) e.push(`blocks.${l}: link "${p}" points to a page that does not exist`);
    }));
    // Règles de contenu QAMAR : pas d'emoji, pas de tiret cadratin
    const all = JSON.stringify([a.title, a.summary, a.metaTitle, a.metaDescription, a.blocks, a.author, a.reviewedBy, a.image && a.image.alt]);
    if (/\u2014/.test(all)) e.push('em dash (\u2014) found: use a comma, a colon or a full stop');
    if (/\p{Extended_Pictographic}/u.test(all)) e.push('emoji found: remove it');
    return e;
  }

  // Ligne Supabase ↔ article
  function fromRow(r) {
    return normalize({
      slug: r.slug, status: r.status, category: r.category,
      title: { en: r.title_en, ar: r.title_ar }, summary: { en: r.summary_en, ar: r.summary_ar },
      metaTitle: { en: r.meta_title_en, ar: r.meta_title_ar }, metaDescription: { en: r.meta_description_en, ar: r.meta_description_ar },
      blocks: { en: r.blocks_en, ar: r.blocks_ar }, service: r.service,
      image: r.image_src ? { src: r.image_src, alt: { en: r.image_alt_en, ar: r.image_alt_ar }, width: r.image_width, height: r.image_height } : null,
      author: { en: r.author_en, ar: r.author_ar, type: r.author_type }, reviewedBy: { en: r.reviewed_by_en, ar: r.reviewed_by_ar },
      datePublished: r.date_published, dateModified: r.date_modified, updatedAt: r.updated_at, source: 'supabase'
    });
  }
  function toRow(raw) {
    const a = normalize(raw);
    return {
      slug: a.slug, status: a.status, category: a.category,
      title_en: a.title.en, title_ar: a.title.ar, summary_en: a.summary.en, summary_ar: a.summary.ar,
      meta_title_en: a.metaTitle.en, meta_title_ar: a.metaTitle.ar, meta_description_en: a.metaDescription.en, meta_description_ar: a.metaDescription.ar,
      blocks_en: a.blocks.en, blocks_ar: a.blocks.ar, service: a.service,
      image_src: a.image ? a.image.src : null, image_alt_en: a.image ? a.image.alt.en : null, image_alt_ar: a.image ? a.image.alt.ar : null, image_width: a.image ? a.image.width : null, image_height: a.image ? a.image.height : null,
      author_en: a.author.en, author_ar: a.author.ar, author_type: a.author.type, reviewed_by_en: a.reviewedBy.en || null, reviewed_by_ar: a.reviewedBy.ar || null,
      date_published: a.datePublished || null, date_modified: a.dateModified || null
    };
  }

  // Dates affichées : « 1 December 2026 » / « ١ ديسمبر ٢٠٢٦ »
  function formatDate(iso, lang) {
    if (!DATE_RE.test(iso || '')) return '';
    const d = new Date(iso + 'T00:00:00Z');
    try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-AE-u-nu-arab' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(d); }
    catch (_) { return iso; }
  }
  const arDigits = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
  function readingLabel(n, lang) {
    if (lang !== 'ar') return n + ' min read';
    if (n === 1) return 'قراءة دقيقة واحدة';
    if (n === 2) return 'قراءة دقيقتين';
    return 'قراءة ' + arDigits(n) + (n <= 10 ? ' دقائق' : ' دقيقة');
  }

  root.QAMAR_BLOG = { CATEGORIES, BLOCK_TYPES, SLUG_RE, ALLOWED_PATH, LINK_RE, esc, normalize, normBlocks, hasArabic, inline, renderBlocks, plain, words, readingMinutes, linksOf, validate, fromRow, toRow, formatDate, readingLabel, arDigits };
})(typeof window !== 'undefined' ? window : globalThis);
