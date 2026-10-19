/* QAMAR — mesure d'audience, DÉSACTIVÉE par défaut.
   Rien n'est chargé ni envoyé tant que config.js → analytics.enabled = false, qu'aucun identifiant GA4 n'est renseigné
   ou que la visiteuse n'a pas donné son accord (localStorage 'qamar:consent' = 'granted', posé par le futur bandeau de consentement).
   Aucune donnée personnelle (nom, téléphone) n'est jamais transmise. Événements documentés dans docs/ANALYTICS.md. */
(function () {
  const cfg = (window.QAMAR_CONFIG && window.QAMAR_CONFIG.analytics) || {};
  const consent = () => { try { return localStorage.getItem('qamar:consent') === 'granted'; } catch (e) { return false; } };
  const active = () => !!(cfg.enabled && /^G-[A-Z0-9]+$/.test(cfg.ga4Id || '') && consent());
  let loaded = false;
  function load() {
    if (loaded || !active()) return; loaded = true;
    const s = document.createElement('script'); s.async = true; s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(cfg.ga4Id);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || []; window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date()); window.gtag('config', cfg.ga4Id, { anonymize_ip: true });
  }
  // Un seul envoi par action : les éléments portent data-track="nom_evenement" (et data-track-loc facultatif)
  window.QamarTrack = (event, params) => {
    if (!active()) return; load();
    window.gtag('event', event, Object.assign({ page_language: document.documentElement.lang || 'en' }, params || {}));
  };
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-track]'); if (!el) return;
    window.QamarTrack(el.dataset.track, { location: el.dataset.trackLoc || '' });
  });
  load();
})();
