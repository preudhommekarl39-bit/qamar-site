// QAMAR — fonctions de build partagées (Node ≥ 18, sans dépendance). Utilisées par build-site.mjs et run-tests.mjs.
// Volontairement en pur traitement de texte pour pouvoir aussi être testées dans un navigateur.

// Extrait l'objet `const dict = { … }` d'une page (dictionnaire EN/AR) en comptant les accolades hors chaînes.
export function extractDict(html, name = 'dict') {
  const start = html.indexOf(`const ${name} = {`);
  if (start < 0) return null;
  let i = html.indexOf('{', start), depth = 0, q = null, esc = false;
  const from = i;
  for (; i < html.length; i++) {
    const c = html[i];
    if (q) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) q = null; continue; }
    if (c === '"' || c === "'" || c === '`') { q = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  // eslint-disable-next-line no-new-func
  return Function('"use strict"; return (' + html.slice(from, i + 1) + ');')();
}

const escAttr = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// Remplace le contenu des éléments [data-i18n] et les placeholders [data-i18n-ph] par la langue demandée.
// Les éléments traduits ne contiennent que du texte ou de l'HTML en ligne (b, br, em, span) : pas d'imbrication du même tag.
export function translateHtml(html, dict, lang) {
  let missing = [];
  let nested = [];
  html = html.replace(/<([a-z0-9]+)(\s(?:[^>]*?\s)?data-i18n="([^"]+)"[^>]*)>([\s\S]*?)<\/\1>/gi, (m, tag, attrs, key, inner) => {
    const v = dict[key]?.[lang];
    if (v == null) { missing.push(key); return m; }
    if (new RegExp(`<${tag}[\\s>]`, 'i').test(inner)) nested.push(key); // même balise imbriquée : remplacement non sûr
    return `<${tag}${attrs}>${v}</${tag}>`;
  });
  if (nested.length) throw new Error('translateHtml: nested tags inside data-i18n elements: ' + nested.join(', '));
  html = html.replace(/<[^>]*\sdata-i18n-ph="([^"]+)"[^>]*>/gi, (m, key) => {
    const v = dict[key]?.[lang];
    return v == null ? m : m.replace(/\splaceholder="[^"]*"/, ` placeholder="${escAttr(v)}"`);
  });
  return { html, missing };
}

// Remplace (ou insère) une balise <meta>/<link> identifiée par son attribut clé dans le <head>.
export function setHeadTag(html, matcher, tag) {
  return matcher.test(html) ? html.replace(matcher, tag) : html.replace('</title>', '</title>\n' + tag);
}

export function setMeta(html, attr, name, content) {
  const re = new RegExp(`<meta ${attr}="${name.replace(/[.:]/g, '\\$&')}" content="[^"]*">`);
  return setHeadTag(html, re, `<meta ${attr}="${name}" content="${escAttr(content)}">`);
}

// Liens relatifs d'une page HTML (href/src) — pour la vérification des liens internes
export function localRefs(html) {
  const out = [];
  html.replace(/\s(?:href|src)="([^"]+)"/g, (m, u) => {
    if (/^(https?:|mailto:|tel:|data:|#|javascript:|\$\{|blob:)/.test(u) || u.includes('${')) return m;
    out.push(u.split('#')[0].split('?')[0]);
    return m;
  });
  return out.filter(Boolean);
}
