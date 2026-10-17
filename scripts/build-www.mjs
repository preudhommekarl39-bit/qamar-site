// Copie les fichiers du site client dans www/ (dossier embarqué dans les applications).
// Les écrans du personnel (poste, dashboard, écran d'entrée) et les tests ne sont pas embarqués.
import { cpSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
const keep = ['index.html', 'queue.html', 'privacy.html', 'legal.html', 'manifest.webmanifest'];
for (const f of readdirSync('.')) if (keep.includes(f)) cpSync(f, `www/${f}`);
cpSync('assets', 'www/assets', { recursive: true });
console.log('www/ prêt :', readdirSync('www').join(', '));
