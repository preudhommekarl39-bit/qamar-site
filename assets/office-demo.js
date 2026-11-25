/* QAMAR : démo locale du back-office (office.html#local-demo, #local-demo-manager, #local-demo-stylist).
   Données FACTICES en mémoire, rien n'est envoyé ni enregistré. Chargé par office.html uniquement sur localhost ;
   ce fichier refuse lui-même de s'activer ailleurs (jamais de démo sur le site en ligne). Sert aux captures d'écran. */
(function () {
  'use strict';
  if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return;
  const iso = (daysAgo, h = 10) => new Date(Date.now() - daysAgo * 864e5 + h * 36e5 - new Date().getHours() * 36e5).toISOString();
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  const clone = o => JSON.parse(JSON.stringify(o));

  function create(role, D) {
    const ids = { owner: 'u-owner', manager: 'u-manager', stylist: 'u-stylist' };
    const db = {
      staff: [
        { id: 'u-owner', display_name: 'Karl', role: 'owner', email: 'owner@example.com', instagram: null, specialty_en: null, specialty_ar: null, active: true, created_at: iso(30) },
        { id: 'u-manager', display_name: 'Hana', role: 'manager', email: 'manager@example.com', instagram: null, specialty_en: 'Front desk', specialty_ar: 'الاستقبال', active: true, created_at: iso(12) },
        { id: 'u-stylist', display_name: 'Layla', role: 'stylist', email: 'stylist@example.com', instagram: 'qamar.layla', specialty_en: 'Hollywood curls', specialty_ar: 'كيرلي هوليوود', active: true, created_at: iso(10) },
        { id: 'u-4', display_name: 'Noor', role: 'stylist', email: 'noor@example.com', instagram: 'qamar.noor', specialty_en: 'Sleek and glass hair', specialty_ar: 'الشعر الناعم واللامع', active: true, created_at: iso(9) },
        { id: 'u-5', display_name: 'Sara', role: 'stylist', email: 'sara@example.com', instagram: null, specialty_en: 'Cuts and colour', specialty_ar: 'القص والصبغة', active: false, created_at: iso(8) }
      ],
      services: D.services.map((s, i) => ({ id: s.id, look_en: s.look.en, look_ar: s.look.ar, name_en: s.name.en, name_ar: s.name.ar, duration_min: s.duration, price_aed: s.price, from_hour: s.fromHour ?? null, free_matcha: !!s.freeMatcha, active: true, sort_order: (i + 1) * 10, updated_at: iso(3) })),
      addons: D.extras.filter(x => x.id !== 'long').map((x, i) => ({ id: x.id, name_en: x.name.en, name_ar: x.name.ar, kind: 'extra', price_aed: x.price, active: true, sort_order: (i + 1) * 10, updated_at: iso(3) }))
        .concat([{ id: 'ritual', name_en: D.ritual.name.en, name_ar: D.ritual.name.ar, kind: 'ritual', price_aed: D.ritual.price, active: true, sort_order: 90, updated_at: iso(3) }])
        .concat(D.addons.map((a, i) => ({ id: a.id, name_en: a.name.en, name_ar: a.name.ar, kind: 'matcha', price_aed: a.price, active: true, sort_order: 100 + i, updated_at: iso(3) }))),
      promo_codes: [
        { code: 'GLOW10', pct: 10, label_en: 'Glow code', label_ar: 'كود جلو', valid_until: day(120), min_people: 1, enabled: true, created_at: iso(2) },
        { code: 'BRIDE15', pct: 15, label_en: 'Bridal party', label_ar: 'حفلة العروس', valid_until: null, min_people: 4, enabled: false, created_at: iso(5) }
      ],
      event_requests: [
        { id: 'e1', created_at: iso(0, 9), updated_at: iso(0, 9), event_type: 'wedding', event_date: day(41), guests: 6, name: 'Example bride (demo)', phone: '+971500000001', email: null, note: 'Hair for the bride and 5 guests, start 6 PM.', lang: 'en', source: 'whatsapp', status: 'new', staff_notes: null, handled_by: null },
        { id: 'e2', created_at: iso(1, 15), updated_at: iso(1, 15), event_type: 'birthday', event_date: day(18), guests: 8, name: 'Demo client', phone: null, email: 'client@example.com', note: 'Sweet 16, sleek ponytails for everyone.', lang: 'en', source: 'instagram', status: 'contacted', staff_notes: 'Sent the group menu. Waiting for the final number of guests.', handled_by: 'u-manager' },
        { id: 'e3', created_at: iso(4, 11), updated_at: iso(2, 11), event_type: 'henna', event_date: day(25), guests: 12, name: 'عميلة تجريبية', phone: '+971500000003', email: null, note: null, lang: 'ar', source: 'phone', status: 'confirmed', staff_notes: 'Lounge booked after 10 PM.', handled_by: 'u-owner' },
        { id: 'e4', created_at: iso(6, 12), updated_at: iso(5, 12), event_type: 'shoot', event_date: day(9), guests: 2, name: 'Demo studio', phone: null, email: 'studio@example.com', note: 'Two models, morning.', lang: 'en', source: 'website', status: 'declined', staff_notes: 'Date before opening.', handled_by: 'u-owner' }
      ],
      club_members: [
        { id: 'c1', created_at: iso(0, 8), updated_at: iso(0, 8), name: 'Demo member', phone: '+971500000011', email: null, tier: 'half', founding: true, lang: 'en', source: 'whatsapp', status: 'new', staff_notes: null, handled_by: null },
        { id: 'c2', created_at: iso(2, 13), updated_at: iso(1, 13), name: 'عضوة تجريبية', phone: null, email: 'member@example.com', tier: 'full', founding: true, lang: 'ar', source: 'instagram', status: 'contacted', staff_notes: 'Wants to start in March.', handled_by: 'u-manager' },
        { id: 'c3', created_at: iso(3, 10), updated_at: iso(3, 10), name: 'Demo guest', phone: '+971500000013', email: null, tier: 'undecided', founding: false, lang: 'en', source: 'walk-in', status: 'new', staff_notes: null, handled_by: null }
      ],
      salon_status: [{ id: 1, lounge_waiting: 0, chairs_free: null, mode: 'preopening', message_en: 'Opening March 2027 off Sheikh Zayed Road.', message_ar: 'الافتتاح مارس ٢٠٢٧ قرب شارع الشيخ زايد.', wait_minutes: null, updated_at: iso(1), updated_by: 'u-owner' }],
      cash_closings: [{ id: 'c1', day: iso(1).slice(0, 10), cash_aed: 380, card_aed: 1240, other_aed: 0, expected: { cash: { count: 3, total: 380, tips: 0 }, card: { count: 7, total: 1150, tips: 90 } }, note: null, closed_by: 'u-manager', created_at: iso(1, 23), updated_at: iso(1, 23) }],
      staff_schedule: [{ id: 'p1', staff_id: 'u-stylist', day: iso(-1).slice(0, 10), start_time: '10:00:00', end_time: '18:00:00', note: null, created_at: iso(1) }],
      pins: { 'u-stylist': iso(3) },
      audit_logs: [
        { id: 5, actor: 'u-manager', action: 'update:event_requests', target: 'e2', details: { before: { status: 'new' }, after: { status: 'contacted' } }, at: iso(1, 16) },
        { id: 4, actor: 'u-owner', action: 'update:services', target: 'glow', details: { before: { price_aed: 169 }, after: { price_aed: 179 } }, at: iso(2, 11) },
        { id: 3, actor: 'u-owner', action: 'insert:promo_codes', target: 'GLOW10', details: { before: null, after: { code: 'GLOW10', pct: 10 } }, at: iso(2, 10) },
        { id: 2, actor: 'u-owner', action: 'invite:staff', target: 'u-stylist', details: { email: 'stylist@example.com', role: 'stylist' }, at: iso(10) },
        { id: 1, actor: 'u-owner', action: 'update:salon_status', target: '1', details: { before: { mode: 'preopening', message_en: null }, after: { mode: 'preopening', message_en: 'Opening March 2027 off Sheikh Zayed Road.' } }, at: iso(1) }
      ]
    };
    const me = db.staff.find(s => s.id === ids[role]);
    const isMgr = role === 'owner' || role === 'manager';
    const deny = () => { throw new Error('permission denied (demo: not allowed for this role)'); };
    const KEY = { promo_codes: 'code' };
    let seq = 100;
    const log = (action, target, before, after) => db.audit_logs.unshift({ id: ++seq, actor: me.id, action, target, details: { before, after }, at: new Date().toISOString() });
    const later = v => new Promise(r => setTimeout(() => r(clone(v)), 60));
    return {
      me: () => later(me),
      list(t) {
        if (t !== 'staff' && t !== 'salon_status' && t !== 'staff_schedule' && !isMgr) return Promise.reject(new Error('permission denied'));
        if (t === 'staff' && !isMgr) return later([me]);
        const rows = [...db[t]];
        if (t === 'services' || t === 'addons') rows.sort((a, b) => a.sort_order - b.sort_order);
        return later(rows);
      },
      save(t, row, isNew) {
        if (!isMgr) deny();
        const k = KEY[t] || 'id';
        if (isNew) { const r = { ...row, id: row.id || 'n' + (++seq), created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; if (t === 'promo_codes') delete r.id; db[t].unshift(r); log('insert:' + t, r[k], null, t.endsWith('requests') || t === 'club_members' ? { status: r.status } : r); return later(r); }
        const cur = db[t].find(r => r[k] === row[k]); const before = clone(cur);
        Object.assign(cur, row, { updated_at: new Date().toISOString() });
        log('update:' + t, row[k], t === 'event_requests' || t === 'club_members' ? { status: before.status } : before, t === 'event_requests' || t === 'club_members' ? { status: cur.status } : clone(cur));
        return later(cur);
      },
      remove(t, key) { if (!isMgr) deny(); const k = KEY[t] || 'id'; db[t] = db[t].filter(r => r[k] !== key); log('delete:' + t, key, { [k]: key }, null); return later(null); },
      updateStaff(a) {
        if (role !== 'owner') deny();
        const s = db.staff.find(x => x.id === a.p_id); const before = clone(s);
        if (s.role === 'owner' && (a.p_role !== 'owner' || !a.p_active) && !db.staff.some(x => x.id !== s.id && x.role === 'owner' && x.active)) return Promise.reject(new Error('last_owner'));
        Object.assign(s, { display_name: a.p_display_name, role: a.p_role, active: a.p_active, specialty_en: a.p_specialty_en || null, specialty_ar: a.p_specialty_ar || null, instagram: a.p_instagram || null });
        log('update:staff', s.id, before, clone(s)); return later(s);
      },
      linkStaff(email, name, r) { if (role !== 'owner') deny(); const s = { id: 'n' + (++seq), display_name: name, role: r, email, active: true, created_at: new Date().toISOString() }; db.staff.push(s); log('insert:staff', s.id, null, s); return later(s); },
      updateMyProfile(a) { Object.assign(me, { specialty_en: a.p_specialty_en || null, specialty_ar: a.p_specialty_ar || null, instagram: a.p_instagram || null }); return later(me); },
      setSalonStatus(a) {
        if (!isMgr) deny();
        const s = db.salon_status[0], before = clone(s);
        Object.assign(s, { mode: a.p_mode, message_en: a.p_message_en || null, message_ar: a.p_message_ar || null, wait_minutes: a.p_wait_minutes, lounge_waiting: a.p_lounge_waiting ?? s.lounge_waiting, chairs_free: a.p_chairs_free, updated_at: new Date().toISOString(), updated_by: me.id });
        log('update:salon_status', '1', before, clone(s)); return later(s);
      },
      // File réelle (009) : PIN (jamais stocké ici, seulement « a un PIN »), caisse du jour
      pinStatus: () => (isMgr ? later(db.staff.map(x => ({ staff_id: x.id, has_pin: !!db.pins[x.id], updated_at: db.pins[x.id] || null }))) : Promise.reject(new Error('forbidden'))),
      setPin(id, pin) { if (!isMgr) deny(); if (!/^[0-9]{4}$/.test(pin)) return Promise.reject(new Error('invalid_pin')); db.pins[id] = new Date().toISOString(); log('set_pin:staff', id, null, { pin: 'changed' }); return later('ok'); },
      clearPin(id) { if (!isMgr) deny(); delete db.pins[id]; log('clear_pin:staff', id, null, { pin: 'removed' }); return later('ok'); },
      cashTotals: () => (isMgr ? later({ cash: { count: 2, total: 260, tips: 0 }, card: { count: 5, total: 890, tips: 75 }, applepay: { count: 1, total: 139, tips: 14 } }) : Promise.reject(new Error('forbidden'))),
      closeCash(a) {
        if (!isMgr) deny();
        let r = db.cash_closings.find(x => x.day === a.p_day); const before = r ? clone(r) : null;
        if (!r) { r = { id: 'n' + (++seq), day: a.p_day, created_at: new Date().toISOString() }; db.cash_closings.unshift(r); }
        Object.assign(r, { cash_aed: a.p_cash, card_aed: a.p_card, other_aed: a.p_other, note: a.p_note || null, expected: { cash: { count: 2, total: 260, tips: 0 }, card: { count: 5, total: 890, tips: 75 } }, closed_by: me.id, updated_at: new Date().toISOString() });
        log((before ? 'update' : 'insert') + ':cash_closings', r.id, before, clone(r)); return later(r);
      },
      // Démo : la fonction Edge n'existe pas ici, on montre la méthode manuelle (comme avant son déploiement)
      invite: () => later({ ok: false, notDeployed: true }),
      changePassword: () => later(null),
      signOut: () => later(null)
    };
  }
  window.QAMAR_OFFICE_DEMO = { create };
})();
