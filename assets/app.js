/* QAMAR — application installable (Android + iPhone) :
   - enregistre le service worker (ouverture instantanée, fonctionne hors ligne) ;
   - Android / Chrome : vrai bouton « Installer » (invite native du système) ;
   - iPhone / Safari : fiche qui montre « Partager → Sur l'écran d'accueil » (Apple n'autorise pas d'invite automatique) ;
   - tout lien [data-install-app] ouvre la fiche ; un rappel discret apparaît une fois sur mobile. */
(function () {
  // application native (Google Play / App Store, via Capacitor) : pas de service worker ni de fiche d'installation, pas de lien « espace personnel »
  const native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
  const standalone = native || matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  if (standalone) document.documentElement.classList.add('is-app');
  if (native) document.documentElement.classList.add('is-native');

  // Service worker : seulement sur un vrai site https (pas dans un aperçu intégré)
  if ('serviceWorker' in navigator && location.protocol === 'https:' && window.top === window && !native) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isMobile = isIOS || /Android/.test(ua);
  let deferred = null;
  addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; });
  addEventListener('appinstalled', () => { deferred = null; close(); });

  const T = {
    en: { title: 'Get the QAMAR app', sub: 'Join the queue in one tap, right from your home screen.', install: 'Install the app', later: 'Not now',
      ios1: 'Tap', ios1b: 'Share', ios2: 'then', ios2b: 'Add to Home Screen', desk: 'Open this page on your phone to install the app.', done: 'The app is already installed on this device.', and1: 'Open the browser menu', and2: 'Install app' },
    ar: { title: 'حمّلي تطبيق قمر', sub: 'انضمي إلى الطابور بلمسة واحدة من شاشتك الرئيسية.', install: 'تثبيت التطبيق', later: 'ليس الآن',
      ios1: 'اضغطي على', ios1b: 'مشاركة', ios2: 'ثم', ios2b: 'إضافة إلى الشاشة الرئيسية', desk: 'افتحي هذه الصفحة على هاتفك لتثبيت التطبيق.', done: 'التطبيق مثبّت بالفعل على هذا الجهاز.', and1: 'افتحي قائمة المتصفح', and2: 'تثبيت التطبيق' }
  };
  const t = k => (T[(window.Q && Q.lang) || document.documentElement.lang] || T.en)[k] || T.en[k];

  const css = document.createElement('style');
  css.textContent = `
  .qa-sheet { position: fixed; z-index: 80; left: 50%; bottom: calc(env(safe-area-inset-bottom, 0px) + 14px); transform: translate(-50%, 140%); width: min(420px, calc(100vw - 28px));
    background: rgba(255, 252, 253, .92); backdrop-filter: blur(22px) saturate(1.6); -webkit-backdrop-filter: blur(22px) saturate(1.6); border: 1px solid rgba(196, 154, 90, .35);
    border-radius: 24px; box-shadow: 0 30px 60px -24px rgba(120, 50, 70, .45); padding: 18px; display: grid; grid-template-columns: 56px 1fr; gap: 6px 14px; align-items: center;
    transition: transform .5s cubic-bezier(.2, .8, .2, 1); color: #1F1417; font: 15px/1.4 "Helvetica Neue", Helvetica, Arial, sans-serif; }
  .qa-sheet.show { transform: translate(-50%, 0); }
  .qa-sheet img { width: 56px; height: 56px; border-radius: 14px; grid-row: span 2; box-shadow: 0 6px 16px -8px rgba(120, 50, 70, .5); }
  .qa-sheet b { font-size: 16px; font-weight: 600; letter-spacing: -.01em; }
  .qa-sheet p { margin: 0; color: #6B4A52; font-size: 13.5px; }
  .qa-sheet .qa-act { grid-column: 1 / -1; display: flex; gap: 8px; margin-top: 10px; }
  .qa-sheet button { flex: 1; border: 0; border-radius: 999px; padding: 12px 14px; font: inherit; font-weight: 600; cursor: pointer; }
  .qa-sheet .qa-go { background: #1F1417; color: #fff; }
  .qa-sheet .qa-no { background: rgba(168, 91, 114, .1); color: #A85B72; flex: .6; }
  .qa-sheet .qa-ios { grid-column: 1 / -1; margin-top: 10px; padding: 12px 14px; border-radius: 16px; background: rgba(252, 230, 236, .7); color: #4B2D35; font-size: 14px; }
  .qa-sheet .qa-ios svg { vertical-align: -3px; margin: 0 3px; }
  html[dir="rtl"] .qa-sheet { direction: rtl; }
  html.is-app [data-install-app] { display: none !important; }
  html.is-native a[href="admin.html"] { display: none !important; }`;
  document.head.appendChild(css);

  let sheet = null;
  const shareIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0A84FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
  function open() {
    close(true);
    sheet = document.createElement('div'); sheet.className = 'qa-sheet'; sheet.setAttribute('role', 'dialog'); sheet.setAttribute('aria-label', t('title'));
    let body = '';
    if (standalone) body = `<p class="qa-ios">${t('done')}</p>`;
    else if (isIOS) body = `<div class="qa-ios">${t('ios1')} ${shareIcon}<b>${t('ios1b')}</b> ${t('ios2')} <b>${t('ios2b')}</b> ＋</div>`;
    else if (!deferred && !isMobile) body = `<p class="qa-ios">${t('desk')}</p>`;
    else if (!deferred) body = `<div class="qa-ios">${t('and1')} <b>⋮</b> ${t('ios2')} <b>${t('and2')}</b></div>`;
    sheet.innerHTML = `<img src="assets/app/icon-192.png" alt=""><b>${t('title')}</b><p>${t('sub')}</p>${body}
      <div class="qa-act">${deferred && !standalone ? `<button class="qa-go" type="button">${t('install')}</button>` : ''}<button class="qa-no" type="button">${t('later')}</button></div>`;
    document.body.appendChild(sheet);
    requestAnimationFrame(() => requestAnimationFrame(() => sheet && sheet.classList.add('show')));
    const go = sheet.querySelector('.qa-go');
    if (go) go.onclick = async () => { const d = deferred; deferred = null; d.prompt(); try { await d.userChoice; } catch (e) {} close(); };
    sheet.querySelector('.qa-no').onclick = () => { remember(); close(); };
  }
  function close(now) { const s = sheet; sheet = null; if (!s) return; if (now) return s.remove(); s.classList.remove('show'); setTimeout(() => s.remove(), 500); }
  function remember() { try { localStorage.setItem('qamar:app-hint', String(Date.now())); } catch (e) {} }
  function seen() { try { return +localStorage.getItem('qamar:app-hint') > Date.now() - 14 * 864e5; } catch (e) { return true; } }

  document.addEventListener('click', e => { const a = e.target.closest('[data-install-app]'); if (a) { e.preventDefault(); open(); } });
  // rappel discret, une seule fois toutes les 2 semaines, sur mobile uniquement
  if (isMobile && !standalone && !seen() && !/queue.html/.test(location.pathname)) setTimeout(() => { if (!sheet) { remember(); open(); } }, 9000);
  window.QamarApp = { open };
})();
