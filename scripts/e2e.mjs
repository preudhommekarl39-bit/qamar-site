// QAMAR — tests de parcours dans un vrai navigateur (Chromium via Playwright) + contrôles HTTP des domaines.
// Exécuté par .github/workflows/quality.yml après chaque mise en ligne :  BASE=https://qamarlounge.com node scripts/e2e.mjs
// Teste le site PUBLIÉ (pas une copie locale) : ce qui passe ici est ce que voient réellement les clientes.
import { chromium, devices } from 'playwright';

const BASE = (process.env.BASE || 'https://qamarlounge.com').replace(/\/$/, '');
let pass = 0, fail = 0;
const results = [];
async function test(name, fn) {
  try { const r = await fn(); if (r !== true) throw new Error('got ' + JSON.stringify(r)); pass++; results.push('✓ ' + name); }
  catch (e) { fail++; results.push('✗ ' + name + ' — ' + String(e.message || e).slice(0, 300)); }
}
const IGNORED = [/navigator\.vibrate/i, /favicon/i];
function watchErrors(page) {
  const errs = [];
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !IGNORED.some(r => r.test(m.text()))) errs.push('console: ' + m.text()); });
  return errs;
}

// ---- 1. HTTP : domaines, redirections, fichiers SEO ----
async function head(url) { const r = await fetch(url, { redirect: 'manual' }); return { status: r.status, location: r.headers.get('location') || '' }; }
await test('https://qamarlounge.com/ answers 200', async () => (await head(BASE + '/')).status === 200);
await test('https://qamarlounge.com/ar.html answers 200', async () => (await head(BASE + '/ar.html')).status === 200);
await test('http → https (301)', async () => { const r = await head('http://qamarlounge.com/'); return r.status === 301 && r.location.startsWith('https://qamarlounge.com') || r; });
await test('www → apex (301)', async () => { const r = await head('https://www.qamarlounge.com/'); return r.status === 301 && r.location.startsWith('https://qamarlounge.com') || r; });
await test('qamarlounge.ae → qamarlounge.com, path kept (301)', async () => { const r = await head('https://qamarlounge.ae/ar.html'); return r.status === 301 && r.location === 'https://qamarlounge.com/ar.html' || r; });
await test('old GitHub address → domain (301)', async () => { const r = await head('https://preudhommekarl39-bit.github.io/qamar-site/'); return r.status === 301 && r.location.startsWith('https://qamarlounge.com') || r; });
await test('unknown page answers 404', async () => (await head(BASE + '/does-not-exist-' + Date.now())).status === 404);
await test('sitemap.xml lists EN and AR with hreflang', async () => { const t = await (await fetch(BASE + '/sitemap.xml')).text(); return t.includes('<loc>https://qamarlounge.com/</loc>') && t.includes('https://qamarlounge.com/ar.html') && t.includes('hreflang="ar"'); });
await test('robots.txt allows crawling and declares the sitemap', async () => { const t = await (await fetch(BASE + '/robots.txt')).text(); return /Allow: \//.test(t) && t.includes('Sitemap: https://qamarlounge.com/sitemap.xml'); });
await test('EN and AR pages point to each other (canonical + hreflang)', async () => {
  const en = await (await fetch(BASE + '/')).text(), ar = await (await fetch(BASE + '/ar.html')).text();
  return en.includes('<link rel="canonical" href="https://qamarlounge.com/">') && ar.includes('<link rel="canonical" href="https://qamarlounge.com/ar.html">') && en.includes('hreflang="ar" href="https://qamarlounge.com/ar.html"') && ar.includes('hreflang="en" href="https://qamarlounge.com/"');
});

// ---- 2. Navigateur ----
const browser = await chromium.launch();

for (const path of ['/', '/ar.html']) {
  for (const width of [360, 390, 768, 1280, 1920]) {
    await test(`${path} at ${width}px: loads without errors, no horizontal scroll, one H1`, async () => {
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const page = await ctx.newPage(); const errs = watchErrors(page);
      await page.goto(BASE + path, { waitUntil: 'networkidle' });
      const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth, h1: document.querySelectorAll('h1').length, lang: document.documentElement.lang, dir: document.dir }));
      await ctx.close();
      const want = path === '/ar.html' ? { lang: 'ar', dir: 'rtl' } : { lang: 'en', dir: 'ltr' };
      if (errs.length) return errs;
      return r.sw <= r.w + 1 && r.h1 === 1 && r.lang === want.lang && r.dir === want.dir || r;
    });
  }
}

const phone = { ...devices['iPhone 13'], reducedMotion: 'reduce' };

await test('mobile menu opens, lists every section, closes with Escape', async () => {
  const ctx = await browser.newContext(phone); const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.locator('.hnav .menu-btn').click();
  await page.waitForSelector('#mnav.open');
  const links = await page.locator('#mnav .mnav-links a').count();
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);
  const hidden = await page.locator('#mnav').evaluate(el => el.hidden || !el.classList.contains('open'));
  await ctx.close();
  return links >= 9 && hidden || { links, hidden };
});

await test('language switch opens the Arabic page and comes back, keeping the section', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  await page.goto(BASE + '/#faq', { waitUntil: 'networkidle' });
  await Promise.all([page.waitForURL(/\/ar\.html#faq$/), page.locator('.hnav .lang button[data-lang="ar"]').click()]);
  const arTitle = await page.title();
  await Promise.all([page.waitForURL(u => !u.pathname.endsWith('ar.html')), page.locator('.hnav .lang button[data-lang="en"]').click()]);
  const back = page.url();
  await ctx.close();
  return /[؀-ۿ]/.test(arTitle) && back.startsWith(BASE + '/') || { arTitle, back };
});

await test('pre-opening honesty: no WhatsApp link, forms closed, preview CTA', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => ({ wa: document.querySelectorAll('a[href*="wa.me"]').length, disabled: document.querySelector('#contestForm button').disabled, cta: document.querySelector('.hnav .pill-btn').textContent.trim(), social: [...document.querySelectorAll('a[href*="instagram.com"]')].filter(a => a.offsetParent).length }));
  await ctx.close();
  return r.wa === 0 && r.disabled === true && /Preview/i.test(r.cta) && r.social === 0 || r;
});

await test('keyboard: first Tab reaches the "Skip to content" link', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement && document.activeElement.className);
  await ctx.close();
  return focused === 'skip' || focused;
});

await test('queue: full demo journey on a phone (join → called → in service → pay → rate)', async () => {
  const ctx = await browser.newContext(phone); const page = await ctx.newPage(); const errs = watchErrors(page);
  await page.goto(BASE + '/queue.html', { waitUntil: 'networkidle' });
  const note = await page.locator('.demo-note').isVisible();
  await page.locator('#looks .opt:not([disabled])').first().click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.locator('.opt', { hasText: /First available/i }).first().click();
  await page.getByRole('button', { name: /Continue/ }).click();
  await page.fill('#fname', 'Test E2E');
  await page.fill('#phone', '50' + String(Date.now()).slice(-7));
  await page.getByRole('button', { name: /Join the queue/ }).click();
  await page.waitForSelector('.demo-next');
  for (let i = 0; i < 3; i++) { await page.locator('.demo-next').click(); await page.waitForTimeout(500); }
  const checkout = await page.locator('.ticket-card h1').first().textContent();
  await page.getByRole('button', { name: /^Pay/ }).first().click();
  await page.waitForSelector('.stars button', { timeout: 10000 });
  await ctx.close();
  if (errs.length) return errs;
  return note && /ready/i.test(checkout || '') || { note, checkout };
});

await test('queue in Arabic: right-to-left and translated', async () => {
  const ctx = await browser.newContext(phone); const page = await ctx.newPage();
  await page.addInitScript(() => { try { localStorage.setItem('qamar:lang', 'ar'); } catch (e) {} });
  await page.goto(BASE + '/queue.html', { waitUntil: 'networkidle' });
  const r = await page.evaluate(() => ({ dir: document.dir, h1: document.querySelector('h1').textContent }));
  await ctx.close();
  return r.dir === 'rtl' && /[؀-ۿ]/.test(r.h1) || r;
});

await test('staff and tool pages are noindex', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage(); const bad = [];
  for (const p of ['/admin.html', '/station.html', '/entrance.html', '/tests.html', '/queue.html']) {
    await page.goto(BASE + p, { waitUntil: 'domcontentloaded' });
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    if (!/noindex/.test(robots || '')) bad.push(p);
  }
  await ctx.close();
  return bad.length ? bad : true;
});

await test('engine tests page is green in a real browser', async () => {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  await page.goto(BASE + '/tests.html', { waitUntil: 'networkidle' });
  const sum = await page.locator('#sum').textContent();
  await ctx.close();
  return /\b0 failed/.test(sum) || sum;
});

await browser.close();
console.log(results.join('\n'));
console.log(`\n${pass} passed · ${fail} failed`);
process.exit(fail ? 1 : 0);
