/* QAMAR — tests du moteur et des règles commerciales.
   Partagés par tests.html (navigateur) et scripts/run-tests.mjs (Node, exécuté par GitHub Actions avant chaque mise en ligne).
   Ne jamais modifier un test pour masquer une erreur : corriger le moteur. */
window.QAMAR_ENGINE_TESTS = function (test, Q) {
  const fresh = () => { Q.reset(); };
  const D = Q.D;
  const T = (h, m = 0, day = 19) => Date.UTC(2026, 9, day, h - 4, m); // heure de Dubaï → UTC (19/10/2026 = lundi)

  // ---- Règles commerciales ----
  test('every service lasts 45 min or less', () => D.services.every(s => s.duration <= 45) && D.maxMinutes === 45);
  test('extra long hair never pushes a service past 45 min', () => { fresh(); return D.services.every(s => Q.quote(s.id, true).duration <= 45); });
  test('opening offer: first ticket gets −70%', () => { fresh(); const q = Q.quote('express'); return q.promo.id === 'launch-first' && q.total === D.services.find(s => s.id === 'express').price - Math.round(D.services.find(s => s.id === 'express').price * .7); });
  test('a cancelled ticket frees its −70% spot', () => { fresh(); const t = Q.joinQueue({ name: 'A', phone: '+971500000001', serviceId: 'express' }); const before = Q.launchUsed(); Q.cancel(t.id); return before === 1 && Q.launchUsed() === 0; });
  test('a no-show frees its −70% spot', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000020', serviceId: 'express' }); Q.call('layla'); Q.noShow(t.id); return Q.launchUsed() === 0; });
  test('after 30 active −70% tickets the next one gets −50%', () => { fresh(); for (let i = 0; i < 30; i++) Q.joinQueue({ name: 'G' + i, phone: '+9715000001' + String(i).padStart(2, '0'), serviceId: 'sos' }); const t = Q.joinQueue({ name: 'Z', phone: '+971500009999', serviceId: 'sos' }); return t.promo.id === 'launch' && t.promo.pct === 50; });
  test('happy hours apply Mon–Fri 10:00–15:00 Dubai, only when launch is off', () => { fresh(); Q.setSetting('launchMode', false); return Q.bestPromo(T(11))?.id === 'happy-hours' && Q.bestPromo(T(11, 0, 17)) === null && Q.bestPromo(T(16)) === null && Q.bestPromo(T(9, 59)) === null && Q.bestPromo(T(15, 0)) === null; });
  test('only one discount applies (the best one)', () => { fresh(); return Q.bestPromo(T(11)).pct === 70; });
  test('when launch and happy hours are both eligible, only the bigger one is used', () => { fresh(); const q = Q.quote('glow', false, T(11)); return q.promo && q.promo.pct === 70 && q.discount === Math.round(D.services.find(s => s.id === 'glow').price * .7); });
  test('discount covers the extra-long supplement, never drinks', () => { fresh(); const q = Q.quote('express', true); const t = { serviceId: 'express', extraLong: true, addons: ['matcha-latte'], promo: q.promo, discountPct: q.promo.pct }; const p = Q.pricing(t); return p.base === D.services.find(s => s.id === 'express').price + D.extraLong.price && p.addonsTotal === 25 && p.total === (p.base - p.discount) + 25; });
  test('no promotion → full price', () => { fresh(); Q.setSetting('launchMode', false); const q = Q.quote('express', false, T(18)); return !q.promo && q.total === D.services.find(s => s.id === 'express').price && q.discount === 0; });
  // ---- Visites de groupe (Squad) et affluence ----
  const P = id => D.services.find(s => s.id === id).price;
  test('group of 4, no other offer: Squad −25% on each person', () => { fresh(); Q.setSetting('launchMode', false); const g = Q.groupQuote([{ serviceId: 'express' }, { serviceId: 'express' }, { serviceId: 'glow' }, { serviceId: 'sos' }], T(18)); const exp = ['express', 'express', 'glow', 'sos'].reduce((n, id) => n + P(id) - Math.round(P(id) * .25), 0); return g.squad && g.people.every(l => l.promo.id === 'squad') && g.total === exp && g.base === P('express') * 2 + P('glow') + P('sos'); });
  test('group of 3: no Squad discount', () => { fresh(); Q.setSetting('launchMode', false); const g = Q.groupQuote([{ serviceId: 'express' }, { serviceId: 'glow' }, { serviceId: 'sos' }], T(18)); return !g.squad && g.discount === 0; });
  test('group: one discount per person, the best one (opening −70% beats Squad, never stacked)', () => { fresh(); const g = Q.groupQuote([{ serviceId: 'glow' }, { serviceId: 'glow' }, { serviceId: 'glow' }, { serviceId: 'glow' }]); return g.people.every(l => l.promo.id === 'launch-first' && l.discount === Math.round(P('glow') * .7)); });
  test('group ticket carries the party, uses one −70% spot per person, and the till matches the quote', () => { fresh(); const party = [{ serviceId: 'express' }, { serviceId: 'waves', extraLong: true }, { serviceId: 'sos' }, { serviceId: 'sos' }]; const q = Q.groupQuote(party); const t = Q.joinQueue({ name: 'A', phone: '+971500000030', serviceId: 'express', party }); const p = Q.pricing(t); return Q.sizeOf(t) === 4 && Q.launchUsed() === 4 && p.total === q.total && p.base === q.base && /^×4 · /.test(Q.partyText(t)); });
  test('group: when the −70% spots run out mid-group, each person gets her own best offer', () => { fresh(); Q.setSetting('launchFirst', 2); Q.setSetting('launchMode', true); const g = Q.groupQuote([{ serviceId: 'sos' }, { serviceId: 'sos' }, { serviceId: 'sos' }, { serviceId: 'sos' }]); return g.people.map(l => l.promo.pct).join() === '70,70,50,50'; });
  test('live status: staff lounge count drives the busy level, never shown as a booking', () => { fresh(); Q.clockIn('layla', '1111'); const quiet = Q.liveStatus(); Q.setLounge({ waiting: 6, chairsFree: 0 }); const busy = Q.liveStatus(); return quiet.open && quiet.level === 'quiet' && busy.waiting === 6 && busy.level === 'busy' && busy.minutes > 30; });
  test('live status: closed when nobody is on shift and no recent lounge count', () => { fresh(); const s = Q.liveStatus(); return s.open === false && s.level === null; });

  test('Night Glow cannot be booked before 20:00 Dubai', () => { fresh(); const s = Q.service('night'); return Q.available(s, T(16, 0, 17)) === false && Q.available(s, T(21, 0, 17)) === true; });
  test('Night Glow includes one free matcha only', () => { fresh(); const t = { serviceId: 'night', addons: ['matcha-latte', 'matcha-iced'], discountPct: 0 }; const p = Q.pricing(t); return p.addonsTotal === 25; });
  test('35-min guarantee: express over 35 min of service is free (drinks still charged)', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000008', serviceId: 'express' }); Q.call('layla'); Q.start(t.id); Q.addAddon(t.id, 'matcha-iced'); Q.ticket(t.id).startedAt -= 36 * 60000; Q.toCheckout(t.id); const p = Q.pricing(Q.ticket(t.id)); return p.guarantee === true && p.total === 25; });
  test('guarantee does not apply to other looks', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000009', serviceId: 'glow' }); Q.call('layla'); Q.start(t.id); Q.ticket(t.id).startedAt -= 60 * 60000; Q.toCheckout(t.id); return Q.pricing(Q.ticket(t.id)).guarantee === false; });
  test('guarantee is configured for Qamar Express only', () => JSON.stringify(D.guarantee.serviceIds) === '["express"]' && D.guarantee.minutes === 35);

  // ---- File d'attente et autorisations ----
  test('one active ticket per phone number', () => { fresh(); const a = Q.joinQueue({ name: 'A', phone: '+33612345678', serviceId: 'express' }); const b = Q.joinQueue({ name: 'B', phone: '+33612345678', serviceId: 'glow' }); return a.id === b.id; });
  test('names are cleaned of HTML characters and limited to 40', () => { fresh(); const t = Q.joinQueue({ name: '<img src=x onerror=alert(1)>' + 'x'.repeat(60), phone: '+971500000002', serviceId: 'express' }); return !/[<>]/.test(t.name) && t.name.length <= 40; });
  test('a stylist must be clocked in to call a client', () => { fresh(); Q.joinQueue({ name: 'A', phone: '+971500000003', serviceId: 'express' }); return Q.call('layla') === null; });
  test('a stylist cannot call a second client while busy', () => { fresh(); Q.clockIn('layla', '1111'); Q.joinQueue({ name: 'A', phone: '+971500000004', serviceId: 'express' }); Q.joinQueue({ name: 'B', phone: '+971500000005', serviceId: 'express' }); return !!Q.call('layla') && Q.call('layla') === null; });
  test('a client who asked for Noor cannot be called by Layla', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000006', serviceId: 'express', pref: 'noor' }); return Q.call('layla', t.id) === null; });
  test('5 wrong PINs lock the station', () => { fresh(); for (let i = 0; i < 5; i++) Q.clockIn('sara', '0000'); return Q.clockIn('sara', '3333').error === 'locked'; });
  test('clocking in twice does not create two shifts', () => { fresh(); Q.clockIn('noor', '2222'); Q.clockIn('noor', '2222'); return Q.state.shifts.filter(s => s.stylistId === 'noor' && !s.out).length === 1; });
  test('status transitions are enforced (no start before call)', () => { fresh(); const t = Q.joinQueue({ name: 'A', phone: '+971500000007', serviceId: 'express' }); return Q.start(t.id) === false && Q.toCheckout(t.id) === false; });
  test('a paid ticket cannot be cancelled or restarted', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000021', serviceId: 'sos' }); Q.call('layla'); Q.start(t.id); Q.toCheckout(t.id); Q.pay(t.id, { method: 'cash' }); return Q.cancel(t.id) === false && Q.start(t.id) === false && Q.ticket(t.id).status === 'paid'; });
  test('requeue puts a called client back in line', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000013', serviceId: 'sos' }); Q.call('layla'); return Q.requeue(t.id) === true && Q.ticket(t.id).status === 'waiting' && !Q.ticket(t.id).assignedTo; });

  // ---- Paiement (simulé en démo), pourboires, avis ----
  test('tips are capped and cash tips are not recorded as card tips', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000010', serviceId: 'express' }); Q.call('layla'); Q.start(t.id); Q.toCheckout(t.id); const p = Q.pay(t.id, { method: 'card', tip: 99999 }); return p.tip <= p.total && p.tip <= D.limits.tipMaxAed; });
  test('a negative tip is never recorded', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000022', serviceId: 'express' }); Q.call('layla'); Q.start(t.id); Q.toCheckout(t.id); const p = Q.pay(t.id, { method: 'card', tip: -50 }); return p.tip === 0; });
  test('demo payments are flagged as demo', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000023', serviceId: 'sos' }); Q.call('layla'); Q.start(t.id); Q.toCheckout(t.id); Q.pay(t.id, { method: 'card' }); return Q.ticket(t.id).payment.demo === true; });
  test('revenue is counted once, on the payment date', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000011', serviceId: 'sos' }); Q.call('layla'); Q.start(t.id); Q.toCheckout(t.id); Q.pay(t.id, { method: 'cash' }); Q.rate(t.id, 5, 'Great'); return Q.stats().revenue === Q.ticket(t.id).payment.total && Q.stats().served === 1; });
  test('ratings only after payment, 1 to 5, comment ≤ 500', () => { fresh(); Q.clockIn('layla', '1111'); const t = Q.joinQueue({ name: 'A', phone: '+971500000012', serviceId: 'sos' }); Q.rate(t.id, 5); const before = Q.ticket(t.id).rating; Q.call('layla'); Q.start(t.id); Q.toCheckout(t.id); Q.pay(t.id, { method: 'cash' }); Q.rate(t.id, 9, 'x'.repeat(900)); const tk = Q.ticket(t.id); return before === undefined && tk.rating === undefined && tk.status === 'done'; });

  // ---- Données personnelles et sécurité ----
  test('phone numbers: French 06 → +33, 00 prefix, too short rejected', () => Q.normalizePhone('06 12 34 56 78', '+33') === '+33612345678' && Q.normalizePhone('0044 7700 900123') === '+447700900123' && Q.normalizePhone('123', '+33') === null);
  test('CSV export neutralises formulas', () => Q.toCSV([['=HYPERLINK("x")', '+1', 'ok']]) === '"\'=HYPERLINK(""x"")","\'+1","ok"');
  test('CSV export neutralises - @ and tab/CR prefixes too', () => { const c = Q.toCSV([['-2+3', '@SUM(A1)', '\t=1', '\r=1']]); return !/(^|,)"[-@\t\r=+]/.test(c); });
  test('public name never shows the full last name', () => Q.publicName('Fatima Al Mansoori') === 'Fatima A.');

  // ---- Honnêteté de la démo et configuration ----
  test('no WhatsApp link while no real number is configured', () => { const keep = D.brand.whatsapp; D.brand.whatsapp = ''; const none = Q.waLink('hi') === null; D.brand.whatsapp = '971501234567'; const url = Q.waLink('a b'); D.brand.whatsapp = keep; return none && url === 'https://wa.me/971501234567?text=a%20b'; });
  test('the demo engine stays in demo mode even if config says supabase', () => { const c = window.QAMAR_CONFIG, keep = { ...c }; c.backend = 'supabase'; c.supabaseUrl = ''; const r = Q.isDemo === true && /supabaseUrl/.test(Q.configError); Object.assign(c, keep); return r; });
  test('production environment in demo mode is reported as an error', () => { const c = window.QAMAR_CONFIG, keep = c.environment; c.environment = 'production'; const r = /production/.test(Q.configError); c.environment = keep; return r; });
  test('the current config has no configuration error', () => Q.configError === '');
  test('demo PINs are refused in a production environment', () => { fresh(); const c = window.QAMAR_CONFIG, keep = c.environment; c.environment = 'production'; const r = Q.clockIn('layla', '1111'); c.environment = keep; return r.ok === false && r.error === 'demo_pin_disabled' && Q.state.shifts.length === 0; });
  test('the site is in pre-opening mode until the owner switches it to open', () => ['preopening', 'open'].includes(window.QAMAR_CONFIG.phase));
  test('analytics is off until explicitly configured', () => window.QAMAR_CONFIG.analytics && window.QAMAR_CONFIG.analytics.enabled === false);

  // ---- Bilinguisme ----
  test('every service has an English and Arabic look, name and description', () => D.services.every(s => ['look', 'name', 'desc'].every(k => s[k] && s[k].en && s[k].ar)));
  test('every add-on, perfume and package is bilingual', () => [...D.addons, ...D.perfumes].every(a => a.name.en && a.name.ar) && D.packages.every(p => p.name.en && p.name.ar && p.note.en && p.note.ar));

  Q.reset();
};
