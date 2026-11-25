// QAMAR : tests du connecteur assets/store-supabase.js (mode 'supabase') contre la vraie base locale (PGlite, migrations 001 -> 009).
// Un faux client Supabase traduit rpc() / from().select() en SQL exécuté sous le bon rôle (anon ou compte connecté) ;
// le « temps réel » est simulé : après chaque écriture, chaque page abonnée reçoit un événement queue_public.
// Ce qui n'est PAS couvert ici : le vrai serveur Supabase (PostgREST, Realtime, Auth), le réseau, le CDN de supabase-js.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { setup, actor, findPglite } from './harness.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const src = f => readFileSync(ROOT + f, 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));

export async function runStoreTests(log = console.log) {
  if (!findPglite()) { log('  - store-supabase tests skipped: PGlite not found'); return { pass: 0, fail: 0, skipped: true }; }
  let pass = 0, fail = 0;
  const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : ' ' + extra)); };
  const db = await setup();
  const as = actor(db);
  let queueRun = Promise.resolve();
  const serial = fn => { const p = queueRun.then(fn); queueRun = p.catch(() => {}); return p; };   // PGlite : une requête à la fois (le rôle est un réglage de session)

  const U = { M: '00000000-0000-0000-0000-0000000000b1', S1: '00000000-0000-0000-0000-0000000000b2', T: '00000000-0000-0000-0000-0000000000b3' };
  for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, k.toLowerCase() + '@x.test']);
  await db.exec(`insert into staff (id, display_name, role, email) values ('${U.M}', 'Mona', 'manager', 'm@x.test'), ('${U.S1}', 'Layla', 'stylist', 's1@x.test'), ('${U.T}', 'Tablet', 'station', 't@x.test');`);
  await as(U.M, `select admin_set_pin('${U.S1}', '4826')`);

  const pages = [];
  const broadcast = () => pages.forEach(p => p.handlers.forEach(h => { try { h({ new: { ticket_ref: null } }); } catch (e) { if (process.env.DEBUG) console.log('BCAST', e.message); } }));
  const JSONB = new Set(['p_party']);
  function fakeClient(page) {
    const who = () => page.user || 'anon';
    const run = (sql, params) => serial(() => as(who(), sql, params));
    const query = (table) => {
      const st = { table, filters: [], order: null };
      const q = {
        select() { return q; }, order(c, o) { st.order = [c, o && o.ascending !== false]; return q; }, eq(c, v) { st.filters.push([c, v]); return q; },
        then(res, rej) {
          const where = st.filters.map((f, i) => `${f[0]} = $${i + 1}`).join(' and ');
          const sql = `select * from ${st.table}${where ? ' where ' + where : ''}${st.order ? ` order by ${st.order[0]} ${st.order[1] ? 'asc' : 'desc'}` : ''}`;
          return run(sql, st.filters.map(f => f[1])).then(r => ({ data: JSON.parse(JSON.stringify(r.rows)), error: null }), e => ({ data: null, error: { message: e.message } })).then(res, rej);
        }
      };
      return q;
    };
    return {
      rpc: async (fn, args = {}) => {
        const keys = Object.keys(args);
        const call = `${fn}(${keys.map((k, i) => `${k} => $${i + 1}${JSONB.has(k) ? '::jsonb' : ''}`).join(', ')})`;
        const vals = keys.map(k => (JSONB.has(k) && args[k] != null ? JSON.stringify(args[k]) : args[k]));
        try {
          const r = fn === 'join_queue' ? await run(`select * from ${call}`, vals) : await run(`select ${call} as r`, vals);
          if (!['my_ticket_live', 'q_board', 'cash_day_totals'].includes(fn)) broadcast();   // lectures : pas d'événement temps réel
          return { data: JSON.parse(JSON.stringify(fn === 'join_queue' ? r.rows : r.rows[0].r)), error: null };
        } catch (e) { return { data: null, error: { message: e.message } }; }
      },
      from: query,
      auth: {
        getSession: async () => ({ data: { session: page.user ? { user: { id: page.user } } : null } }),
        signInWithPassword: async () => ({ error: null }), signOut: async () => { page.user = null; }
      },
      channel: () => { const c = { on: (_, __, h) => { page.handlers.push(h); return c; }, subscribe: () => c }; return c; }
    };
  }
  function openPage({ staff = false, user = null, search = '', storage = new Map() } = {}) {
    const page = { user, handlers: [], toasts: [] };
    const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, appendChild() {}, remove() {}, querySelector: () => el(), querySelectorAll: () => [] });
    const ctx = {
      console: { log() {}, warn: (...a) => process.env.DEBUG && console.warn(...a), error: console.error }, setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {}, URLSearchParams, Date, JSON, Math, Promise,
      localStorage: { getItem: k => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)), removeItem: k => storage.delete(k) },
      location: { search, pathname: '/queue.html', href: 'https://qamarlounge.com/queue.html' + search, reload() {} },
      navigator: {}, addEventListener() {}, requestAnimationFrame() {},
      document: { documentElement: { dataset: {}, hasAttribute: a => a === 'data-staff' && staff }, addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
        createElement: () => el(), body: { appendChild() {} }, head: { appendChild() {} }, hidden: false }
    };
    ctx.window = ctx;
    vm.createContext(ctx);
    for (const f of ['assets/config.js', 'assets/data.js']) vm.runInContext(src(f), ctx, { filename: f });
    vm.runInContext("window.QAMAR_CONFIG.backend = 'supabase';", ctx);
    ctx.supabase = { createClient: () => fakeClient(page) };
    for (const f of ['assets/store.js', 'assets/store-supabase.js']) vm.runInContext(src(f), ctx, { filename: f });
    ctx.Q.toast = m => page.toasts.push(m);
    page.Q = ctx.Q; page.storage = storage; page.ctx = ctx;
    pages.push(page);
    return page;
  }
  const settle = async () => { for (let i = 0; i < 4; i++) { await wait(150); await queueRun; } };

  log('Supabase store (connector against PGlite)');
  const station = openPage({ staff: true, user: U.T });
  const client = openPage();
  await settle();
  ok('connector switches Q to supabase mode (no demo data, no demo banner)', client.Q.mode === 'supabase' && !client.Q.isDemo && client.Q.state.tickets.length === 0 && !client.Q.configError);
  ok('station board loads: stylists with a PIN listed', station.Q.state.remote.ready && station.Q.state.stylists.map(s => s.name).join() === 'Layla');
  let renders = 0; client.Q.on(() => renders++);
  ok('Q.on fires once the server state is loaded', renders === 1);

  const tk = await client.Q.joinQueue({ name: 'Aisha Rahman', phone: '+971501112233', serviceId: 'express', pref: 'any' });
  await settle();
  ok('client joins: real ticket id, access token kept on the device only', tk && /^[0-9a-f-]{36}$/.test(tk.id) && client.storage.get('qamar:myTicketKey') && tk.status === 'waiting');
  const mine = client.Q.ticket(tk.id);
  ok('client sees her ticket (position 1), phone masked', mine && client.Q.position(tk.id) === 1 && mine.phone === '+...2233' && mine.name === 'Aisha Rahman');
  ok('ticket link carries id + token', client.Q.ticketLink(mine) === tk.id + '.' + client.storage.get('qamar:myTicketKey'));
  const op = openPage(); const other = await op.Q.joinQueue({ name: 'Fatima Noor', phone: '+971502223344', serviceId: 'glow', pref: 'any' });
  await settle();
  ok('client mirror holds 2 tickets, only her own has a name', client.Q.state.tickets.length === 2 && client.Q.state.tickets.filter(t => t.name).length === 1 && !JSON.stringify(client.Q.state).includes('Fatima'));
  ok('no stylist on shift yet: wait unknown, place kept', client.Q.ticketEta(tk.id) && client.Q.ticketEta(tk.id).minutes == null);
  ok('station sees both names and phones', station.Q.state.tickets.length === 2 && station.Q.state.tickets.some(t => t.phone === '+971502223344'));

  const bad = await station.Q.clockIn(U.S1, '1111');
  ok('wrong PIN refused', bad.ok === false && bad.error === 'pin');
  const good = await station.Q.clockIn(U.S1, '4826');
  await settle();
  ok('right PIN: session stored, Layla on shift', good.ok && station.Q.hasStationSession(U.S1) && !!station.Q.openShift(U.S1));
  ok('client ETA now computed from the anonymous queue (first in line: now)', client.Q.ticketEta(tk.id).minutes === 0 && !!client.Q.openShift(U.S1));
  const called = await station.Q.call(U.S1);
  await settle();
  ok('Layla calls the next client: Aisha', called && called.name === 'Aisha Rahman');
  ok('client page updates live: called, seat, stylist', client.Q.ticket(tk.id).status === 'called' && client.Q.ticket(tk.id).assignedTo === U.S1);
  await station.Q.renotify(tk.id); await settle();
  ok('notify again: pings reach the client', client.Q.ticket(tk.id).pings === 1);
  await station.Q.start(tk.id); await station.Q.addAddon(tk.id, 'matcha-latte'); await station.Q.setHijab(tk.id, true); await settle();
  ok('start + matcha + hijab', station.Q.ticket(tk.id).status === 'in_service' && station.Q.ticket(tk.id).addons.length === 1 && station.Q.ticket(tk.id).hijab === true);
  await station.Q.toCheckout(tk.id); await settle();
  const pr = station.Q.pricing(station.Q.ticket(tk.id));
  ok('checkout: amount from the server, same on the client page', pr.total > 0 && client.Q.pricing(client.Q.ticket(tk.id)).total === pr.total);
  ok('client cannot pay online (no provider): refused politely', (await client.Q.pay(tk.id, { method: 'card' })) === null && client.toasts.length > 0);
  const pay = await station.Q.pay(tk.id, { method: 'card', tip: 20 });
  await settle();
  ok('station records the card payment (terminal) with the tip', pay && Number(pay.tip) === 20 && client.Q.ticket(tk.id).status === 'paid');
  // Reprise du ticket sur un autre appareil : lien ?t=<id>.<jeton>, stockage vide
  const link = '?t=' + client.Q.ticketLink(client.Q.ticket(tk.id));
  const phone2 = openPage({ search: link });
  await settle();
  ok('ticket link reopens the ticket on another device (empty storage)', phone2.Q.ticket(tk.id) && phone2.Q.ticket(tk.id).status === 'paid');
  const forged = openPage({ search: '?t=' + tk.id + '.' + '11111111-1111-4111-8111-111111111111' });
  await settle();
  ok('a link with a wrong token shows nothing', !forged.Q.ticket(tk.id));
  await phone2.Q.rate(tk.id, 5, 'Perfect'); await settle();
  ok('client rates from the other device: done, review saved', (await as('su', `select count(*)::int n from reviews`)).rows[0].n === 1 && station.Q.ticket(tk.id).status === 'done');
  ok('station stats count the visit and the tip', station.Q.stylistStats(U.S1).served === 1 && station.Q.stylistStats(U.S1).tips === 20);
  await station.Q.cancel(other.id); await settle();
  ok('station account (no manager session) cannot remove a client', station.Q.ticket(other.id).status === 'waiting' && station.toasts.length > 0);
  const admin = openPage({ staff: true, user: U.M });
  await settle();
  await admin.Q.cancel(other.id); await settle();
  ok('manager removes the client from the queue', admin.Q.ticket(other.id).status === 'cancelled' && admin.Q.stats().cancelled === 1 && admin.Q.stats().revenue === pr.total);
  ok('demo-only settings are not applied in live mode', (admin.Q.seedDemo(), admin.Q.state.tickets.length === 2));
  await station.Q.clockOut(U.S1); await settle();
  ok('clock out ends the station session', !station.Q.hasStationSession(U.S1) && !station.Q.openShift(U.S1));
  const noLogin = openPage({ staff: true });
  await settle();
  ok('staff page without a session asks for sign-in and loads no tickets', noLogin.Q.state.remote.needLogin === true && noLogin.Q.state.tickets.length === 0);

  await db.close();
  return { pass, fail, skipped: false };
}

if (process.argv[1] && process.argv[1].endsWith('store-supabase.test.mjs')) {
  const r = await runStoreTests();
  console.log(`\n${r.pass} passed · ${r.fail} failed`);
  process.exit(r.fail ? 1 : 0);
}
