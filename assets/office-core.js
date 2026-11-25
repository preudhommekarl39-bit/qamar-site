/* QAMAR : back-office (office.html), logique pure : rôles, menu visible par rôle, droits, validations.
   Sans dépendance ni accès réseau : chargé par office.html et testé par scripts/run-tests.mjs (vm).
   Les droits réels sont appliqués par la base (RLS + fonctions, migration 007) : ce fichier ne fait que l'affichage. */
(function (root) {
  'use strict';
  const ROLES = ['owner', 'manager', 'stylist'];
  const ROLE_LABELS = { owner: 'Owner', manager: 'Manager', stylist: 'Stylist' };

  // Rubriques du menu. roles = qui la voit ; edit = qui peut modifier (les autres : lecture seule) ; href = page à part
  const MENU = [
    { id: 'overview', label: 'Overview', group: 'Today', roles: ['owner', 'manager'] },
    { id: 'status', label: 'Salon status', group: 'Today', roles: ['owner', 'manager'], edit: ['owner', 'manager'] },
    { id: 'events', label: 'Event requests', group: 'Clients', roles: ['owner', 'manager'], edit: ['owner', 'manager'] },
    { id: 'club', label: 'Club members', group: 'Clients', roles: ['owner', 'manager'], edit: ['owner', 'manager'] },
    { id: 'services', label: 'Services and prices', group: 'Menu', roles: ['owner', 'manager'], edit: ['owner', 'manager'] },
    { id: 'addons', label: 'Extras and drinks', group: 'Menu', roles: ['owner', 'manager'], edit: ['owner', 'manager'] },
    { id: 'promos', label: 'Promo codes', group: 'Menu', roles: ['owner', 'manager'], edit: ['owner', 'manager'] },
    { id: 'team', label: 'Team', group: 'Team', roles: ['owner', 'manager'], edit: ['owner'] },
    { id: 'activity', label: 'Activity log', group: 'Team', roles: ['owner', 'manager'] },
    { id: 'profile', label: 'My profile', group: 'Me', roles: ['owner', 'manager', 'stylist'], edit: ['owner', 'manager', 'stylist'] },
    { id: 'journal', label: 'Journal (blog)', group: 'Website', roles: ['owner'], href: 'blog-admin.html' },
    { id: 'floor', label: 'Floor (demo)', group: 'Website', roles: ['owner', 'manager'], href: 'admin.html' },
    { id: 'station', label: 'Stylist tablet', group: 'Website', roles: ['owner', 'manager', 'stylist'], href: 'station.html' }
  ];

  const isRole = r => ROLES.includes(r);
  const menuFor = role => (isRole(role) ? MENU.filter(m => m.roles.includes(role)) : []);
  const canSee = (role, id) => menuFor(role).some(m => m.id === id);
  const canEdit = (role, id) => { const m = MENU.find(x => x.id === id); return !!(m && isRole(role) && m.roles.includes(role) && (m.edit || []).includes(role)); };
  const home = role => (role === 'stylist' ? 'profile' : isRole(role) ? 'overview' : null);

  const STATUSES = ['new', 'contacted', 'confirmed', 'declined'];
  const STATUS_LABELS = { new: 'New', contacted: 'Contacted', confirmed: 'Confirmed', declined: 'Declined' };
  const EVENT_TYPES = { wedding: 'Wedding', henna: 'Henna night', engagement: 'Engagement', bridal_shower: 'Bridal shower', birthday: 'Birthday', graduation: 'Graduation', baby: 'Baby shower', eid: 'Eid or Ramadan', shoot: 'Photo or video shoot', corporate: 'Corporate', other: 'Other' };
  const TIERS = { crescent: 'Crescent', half: 'Half Moon', full: 'Full Moon', undecided: 'Not decided' };
  const SOURCES = { website: 'Website', whatsapp: 'WhatsApp', instagram: 'Instagram', phone: 'Phone', 'walk-in': 'Walk-in', other: 'Other' };
  const ADDON_KINDS = { extra: 'Extra', ritual: 'Ritual', matcha: 'Matcha drink', drink: 'Drink', other: 'Other' };
  const SALON_MODES = { preopening: 'Pre-opening (not open yet)', open: 'Open', closed: 'Closed today' };

  const ID_RE = /^[a-z][a-z0-9-]{1,30}$/;
  const PHONE_RE = /^\+[0-9]{7,15}$/;
  const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
  const AR_RE = /[؀-ۿ]/;
  const str = v => (v == null ? '' : String(v)).trim();
  const tags = s => /[<>]/.test(s);
  const wholePrice = p => Number.isInteger(p) && p > 0 && p <= 5000;

  // Chaque validateur renvoie la liste des erreurs (vide = valide), en anglais pour l'écran
  function names(o, pairs, errs) {
    for (const [k, label, max] of pairs) {
      const en = str(o[k + '_en']), ar = str(o[k + '_ar']);
      if (!en) errs.push(label + ' in English is required.');
      if (!ar) errs.push(label + ' in Arabic is required.');
      else if (!AR_RE.test(ar)) errs.push(label + ' in Arabic must be written in Arabic.');
      if (en.length > max || ar.length > max) errs.push(label + ': ' + max + ' characters maximum.');
      if (tags(en) || tags(ar)) errs.push(label + ': the characters < and > are not allowed.');
    }
  }
  function validateService(s, opts = {}) {
    const errs = [];
    if (!ID_RE.test(str(s.id))) errs.push('Code: lowercase letters, digits and hyphens, 2 to 31 characters (e.g. express).');
    if (opts.existingIds && opts.isNew && opts.existingIds.includes(str(s.id))) errs.push('Code: already used by another look.');
    names(s, [['look', 'Look name', 60], ['name', 'Service name', 80]], errs);
    const p = Number(s.price_aed), d = Number(s.duration_min);
    if (!wholePrice(p)) errs.push('Price: a whole number of AED greater than 0 (5000 maximum).');
    if (!Number.isInteger(d) || d < 5 || d > 45) errs.push('Duration: 5 to 45 minutes (no look takes more than 45 minutes).');
    if (s.from_hour !== null && s.from_hour !== '' && s.from_hour !== undefined && !(Number.isInteger(Number(s.from_hour)) && Number(s.from_hour) >= 0 && Number(s.from_hour) <= 23)) errs.push('Available from: an hour between 0 and 23, or empty.');
    if (!Number.isInteger(Number(s.sort_order))) errs.push('Order: a whole number.');
    return errs;
  }
  function validateAddon(a, opts = {}) {
    const errs = [];
    if (!ID_RE.test(str(a.id))) errs.push('Code: lowercase letters, digits and hyphens, 2 to 31 characters (e.g. shower).');
    if (opts.existingIds && opts.isNew && opts.existingIds.includes(str(a.id))) errs.push('Code: already used.');
    names(a, [['name', 'Name', 120]], errs);
    if (!ADDON_KINDS[a.kind]) errs.push('Type: choose one in the list.');
    if (!wholePrice(Number(a.price_aed))) errs.push('Price: a whole number of AED greater than 0 (5000 maximum).');
    if (!Number.isInteger(Number(a.sort_order))) errs.push('Order: a whole number.');
    return errs;
  }
  function validatePromoCode(c, opts = {}) {
    const errs = [];
    const code = str(c.code).toUpperCase();
    if (!/^[A-Z0-9]{2,32}$/.test(code)) errs.push('Code: 2 to 32 letters or digits, no spaces (e.g. GLOW10).');
    if (opts.existingCodes && opts.isNew && opts.existingCodes.includes(code)) errs.push('Code: already exists.');
    const pct = Number(c.pct);
    if (!Number.isInteger(pct) || pct < 1 || pct > 100) errs.push('Discount: a whole percentage from 1 to 100.');
    const mp = Number(c.min_people);
    if (!Number.isInteger(mp) || mp < 1 || mp > 6) errs.push('Minimum group size: 1 to 6.');
    if (c.valid_until && !/^\d{4}-\d{2}-\d{2}$/.test(c.valid_until)) errs.push('Valid until: a date, or empty for no end date.');
    if (str(c.label_en).length > 60 || str(c.label_ar).length > 60) errs.push('Labels: 60 characters maximum.');
    if (tags(str(c.label_en)) || tags(str(c.label_ar))) errs.push('Labels: the characters < and > are not allowed.');
    return errs;
  }
  function contact(r, errs) {
    const ph = str(r.phone).replace(/[\s()-]/g, ''), em = str(r.email);
    if (!ph && !em) errs.push('Add a phone number or an e-mail.');
    if (ph && !PHONE_RE.test(ph)) errs.push('Phone: international format with +, e.g. +971501234567.');
    if (em && !EMAIL_RE.test(em)) errs.push('E-mail: not a valid address.');
  }
  function validateRequest(r, kind) {
    const errs = [];
    const n = str(r.name);
    if (!n || n.length > 60) errs.push('Name: 1 to 60 characters.');
    contact(r, errs);
    if (!STATUSES.includes(r.status)) errs.push('Status: choose one in the list.');
    if (!SOURCES[r.source]) errs.push('Source: choose one in the list.');
    if (str(r.staff_notes).length > 2000) errs.push('Notes: 2000 characters maximum.');
    if (kind === 'event') {
      if (!EVENT_TYPES[r.event_type]) errs.push('Type of event: choose one in the list.');
      if (r.guests !== '' && r.guests != null && !(Number.isInteger(Number(r.guests)) && Number(r.guests) >= 1 && Number(r.guests) <= 60)) errs.push('Guests: 1 to 60.');
      if (str(r.note).length > 500) errs.push('Client message: 500 characters maximum.');
    } else if (!TIERS[r.tier]) errs.push('Plan: choose one in the list.');
    return errs;
  }
  function validateStaff(s) {
    const errs = [];
    const n = str(s.display_name);
    if (!n || n.length > 40) errs.push('Display name: 1 to 40 characters.');
    if (!isRole(s.role)) errs.push('Role: owner, manager or stylist.');
    const ig = str(s.instagram).replace(/^@/, '');
    if (ig && !/^[A-Za-z0-9._]{1,30}$/.test(ig)) errs.push('Instagram: the account name only, e.g. qamar.layla.');
    if (str(s.specialty_en).length > 60 || str(s.specialty_ar).length > 60) errs.push('Specialty: 60 characters maximum.');
    return errs;
  }
  function validateInvite(i) {
    const errs = validateStaff({ display_name: i.display_name, role: i.role });
    if (!EMAIL_RE.test(str(i.email))) errs.push('E-mail: not a valid address.');
    return errs;
  }
  function validateSalonStatus(s) {
    const errs = [];
    if (!SALON_MODES[s.mode]) errs.push('Mode: choose one.');
    if (str(s.message_en).length > 160 || str(s.message_ar).length > 160) errs.push('Message: 160 characters maximum.');
    if (tags(str(s.message_en)) || tags(str(s.message_ar))) errs.push('Message: the characters < and > are not allowed.');
    if (s.wait_minutes !== '' && s.wait_minutes != null && !(Number.isInteger(Number(s.wait_minutes)) && Number(s.wait_minutes) >= 0 && Number(s.wait_minutes) <= 240)) errs.push('Estimated wait: 0 to 240 minutes, or empty.');
    if (!(Number.isInteger(Number(s.lounge_waiting)) && Number(s.lounge_waiting) >= 0 && Number(s.lounge_waiting) <= 30)) errs.push('Guests waiting: 0 to 30.');
    return errs;
  }

  // Lien WhatsApp vers une cliente (numéro +971…) ; aucun lien si le numéro n'est pas valide
  const waHref = phone => { const p = str(phone).replace(/[\s()-]/g, ''); return PHONE_RE.test(p) ? 'https://wa.me/' + p.slice(1) : ''; };
  // Message d'erreur de la base → phrase lisible
  function dbError(e) {
    const m = String((e && (e.message || e.error_description || e.error)) || e || '');
    if (/row-level security|permission denied|forbidden|42501/i.test(m)) return 'Not allowed for your role.';
    if (/last_owner/.test(m)) return 'There must always be at least one active owner.';
    if (/already_staff/.test(m)) return 'This person is already in the team.';
    if (/duplicate key|already/i.test(m)) return 'This code already exists.';
    if (/check constraint/i.test(m)) return 'A value is out of the allowed range. Please check the form.';
    if (/failed to fetch|network|load failed/i.test(m)) return 'The server could not be reached. Check your connection and try again.';
    if (/no_account/.test(m)) return 'No Supabase account with this e-mail. Invite the person from the Supabase dashboard first.';
    return m || 'Unknown error.';
  }

  // ---- Journal d'activité : élément lisible et changement formaté (jamais d'identifiant technique à l'écran) ----
  // lk = { staff, services, addons, event_requests, club_members } (listes déjà lisibles dans le panneau)
  const fmtDay = d => (d ? new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
  function auditItem(e, lk) {
    const tbl = String(e.action || '').split(':')[1] || '', id = e.target, f = (l, k = 'id') => ((lk && lk[l]) || []).find(x => String(x[k]) === String(id));
    if (tbl === 'staff') { const s = f('staff'); return s ? s.display_name : (e.details && e.details.display_name) || 'Former team member'; }
    if (tbl === 'services') { const s = f('services'); return s ? s.look_en : id; }
    if (tbl === 'addons') { const a = f('addons'); return a ? a.name_en : id; }
    if (tbl === 'promo_codes') return id;
    if (tbl === 'salon_status') return 'Salon';
    if (tbl === 'event_requests') { const r = f('event_requests'); return r ? (EVENT_TYPES[r.event_type] || 'Event') + (r.event_date ? ' on ' + fmtDay(r.event_date) : '') + ' · ' + r.name : 'Event request (deleted)'; }
    if (tbl === 'club_members') { const r = f('club_members'); return r ? 'Club · ' + r.name : 'Club request (deleted)'; }
    return id || '';
  }
  const FIELD_LABELS = { price_aed: 'Price', duration_min: 'Duration', status: 'Status', active: 'Active', enabled: 'Active', role: 'Role', display_name: 'Name', look_en: 'Look (EN)', look_ar: 'Look (AR)', name_en: 'Name (EN)', name_ar: 'Name (AR)',
    sort_order: 'Order', from_hour: 'From hour', free_matcha: 'Free matcha', kind: 'Type', pct: 'Discount', valid_until: 'Valid until', min_people: 'Min. group', label_en: 'Label (EN)', label_ar: 'Label (AR)',
    specialty_en: 'Specialty (EN)', specialty_ar: 'Specialty (AR)', instagram: 'Instagram', email: 'E-mail', mode: 'Mode', message_en: 'Message (EN)', message_ar: 'Message (AR)', wait_minutes: 'Estimated wait', lounge_waiting: 'Guests waiting', chairs_free: 'Free chairs', code: 'Code' };
  function auditValue(k, v) {
    if (v == null || v === '') return 'empty';
    if (k === 'price_aed') return String(Math.round(Number(v)));
    if (k === 'status') return STATUS_LABELS[v] || v;
    if (k === 'role') return ROLE_LABELS[v] || v;
    if (k === 'mode') return SALON_MODES[v] || v;
    if (typeof v === 'boolean') return v ? 'yes' : 'no';
    return typeof v === 'object' ? JSON.stringify(v) : String(v);
  }
  const UNIT = { price_aed: ' AED', duration_min: ' min', wait_minutes: ' min', pct: '%' };
  function auditChange(d) {
    if (!d) return '';
    if (!('before' in d) && !('after' in d)) return Object.entries(d).filter(([k]) => k !== 'email').map(([k, v]) => (FIELD_LABELS[k] || k) + ': ' + auditValue(k, v)).join(', ');
    const b = d.before || {}, a = d.after || {};
    const skip = ['id', 'updated_at', 'created_at', 'updated_by', 'handled_by', 'staff_notes'];
    const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => !skip.includes(k) && JSON.stringify(b[k]) !== JSON.stringify(a[k]) && !(k === 'price_aed' && b[k] != null && a[k] != null && Number(b[k]) === Number(a[k])));
    if (!d.before) return 'Created';
    if (!d.after) return 'Deleted';
    return keys.map(k => { const u = UNIT[k] || '', fb = auditValue(k, b[k]), fa = auditValue(k, a[k]); return (FIELD_LABELS[k] || k) + ': ' + fb + (fb !== 'empty' && u ? (u === ' AED' ? '' : u) : '') + ' → ' + fa + (fa !== 'empty' ? u : ''); }).join(' · ') || 'No visible change';
  }

  root.QAMAR_OFFICE = { auditItem, auditChange, ROLES, ROLE_LABELS, MENU, menuFor, canSee, canEdit, home, STATUSES, STATUS_LABELS, EVENT_TYPES, TIERS, SOURCES, ADDON_KINDS, SALON_MODES,
    validateService, validateAddon, validatePromoCode, validateRequest, validateStaff, validateInvite, validateSalonStatus, waHref, dbError };
})(typeof window !== 'undefined' ? window : globalThis);
