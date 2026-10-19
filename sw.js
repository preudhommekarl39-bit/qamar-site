/* QAMAR — service worker : l'app s'ouvre instantanément et fonctionne même sans réseau.
   Pages : réseau d'abord (contenu à jour), cache en secours. Fichiers statiques : cache d'abord, mis à jour en arrière-plan.
   Changer VERSION à chaque mise en ligne pour forcer le rafraîchissement. */
const VERSION = 'qamar-v3';
const CORE = [
  './', 'index.html', 'queue.html', 'privacy.html', 'legal.html', 'manifest.webmanifest',
  'assets/qamar.css', 'assets/config.js', 'assets/data.js', 'assets/store.js', 'assets/app.js',
  'assets/stage-fx.js', 'assets/sakura.js', 'assets/rituals-fx.js', 'assets/looks-fx.js', 'assets/cursor-fx.js',
  'assets/logo-qamar.webp', 'assets/menu-qamar.webp', 'assets/app/icon-192.png', 'assets/app/icon-512.png', 'assets/app/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // polices et CDN : laissés au navigateur
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); return res; })
      .catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
