/* QAMAR : connecteur Supabase de la file d'attente (phase 2). Chargé après assets/store.js sur toutes les pages de la file.
   INACTIF tant que config.js -> backend vaut 'demo' (la page ne charge alors rien de plus et la démo reste identique).
   En mode 'supabase' :
   - l'état de Q (tickets, coiffeuses, pointages, affluence) devient un MIROIR du serveur ; les mêmes fonctions Q.* (joinQueue, call,
     start, pay…) appellent les fonctions SQL de la migration 009, qui vérifient tout ; les pages n'ont presque rien à changer ;
   - pages clientes (accueil, file, app, écran d'entrée) : clé anon seulement, sans session ; la file publique est anonyme
     (queue_public, staff_public) ; le ticket de la cliente est lu par son jeton (my_ticket_live). Le lien ?t=<id>.<jeton>
     rouvre le ticket sur n'importe quel appareil (Safari, app d'écran d'accueil, app native) ;
   - écrans du personnel (<html data-staff> : station.html, admin.html) : connexion Supabase Auth (même session que office.html),
     tableau du jour par q_board ; sur la tablette partagée, chaque coiffeuse déverrouille avec son PIN (station_unlock) ;
   - temps réel : abonnement aux miroirs publics (aucune donnée personnelle) ; à chaque changement, la page relit ce qui la concerne.
   Testé avec un faux client Supabase branché sur PGlite (scripts/run-tests.mjs) ; jamais contre le vrai projet. */
(function () {
  const C = window.QAMAR_CONFIG || {};
  const Q = window.Q;
  if (C.backend !== 'supabase' || !Q || !C.supabaseUrl || !C.supabaseAnonKey) return;
  window.QAMAR_BACKEND_READY = true; // Q.mode = 'supabase' dès maintenant : la page ne montre jamais les données de démo
  const D = Q.D;
  const staffPage = document.documentElement.hasAttribute('data-staff');
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js';
  const ACTIVE_T = ['waiting', 'called', 'in_service', 'checkout', 'paid'];
  const ls = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
  };
  const ts = v => (v ? new Date(v).getTime() : undefined);
  const lang = () => (Q.lang === 'ar' ? 'ar' : 'en');
  const MSG = {
    offline: { en: 'Connection problem: the live queue cannot be reached. Retrying.', ar: 'مشكلة في الاتصال: تعذّر الوصول إلى الطابور المباشر. جارٍ إعادة المحاولة.' },
    error: { en: 'Something went wrong. Please try again.', ar: 'حدث خطأ. يرجى المحاولة مرة أخرى.' },
    forbidden: { en: 'Not allowed for this account.', ar: 'غير مسموح لهذا الحساب.' },
    session_expired: { en: 'This station session has ended. Enter your PIN again.', ar: 'انتهت جلسة المحطة. أدخلي رمزك مرة أخرى.' },
    busy: { en: 'Finish your current client first.', ar: 'أنهي عميلتك الحالية أولاً.' },
    not_clocked_in: { en: 'Clock in first (enter your PIN).', ar: 'سجّلي حضورك أولاً (أدخلي رمزك).' },
    client_in_progress: { en: 'Finish your current client before clocking out.', ar: 'أنهي عميلتك الحالية قبل تسجيل الانصراف.' },
    queue_full: { en: 'The queue is full right now. Please try again in a few minutes.', ar: 'الطابور ممتلئ الآن. يرجى المحاولة بعد دقائق.' },
    try_later: { en: 'Too many requests. Please try again in a few minutes.', ar: 'طلبات كثيرة. يرجى المحاولة بعد دقائق.' },
    too_many_requests: { en: 'This number has joined too many times today.', ar: 'انضم هذا الرقم مرات كثيرة اليوم.' },
    invalid_phone: { en: 'Please check the phone number.', ar: 'يرجى التحقق من رقم الهاتف.' },
    service_unavailable: { en: 'This look is not available right now. Please choose another one.', ar: 'هذه الإطلالة غير متاحة الآن. يرجى اختيار أخرى.' },
    back_office: { en: 'Managed in the back-office (office.html).', ar: 'تتم إدارته من المكتب الخلفي (office.html).' },
    pay_online_off: { en: 'Online payment is not available. Please pay at your station.', ar: 'الدفع عبر الإنترنت غير متاح. يرجى الدفع عند محطتك.' }
  };
  const say = (k) => (MSG[k] || MSG.error)[lang()];
  const codeOf = e => { const m = String((e && (e.message || e.code)) || e || ''); const k = Object.keys(MSG).find(x => m.includes(x)); return k || (/fetch|network|load failed/i.test(m) ? 'offline' : 'error'); };

  /* ---------- Libellés et conversions (format du serveur -> format de la démo) ---------- */
  const PR = D.promotions || {};
  const promoLabel = id => ({ 'launch-first': PR.launch && PR.launch.label, launch: PR.launch && PR.launch.label, 'happy-hours': PR.happyHours && PR.happyHours.label, squad: PR.squad && PR.squad.label, code: { en: 'Promo code', ar: 'كود خصم' } }[id] || { en: 'Discount', ar: 'خصم' });
  const promoObj = (id, pct) => (id && Number(pct) > 0 ? { id, pct: Number(pct), label: promoLabel(id) } : null);
  const num = v => (v == null ? 0 : Number(v));
  function mapTicket(j) {
    const party = Array.isArray(j.party) && j.party.length > 1 ? j.party.map(p => ({ serviceId: p.serviceId, extraLong: !!p.extraLong, promo: promoObj(p.promoId, p.pct) })) : undefined;
    const t = {
      id: j.id, ref: j.public_ref, num: j.num, name: j.name || '', phone: j.phone || '', serviceId: j.service_id, pref: j.pref_staff || 'any',
      extraLong: !!j.extra_long, channel: j.channel || 'qr', promo: promoObj(j.promo_id, j.promo_pct), discountPct: num(j.promo_pct), addons: j.addons || [],
      status: j.status, createdAt: ts(j.created_at), calledAt: ts(j.called_at), startedAt: ts(j.started_at), finishedAt: ts(j.finished_at),
      assignedTo: j.assigned_staff || undefined, seat: j.seat || undefined, perfume: j.perfume || undefined, hijab: !!j.hijab, guaranteeFree: !!j.guarantee_free, pings: j.pings || 0
    };
    if (party) t.party = party;
    if (j.promo_code) t.promoCode = j.promo_code;
    if (j.status === 'cancelled') t.cancelledAt = ts(j.closed_at);
    if (j.status === 'done' || j.status === 'noshow') t.doneAt = ts(j.closed_at);
    if (j.payment) t.payment = { method: j.payment.method, total: num(j.payment.total), discount: num(j.payment.discount), tip: num(j.payment.tip), paidAt: ts(j.payment.paid_at) };
    if (j.rating) t.rating = j.rating;
    if (j.amount) t.amount = { base: num(j.amount.base), discount: num(j.amount.discount), addons: num(j.amount.addons), total: num(j.amount.total) };
    return t;
  }
  // Ligne anonyme du miroir public : pas de nom, pas de téléphone ; sert au rang et à l'attente estimée
  const mapPublic = r => {
    const t = { id: 'pub:' + r.ticket_ref, ref: r.ticket_ref, num: r.num, name: '', phone: '', serviceId: r.service_id, pref: r.pref_staff || 'any', extraLong: !!r.extra_long,
      addons: [], status: r.status, createdAt: ts(r.created_at), calledAt: ts(r.called_at), startedAt: ts(r.started_at), assignedTo: r.assigned_staff || undefined, seat: r.seat || undefined, pings: r.pings || 0, anonymous: true };
    if (r.party_size > 1 && Array.isArray(r.party)) t.party = r.party.map(p => ({ serviceId: p.serviceId, extraLong: !!p.extraLong, promo: null }));
    return t;
  };
  const mapStylist = (r, i) => ({ id: r.id, name: r.display_name, names: { en: r.display_name, ar: r.display_name }, seat: r.seat || i + 1, ig: r.instagram || '',
    specialty: { en: r.specialty_en || '', ar: r.specialty_ar || r.specialty_en || '' } });

  /* ---------- Miroir ---------- */
  const blank = () => ({ v: 1, counter: 0, stylists: [], shifts: [], tickets: [], launchServed: 0,
    settings: { launchMode: false, launchFirst: PR.launch ? PR.launch.firstN : 30, launchFirstPct: PR.launch ? PR.launch.firstPct : 70, launchRestPct: PR.launch ? PR.launch.restPct : 50 },
    lounge: null, remote: { ready: false, error: null, staff: staffPage, me: null, manager: false, needLogin: false, launchUsed: null } });
  const box = Q._attachRemote(blank());
  const pub = { queue: [], staff: [], lounge: null, offer: [] };
  let board = null;         // tableau du personnel (q_board)
  let mine = null;          // ticket de la cliente (my_ticket_live)
  function rebuild() {
    const st = box.get();
    const s = { ...st, remote: { ...st.remote } };
    s.stylists = pub.staff.map(mapStylist);
    const openShifts = pub.staff.filter(r => r.on_shift).map(r => ({ id: 'sh-' + r.id, stylistId: r.id, in: ts(r.shift_in) || Date.now(), out: null }));
    if (board) {
      s.tickets = board.tickets.map(mapTicket);
      const seen = new Set();
      s.shifts = board.shifts.map(x => { if (!x.out) seen.add(x.staff_id); return { id: x.id, stylistId: x.staff_id, seat: x.seat, in: ts(x.in), out: ts(x.out) || null }; })
        .concat(openShifts.filter(x => !seen.has(x.stylistId)));
      s.remote.me = board.me; s.remote.manager = !!board.manager;
    } else {
      const own = mine ? mapTicket(mine) : null;
      if (own) own.accessToken = mine._token;
      s.tickets = pub.queue.filter(r => !own || r.ticket_ref !== own.ref).map(mapPublic).concat(own ? [own] : []);
      s.shifts = openShifts;
    }
    const lg = pub.lounge;
    s.lounge = lg && lg.updated_at ? { waiting: lg.lounge_waiting || 0, chairsFree: lg.chairs_free ?? null, at: ts(lg.updated_at), by: null } : null;
    const lf = pub.offer.find(o => o.id === 'launch-first'), lr = pub.offer.find(o => o.id === 'launch');
    s.settings = { ...s.settings, launchMode: !!((lf && lf.enabled) || (lr && lr.enabled)) };
    if (lf) { s.settings.launchFirst = lf.max_uses || s.settings.launchFirst; s.settings.launchFirstPct = lf.pct; s.remote.launchUsed = Number(lf.used) || 0; s.launchServed = s.remote.launchUsed; }
    if (lr) s.settings.launchRestPct = lr.pct;
    s.counter = s.tickets.reduce((n, t) => Math.max(n, t.num || 0), 0);
    return s;
  }
  let readyOnce = false;
  const publish = () => { const s = rebuild(); s.remote.ready = true; readyOnce = true; box.set(s, true); };

  /* ---------- Ticket de la cliente : jeton gardé sur l'appareil, lien ?t=<id>.<jeton> ---------- */
  const TK = 'qamar:myTicket', TKEY = 'qamar:myTicketKey';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  Q.parseTicketParam = v => { const [id, key] = String(v || '').split('.'); return { id: UUID.test(id || '') ? id : (id || null), key: UUID.test(key || '') ? key : null }; };
  Q.ticketLink = t => { const key = t && (t.accessToken || (t.id === ls.get(TK) && ls.get(TKEY))); return t ? (key ? t.id + '.' + key : t.id) : ''; };
  (function adoptLink() {
    if (staffPage) return;
    const p = Q.parseTicketParam(new URLSearchParams(location.search).get('t'));
    if (p.id && p.key) { ls.set(TK, p.id); ls.set(TKEY, p.key); }
  })();
  const myKey = () => { const id = ls.get(TK), key = ls.get(TKEY); return id && key && UUID.test(id) && UUID.test(key) ? { id, key } : null; };

  /* ---------- Client Supabase ---------- */
  let sb = null, clientReady;
  const booted = new Promise(r => { clientReady = r; });   // une action tapée avant la fin du chargement attend le client
  const rpc = async (fn, args) => { if (!sb && !(await booted)) throw new Error('network: supabase-js'); const { data, error } = await sb.rpc(fn, args); if (error) throw error; return data; };
  const sel = async (table, q = x => x) => { const { data, error } = await q(sb.from(table).select('*')); if (error) throw error; return data || []; };
  function loadLib() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = LIB; s.crossOrigin = 'anonymous'; s.onload = res; s.onerror = () => rej(new Error('network: supabase-js')); document.head.appendChild(s); });
  }

  /* ---------- Sessions de poste (tablette) ---------- */
  const SK = 'qamar:stationSessions';
  const sessions = () => { try { const o = JSON.parse(ls.get(SK) || '{}'); const now = Date.now(); Object.keys(o).forEach(k => { if (!o[k] || o[k].exp < now) delete o[k]; }); return o; } catch (e) { return {}; } };
  const saveSessions = o => ls.set(SK, JSON.stringify(o));
  const sessionFor = sid => { const o = sessions(); return sid && o[sid] ? o[sid].token : null; };
  const lastSession = () => { const o = sessions(); const k = Object.keys(o).sort((a, b) => o[b].at - o[a].at)[0]; return k ? o[k].token : null; };
  Q.hasStationSession = sid => !!sessionFor(sid);
  const dropSession = sid => { const o = sessions(); delete o[sid]; saveSessions(o); };

  /* ---------- Chargements ---------- */
  async function loadPublic() {
    const [queue, staff, lounge, offer] = await Promise.all([
      sel('queue_public', q => q.order('created_at', { ascending: true })), sel('staff_public', q => q.order('display_name', { ascending: true })),
      sel('salon_status', q => q.eq('id', 1)), sel('public_offer')]);
    pub.queue = queue; pub.staff = staff; pub.lounge = lounge[0] || null; pub.offer = offer;
  }
  async function loadMine() {
    const k = myKey(); if (!k) { mine = null; return; }
    const j = await rpc('my_ticket_live', { p_ticket: k.id, p_token: k.key });
    mine = j ? { ...j, _token: k.key } : null;
  }
  async function loadBoard() { board = await rpc('q_board', { p_session: lastSession() }); }
  let failures = 0;
  async function refresh(what = 'all') {
    if (!sb) return;
    try {
      if (what === 'all' || what === 'public') await loadPublic();
      if (staffPage) { if (!box.get().remote.needLogin) await loadBoard(); }
      else if (what === 'all' || what === 'mine') await loadMine();
      failures = 0; banner(null); publish();
    } catch (e) {
      const c = codeOf(e);
      if (c === 'session_expired') { saveSessions({}); return refresh(what); }
      failures++; console.warn('[QAMAR] refresh failed', e);
      if (failures >= 2 || !readyOnce) banner(say('offline'));
      if (!readyOnce) publish();
    }
  }
  let tmr = null, pendingWhat = null;
  // Regroupe les événements rapprochés (au plus une relecture toutes les 250 ms, jamais repoussée indéfiniment)
  const soon = (what = 'all') => { pendingWhat = pendingWhat && pendingWhat !== what ? 'all' : what; if (tmr) return; tmr = setTimeout(() => { tmr = null; const w = pendingWhat; pendingWhat = null; refresh(w); }, 250); };

  function subscribe() {
    const onQueue = p => {
      const ref = (p.new && p.new.ticket_ref) || (p.old && p.old.ticket_ref);
      if (!staffPage && mine && (!ref || ref === mine.public_ref)) return soon('all');
      soon(staffPage ? 'all' : 'public');
    };
    sb.channel('qamar-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queue_public' }, onQueue)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_public' }, () => soon('all'))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salon_status' }, () => soon('public'))
      .subscribe();
  }

  /* ---------- Bandeau de connexion et écran de connexion du personnel (EN + AR) ---------- */
  function banner(text) {
    let b = document.getElementById('qLiveBanner');
    if (!text) { if (b) b.remove(); return; }
    if (!b) {
      b = document.createElement('div'); b.id = 'qLiveBanner'; b.setAttribute('role', 'status');
      b.style.cssText = 'position:fixed;z-index:998;left:50%;bottom:12px;transform:translateX(-50%);background:#1B1117;color:#E8CFA0;border:1px solid rgba(232,207,160,.35);border-radius:999px;padding:7px 14px;font:500 12px/1.3 Helvetica,Arial,sans-serif;max-width:calc(100% - 24px);text-align:center';
      (document.body || document.documentElement).appendChild(b);
    }
    b.textContent = text;
  }
  const L2 = (en, ar) => `${Q.esc(en)} <span lang="ar" dir="rtl">${Q.esc(ar)}</span>`;
  function loginOverlay() {
    if (document.getElementById('qLogin')) return;
    const o = document.createElement('div'); o.id = 'qLogin';
    o.style.cssText = 'position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:linear-gradient(160deg,#FCEDE9,var(--blush,#F6DCD5))';
    o.innerHTML = `<form class="panel" style="background:#fff;border-radius:26px;padding:30px;max-width:420px;width:100%;box-shadow:var(--shadow)" novalidate>
      <div class="lbl" style="font-size:.75rem;letter-spacing:.2em;text-transform:uppercase;color:var(--rose)">QAMAR</div>
      <h2 style="font-family:var(--serif);font-weight:400;font-size:2rem;margin:6px 0 4px;color:var(--cocoa)">${L2('Sign in to the salon', 'تسجيل الدخول إلى الصالون')}</h2>
      <p class="muted" style="font-size:.9rem;margin:0 0 16px">${L2('Team or station account. There is no sign-up here.', 'حساب الفريق أو المحطة. لا يوجد تسجيل جديد هنا.')}</p>
      <label style="display:block;font-size:.85rem;margin:8px 0 4px" for="qlEmail">${L2('E-mail', 'البريد الإلكتروني')}</label><input class="input" id="qlEmail" type="email" autocomplete="username" required style="width:100%">
      <label style="display:block;font-size:.85rem;margin:12px 0 4px" for="qlPw">${L2('Password', 'كلمة المرور')}</label><input class="input" id="qlPw" type="password" autocomplete="current-password" required style="width:100%">
      <button class="btn btn-primary btn-block" type="submit" style="margin-top:18px">${L2('Sign in', 'دخول')}</button>
      <p id="qlMsg" role="alert" style="color:var(--bad,#B4403A);font-size:.9rem;margin:12px 0 0"></p></form>`;
    document.body.appendChild(o);
    o.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      const m = o.querySelector('#qlMsg'); m.textContent = '';
      const { error } = await sb.auth.signInWithPassword({ email: o.querySelector('#qlEmail').value.trim(), password: o.querySelector('#qlPw').value });
      if (error) { m.innerHTML = L2('Wrong e-mail or password.', 'البريد الإلكتروني أو كلمة المرور غير صحيحة.'); return; }
      o.remove(); const s = box.get(); box.set({ ...s, remote: { ...s.remote, needLogin: false } }, false); refresh('all'); timers();
    };
  }

  /* ---------- Actions : mêmes noms que la démo, résultat en promesse ---------- */
  const mineId = () => (myKey() || {}).id;
  const isMine = id => !staffPage && id && id === mineId();
  const actorSession = id => { const t = Q.ticket(id); return sessionFor(t && t.assignedTo) || null; };
  async function act(fn, args, fallback, what = 'all') {
    try { const r = await rpc(fn, args); await refresh(what); return r; }
    catch (e) { const c = codeOf(e); console.warn('[QAMAR]', fn, e); Q.toast(say(c)); if (c === 'session_expired') { saveSessions({}); refresh('all'); } return fallback; }
  }

  Q.joinQueue = async ({ name, phone, serviceId, pref = 'any', extraLong = false, party = null, promoCode = null } = {}) => {
    const people = Array.isArray(party) && party.length > 1 ? party.slice(0, D.maxParty || 6).map(p => ({ serviceId: p && p.serviceId, extraLong: !!(p && p.extraLong) })) : null;
    const code = promoCode ? String(promoCode).trim().toUpperCase().slice(0, 32) : null;
    try {
      const r = await rpc('join_queue', { p_name: name, p_phone: phone, p_service: people ? people[0].serviceId : serviceId, p_extra_long: people ? people[0].extraLong : !!extraLong,
        p_pref: pref && pref !== 'any' && UUID.test(pref) ? pref : null, p_party: people, p_promo_code: code || null });
      const row = Array.isArray(r) ? r[0] : r;
      if (!row || !row.ticket_id) return null;
      if (!staffPage) { ls.set(TK, row.ticket_id); ls.set(TKEY, row.access_token); }
      await refresh('all');
      const t = Q.ticket(row.ticket_id);
      if (t) t.accessToken = row.access_token;   // lien ?t=<id>.<jeton> (message WhatsApp, QR)
      return t || { id: row.ticket_id, num: row.num, accessToken: row.access_token, status: 'waiting', serviceId, name, createdAt: Date.now(), addons: [] };
    } catch (e) { const c = codeOf(e); console.warn('[QAMAR] join_queue', e); if (c !== 'service_unavailable') Q.toast(say(c)); return null; }
  };
  Q.cancel = id => {
    if (isMine(id)) return act('cancel_my_ticket', { p_ticket: id, p_token: myKey().key }, false).then(() => true);
    return act('q_advance', { p_ticket: id, p_action: 'remove', p_session: null }, null).then(r => !!r);
  };
  // Tablette : PIN -> session de poste + pointage (à ce poste)
  Q.clockIn = async (sid, pin) => {
    try {
      const r = await rpc('station_unlock', { p_staff: sid, p_pin: String(pin), p_seat: Q.stationSeat || null });
      if (!r || !r.ok) return { ok: false, error: (r && r.error) || 'pin' };
      const o = sessions(); o[sid] = { token: r.session, exp: ts(r.expires_at), at: Date.now() }; saveSessions(o);
      await refresh('all'); return { ok: true };
    } catch (e) { const c = codeOf(e); Q.toast(say(c)); return { ok: false, error: c }; }
  };
  Q.clockOut = sid => act('q_clock_out', { p_session: sessionFor(sid) }, false).then(r => { if (r !== false) dropSession(sid); return r !== false; });
  Q.lockStation = sid => { const s = sessionFor(sid); dropSession(sid); return s ? act('station_lock', { p_session: s }, null) : Promise.resolve(); };
  Q.call = (sid, ticketId) => act('q_call', { p_ticket: ticketId || null, p_session: sessionFor(sid) }, null).then(j => (j ? (Q.ticket(j.id) || mapTicket(j)) : null));
  const adv = action => id => act('q_advance', { p_ticket: id, p_action: action, p_session: actorSession(id) }, null).then(r => !!r);
  Q.start = adv('start'); Q.toCheckout = adv('finish'); Q.noShow = adv('noshow'); Q.requeue = adv('requeue'); Q.renotify = adv('renotify'); Q.toggleExtraLong = adv('toggle_long');
  Q.addAddon = (id, a) => (isMine(id) ? act('my_add_addon', { p_ticket: id, p_token: myKey().key, p_addon: a }, null) : act('q_add_addon', { p_ticket: id, p_addon: a, p_session: actorSession(id) }, null));
  Q.removeAddon = (id, a) => act('q_remove_addon', { p_ticket: id, p_addon: a, p_session: actorSession(id) }, null);
  Q.setPerfume = (id, p) => (isMine(id) ? act('my_set_perfume', { p_ticket: id, p_token: myKey().key, p_perfume: p }, null) : act('q_set_details', { p_ticket: id, p_perfume: p, p_hijab: null, p_session: actorSession(id) }, null));
  Q.setHijab = (id, v) => act('q_set_details', { p_ticket: id, p_perfume: null, p_hijab: !!v, p_session: actorSession(id) }, null);
  // Encaissement au salon (espèces ou terminal de carte), confirmé par la coiffeuse. Aucun paiement en ligne (pas de prestataire branché).
  Q.onlinePayments = !!(C.payments && C.payments.provider);
  Q.pay = (id, { method, tip = 0 } = {}) => {
    if (!staffPage) { Q.toast(say('pay_online_off')); return Promise.resolve(null); }
    return act('q_record_payment', { p_ticket: id, p_method: method, p_tip: Math.max(0, Math.round(Number(tip) || 0)), p_session: actorSession(id) }, null);
  };
  Q.rate = (id, stars, comment) => {
    const n = Math.round(Number(stars) || 0);
    if (isMine(id)) return act('my_rate', { p_ticket: id, p_token: myKey().key, p_stars: n, p_comment: comment || null }, null);
    return act('q_rate', { p_ticket: id, p_stars: n, p_comment: comment || null, p_session: actorSession(id) }, null);
  };
  Q.setLounge = ({ waiting, chairsFree } = {}) => {
    const cur = box.get().lounge || {};
    const w = waiting === undefined ? (cur.waiting || 0) : Math.max(0, Math.min((D.live && D.live.loungeMax) || 30, Math.round(Number(waiting) || 0)));
    const c = chairsFree === undefined ? (cur.chairsFree ?? null) : chairsFree === null || chairsFree === '' ? null : Math.max(0, Math.round(Number(chairsFree) || 0));
    act('set_lounge', { p_waiting: w, p_chairs_free: c }, null, 'public');
    return { waiting: w, chairsFree: c, at: Date.now(), by: null };
  };
  // Réglages de démo : en mode connecté, ils vivent dans le back-office (promotions, codes, statut du salon)
  Q.setSetting = Q.resetLaunchCounter = Q.seedDemo = Q.reset = () => { Q.toast(say('back_office')); };
  // Montant affiché = celui recalculé par le serveur (ticket_amount, 009) quand il est connu
  const basePricing = Q.pricing;
  Q.pricing = t => { const p = basePricing(t); if (t && t.amount) { p.base = t.amount.base; p.discount = t.amount.discount; p.addonsTotal = t.amount.addons; p.total = t.amount.total; } return p; };
  Q.signOut = async () => { saveSessions({}); if (sb) await sb.auth.signOut(); location.reload(); };
  Q.refresh = () => refresh('all');

  /* ---------- Démarrage ---------- */
  (async function boot() {
    try { await loadLib(); }
    catch (e) { banner(say('offline')); clientReady(false); publish(); return; }
    // Personnel : session partagée avec office.html (même clé de stockage). Clientes : jamais de session (anon pur).
    sb = staffPage
      ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, storageKey: 'qamar-blog-admin' } })
      : window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'qamar-client' } });
    Q.client = sb; clientReady(true);
    if (staffPage) {
      let session = null;
      try { session = (await sb.auth.getSession()).data.session; } catch (e) { /* ignore */ }
      if (!session) {
        const s = box.get(); box.set({ ...s, remote: { ...s.remote, needLogin: true } }, false);
        const show = () => loginOverlay(); if (document.body) show(); else addEventListener('DOMContentLoaded', show);
        try { await loadPublic(); } catch (e) { /* ignore */ }
        publish(); subscribe(); return;
      }
    }
    await refresh('all');
    subscribe();
    timers();
  })();
  // Filet de sécurité si le temps réel décroche (lancé aussi après la connexion du personnel, sinon la page ne se relisait plus)
  let timersOn = false;
  function timers() {
    if (timersOn) return; timersOn = true;
    setInterval(() => refresh('all'), staffPage ? 20000 : 15000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh('all'); });
  }
})();
