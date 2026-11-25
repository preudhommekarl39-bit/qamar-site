// QAMAR : tests SQL de la file réelle (migration 009) sur PGlite : vraies migrations 001 -> 009, vraie RLS, vraies fonctions.
//   node tests/sql/live-queue.test.mjs          (aussi lancé par scripts/run-tests.mjs)
import { setup, actor, findPglite } from './harness.mjs';

export async function runSqlTests(log = console.log) {
  if (!findPglite()) { log('  - SQL tests skipped: PGlite not found (set PGLITE_DIR to a node_modules folder with @electric-sql/pglite)'); return { pass: 0, fail: 0, skipped: true }; }
  let pass = 0, fail = 0;
  const db = await setup({ rerun: ['009_live_queue.sql'] });   // 009 appliquée deux fois : rejouable
  const as = actor(db);
  const ok = (name, cond, extra = '') => { cond ? pass++ : fail++; log((cond ? '  ✓ ' : '  ✗ ') + name + (cond ? '' : ' ' + extra)); };
  const expectOk = async (name, who, sql, check) => {
    try { const r = await as(who, sql); const c = check ? check(r.rows) : true; ok(name, c === true, JSON.stringify(r.rows).slice(0, 300)); return r.rows; }
    catch (e) { ok(name, false, 'error: ' + e.message); return null; }
  };
  const expectErr = async (name, who, sql, re) => {
    try { const r = await as(who, sql); ok(name, false, 'no error: ' + JSON.stringify(r.rows).slice(0, 200)); }
    catch (e) { ok(name, !re || re.test(e.message), '-> ' + e.message); }
  };
  const one = async (who, sql) => (await as(who, sql)).rows[0];

  const U = { O: '00000000-0000-0000-0000-0000000000a1', M: '00000000-0000-0000-0000-0000000000a2', S1: '00000000-0000-0000-0000-0000000000a3', S2: '00000000-0000-0000-0000-0000000000a4', T: '00000000-0000-0000-0000-0000000000a5', X: '00000000-0000-0000-0000-0000000000a6' };
  for (const [k, id] of Object.entries(U)) await db.query('insert into auth.users (id, email) values ($1, $2)', [id, k.toLowerCase() + '@x.test']);
  await db.exec(`insert into staff (id, display_name, role, email) values ('${U.O}', 'Karl', 'owner', 'o@x.test'), ('${U.M}', 'Mona', 'manager', 'm@x.test'),
    ('${U.S1}', 'Layla', 'stylist', 's1@x.test'), ('${U.S2}', 'Noor', 'stylist', 's2@x.test');`);
  // README : compte « poste » de la tablette, requête séparée après la 009
  await db.exec(`insert into staff (id, display_name, role, email) values ('${U.T}', 'Tablet', 'station', 't@x.test');`);

  log('SQL: migrations');
  ok('001 -> 009 apply on an empty database, 009 re-runs without error', true);
  await expectOk('realtime publishes only the anonymous mirrors (tickets and shifts removed)', 'su', `select tablename from pg_publication_tables where pubname = 'supabase_realtime' order by 1`,
    r => JSON.stringify(r.map(x => x.tablename)) === JSON.stringify(['queue_public', 'salon_status', 'staff_public']));
  await expectOk('queue_public columns: no name, phone, token or ticket id', 'su', `select column_name from information_schema.columns where table_name = 'queue_public'`,
    r => r.length > 5 && !r.some(c => /name|phone|token|^id$|email|promo|comment/.test(c.column_name)));
  await expectOk('staff_public columns: no e-mail, role or PIN', 'su', `select column_name from information_schema.columns where table_name = 'staff_public'`, r => !r.some(c => /email|role|pin/.test(c.column_name)));

  log('SQL: PINs and station sessions');
  await expectErr('stylist cannot set a PIN', U.S1, `select admin_set_pin('${U.S1}', '4826')`, /forbidden/);
  await expectErr('anon cannot set a PIN', 'anon', `select admin_set_pin('${U.S1}', '4826')`, /permission denied/);
  await expectErr('weak PIN 1111 refused', U.M, `select admin_set_pin('${U.S1}', '1111')`, /weak_pin/);
  await expectErr('weak PIN 1234 refused', U.M, `select admin_set_pin('${U.S1}', '1234')`, /weak_pin/);
  await expectErr('PIN must be 4 digits', U.M, `select admin_set_pin('${U.S1}', '12a4')`, /invalid_pin/);
  await expectErr('no PIN for the station account', U.M, `select admin_set_pin('${U.T}', '4826')`, /not_found/);
  await expectOk('manager sets PINs (bcrypt)', U.M, `select admin_set_pin('${U.S1}', '4826') a, admin_set_pin('${U.S2}', '7391') b`, r => r[0].a === 'ok' && r[0].b === 'ok');
  await expectOk('PIN stored as bcrypt hash, never in clear', 'su', `select pin_hash from staff_pins`, r => r.length === 2 && r.every(x => /^\$2a\$08\$/.test(x.pin_hash) && !x.pin_hash.includes('4826')));
  await expectOk('PIN change is in the activity log without the PIN', 'su', `select details from audit_logs where action = 'set_pin:staff'`, r => r.length === 2 && !JSON.stringify(r).match(/4826|7391|\$2a/));
  for (const w of [U.M, U.S1, U.T, 'anon']) await expectErr(`${w === 'anon' ? 'anon' : 'staff'} cannot read staff_pins`, w, `select * from staff_pins`, /permission denied/);
  await expectErr('station sessions are unreadable', U.T, `select * from station_sessions`, /permission denied/);
  await expectOk('stylists with a PIN appear in staff_public (not the owner, manager or station)', 'anon', `select display_name from staff_public order by 1`, r => JSON.stringify(r.map(x => x.display_name)) === '["Layla","Noor"]');
  await expectErr('anon cannot unlock a station', 'anon', `select station_unlock('${U.S1}', '4826', 1::smallint)`, /permission denied|forbidden/);
  await expectOk('wrong PIN: refused without error (attempt counted)', U.T, `select station_unlock('${U.S1}', '0000', 1::smallint) r`, r => r[0].r.ok === false && r[0].r.error === 'pin');
  await expectOk('failed attempt is stored (not rolled back)', 'su', `select count(*)::int n from station_pin_attempts where not ok`, r => r[0].n === 1);
  const unl = await expectOk('right PIN: unlocks, clocks in at seat 1, returns a session', U.T, `select station_unlock('${U.S1}', '4826', 1::smallint) r`, r => r[0].r.ok === true && /^[0-9a-f-]{36}$/.test(r[0].r.session) && r[0].r.seat === 1);
  const S1 = unl && unl[0].r.session;
  await expectOk('session token stored as sha256 only', 'su', `select token_hash from station_sessions`, r => r.length === 1 && r[0].token_hash.length === 64 && r[0].token_hash !== S1);
  await expectOk('Layla is on shift in staff_public (seat 1)', 'anon', `select on_shift, seat from staff_public where display_name = 'Layla'`, r => r[0].on_shift === true && r[0].seat === 1);
  // force brute : 5 échecs pour Noor -> bloquée, même avec le bon PIN
  for (let i = 0; i < 5; i++) await as(U.T, `select station_unlock('${U.S2}', '${String(1000 + i)}', 2::smallint)`);
  await expectOk('5 wrong PINs: account locked, even the right PIN is refused', U.T, `select station_unlock('${U.S2}', '7391', 2::smallint) r`, r => r[0].r.ok === false && r[0].r.error === 'locked');
  await db.exec(`update station_pin_attempts set at = at - interval '6 minutes' where staff_id = '${U.S2}'`);
  // tablette : 20 échecs en 15 min, toutes coiffeuses confondues -> tablette bloquée
  await db.exec(`insert into station_pin_attempts (staff_id, station_uid, ok, at) select '${U.X}', '${U.T}', false, now() from generate_series(1, 20)`);
  await expectOk('20 wrong PINs on one tablet in 15 min: tablet locked', U.T, `select station_unlock('${U.S2}', '7391', 2::smallint) r`, r => r[0].r.error === 'locked');
  await db.exec(`delete from station_pin_attempts where staff_id = '${U.X}'`);
  const unl2 = await expectOk('after the lock time, the right PIN works again', U.T, `select station_unlock('${U.S2}', '7391', 2::smallint) r`, r => r[0].r.ok === true);
  const S2 = unl2 && unl2[0].r.session;
  await expectErr('a session only works from the station account that opened it', U.M, `select q_board('${S1}')`, /session_expired/);
  await expectErr('a made-up session is refused', U.T, `select q_call(null, gen_random_uuid())`, /session_expired/);
  await expectErr('the station account cannot act without a stylist session', U.T, `select q_call(null, null)`, /forbidden/);
  await expectErr('a stylist account cannot try PINs from her phone (station account only)', U.S1, `select station_unlock('${U.S2}', '7391', 2::smallint)`, /forbidden/);
  await expectOk('pgcrypto is used from the "extensions" schema, as on Supabase', 'su', `select n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname = 'pgcrypto'`, r => r[0].nspname === 'extensions');
  await expectErr('legacy call_next is no longer callable', U.S1, `select call_next(null)`, /permission denied/);
  await expectErr('legacy advance_ticket is no longer callable', U.M, `select advance_ticket(gen_random_uuid(), 'start')`, /permission denied/);

  log('SQL: client tickets');
  const j = await expectOk('anon joins the queue (ticket id + access token)', 'anon', `select * from join_queue('Aisha Rahman', '+971501112233', 'express', false, null)`, r => !!r[0].ticket_id && !!r[0].access_token && r[0].num === 1);
  const A = j && j[0];
  const j2 = await expectOk('second client asks for Noor', 'anon', `select * from join_queue('Fatima', '+971502223344', 'glow', false, '${U.S2}')`, r => r[0].num === 2);
  const B = j2 && j2[0];
  await expectOk('unknown preferred stylist becomes "first available"', 'anon', `select * from join_queue('Hessa', '+971503334455', 'sleek', false, '${U.M}')`, r => r[0].num === 3);
  await expectOk('pref of the manager (not on the floor) was reset', 'su', `select pref_staff from tickets where num = 3`, r => r[0].pref_staff === null);
  await expectErr('anon cannot list tickets', 'anon', `select * from tickets`, /permission denied/);
  await expectErr('anon cannot read the 001 public_queue view (first names)', 'anon', `select * from public_queue`, /permission denied/);
  for (const t of ['payments', 'reviews', 'shifts', 'ticket_addons', 'ticket_events']) await expectErr(`anon cannot read ${t}`, 'anon', `select * from ${t}`, /permission denied/);
  await expectOk('anon reads the anonymous queue mirror: 3 rows, no personal data', 'anon', `select * from queue_public`, r => r.length === 3 && !JSON.stringify(r).match(/Aisha|Fatima|Hessa|\+9715|access/));
  await expectOk('anon reads the queue counts', 'anon', `select * from public_queue_status`, r => r[0].waiting_tickets === 3 && r[0].waiting_people === 3 && r[0].stylists_on_shift === 2 && r[0].chairs_free === 2 && r[0].rough_wait_minutes === 70);
  await expectOk('anon reads the launch offer counter', 'anon', `select id, used from public_offer where id = 'launch-first'`, r => r.length === 1);
  const mine = await expectOk('my_ticket_live with the right token: own ticket, phone masked', 'anon', `select my_ticket_live('${A.ticket_id}', '${A.access_token}') t`, r => r[0].t.name === 'Aisha Rahman' && r[0].t.phone === '+...2233' && r[0].t.amount.total > 0 && !('access_token' in r[0].t));
  await expectOk('my_ticket_live with another ticket\'s token: nothing', 'anon', `select my_ticket_live('${A.ticket_id}', '${B.access_token}') t`, r => r[0].t === null);
  await expectOk('my_ticket_live with a random token: nothing', 'anon', `select my_ticket_live('${A.ticket_id}', gen_random_uuid()) t`, r => r[0].t === null);
  await expectOk('the mirror row of my ticket is found by public_ref', 'anon', `select count(*)::int n from queue_public where ticket_ref = '${mine && mine[0].t.public_ref}'`, r => r[0].n === 1);
  await expectOk('client adds a matcha with her token', 'anon', `select my_add_addon('${A.ticket_id}', '${A.access_token}', 'matcha-latte') t`, r => r[0].t.addons.length === 1);
  await expectErr('client cannot add an extra (not a drink)', 'anon', `select my_add_addon('${A.ticket_id}', '${A.access_token}', 'shower')`, /addon_unavailable/);
  await expectErr('client cannot add to someone else\'s ticket', 'anon', `select my_add_addon('${A.ticket_id}', '${B.access_token}', 'matcha-latte')`, /forbidden/);
  await expectOk('client chooses her hair perfume', 'anon', `select my_set_perfume('${A.ticket_id}', '${A.access_token}', 'oud')`);
  await expectErr('client cannot rate before paying', 'anon', `select my_rate('${A.ticket_id}', '${A.access_token}', 5::smallint, 'x')`, /forbidden/);

  log('SQL: stylist and manager actions');
  const c1 = await expectOk('Layla (session) calls the next client: Aisha (first in line, any stylist)', U.T, `select q_call(null, '${S1}') t`, r => r[0].t.name === 'Aisha Rahman' && r[0].t.seat === 1);
  await expectErr('Layla cannot call a second client while busy', U.T, `select q_call(null, '${S1}')`, /busy/);
  await expectOk('Noor calls: gets Fatima (who asked for her)', U.T, `select q_call(null, '${S2}') t`, r => r[0].t.name === 'Fatima');
  await expectOk('client sees "called" and her seat through her token', 'anon', `select my_ticket_live('${A.ticket_id}', '${A.access_token}') t`, r => r[0].t.status === 'called' && r[0].t.seat === 1 && r[0].t.staff_name === 'Layla');
  await expectOk('mirror shows the call without personal data', 'anon', `select status, seat from queue_public where num = 1`, r => r[0].status === 'called' && r[0].seat === 1);
  await expectErr('Noor cannot start Layla\'s client', U.T, `select q_advance('${A.ticket_id}', 'start', '${S2}')`, /forbidden/);
  await expectErr('stylist cannot remove a client from the queue (manager action)', U.T, `select q_advance((select id from tickets where num = 3), 'remove', '${S1}')`, /forbidden/);
  await expectErr('stylist own account cannot remove either', U.S1, `select q_advance((select id from tickets where num = 3), 'remove', null)`, /forbidden/);
  await expectOk('Layla notifies again (pings + 1)', U.T, `select q_advance('${A.ticket_id}', 'renotify', '${S1}') t`, r => r[0].t.pings === 1);
  await expectOk('Layla starts the service', U.T, `select q_advance('${A.ticket_id}', 'start', '${S1}') t`, r => r[0].t.status === 'in_service');
  await expectOk('Layla adds an iced matcha', U.T, `select q_add_addon('${A.ticket_id}', 'matcha-iced', '${S1}')`);
  await expectOk('Layla removes it again', U.T, `select q_remove_addon('${A.ticket_id}', 'matcha-iced', '${S1}')`);
  await expectOk('Layla sets hijab + perfume', U.T, `select q_set_details('${A.ticket_id}', 'rose', true, '${S1}')`);
  await expectErr('Layla cannot clock out with a client in the chair', U.T, `select q_clock_out('${S1}')`, /client_in_progress/);
  await expectOk('Layla finishes: checkout', U.T, `select q_advance('${A.ticket_id}', 'finish', '${S1}') t`, r => r[0].t.status === 'checkout');
  const due = await one('su', `select (ticket_amount('${A.ticket_id}')).total`);
  await expectOk('card on the salon terminal, tip capped at the bill', U.T, `select q_record_payment('${A.ticket_id}', 'card', 99999, '${S1}') p`, r => Number(r[0].p.total) === Number(due.total) && Number(r[0].p.tip) === Math.min(500, Number(due.total)));
  await expectErr('a ticket cannot be paid twice', U.T, `select q_record_payment('${A.ticket_id}', 'cash', 0, '${S1}')`, /forbidden/);
  await expectOk('client rates 5 stars with her token, ticket done', 'anon', `select my_rate('${A.ticket_id}', '${A.access_token}', 5::smallint, 'Lovely <b>')`);
  await expectOk('review stored, tags stripped, ticket done and gone from the mirror', 'su', `select r.comment, t.status, (select count(*)::int from queue_public q where q.ticket_ref = t.public_ref) m from reviews r join tickets t on t.id = r.ticket_id`, r => r[0].comment === 'Lovely b' && r[0].status === 'done' && r[0].m === 0);
  await expectOk('board for Layla\'s session: all of today, amounts only for her tickets', U.T, `select q_board('${S1}') b`, r => { const b = r[0].b; const f = b.tickets.find(t => t.name === 'Fatima'), a = b.tickets.find(t => t.name === 'Aisha Rahman'); return b.tickets.length === 3 && !b.manager && !('amount' in f) && !!a.amount && !!a.payment.total; });
  await expectOk('board for the manager: amounts for every ticket, all shifts', U.M, `select q_board(null) b`, r => r[0].b.manager === true && r[0].b.tickets.every(t => 'amount' in t) && r[0].b.shifts.length === 2);
  await expectErr('anon cannot read the board', 'anon', `select q_board(null)`, /permission denied/);
  await expectOk('manager removes Hessa from the queue', U.M, `select q_advance((select id from tickets where num = 3), 'remove', null) t`, r => r[0].t.status === 'cancelled');
  await expectOk('Noor: no-show for Fatima', U.T, `select q_advance('${B.ticket_id}', 'noshow', '${S2}') t`, r => r[0].t.status === 'noshow');
  await expectOk('Layla clocks out: shift closed, session ended, off shift in staff_public', U.T, `select q_clock_out('${S1}')`);
  await expectOk('staff_public shows Layla off shift', 'anon', `select on_shift from staff_public where display_name = 'Layla'`, r => r[0].on_shift === false);
  await expectErr('Layla\'s session no longer works after clock-out', U.T, `select q_board('${S1}')`, /session_expired/);
  await expectOk('audit: clock in/out and the card payment are logged', 'su', `select array_agg(distinct action) a from audit_logs where action in ('clock_in', 'clock_out', 'payment:card')`, r => r[0].a.length === 3);

  log('SQL: rate limits on joining');
  await db.exec(`insert into tickets (num, client_name, client_phone, service_id, created_at) select 100 + g, 'Bulk', '+97155' || lpad(g::text, 7, '0'), 'express', now() - interval '10 minutes' from generate_series(1, 60) g`);
  await expectErr('queue full at 60 waiting tickets', 'anon', `select * from join_queue('Late', '+971509998877', 'express', false, null)`, /queue_full/);
  await db.exec(`update tickets set status = 'cancelled' where client_name = 'Bulk'; update tickets set created_at = now() where client_name = 'Bulk' and num < 121;`);
  await expectErr('20 joins in 2 minutes: try later', 'anon', `select * from join_queue('Late', '+971509998877', 'express', false, null)`, /try_later/);

  log('SQL: cash closing and schedule');
  await expectOk('manager reads the day totals by method', U.M, `select cash_day_totals(dubai_today()) t`, r => r[0].t.card && r[0].t.card.count === 1);
  await expectErr('stylist cannot read the day totals', U.S1, `select cash_day_totals(dubai_today())`, /forbidden/);
  await expectOk('manager closes the cash (expected totals frozen)', U.M, `select (admin_close_cash(dubai_today(), 0, ${Number(due.total) + Math.min(500, Number(due.total))}, 0, 'ok')).expected e`, r => r[0].e.card.count === 1);
  await expectOk('closing again updates the same day (one row)', U.M, `select (admin_close_cash(dubai_today(), 10, 0, 0, null)).cash_aed c`, r => Number(r[0].c) === 10);
  await expectOk('cash closing audited', 'su', `select count(*)::int n from audit_logs where action like '%:cash_closings'`, r => r[0].n === 2);
  await expectErr('stylist cannot close the cash', U.S1, `select admin_close_cash(dubai_today(), 1, 1, 1, null)`, /forbidden/);
  await expectOk('stylist cannot read cash closings (0 rows)', U.S1, `select * from cash_closings`, r => r.length === 0);
  await expectOk('manager plans a shift', U.M, `insert into staff_schedule (staff_id, day, start_time, end_time) values ('${U.S1}', dubai_today() + 1, '10:00', '18:00') returning id`, r => r.length === 1);
  await expectOk('stylist sees the schedule', U.S1, `select count(*)::int n from staff_schedule`, r => r[0].n === 1);
  await expectErr('stylist cannot change the schedule', U.S1, `insert into staff_schedule (staff_id, day, start_time, end_time) values ('${U.S1}', dubai_today() + 2, '10:00', '18:00')`, /row-level security/);
  await expectErr('end before start refused', U.M, `insert into staff_schedule (staff_id, day, start_time, end_time) values ('${U.S1}', dubai_today() + 3, '18:00', '10:00')`, /staff_schedule_times/);
  await expectErr('anon cannot read the schedule', 'anon', `select * from staff_schedule`, /permission denied/);
  await expectOk('a ticket left waiting yesterday', 'su', `update tickets set day = day - 1 where client_name = 'Bulk' and num = 160 returning id`, r => r.length === 1);
  await db.exec(`update tickets set status = 'waiting' where client_name = 'Bulk' and num = 160`);
  await expectOk('a ticket left from yesterday is never called', U.T, `select q_call(null, '${S2}') t`, r => r[0].t === null);
  await expectErr('a stylist cannot run q_close_stale', U.S1, `select q_close_stale()`, /forbidden/);
  await expectOk('q_close_stale cancels it', U.M, `select q_close_stale() n`, r => r[0].n === 1);

  await db.close();
  return { pass, fail, skipped: false };
}

if (process.argv[1] && process.argv[1].endsWith('live-queue.test.mjs')) {
  const r = await runSqlTests();
  console.log(`\n${r.pass} passed · ${r.fail} failed${r.skipped ? ' (skipped)' : ''}`);
  process.exit(r.fail ? 1 : 0);
}
