/* QAMAR : fonctions de l'APPLICATION native (iPhone / Android, Capacitor). Jamais chargé par le site web :
   assets/app.js ne l'ajoute que si Capacitor.isNativePlatform() est vrai.
   Les plugins natifs sont appelés par Capacitor.Plugins (pas de bundler) ; leur code natif est installé par `npx cap sync`
   à partir de package.json (@capacitor/app, haptics, local-notifications, push-notifications, splash-screen, status-bar).
   - barre d'onglets en bas (Accueil, File, Looks, Moi), EN + AR, RTL ;
   - notifications locales : « c'est votre tour » quand le ticket passe à « appelé » (app ouverte ou en arrière-plan tant
     qu'elle tourne), rappel « bientôt votre tour » programmé quand l'app passe en arrière-plan, rappel choisi par la cliente ;
   - retour Android, liens profonds https://qamarlounge.com/go → file d'attente ;
   - liens externes (WhatsApp, Instagram, cartes, site) : ouverts par le système, jamais dans l'app ;
   - notifications push distantes : désactivées tant que config.js → push.enabled = false (voir docs/stores/PUSH.md). */
(function () {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform() || window.QamarNative) return;
  const P = C.Plugins || {};
  const CFG = window.QAMAR_CONFIG || {};
  const H = document.documentElement;
  const platform = (C.getPlatform && C.getPlatform()) || '';
  const HOME = 'index.html'; // www/index.html = app-home.html (scripts/build-www.mjs)
  const isHome = H.hasAttribute('data-app-home');
  const lang = () => (((window.Q && Q.lang) || H.lang) === 'ar' ? 'ar' : 'en');
  const T = {
    en: { home: 'Home', queue: 'Queue', looks: 'Looks', me: 'Me', tabs: 'Main menu',
      called_t: 'QAMAR: your wait is over', called_b: 'Go to seat {s}', soon_t: 'QAMAR: almost your turn', soon_b: 'Your estimated turn is in about 5 minutes.' },
    ar: { home: 'الرئيسية', queue: 'الطابور', looks: 'الإطلالات', me: 'حسابي', tabs: 'القائمة الرئيسية',
      called_t: 'قمر: انتهى انتظاركِ', called_b: 'توجّهي إلى المقعد {s}', soon_t: 'قمر: اقترب دوركِ', soon_b: 'دوركِ المتوقع بعد حوالي ٥ دقائق.' }
  };
  const t = (k, v = {}) => T[lang()][k].replace(/\{(\w)\}/g, (_, x) => v[x] ?? '');
  // Appel de plugin tolérant : un plugin absent ou une erreur native ne casse jamais la page
  const call = (name, method, arg) => { try { const p = P[name]; return p && typeof p[method] === 'function' ? Promise.resolve(p[method](arg)).catch(() => null) : Promise.resolve(null); } catch (e) { return Promise.resolve(null); } };
  const listen = (name, ev, fn) => { try { const p = P[name]; if (p && p.addListener) Promise.resolve(p.addListener(ev, fn)).catch(() => {}); } catch (e) { /* ignore */ } };
  const ls = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } } };

  /* ---------- Barres système, écran de démarrage ---------- */
  call('StatusBar', 'setStyle', { style: 'LIGHT' }); // texte sombre sur fond rose clair
  const hideSplash = () => call('SplashScreen', 'hide', { fadeOutDuration: 250 });
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', hideSplash); else hideSplash();

  /* ---------- Styles propres à l'app (zones sûres, onglets) ---------- */
  const css = document.createElement('style');
  css.textContent = `
  :root { --qa-safe-t: max(env(safe-area-inset-top, 0px), var(--safe-area-inset-top, 0px)); --qa-safe-b: max(env(safe-area-inset-bottom, 0px), var(--safe-area-inset-bottom, 0px)); --qa-tabs-h: 62px; }
  html.is-native body { padding-top: var(--qa-safe-t); padding-bottom: calc(var(--qa-tabs-h) + var(--qa-safe-b)); -webkit-tap-highlight-color: transparent; }
  .qa-tabs { position: fixed; z-index: 70; inset-inline: 0; bottom: 0; height: calc(var(--qa-tabs-h) + var(--qa-safe-b)); padding-bottom: var(--qa-safe-b);
    display: grid; grid-template-columns: repeat(4, 1fr); background: rgba(255, 248, 244, .94); backdrop-filter: blur(18px) saturate(1.4); -webkit-backdrop-filter: blur(18px) saturate(1.4);
    border-top: 1px solid rgba(184, 122, 98, .22); }
  .qa-tabs a { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; min-height: 44px; text-decoration: none; color: #8A6A60; font-size: .7rem; letter-spacing: .02em; }
  .qa-tabs a svg { width: 24px; height: 24px; }
  .qa-tabs a[aria-current="page"] { color: #9A5F4A; font-weight: 500; }
  html.is-native .bar { bottom: calc(var(--qa-tabs-h) + var(--qa-safe-b)); padding-bottom: 14px; }
  html.is-native .app { padding-bottom: 200px; }
  html[data-app-home].is-native .app { padding-bottom: 40px; }
  html.is-native .toast { bottom: calc(var(--qa-tabs-h) + var(--qa-safe-b) + 14px); }
  html.is-native main { padding-top: 24px; }`;
  document.head.appendChild(css);

  const ICON = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20h14V9.5"/><path d="M10 20v-5h4v5"/>',
    queue: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    looks: '<path d="M7 20c0-6 1-11 5-16 4 5 5 10 5 16"/><path d="M9.5 13c1.5 1 3.5 1 5 0"/>',
    me: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/>'
  };
  const TABS = [['home', HOME + '#home'], ['queue', 'queue.html'], ['looks', HOME + '#looks'], ['me', HOME + '#me']];
  let nav = null;
  function current() {
    if (/queue\.html$/.test(location.pathname)) return 'queue';
    if (!isHome) return '';
    const h = location.hash.slice(1); return ['looks', 'me'].includes(h) ? h : 'home';
  }
  function renderTabs() {
    if (!document.body) return;
    if (!nav) { nav = document.createElement('nav'); nav.className = 'qa-tabs'; document.body.appendChild(nav); }
    nav.setAttribute('aria-label', t('tabs'));
    const cur = current();
    nav.innerHTML = TABS.map(([id, href]) => `<a href="${href}" data-tab="${id}" ${cur === id ? 'aria-current="page"' : ''}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[id]}</svg><span>${t(id)}</span></a>`).join('');
  }
  if (document.body) renderTabs(); else addEventListener('DOMContentLoaded', renderTabs);
  addEventListener('hashchange', renderTabs);
  document.addEventListener('qamar:lang', renderTabs);

  /* ---------- Retour tactile (Haptics) ---------- */
  const haptic = kind => kind === 'success' || kind === 'warning' ? call('Haptics', 'notification', { type: kind.toUpperCase() }) : call('Haptics', 'impact', { style: kind === 'medium' ? 'MEDIUM' : 'LIGHT' });

  /* ---------- Liens : onglets, liens externes (système) ---------- */
  const external = a => { try { const u = new URL(a.getAttribute('href'), location.href); return /^(https?|mailto|tel):$/.test(u.protocol) && u.origin !== location.origin ? u.href : null; } catch (e) { return null; } };
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href]');
    if (a) {
      const ext = external(a);
      // Capacitor confie au système toute navigation hors de l'app (aucun allowNavigation dans capacitor.config.json) :
      // WhatsApp, Instagram, cartes et le site s'ouvrent dans leur app ou le navigateur, jamais dans la vue de l'app.
      if (ext) { e.preventDefault(); haptic('light'); location.href = ext; return; }
      if (a.dataset.tab) {
        haptic('light');
        // déjà sur l'accueil de l'app : changer de vue sans recharger la page
        const h = a.getAttribute('href');
        if (isHome && h.startsWith(HOME + '#')) { e.preventDefault(); location.hash = h.slice(HOME.length); }
      }
      return;
    }
    if (e.target.closest && e.target.closest('.btn-primary, .opt, .sty, .stepper button')) haptic('light');
  }, true);

  /* ---------- Notifications locales ---------- */
  let perm = 'prompt';
  const ID = { called: 1001, soon: 1002, reminder: 1003 };
  const REM = 'qamar:reminder';
  const refreshPerm = () => call('LocalNotifications', 'checkPermissions').then(r => { if (r && r.display) perm = r.display; return perm; });
  const ask = () => call('LocalNotifications', 'requestPermissions').then(r => { if (r && r.display) perm = r.display; return perm; });
  const schedule = n => call('LocalNotifications', 'schedule', { notifications: [Object.assign({ smallIcon: 'ic_stat_qamar', iconColor: '#B87A62' }, n)] });
  const cancel = id => call('LocalNotifications', 'cancel', { notifications: [{ id }] });
  async function notify(id, title, body, at) {
    if (perm !== 'granted') await refreshPerm();
    if (perm !== 'granted') return false;
    await schedule({ id, title, body, schedule: at ? { at, allowWhileIdle: true } : undefined });
    return true;
  }

  /* Ticket de cette cliente : « c'est votre tour » au passage à « appelé » ; rappel 5 min avant l'heure estimée quand l'app passe en arrière-plan */
  const myId = () => ls.get('qamar:myTicket');
  const myTicket = () => { const id = myId(); return id && window.Q && Q.ticket ? Q.ticket(id) : null; };
  let lastStatus = null, lastPings = 0, pushFor = null;
  function watch() {
    const tk = myTicket();
    if (!tk) { lastStatus = null; return; }
    if (tk.status === 'called' && (lastStatus !== 'called' || (tk.pings || 0) !== lastPings) && lastStatus) {
      cancel(ID.soon);
      notify(ID.called, t('called_t'), t('called_b', { s: tk.seat }));
      haptic('success');
    }
    lastStatus = tk.status; lastPings = tk.pings || 0;
    if (tk.accessToken && pushFor !== tk.id) { pushFor = tk.id; registerPush({ ticketId: tk.id, accessToken: tk.accessToken }); }
  }
  function waitReady() { if (window.Q && Q.on) { Q.on(watch); return; } setTimeout(waitReady, 300); }
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', waitReady); else waitReady();
  listen('App', 'pause', () => {
    const tk = myTicket(); if (!tk || tk.status !== 'waiting' || !Q.ticketEta) return;
    const e = Q.ticketEta(tk.id) || {};
    if (e.minutes != null && e.minutes > 6) notify(ID.soon, t('soon_t'), t('soon_b'), new Date(Date.now() + (e.minutes - 5) * 60000));
  });
  listen('App', 'resume', () => { cancel(ID.soon); refreshPerm().then(() => document.dispatchEvent(new CustomEvent('qamar:native'))); });
  // Toucher la notification : ouvrir le ticket
  listen('LocalNotifications', 'localNotificationActionPerformed', a => {
    const id = a && a.notification && a.notification.id;
    if (id === ID.called || id === ID.soon) location.href = 'queue.html' + (myId() ? '?t=' + encodeURIComponent(myId()) : '');
    else if (id === ID.reminder) location.href = HOME + '#home';
  });

  /* ---------- Retour Android ---------- */
  listen('App', 'backButton', ({ canGoBack } = {}) => {
    if (isHome) { if (current() !== 'home') location.hash = '#home'; else call('App', 'minimizeApp'); return; }
    const back = document.querySelector('#flow:not(.hidden) #backBtn');
    if (back) { back.click(); return; }   // file d'attente : étape précédente, puis accueil de l'app
    if (canGoBack) history.back(); else location.href = HOME;
  });

  /* ---------- Liens profonds : https://qamarlounge.com/go (QR du salon) → file d'attente ---------- */
  const SITE = (() => { try { return new URL(CFG.siteUrl || 'https://qamarlounge.com/'); } catch (e) { return null; } })();
  function route(url) {
    let u; try { u = new URL(url); } catch (e) { return false; }
    if (!SITE || u.hostname.replace(/^www\./, '') !== SITE.hostname.replace(/^www\./, '')) return false;
    const q = new URLSearchParams(u.search);
    if (/^\/(go\/?|go\.html|queue\.html)$/.test(u.pathname)) { if (!q.has('source') && !q.has('t')) q.set('source', 'qr'); location.href = 'queue.html?' + q.toString(); return true; }
    location.href = HOME; return true;
  }
  listen('App', 'appUrlOpen', e => { if (e && e.url) route(e.url); });
  try { if (isHome && !sessionStorage.getItem('qamar:launch')) { sessionStorage.setItem('qamar:launch', '1'); call('App', 'getLaunchUrl').then(r => { if (r && r.url) route(r.url); }); } } catch (e) { /* ignore */ }

  /* ---------- Notifications push distantes : DÉSACTIVÉES par défaut ----------
     Actives seulement si config.js → push.enabled = true ET backend = 'supabase' (vrais tickets côté serveur) ET les clés
     des stores existent (google-services.json pour Android, capacité Push pour iOS). Le jeton est rattaché au ticket par
     la fonction register_push_token (supabase/migrations/008_push_tokens.sql), qui vérifie le jeton d'accès du ticket. */
  const pushOn = () => !!(CFG.push && CFG.push.enabled && CFG.backend === 'supabase' && CFG.supabaseUrl && CFG.supabaseAnonKey);
  let pushListening = false;
  async function registerPush({ ticketId, accessToken }) {
    if (!pushOn() || !ticketId || !accessToken) return false;
    const r = await call('PushNotifications', 'requestPermissions');
    if (!r || r.receive !== 'granted') return false;
    if (!pushListening) {
      pushListening = true;
      listen('PushNotifications', 'registration', tok => {
        if (!tok || !tok.value) return;
        fetch(CFG.supabaseUrl.replace(/\/$/, '') + '/rest/v1/rpc/register_push_token', {
          method: 'POST', headers: { apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_token: tok.value, p_platform: platform, p_ticket: ticketId, p_access_token: accessToken, p_lang: lang() })
        }).catch(() => {});
      });
      listen('PushNotifications', 'pushNotificationActionPerformed', () => { location.href = 'queue.html?t=' + encodeURIComponent(ticketId); });
    }
    await call('PushNotifications', 'register');
    return true;
  }

  /* ---------- Rappel choisi par la cliente (écran d'accueil de l'app) ---------- */
  const reminder = () => { const v = +ls.get(REM); return v > Date.now() ? v : null; };
  async function setReminder(at, { title, body }) {
    if (perm !== 'granted') await ask();
    if (perm !== 'granted') return false;
    await cancel(ID.reminder);
    await schedule({ id: ID.reminder, title, body, schedule: { at, allowWhileIdle: true } });
    ls.set(REM, String(at.getTime())); haptic('success');
    return true;
  }
  async function cancelReminder() { await cancel(ID.reminder); ls.set(REM, null); }

  window.QamarNative = {
    platform, haptic, notify, registerPush, setReminder, cancelReminder, reminder, route,
    permission: () => perm,
    askNotifications: async () => { await ask(); document.dispatchEvent(new CustomEvent('qamar:native')); return perm; },
    pushEnabled: pushOn
  };
  refreshPerm().then(() => document.dispatchEvent(new CustomEvent('qamar:native')));
})();
