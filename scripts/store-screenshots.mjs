// QAMAR : captures d'écran des fiches App Store / Google Play, prises sur la VRAIE interface de l'app (www/, mode app native).
//   node scripts/build-www.mjs && node scripts/store-screenshots.mjs
// Playwright n'est pas une dépendance du dépôt : installez-le à part (npm i playwright && npx playwright install chromium)
// et indiquez son dossier avec PLAYWRIGHT_DIR=/chemin/vers/node_modules/playwright si besoin.
// - Capacitor est simulé (window.Capacitor + plugins muets) : c'est exactement le code de l'app qui s'affiche (onglets, vues, pas de paiement).
// - Données de démonstration du salon (Q.seedDemo, prénoms fictifs), aucun avis ni note affichés.
// - Le bandeau « aperçu / démo » et le bouton « simuler l'étape suivante » sont masqués : ils n'existent pas dans l'app une fois le salon ouvert.
// Sortie : docs/stores/screenshots/{ios-6.9,android-phone}/{en,ar}/NN-nom.png
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const pw = process.env.PLAYWRIGHT_DIR ? await import(pathToFileURL(join(resolve(process.env.PLAYWRIGHT_DIR), 'index.mjs')).href) : await import('playwright');
const { chromium } = pw.default || pw;
const ROOT = resolve('www');
if (!existsSync(join(ROOT, 'index.html'))) { console.error('www/ manquant : lancez d\'abord node scripts/build-www.mjs'); process.exit(1); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = createServer((req, res) => {
  const p = join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/^\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' }); res.end(readFileSync(p));
}).listen(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;

// Tailles exigées : App Store iPhone 6,9" = 1320 x 2868 ; Google Play téléphone = 1080 x 1920 (16:9)
const DEVICES = [
  { id: 'ios-6.9', platform: 'ios', viewport: { width: 440, height: 956 }, scale: 3, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148' },
  { id: 'android-phone', platform: 'android', viewport: { width: 360, height: 640 }, scale: 3, ua: 'Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Mobile Safari/537.36' }
];
const capacitorStub = platform => `
  (() => {
    const quiet = new Proxy({}, { get: (_, m) => m === 'then' ? undefined : async () => ({ display: 'granted', receive: 'granted' }) });
    const plugins = new Proxy({}, { get: () => quiet });
    window.Capacitor = { isNativePlatform: () => true, getPlatform: () => '${platform}', Plugins: plugins };
    document.addEventListener('DOMContentLoaded', () => { const s = document.createElement('style');
      s.textContent = '.demo-note, .demo-next, .demo-next + p, #demoBanner, .toast { display: none !important; } *, *::before, *::after { animation: none !important; transition: none !important; } canvas { display: none !important; }';
      document.head.appendChild(s); });
  })();`;

const SHOTS = [
  { name: '01-home', url: 'index.html#home', ticket: false },
  { name: '02-looks', url: 'index.html#looks', ticket: false },
  { name: '03-choose-look', url: 'queue.html?look=glow', ticket: false },
  { name: '04-my-ticket', url: 'queue.html', ticket: 'waiting' },
  { name: '05-your-turn', url: 'queue.html', ticket: 'called' }
];

const browser = await chromium.launch();
let n = 0;
for (const dev of DEVICES) for (const lang of ['en', 'ar']) {
  const out = join('docs/stores/screenshots', dev.id, lang); mkdirSync(out, { recursive: true });
  for (const shot of SHOTS) {
    const ctx = await browser.newContext({ viewport: dev.viewport, deviceScaleFactor: dev.scale, userAgent: dev.ua, isMobile: true, hasTouch: true, locale: lang === 'ar' ? 'ar-AE' : 'en-AE', timezoneId: 'Asia/Dubai' });
    await ctx.addInitScript(capacitorStub(dev.platform));
    await ctx.addInitScript(l => { try { localStorage.setItem('qamar:lang', l); localStorage.setItem('qamar:app-hint', String(Date.now())); } catch (e) { /* ignore */ } }, lang);
    // Heure fixe (18 h à Dubaï) : affluence du soir, hors créneau « Night Glow » ; les captures sont reproductibles
    await ctx.addInitScript(() => { const fixed = new Date('2026-12-03T14:00:00Z').getTime(), Real = Date, off = fixed - Real.now();
      class F extends Real { constructor(...a) { super(...(a.length ? a : [Real.now() + off])); } static now() { return Real.now() + off; } }
      window.Date = F; });
    const page = await ctx.newPage();
    // Données du salon (démo) + ticket de cette cliente si besoin
    await page.goto(BASE + 'index.html');
    await page.evaluate(kind => {
      Q.seedDemo();
      try { localStorage.removeItem('qamar:myTicket'); } catch (e) { /* ignore */ }
      if (kind) {
        const tk = Q.joinQueue({ name: 'Amira', phone: '+971501234567', serviceId: 'glow', pref: 'any', extraLong: false, channel: 'qr' });
        localStorage.setItem('qamar:myTicket', tk.id);
        if (kind === 'called') { for (const s of Q.D.stylists) { Q.clockIn(s.id, s.pin); if (Q.call(s.id, tk.id)) break; } }
      }
    }, shot.ticket);
    await page.goto(BASE + shot.url);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.waitForTimeout(600);
    await page.screenshot({ path: join(out, shot.name + '.png') });
    await ctx.close(); n++;
  }
}
await browser.close(); server.close();
console.log(`${n} captures dans docs/stores/screenshots/`);
