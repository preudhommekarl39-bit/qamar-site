// Copie les fichiers client dans www/ (dossier embarqué dans les applications iPhone et Android).
// - www/index.html = app-home.html : l'app s'ouvre sur un vrai écran d'application (affluence, file, looks, mon ticket),
//   pas sur la page d'accueil marketing du site (règle 4.2 de l'App Store : une app ne doit pas être un simple site).
// - Les écrans du personnel (poste, dashboard, back-office, écran d'entrée), les tests et la vidéo ne sont pas embarqués.
import { cpSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
const PAGES = ['queue.html', 'go.html', 'privacy.html', 'legal.html', 'manifest.webmanifest'];
const SKIP_ASSETS = ['video', 'office-core.js', 'office-demo.js', 'blog-core.js', 'stage-fx.js', 'rituals-fx.js', 'og-qamar.png', 'menu-qamar.webp'];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
cpSync('app-home.html', 'www/index.html');
for (const f of PAGES) cpSync(f, `www/${f}`);
cpSync('assets', 'www/assets', { recursive: true, filter: src => !SKIP_ASSETS.some(x => src === `assets/${x}` || src.startsWith(`assets/${x}/`)) });
console.log('www/ prêt :', readdirSync('www').join(', '), '· assets :', readdirSync('www/assets').length, 'éléments');
