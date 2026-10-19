/* QAMAR — moteur partagé : file d'attente, temps d'attente, pointeuse, paiements, pourboires, notes.
   MODE DÉMO (config.js → backend: 'demo') : l'état vit dans ce navigateur (localStorage) et se synchronise
   entre onglets du même appareil. Rien n'est envoyé, rien n'est encaissé.
   MODE CONNECTÉ (backend: 'supabase') : voir assets/backend-supabase.js et supabase/ — les règles sont
   recalculées et appliquées côté serveur (RLS + fonctions SQL), le navigateur n'est jamais cru sur parole. */
(function () {
  const D = window.QAMAR_DATA;
  const KEY = window.QAMAR_TEST ? 'qamar:test' : 'qamar:v1'; // les tests n'écrasent jamais les données de démo
  const MIN = 60000;
  const ACTIVE = ['called', 'in_service', 'checkout', 'paid'];
  const chan = 'BroadcastChannel' in window ? new BroadcastChannel(window.QAMAR_TEST ? 'qamar-test' : 'qamar') : null;
  const listeners = [];

  // Heure de Dubaï (UTC+4, sans heure d'été) — utilisée pour les journées, Happy Hours et statistiques
  const DUBAI_OFFSET = 4 * 3600000;
  const dubai = (ts = Date.now()) => { const d = new Date(ts + DUBAI_OFFSET); return { weekday: d.getUTCDay(), hour: d.getUTCHours(), dateKey: d.toISOString().slice(0, 10) }; };
  const startOfDay = (ts = Date.now()) => Math.floor((ts + DUBAI_OFFSET) / 86400000) * 86400000 - DUBAI_OFFSET;
  function defaults() {
    return {
      v: 1, counter: 0, counterDay: dubai().dateKey, launchServed: 0,
      stylists: D.stylists.map(s => ({ ...s })),
      shifts: [], tickets: [],
      settings: { launchMode: !!(D.promotions && D.promotions.launch.enabled), launchFirst: D.promotions.launch.firstN, launchFirstPct: D.promotions.launch.firstPct, launchRestPct: D.promotions.launch.restPct }
    };
  }
  function load() {
    try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch (e) { /* stockage bloqué */ }
    return defaults();
  }
  let state = load();
  let memoryOnly = false;

  function emit() { listeners.forEach(fn => { try { fn(state); } catch (e) { console.error(e); } }); }
  function commit() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { memoryOnly = true; }
    if (chan) chan.postMessage('sync');
    emit();
  }
  function refresh() { state = load(); emit(); }
  if (chan) chan.onmessage = refresh;
  window.addEventListener('storage', e => { if (e.key === KEY) refresh(); });
  setInterval(emit, 20000); // les temps d'attente avancent même sans événement

  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const service = id => D.services.find(s => s.id === id);
  const addon = id => D.addons.find(a => a.id === id);
  const stylist = id => state.stylists.find(s => s.id === id);
  const ticket = id => state.tickets.find(t => t.id === id);
  const openShift = sid => state.shifts.find(s => s.stylistId === sid && !s.out);
  const online = () => state.stylists.filter(s => openShift(s.id));
  const duration = t => Math.min(D.maxMinutes || 45, (service(t.serviceId)?.duration || 30) + (t.extraLong ? D.extraLong.minutes : 0));
  const currentOf = sid => state.tickets.find(t => t.assignedTo === sid && ACTIVE.includes(t.status));

  /* Planning glouton : chaque cliente en attente est placée chez sa coiffeuse choisie
     ou chez la première coiffeuse libre. Donne l'heure de passage estimée de chacune. */
  function schedule(extra) {
    const now = Date.now();
    const avail = {};
    online().forEach(s => {
      const cur = currentOf(s.id);
      let at = now;
      if (cur) {
        if (cur.status === 'in_service') at = Math.max(now + 2 * MIN, cur.startedAt + duration(cur) * MIN);
        else if (cur.status === 'called') at = now + (duration(cur) + 2) * MIN;
        else at = now + 3 * MIN;
      }
      avail[s.id] = at;
    });
    const list = state.tickets.filter(t => t.status === 'waiting').sort((a, b) => a.createdAt - b.createdAt);
    if (extra) list.push(extra);
    const out = {};
    list.forEach(t => {
      let sid = null;
      if (t.pref && t.pref !== 'any') {
        if (avail[t.pref] === undefined) { out[t.id] = { stylistId: t.pref, startAt: null, offline: true }; return; }
        sid = t.pref;
      } else {
        sid = Object.keys(avail).sort((a, b) => avail[a] - avail[b])[0] || null;
      }
      if (!sid) { out[t.id] = { stylistId: null, startAt: null }; return; }
      out[t.id] = { stylistId: sid, startAt: avail[sid] };
      avail[sid] += duration(t) * MIN;
    });
    return out;
  }
  const minsUntil = at => (at == null ? null : Math.max(0, Math.round((at - Date.now()) / MIN)));

  function estimate(serviceId, pref = 'any', extraLong = false) {
    const fake = { id: '__estimate', serviceId, pref, extraLong, createdAt: Date.now() + 1 };
    const r = schedule(fake).__estimate;
    return r && r.startAt != null ? { minutes: minsUntil(r.startAt), stylistId: r.stylistId } : null;
  }
  function ticketEta(id) {
    const t = ticket(id); if (!t) return null;
    if (t.status !== 'waiting') return { minutes: 0, stylistId: t.assignedTo };
    const r = schedule()[id];
    return r ? { minutes: minsUntil(r.startAt), stylistId: r.stylistId, offline: !!r.offline } : null;
  }
  function position(id) {
    const waiting = state.tickets.filter(t => t.status === 'waiting').sort((a, b) => a.createdAt - b.createdAt);
    return waiting.findIndex(t => t.id === id) + 1;
  }

  /* ---------- Règles commerciales (source unique : data.js → promotions) ---------- */
  const PROMO = D.promotions || {};
  const CLOSED = ['cancelled', 'noshow'];
  // places « −70 % » réellement consommées : les tickets annulés ou absents libèrent leur place
  function launchUsed() {
    const since = state.launchResetAt || 0;
    return state.tickets.filter(t => t.promo && t.promo.id === 'launch-first' && !CLOSED.includes(t.status) && t.createdAt >= since).length;
  }
  function launchOn() { return !!(PROMO.launch && PROMO.launch.enabled && state.settings.launchMode); }
  function happyHourAt(ts) {
    const h = PROMO.happyHours; if (!h || !h.enabled) return false;
    const p = dubai(ts);
    return h.days.includes(p.weekday) && p.hour >= h.fromHour && p.hour < h.toHour;
  }
  // Meilleure remise applicable à un instant donné (une seule remise, jamais cumulée)
  function bestPromo(ts = Date.now()) {
    const cands = [];
    if (launchOn()) {
      const L = PROMO.launch, st = state.settings;
      const first = launchUsed() < (st.launchFirst ?? L.firstN);
      cands.push(first ? { id: 'launch-first', pct: st.launchFirstPct ?? L.firstPct, label: L.label } : { id: 'launch', pct: st.launchRestPct ?? L.restPct, label: L.label });
    }
    if (happyHourAt(ts)) cands.push({ id: 'happy-hours', pct: PROMO.happyHours.pct, label: PROMO.happyHours.label });
    return cands.sort((a, b) => b.pct - a.pct)[0] || null;
  }
  // Prix affiché AVANT inscription (site, page cliente) — même calcul que la caisse
  function quote(serviceId, extraLong = false, ts = Date.now()) {
    const s = service(serviceId); if (!s) return null;
    const base = s.price + (extraLong ? D.extraLong.price : 0);
    const promo = bestPromo(ts);
    const discount = promo ? Math.round(base * promo.pct / 100) : 0;
    return { base, promo, discount, total: base - discount, duration: Math.min(D.maxMinutes || 45, s.duration + (extraLong ? D.extraLong.minutes : 0)) };
  }
  function available(s, ts = Date.now()) { return !s.fromHour || dubai(ts).hour >= s.fromHour; }

  function pricing(t) {
    const s = service(t.serviceId);
    const base = (s?.price || 0) + (t.extraLong ? D.extraLong.price : 0);
    const pct = t.promo ? t.promo.pct : (t.discountPct || 0);
    const discount = Math.round(base * pct / 100);
    let freeMatchaLeft = s?.freeMatcha ? 1 : 0;
    const lines = (t.addons || []).map(id => {
      const a = addon(id); if (!a) return null;
      let price = a.price;
      if (a.kind === 'matcha' && freeMatchaLeft > 0) { price = 0; freeMatchaLeft--; }
      return { id, name: a.name, price };
    }).filter(Boolean);
    const addonsTotal = lines.reduce((n, l) => n + l.price, 0);
    const guarantee = !!t.guaranteeFree;
    const serviceDue = guarantee ? 0 : base - discount;
    return { base, discount, pct, promo: t.promo || null, addons: lines, addonsTotal, guarantee, total: serviceDue + addonsTotal };
  }

  const fmt = n => `${Math.round(n).toLocaleString('en-US')} AED`;
  const ticketCode = t => 'Q-' + String(t.num).padStart(3, '0');
  const clean = (s, max) => String(s || '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
  const pinFails = {}; // anti force brute (démo) : 5 essais ratés → 5 min de blocage
  const ok = (v) => ({ ok: true, ...v });
  const fail = (code) => ({ ok: false, error: code });

  const Q = {
    D, get state() { return state; }, get memoryOnly() { return memoryOnly; },
    // Ce moteur stocke tout dans le navigateur : il reste en mode démo tant que le connecteur Supabase n'a pas
    // réellement pris le relais (window.QAMAR_BACKEND_READY). Une config « supabase » incomplète n'efface jamais le mot « démo ».
    mode: (window.QAMAR_CONFIG && window.QAMAR_CONFIG.backend === 'supabase' && window.QAMAR_BACKEND_READY === true) ? 'supabase' : 'demo',
    get isDemo() { return this.mode !== 'supabase'; },
    get configError() {
      const c = window.QAMAR_CONFIG || {};
      if (c.backend === 'supabase' && (!c.supabaseUrl || !c.supabaseAnonKey)) return 'Configuration error: backend "supabase" needs supabaseUrl and supabaseAnonKey.';
      if (c.backend === 'supabase' && window.QAMAR_BACKEND_READY !== true) return 'Configuration error: the Supabase connector is not loaded. Running in demo mode.';
      if (c.environment === 'production' && this.mode !== 'supabase') return 'Configuration error: production environment is running in demo mode. Nothing is saved for the salon.';
      return '';
    },
    on(fn) { listeners.push(fn); fn(state); },
    service, addon, stylist, ticket, openShift, online, duration, currentOf, schedule, estimate, ticketEta, position, pricing, fmt, ticketCode, minsUntil, startOfDay,
    quote, bestPromo, launchUsed, available, dubai,

    joinQueue({ name, phone, serviceId, pref = 'any', extraLong = false, channel = 'qr' }) {
      const s = service(serviceId);
      if (!s || !available(s)) return null;                                   // prestation inconnue ou hors horaire
      if (pref !== 'any' && !stylist(pref)) pref = 'any';
      const ph = clean(phone, 20);
      // une seule demande active par numéro : on renvoie le ticket existant au lieu d'en créer un doublon
      if (ph) { const dup = state.tickets.find(t => t.phone === ph && ['waiting', 'called', 'in_service', 'checkout'].includes(t.status)); if (dup) return dup; }
      const today = dubai().dateKey;
      if (state.counterDay !== today) { state.counterDay = today; state.counter = 0; } // numéros remis à zéro chaque jour
      const promo = bestPromo();
      if (launchOn()) state.launchServed = (state.launchServed || 0) + 1;      // compteur informatif (dashboard)
      const t = { id: uid(), num: ++state.counter, name: clean(name, D.limits.nameMax) || 'Guest', phone: ph, serviceId, pref, extraLong: !!extraLong, channel, promo, discountPct: promo ? promo.pct : 0, addons: [], status: 'waiting', createdAt: Date.now() };
      state.tickets.push(t);
      commit();
      return t;
    },
    cancel(id) { const t = ticket(id); if (t && ['waiting', 'called'].includes(t.status)) { t.status = 'cancelled'; t.cancelledAt = Date.now(); commit(); return true; } return false; },
    noShow(id) { const t = ticket(id); if (t && t.status === 'called') { t.status = 'noshow'; t.doneAt = Date.now(); commit(); return true; } return false; },

    clockIn(sid, pin) {
      const s = stylist(sid); if (!s) return fail('unknown');
      const f = pinFails[sid] || { n: 0, until: 0 };
      if (f.until > Date.now()) return fail('locked');
      if (String(pin) !== String(s.pin)) { f.n++; if (f.n >= 5) { f.until = Date.now() + 5 * MIN; f.n = 0; } pinFails[sid] = f; return fail('pin'); }
      pinFails[sid] = { n: 0, until: 0 };
      if (!openShift(sid)) state.shifts.push({ id: uid(), stylistId: sid, in: Date.now(), out: null }); // pas de double pointage
      commit();
      return ok({});
    },
    clockOut(sid) { const sh = openShift(sid); if (sh) { sh.out = Date.now(); commit(); } return sh; },

    nextFor(sid) {
      const plan = schedule();
      const mine = state.tickets.filter(t => t.status === 'waiting' && plan[t.id]?.stylistId === sid).sort((a, b) => plan[a.id].startAt - plan[b.id].startAt);
      if (mine[0]) return mine[0];
      return state.tickets.filter(t => t.status === 'waiting' && (t.pref === 'any' || t.pref === sid)).sort((a, b) => a.createdAt - b.createdAt)[0] || null;
    },
    // Appel : refusé si la coiffeuse a déjà une cliente, n'est pas pointée, ou si la cliente a demandé une autre coiffeuse
    call(sid, ticketId) {
      const s = stylist(sid);
      if (!s || !openShift(sid) || currentOf(sid)) return null;
      const t = ticketId ? ticket(ticketId) : Q.nextFor(sid);
      if (!t || t.status !== 'waiting' || (t.pref !== 'any' && t.pref !== sid)) return null;
      t.status = 'called'; t.assignedTo = sid; t.seat = s.seat; t.calledAt = Date.now();
      commit();
      return t;
    },
    // Remet une cliente appelée dans la file (réattribution contrôlée), à sa place d'origine
    requeue(id) { const t = ticket(id); if (t && t.status === 'called') { t.status = 'waiting'; delete t.assignedTo; delete t.seat; delete t.calledAt; commit(); return true; } return false; },
    renotify(id) { const t = ticket(id); if (t && t.status === 'called') { t.pings = (t.pings || 0) + 1; commit(); } },
    start(id) { const t = ticket(id); if (t && t.status === 'called') { t.status = 'in_service'; t.startedAt = Date.now(); commit(); return true; } return false; },
    toggleExtraLong(id) { const t = ticket(id); if (t && ['called', 'in_service'].includes(t.status)) { t.extraLong = !t.extraLong; commit(); } },
    addAddon(id, addonId) { const t = ticket(id); if (t && addon(addonId) && ['waiting', 'called', 'in_service'].includes(t.status) && t.addons.length < 6) { t.addons.push(addonId); commit(); } },
    removeAddon(id, addonId) { const t = ticket(id); if (t && t.status !== 'paid' && t.status !== 'done') { const i = t.addons.lastIndexOf(addonId); if (i > -1) { t.addons.splice(i, 1); commit(); } } },
    setPerfume(id, p) { const t = ticket(id); if (t && D.perfumes.some(x => x.id === p)) { t.perfume = p; commit(); } },
    setHijab(id, v) { const t = ticket(id); if (t) { t.hijab = !!v; commit(); } },
    toCheckout(id) {
      const t = ticket(id); if (!t || t.status !== 'in_service') return false;
      t.status = 'checkout'; t.finishedAt = Date.now();
      // Garantie : prestations listées dans data.js, temps mesuré du début à la fin de la prestation (l'attente ne compte pas)
      const g = D.guarantee;
      if (g && g.serviceIds.includes(t.serviceId) && t.startedAt) {
        t.serviceMinutes = Math.round((t.finishedAt - t.startedAt) / 60000);
        if (t.finishedAt - t.startedAt > g.minutes * MIN) t.guaranteeFree = true;
      }
      commit();
      return true;
    },
    // DÉMO : aucun argent n'est encaissé. En mode connecté, seul le webhook du prestataire peut marquer « payé ».
    pay(id, { method, tip = 0 }) {
      const t = ticket(id); if (!t || t.status !== 'checkout') return null;
      if (!['applepay', 'card', 'cash'].includes(method)) return null;
      const p = pricing(t);
      const L = D.limits;
      const maxTip = Math.min(L.tipMaxAed, Math.round(p.total * L.tipMaxPct / 100) || L.tipMaxAed);
      const safeTip = method === 'cash' ? 0 : Math.max(0, Math.min(maxTip, Math.round(Number(tip) || 0)));
      t.payment = { method, total: p.total, discount: p.discount, promo: p.promo ? p.promo.id : null, tip: safeTip, paidAt: Date.now(), demo: Q.isDemo };
      t.status = 'paid';
      commit();
      return t.payment;
    },
    rate(id, stars, comment) {
      const t = ticket(id); if (!t || t.status !== 'paid') return;
      const n = Math.round(Number(stars) || 0);
      if (n >= 1 && n <= 5) { t.rating = n; t.comment = clean(comment, D.limits.commentMax); }
      t.status = 'done'; t.doneAt = Date.now();
      commit();
    },
    setSetting(k, v) { if (k in state.settings) { state.settings[k] = v; commit(); } },
    resetLaunchCounter() { state.launchServed = 0; state.launchResetAt = Date.now(); commit(); },
    reset() { state = defaults(); commit(); },

    /* Stats du jour (journée de Dubaï). Le CA est compté à la date de PAIEMENT, sans doublon. */
    stats() {
      const t0 = startOfDay();
      const paid = state.tickets.filter(t => t.payment && t.payment.paidAt >= t0);
      const rated = state.tickets.filter(t => t.rating && (t.doneAt || 0) >= t0);
      const waits = state.tickets.filter(t => t.calledAt && t.calledAt >= t0).map(t => (t.calledAt - t.createdAt) / MIN);
      return {
        served: paid.length,
        waiting: state.tickets.filter(t => t.status === 'waiting').length,
        inChair: state.tickets.filter(t => ACTIVE.includes(t.status)).length,
        revenue: paid.reduce((n, t) => n + t.payment.total, 0),
        discounts: paid.reduce((n, t) => n + (t.payment.discount || 0), 0),
        tips: paid.reduce((n, t) => n + t.payment.tip, 0),
        rating: rated.length ? rated.reduce((n, t) => n + t.rating, 0) / rated.length : null,
        ratings: rated.length,
        avgWait: waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : null,
        noshows: state.tickets.filter(t => t.status === 'noshow' && (t.doneAt || 0) >= t0).length,
        cancelled: state.tickets.filter(t => t.status === 'cancelled' && (t.cancelledAt || 0) >= t0).length,
        matchas: paid.reduce((n, t) => n + (t.addons || []).filter(a => addon(a)?.kind === 'matcha').length, 0)
      };
    },
    stylistStats(sid) {
      const t0 = startOfDay();
      const paid = state.tickets.filter(t => t.assignedTo === sid && t.payment && t.payment.paidAt >= t0);
      const rated = state.tickets.filter(t => t.assignedTo === sid && t.rating);
      // durée travaillée du jour : seule la partie du pointage tombant après minuit (Dubaï) compte
      const worked = state.shifts.filter(s => s.stylistId === sid && (s.out || Date.now()) >= t0).reduce((n, s) => n + ((s.out || Date.now()) - Math.max(s.in, t0)), 0);
      return {
        served: paid.length,
        revenue: paid.reduce((n, t) => n + t.payment.total, 0),
        tips: paid.reduce((n, t) => n + t.payment.tip, 0),
        tipsAll: state.tickets.filter(t => t.assignedTo === sid && t.payment).reduce((n, t) => n + t.payment.tip, 0),
        rating: rated.length ? rated.reduce((n, t) => n + t.rating, 0) / rated.length : null,
        ratings: rated.length,
        workedMin: Math.round(worked / MIN)
      };
    },

    /* Données de démo pour voir le système vivant */
    seedDemo() {
      state = defaults();
      const LP = { id: 'launch-first', pct: 70, label: D.promotions.launch.label };
      state.counterDay = dubai().dateKey;
      const now = Date.now();
      const names = ['Aisha', 'Fatima', 'Hessa', 'Chloé', 'Priya', 'Reem', 'Lina', 'Sofia', 'Maha', 'Dana', 'Emma', 'Shamma', 'Amal', 'Nadia'];
      const svc = ['express', 'glow', 'waves', 'sleek', 'sos', 'care', 'cut', 'express', 'glow', 'waves'];
      ['layla', 'noor', 'sara', 'mariam'].forEach((sid, i) => state.shifts.push({ id: uid(), stylistId: sid, in: now - (5 - i * .5) * 60 * MIN, out: null }));
      state.shifts.push({ id: uid(), stylistId: 'yasmin', in: now - 9 * 60 * MIN, out: now - 60 * MIN });
      const comments = ['Best blow-dry in Dubai, honestly 😍', 'So fast, I came straight from the office!', 'The oud hair perfume 🤍', 'Loved the matcha and the hijab bar', 'My stylist is a magician ✨', ''];
      const methods = ['applepay', 'card', 'applepay', 'cash', 'card'];
      for (let i = 0; i < 11; i++) {
        const sid = ['layla', 'noor', 'sara', 'mariam', 'yasmin'][i % 5];
        const created = now - (300 - i * 24) * MIN;
        const t = { id: uid(), num: ++state.counter, name: names[i], phone: '+97150' + (1000000 + i * 7919), serviceId: svc[i % svc.length], pref: i % 3 ? 'any' : sid, extraLong: i % 4 === 0, channel: i % 2 ? 'whatsapp' : 'qr', discountPct: 70, promo: LP, seeded: true, addons: i % 2 ? ['matcha-iced'] : [], status: 'done', createdAt: created, assignedTo: sid, seat: stylist(sid).seat, calledAt: created + (6 + i % 5) * MIN };
        t.startedAt = t.calledAt + 2 * MIN; t.finishedAt = t.startedAt + duration(t) * MIN; t.perfume = ['oud', 'rose', 'musk'][i % 3];
        const p = pricing(t); const m = methods[i % methods.length];
        t.payment = { method: m, total: p.total, discount: p.discount, tip: m === 'cash' ? 0 : Math.round(p.total * [0.1, 0.25, 0.1, 0, 0.75][i % 5]), paidAt: t.finishedAt + MIN };
        if (i % 4 !== 3) { t.rating = i % 6 === 5 ? 4 : 5; t.comment = comments[i % comments.length]; }
        t.doneAt = t.finishedAt + 2 * MIN;
        state.tickets.push(t);
      }
      state.launchServed = 11;
      // En cours au fauteuil
      const inChair = [['layla', 'Hind', 'waves', 18], ['noor', 'Mira', 'sleek', 30], ['sara', 'Yara', 'cut', 12]];
      inChair.forEach(([sid, name, s, ago]) => {
        state.tickets.push({ id: uid(), num: ++state.counter, name, phone: '', serviceId: s, pref: sid, extraLong: false, channel: 'qr', discountPct: 70, promo: LP, seeded: true, addons: ['matcha-latte'], status: 'in_service', createdAt: now - (ago + 10) * MIN, assignedTo: sid, seat: stylist(sid).seat, calledAt: now - (ago + 2) * MIN, startedAt: now - ago * MIN, perfume: 'oud' });
        state.launchServed++;
      });
      // En attente
      [['Alia', 'express', 'any'], ['Joud', 'glow', 'noor'], ['Sarah', 'sos', 'any'], ['Meera', 'waves', 'layla'], ['Noura', 'express', 'any']].forEach(([name, s, pref], i) => {
        state.tickets.push({ id: uid(), num: ++state.counter, name, phone: '+97155' + (2000000 + i * 104729), serviceId: s, pref, extraLong: false, channel: i % 2 ? 'whatsapp' : 'qr', discountPct: 70, promo: LP, seeded: true, addons: [], status: 'waiting', createdAt: now - (14 - i * 3) * MIN });
        state.launchServed++;
      });
      commit();
    }
  };

  /* UI helpers */
  Q.esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  Q.logo = (cls = 'logo-mark') => `<svg class="${cls}" viewBox="0 0 120 160" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M82 14C50 18 30 46 34 76c4 24 24 38 46 36"/><path d="M82 14C62 26 54 48 58 70"/><path d="M58 70c4 16 30 20 26 42-2 12-12 20-14 36"/><path d="M64 60c2 20 32 26 28 50-2 14-12 24-14 40"/><path d="M104 74c-4 18-14 30-24 38"/></svg>`;
  Q.toast = msg => {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2800);
  };
  Q.beep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [880, 1320, 1760].forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
        const t = ctx.currentTime + i * .18; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.18, t + .02); g.gain.exponentialRampToValueAtTime(.001, t + .5);
        o.start(t); o.stop(t + .55);
      });
    } catch (e) { /* audio indisponible */ }
  };
  /* Illustration de cheveux propre à chaque look (lisse, ondulé, tresse…), en SVG */
  Q.lookArt = (style, uid = Math.random().toString(36).slice(2, 7)) => {
    const W = 200, H = 260, N = 11;
    const pts = (fx, y0 = 18, y1 = 242, step = 6) => { let d = ''; for (let y = y0; y <= y1; y += step) { const x = fx(y); d += (d ? ' L' : 'M') + x.toFixed(1) + ' ' + y; } return d; };
    const strands = (fx, opts = {}) => Array.from({ length: N }, (_, i) => {
      const x0 = 38 + i * 12.4;
      const y1 = opts.end ? opts.end(i) : 242;
      return `<path d="${pts(y => x0 + fx(y, i, x0), 18 + Math.abs(i - 5) * 3, y1)}" stroke-width="${i % 3 ? 1.4 : 2.2}" opacity="${.45 + (i % 4) * .14}"/>`;
    }).join('');
    let body = '', extra = '';
    switch (style) {
      case 'straight': body = strands(() => 0); break;
      case 'bouncy': body = strands((y, i) => y > 186 ? Math.sin((y - 186) / 56 * Math.PI) * (i < 5 ? -14 : 14) * Math.min(1, (y - 186) / 30) : 0); break;
      case 'glow': body = strands((y, i) => Math.sin(y / 70 + .6) * 12 + (y > 200 ? (y - 200) * (i < 5 ? -.25 : .25) : 0));
        extra = `<ellipse cx="86" cy="96" rx="20" ry="58" fill="url(#sh${uid})" stroke="none" transform="rotate(-12 86 96)"/>`; break;
      case 'waves': body = strands((y, i) => Math.sin(y / 20 + i * .35) * (6 + y / 30)); break;
      case 'night': body = strands((y, i) => Math.sin(y / 26 + i * .3) * 5);
        extra = `<path d="M150 26a22 22 0 1 0 16 36a18 18 0 1 1-16-36z" fill="rgba(255,236,200,.9)" stroke="none"/>` + [[40, 30], [62, 54], [176, 96], [28, 110], [168, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8" fill="#fff" stroke="none"/>`).join(''); break;
      case 'braid': case 'mini': {
        const amp = style === 'mini' ? 16 : 24, f = style === 'mini' ? 14 : 18, sw = style === 'mini' ? 5 : 7;
        body = [0, 1, 2].map(k => `<path d="${pts(y => 100 + Math.sin(y / f + k * 2.094) * amp * Math.min(1, y / 60 + .3), 30, 236, 3)}" stroke-width="${sw}" opacity="${.55 + k * .15}"/>`).join('');
        extra = `<circle cx="100" cy="240" r="6" fill="rgba(255,255,255,.85)" stroke="none"/>`;
        if (style === 'mini') extra += `<path d="M86 30c4-10 24-10 28 0" stroke-width="3"/>`;
        break;
      }
      case 'drops': body = strands((y, i) => Math.sin(y / 34 + i) * 4, { end: i => 200 - Math.abs(i - 5) * 4 });
        extra = [[64, 222], [100, 236], [136, 222], [82, 248], [118, 248]].map(([x, y]) => `<path d="M${x} ${y - 9}c4 6 6 9 6 12a6 6 0 0 1-12 0c0-3 2-6 6-12z" fill="rgba(255,255,255,.75)" stroke="none"/>`).join(''); break;
      case 'cut': body = strands(() => 0, { end: i => 150 + i * 6 });
        extra = `<path d="M24 158 L178 222" stroke-dasharray="4 6" stroke-width="1.2"/><g transform="translate(150 196) rotate(22)" stroke-width="2"><circle cx="-8" cy="12" r="6"/><circle cx="8" cy="12" r="6"/><path d="M-4 7 10 -18M4 7 -10 -18"/></g>`; break;
      case 'root': body = strands((y, i) => Math.sin(y / 90 + i * .2) * 3);
        extra = `<ellipse cx="100" cy="44" rx="74" ry="40" fill="url(#rt${uid})" stroke="none"/>`; break;
      default: body = strands(() => 0);
    }
    return `<svg class="look-svg" viewBox="0 0 ${W} ${H}" fill="none" stroke="url(#st${uid})" stroke-linecap="round" aria-hidden="true">
      <defs>
        <linearGradient id="st${uid}" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="260"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset=".35" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity=".7"/></linearGradient>
        <radialGradient id="sh${uid}"><stop offset="0" stop-color="#fff" stop-opacity=".7"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
        <radialGradient id="rt${uid}"><stop offset="0" stop-color="#F3D29A" stop-opacity=".85"/><stop offset="1" stop-color="#F3D29A" stop-opacity="0"/></radialGradient>
      </defs>${extra}${body}</svg>`;
  };

  /* Numéros de téléphone internationaux (format E.164 : +33612345678) */
  Q.countries = [
    ['🇦🇪', '+971', 'UAE'], ['🇸🇦', '+966', 'Saudi Arabia'], ['🇶🇦', '+974', 'Qatar'], ['🇰🇼', '+965', 'Kuwait'], ['🇧🇭', '+973', 'Bahrain'], ['🇴🇲', '+968', 'Oman'],
    ['🇫🇷', '+33', 'France'], ['🇧🇪', '+32', 'Belgium'], ['🇨🇭', '+41', 'Switzerland'], ['🇬🇧', '+44', 'United Kingdom'], ['🇩🇪', '+49', 'Germany'], ['🇮🇹', '+39', 'Italy'], ['🇪🇸', '+34', 'Spain'], ['🇳🇱', '+31', 'Netherlands'],
    ['🇲🇦', '+212', 'Morocco'], ['🇩🇿', '+213', 'Algeria'], ['🇹🇳', '+216', 'Tunisia'], ['🇪🇬', '+20', 'Egypt'], ['🇱🇧', '+961', 'Lebanon'], ['🇯🇴', '+962', 'Jordan'], ['🇹🇷', '+90', 'Turkey'],
    ['🇮🇳', '+91', 'India'], ['🇵🇰', '+92', 'Pakistan'], ['🇵🇭', '+63', 'Philippines'], ['🇷🇺', '+7', 'Russia'], ['🇺🇸', '+1', 'USA / Canada'], ['🇦🇺', '+61', 'Australia'], ['🇳🇬', '+234', 'Nigeria']
  ];
  // Retourne le numéro au format +XXXXXXXX, ou null s'il n'est pas valable
  Q.normalizePhone = (raw, cc = '+971') => {
    let s = String(raw || '').trim().replace(/[\s().\-\/]/g, '');
    if (!s) return null;
    if (s.startsWith('00')) s = '+' + s.slice(2);
    if (!s.startsWith('+')) s = cc + s.replace(/^0+/, '');   // « 06 12… » en France devient +33 6 12…
    const digits = s.slice(1);
    if (!/^\d+$/.test(digits) || digits.length < 7 || digits.length > 15) return null;
    return '+' + digits;
  };
  Q.flagFor = phone => { if (!phone) return ''; const m = Q.countries.filter(c => phone.startsWith(c[1])).sort((a, b) => b[1].length - a[1].length)[0]; return m ? m[0] : '🌍'; };

  /* Alerte « nouvelle cliente » pour les écrans du salon (dashboard, postes) */
  Q.watchNewClients = (cb) => {
    let seen = null;
    Q.on(s => {
      const ids = new Set(s.tickets.filter(t => t.status === 'waiting').map(t => t.id));
      if (seen) s.tickets.filter(t => ids.has(t.id) && !seen.has(t.id)).forEach(cb);
      seen = new Set([...(seen || []), ...ids]);
    });
  };
  Q.alertBanner = (html) => {
    let box = document.getElementById('qAlerts');
    if (!box) {
      box = document.createElement('div'); box.id = 'qAlerts';
      box.style.cssText = 'position:fixed;z-index:999;top:16px;right:16px;display:grid;gap:10px;max-width:min(360px,calc(100% - 32px))';
      document.body.appendChild(box);
    }
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.style.cssText = 'background:#1B1117;color:#F6E6DF;border-radius:18px;padding:14px 16px;box-shadow:0 20px 40px -20px rgba(0,0,0,.6);font-size:.9rem;line-height:1.45;border:1px solid rgba(232,207,160,.25);transform:translateX(120%);transition:transform .45s cubic-bezier(.2,.8,.2,1)';
    el.innerHTML = html;
    box.prepend(el);
    requestAnimationFrame(() => { el.style.transform = 'none'; });
    setTimeout(() => { el.style.transform = 'translateX(130%)'; setTimeout(() => el.remove(), 500); }, 9000);
  };
  // CSV sûr : champs entre guillemets et neutralisation des formules (= + - @ tab) pour Excel / Sheets
  Q.toCSV = (rows) => rows.map(r => r.map(v => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return '"' + s.replace(/"/g, '""') + '"';
  }).join(',')).join('\r\n');
  // Nom affichable en public (écran d'entrée) : prénom + initiale, jamais le numéro
  Q.publicName = (name) => { const p = String(name || '').trim().split(/\s+/); return p[0] ? p[0].slice(0, 14) + (p[1] ? ' ' + p[1][0].toUpperCase() + '.' : '') : 'Guest'; };
  // Bandeau « mode démo » pour les écrans du personnel : rien n'est réel tant que le backend n'est pas branché
  Q.showDemoBanner = (text) => {
    if (Q.configError) { console.error('[QAMAR]', Q.configError); text = Q.configError; }
    if (!Q.isDemo || document.getElementById('demoBanner')) return;
    const b = document.createElement('div');
    b.id = 'demoBanner'; b.setAttribute('role', 'note');
    b.style.cssText = 'position:fixed;z-index:998;left:50%;bottom:12px;transform:translateX(-50%);background:#1B1117;color:#E8CFA0;border:1px solid rgba(232,207,160,.35);border-radius:999px;padding:7px 14px;font:500 12px/1.3 Helvetica,Arial,sans-serif;max-width:calc(100% - 24px);text-align:center;box-shadow:0 10px 24px -14px rgba(0,0,0,.6)';
    b.textContent = text || 'DEMO MODE — data stays on this device. No real payments, messages or staff accounts.';
    document.body.appendChild(b);
  };
  Q.newClientAlert = (t) => {
    const s = service(t.serviceId);
    Q.beep();
    Q.alertBanner(`<div style="color:#E8CFA0;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;margin-bottom:4px">New client · ${t.channel === 'whatsapp' ? 'WhatsApp' : 'QR code'}</div>
      <b style="font-weight:500;font-size:1.05rem">${Q.esc(t.name)}</b> · ${Q.esc(s?.look.en || '')} · ${Q.ticketCode(t)}<br>
      <span style="opacity:.75">${Q.flagFor(t.phone)} ${Q.esc(t.phone || 'no phone')} · ${t.pref === 'any' ? 'first available' : 'asked for ' + Q.esc(stylist(t.pref)?.name || '')}</span>`);
  };

  /* Confirmation en deux appuis (les boîtes confirm() sont bloquées dans certains cadres) */
  Q.twoTap = (btn, fn, label = 'Tap again to confirm') => {
    if (btn.dataset.armed) { fn(); return; }
    const old = btn.textContent;
    btn.dataset.armed = '1'; btn.textContent = label;
    setTimeout(() => { if (btn.isConnected) { btn.textContent = old; delete btn.dataset.armed; } }, 3000);
  };
  Q.clock = ts => new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  // Lien WhatsApp vers le salon — null tant qu'aucun vrai numéro n'est configuré (jamais de numéro fictif)
  Q.waLink = text => { const n = String(Q.D.brand.whatsapp || '').replace(/\D/g, ''); return n.length >= 9 ? `https://wa.me/${n}?text=${encodeURIComponent(text || '')}` : null; };
  Q.hm = min => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`;
  Q.baseUrl = () => location.href.replace(/[^/]*([?#].*)?$/, '');
  Q.qr = (el, text, size = 220, dark = '#4B2D25') => {
    el.innerHTML = '';
    if (window.QRCode) new window.QRCode(el, { text, width: size, height: size, colorDark: dark, colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M });
    else el.textContent = text;
  };

  /* i18n minimal : data-i18n="clé" sur les éléments, dictionnaire par page */
  // Sur le site publié, l'accueil existe en deux pages indexables (/ en anglais, ar.html en arabe) :
  // la langue de la page l'emporte et le sélecteur navigue vers l'autre version (attributs ajoutés par scripts/build-site.mjs).
  // Ailleurs (app native, aperçu, autres pages), la langue change sur place et la préférence est mémorisée.
  const pageLang = document.documentElement.dataset.pageLang;
  Q.lang = pageLang || (() => { try { return localStorage.getItem('qamar:lang') || 'en'; } catch (e) { return 'en'; } })();
  Q.i18n = function (dict) {
    Q.dict = dict;
    const altHref = lang => document.documentElement.dataset['langHref' + lang.charAt(0).toUpperCase() + lang.slice(1)];
    const go = lang => {
      const href = lang !== pageLang && altHref(lang);
      if (href) { try { localStorage.setItem('qamar:lang', lang); } catch (e) { /* ignore */ } location.href = href + location.hash; return; }
      apply(lang);
    };
    const apply = lang => {
      Q.lang = lang;
      try { localStorage.setItem('qamar:lang', lang); } catch (e) { /* ignore */ }
      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      document.querySelectorAll('[data-i18n]').forEach(el => { const v = dict[el.dataset.i18n]?.[lang]; if (v != null) el.innerHTML = v; });
      document.querySelectorAll('[data-i18n-ph]').forEach(el => { const v = dict[el.dataset.i18nPh]?.[lang]; if (v != null) el.placeholder = v; });
      document.querySelectorAll('.lang button').forEach(b => { b.classList.toggle('on', b.dataset.lang === lang); b.setAttribute('aria-pressed', String(b.dataset.lang === lang)); });
      document.dispatchEvent(new CustomEvent('qamar:lang', { detail: lang }));
    };
    document.querySelectorAll('.lang button').forEach(b => { b.type = 'button'; b.setAttribute('lang', b.dataset.lang); b.addEventListener('click', () => go(b.dataset.lang)); });
    apply(Q.lang);
    return apply;
  };
  Q.t = key => Q.dict?.[key]?.[Q.lang] ?? key;
  Q.L = obj => (obj && typeof obj === 'object' ? (obj[Q.lang] ?? obj.en) : obj);

  window.Q = Q;
})();
