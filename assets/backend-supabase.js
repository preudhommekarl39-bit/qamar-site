/* QAMAR — connecteur Supabase (mode connecté). NON ACTIF tant que config.js → backend: 'demo'.
   NON TESTÉ contre un vrai projet : à valider après `supabase db push` (voir DEPLOY.md).

   Chargement (dans chaque page, AVANT store.js, uniquement en mode connecté) :
     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js"></script>
     <script src="assets/backend-supabase.js"></script>

   Correspondance avec l'API de démo (assets/store.js) — mêmes noms, mais chaque action passe par une
   fonction SQL qui vérifie le rôle et l'état, et recalcule les montants côté serveur :
     joinQueue      → rpc('join_queue')          cliente, anonyme (retourne ticket_id + access_token)
     ticket suivi   → rpc('my_ticket')           cliente, avec access_token (jamais le téléphone dans l'URL)
     cancel         → rpc('cancel_my_ticket')
     clockIn/Out    → rpc('clock_in'/'clock_out') personnel connecté (Supabase Auth, e-mail + mot de passe ou lien magique)
     call           → rpc('call_next')           verrou SKIP LOCKED : jamais deux postes pour la même cliente
     start/toCheckout/noShow/requeue → rpc('advance_ticket')
     pay (espèces)  → rpc('confirm_cash')        carte/Apple Pay : uniquement via supabase/functions/payment-webhook
     rate           → rpc('leave_review')        seulement après paiement confirmé
     écran d'entrée → select sur la vue public_queue (prénom + initiale, sans téléphone)
     temps réel     → channel('qamar').on('postgres_changes', { table: 'tickets' }, …) */
(function () {
  const C = window.QAMAR_CONFIG || {};
  if (C.backend !== 'supabase') return;
  if (!window.supabase || !C.supabaseUrl || !C.supabaseAnonKey) {
    console.warn('[QAMAR] backend supabase demandé mais non configuré : retour au mode démo.');
    C.backend = 'demo';
    return;
  }
  const sb = window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey);
  const call = async (fn, args) => { const { data, error } = await sb.rpc(fn, args); if (error) throw new Error(error.message); return data; };

  window.QAMAR_BACKEND = {
    client: sb,
    joinQueue: (p) => call('join_queue', { p_name: p.name, p_phone: p.phone, p_service: p.serviceId, p_extra_long: !!p.extraLong, p_pref: p.prefStaffId || null }),
    myTicket: (id, token) => call('my_ticket', { p_ticket: id, p_token: token }),
    cancel: (id, token) => call('cancel_my_ticket', { p_ticket: id, p_token: token }),
    signIn: (email, password) => sb.auth.signInWithPassword({ email, password }),
    signOut: () => sb.auth.signOut(),
    clockIn: (seat) => call('clock_in', { p_seat: seat }),
    clockOut: () => call('clock_out'),
    callNext: (ticketId) => call('call_next', { p_ticket: ticketId || null }),
    advance: (ticketId, action) => call('advance_ticket', { p_ticket: ticketId, p_action: action }),
    confirmCash: (ticketId) => call('confirm_cash', { p_ticket: ticketId }),
    amountDue: (ticketId) => call('amount_due', { p_ticket: ticketId }),
    review: (id, token, stars, comment) => call('leave_review', { p_ticket: id, p_token: token, p_stars: stars, p_comment: comment }),
    publicQueue: async () => { const { data, error } = await sb.from('public_queue').select('*'); if (error) throw error; return data; },
    subscribe: (onChange) => sb.channel('qamar').on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, onChange).subscribe()
  };
})();
