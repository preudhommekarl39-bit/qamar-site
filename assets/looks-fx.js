/* QAMAR — visuels animés des looks : un ruban de satin en 3D par look (esprit visuel de parfum, pas d'illustration de personnage).
   Chaque forme évoque le résultat : boucles rebondies, onde, tombé lisse, torsade, coupe, racines…
   Usage : <canvas class="look-canvas" data-look="express"></canvas> — détection automatique des nouveaux canvas.
   Une seule boucle pour tous les canvas ; seuls ceux visibles à l'écran sont animés. */
(function () {
  const TAU = Math.PI * 2;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lerp = (a, b, k) => a + (b - a) * k;
  const hsh = n => { const x = Math.sin(n * 127.1) * 43758.5; return x - Math.floor(x); };

  // teintes satin : [ombre, lumière]
  const SATIN = {
    rose:  [[176, 92, 118], [253, 224, 232]],
    champ: [[160, 116, 64], [253, 238, 210]],
    plum:  [[58, 30, 44], [226, 176, 194]],
    pearl: [[188, 160, 162], [255, 250, 248]],
    mauve: [[92, 52, 64], [238, 200, 210]],
    cocoa: [[70, 44, 36], [196, 150, 120]]
  };

  /* Ruban : spine(u,t) -> [x, y], twist(u,t) -> angle, largeur en px.
     Projection : demi-largeur visible = w/2 · cos(twist) ; ombrage selon l'orientation de la face. */
  function ribbon(c, spine, twist, w, col, t, opts = {}) {
    const N = opts.n || 140, u0 = opts.from || 0, u1 = opts.to == null ? 1 : opts.to;
    const P = [], A = [];
    for (let i = 0; i <= N; i++) { const u = lerp(u0, u1, i / N); P.push(spine(u, t)); A.push(twist(u, t)); }
    const pts = P.map((p, i) => {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(N, i + 1)];
      let dx = b[0] - a[0], dy = b[1] - a[1]; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
      const half = (opts.width ? opts.width(lerp(u0, u1, i / N)) : w) / 2 * Math.cos(A[i]);
      return { l: [p[0] - dy * half, p[1] + dx * half], r: [p[0] + dy * half, p[1] - dx * half], c: Math.cos(A[i]), s: Math.sin(A[i]), u: lerp(u0, u1, i / N) };
    });
    // ombre portée douce sous le ruban
    if (!opts.noShadow) {
      c.save(); c.filter = 'blur(10px)'; c.strokeStyle = 'rgba(90, 40, 55, .16)'; c.lineWidth = w * .55; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); P.forEach((p, i) => i ? c.lineTo(p[0] + 6, p[1] + 14) : c.moveTo(p[0] + 6, p[1] + 14)); c.stroke(); c.restore();
    }
    for (let i = 0; i < N; i++) {
      const p = pts[i], q = pts[i + 1];
      const cm = (p.c + q.c) / 2, sm = (p.s + q.s) / 2, facing = Math.abs(cm);
      const [dk, lt] = typeof col === 'function' ? col((p.u + q.u) / 2) : col;
      const back = cm < 0 ? .78 : 1;                              // revers du satin un peu plus sombre
      const k = Math.min(1, (.18 + .82 * Math.pow(facing, .7)) * back);
      const spec = Math.pow(Math.max(0, sm * .55 + cm * .84), 18) * facing; // reflet satiné
      const rgb = dk.map((v, j) => Math.round(Math.min(255, lerp(v, lt[j], k) + spec * 120)));
      const fill = `rgb(${rgb.join(',')})`;
      c.beginPath(); c.moveTo(p.l[0], p.l[1]); c.lineTo(q.l[0], q.l[1]); c.lineTo(q.r[0], q.r[1]); c.lineTo(p.r[0], p.r[1]); c.closePath();
      c.fillStyle = fill; c.fill(); c.strokeStyle = fill; c.lineWidth = .6; c.stroke();
    }
    // liseré doré sur les bords
    if (opts.edge) {
      c.strokeStyle = opts.edge; c.lineWidth = 1;
      // interrompu là où le ruban est vu par la tranche (évite de petites marques aux torsions)
      ['l', 'r'].forEach(sd => { c.beginPath(); let on = false; pts.forEach(p => { if (Math.abs(p.c) < .2) { on = false; return; } on ? c.lineTo(p[sd][0], p[sd][1]) : c.moveTo(p[sd][0], p[sd][1]); on = true; }); c.stroke(); });
    }
  }

  function sparkle(c, x, y, r, a) {
    c.save(); c.translate(x, y); c.fillStyle = `rgba(255, 246, 236, ${a})`;
    c.beginPath(); for (let k = 0; k < 8; k++) { const rr = k % 2 ? r * .22 : r, an = k * Math.PI / 4; c[k ? 'lineTo' : 'moveTo'](Math.cos(an) * rr, Math.sin(an) * rr); } c.closePath(); c.fill(); c.restore();
  }

  const LOOKS = {
    // boucles rebondies : le ruban fait deux boucles souples
    express(c, w, h, t) {
      ribbon(c, (u, t) => [w * .5 + Math.sin(u * TAU * 2 + t * .6) * w * .17, h * .12 + u * h * .7 + Math.cos(u * TAU * 2 + t * .6) * h * .1],
        (u, t) => u * 4 + t * .6, w * .14, SATIN.rose, t, { edge: 'rgba(214, 170, 110, .55)' });
    },
    // brillance miroir : large ruban champagne, un reflet qui passe lentement
    glow(c, w, h, t) {
      ribbon(c, (u, t) => [w * .5 + Math.sin(u * Math.PI * 1.3 + t * .35) * w * .14, h * .06 + u * h * .88],
        (u, t) => u * 2.4 - 1.2 + Math.sin(t * .5) * 1.1, w * .3, SATIN.champ, t, { edge: 'rgba(255, 240, 210, .6)' });
      for (let k = 0; k < 3; k++) { const ph = (t * .4 + k / 3) % 1; sparkle(c, w * (.3 + hsh(k) * .4), h * (.15 + hsh(k + 4) * .7), 6 * Math.sin(ph * Math.PI), Math.sin(ph * Math.PI) * .9); }
    },
    // ondulations : onde régulière qui se propage
    waves(c, w, h, t) {
      ribbon(c, (u, t) => [w * .5 + Math.sin(u * TAU * 2.1 - t * 1.2) * w * .16, h * .06 + u * h * .88],
        (u, t) => Math.sin(u * TAU * 2.1 - t * 1.2 + 1.2) * .9, w * .24, SATIN.rose, t, { edge: 'rgba(214, 170, 110, .5)' });
    },
    // lisse comme du verre : tombé droit, reflet vertical qui glisse
    sleek(c, w, h, t) {
      ribbon(c, (u, t) => [w * .5 + Math.sin(u * Math.PI + t * .4) * w * .05, h * .02 + u * h * .92],
        (u, t) => .25 + u * u * 2.8 + Math.sin(t * .6) * .35, w * .24, SATIN.mauve, t, { edge: 'rgba(255, 230, 236, .5)' });
    },
    // nuit : ciel prune, lune dorée, ruban satin sombre à liseré or
    night(c, w, h, t) {
      const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#2A1A26'); bg.addColorStop(1, '#5A3446'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
      for (let k = 0; k < 16; k++) { const a = .3 + .7 * Math.abs(Math.sin(t * 1.2 + k * 2.1)); c.fillStyle = `rgba(255, 240, 220, ${a * .75})`; c.beginPath(); c.arc(hsh(k) * w, hsh(k + 9) * h * .6, .6 + hsh(k + 3) * 1.2, 0, TAU); c.fill(); }
      c.save(); c.translate(w * .74, h * .18); c.beginPath(); c.arc(0, 0, w * .07, Math.PI * .3, Math.PI * 1.7); c.arc(w * .035, 0, w * .058, Math.PI * 1.62, Math.PI * .38, true); c.closePath();
      c.fillStyle = '#F0D8A8'; c.shadowColor = 'rgba(240, 216, 168, .8)'; c.shadowBlur = 18; c.fill(); c.restore();
      ribbon(c, (u, t) => [w * .45 + Math.sin(u * Math.PI * 1.6 + t * .4) * w * .16, h * .04 + u * h * .92],
        (u, t) => u * 3.4 + t * .5, w * .22, SATIN.plum, t, { edge: 'rgba(222, 182, 112, .85)', noShadow: true });
    },
    // SOS 15 : torsade serrée qui se balance (queue de cheval, tresse)
    sos(c, w, h, t) {
      ribbon(c, (u, t) => [w * .5 + Math.sin(t * 1.3) * w * .08 * u * u, h * .1 + u * h * .8],
        (u, t) => u * TAU * 3.2 - t * 2, w * .17, SATIN.champ, t, { width: u => w * .17 * (1 - u * .45), edge: 'rgba(255, 236, 200, .55)' });
      // attache dorée
      c.fillStyle = '#D6AA68'; c.beginPath(); c.ellipse(w * .5, h * .1, w * .07, w * .025, 0, 0, TAU); c.fill();
    },
    // rituel de soin : ruban nacré tout doux + éclats scintillants
    care(c, w, h, t) {
      ribbon(c, (u, t) => [w * .5 + Math.sin(u * TAU * .9 + t * .3) * w * .18, h * .08 + u * h * .84],
        (u, t) => u * 2.2 + Math.sin(t * .4) * .8, w * .27, SATIN.pearl, t, { edge: 'rgba(230, 200, 190, .7)' });
      for (let k = 0; k < 5; k++) { const ph = (t * .35 + k / 5) % 1; sparkle(c, w * (.2 + hsh(k + 1) * .6), h * (.12 + hsh(k + 6) * .76), 5.5 * Math.sin(ph * Math.PI), Math.sin(ph * Math.PI)); }
    },
    // coupe : le ruban est tranché net, la chute glisse et disparaît
    cut(c, w, h, t) {
      const sp = (u, t) => [w * .5 + Math.sin(u * Math.PI * 1.2 + .4) * w * .12, h * .06 + u * h * .88];
      const tw = (u, t) => u * 3 + .3;
      const cyc = (t % 3.6) / 3.6, fall = Math.max(0, cyc - .25) / .75;
      ribbon(c, sp, tw, w * .22, SATIN.rose, t, { to: .52, edge: 'rgba(214, 170, 110, .55)' });
      c.save(); c.globalAlpha = 1 - fall; c.translate(fall * w * .05, fall * fall * h * .35); c.rotate(fall * .25);
      ribbon(c, sp, tw, w * .22, SATIN.rose, t, { from: .56, edge: 'rgba(214, 170, 110, .55)', noShadow: true });
      c.restore();
      // trait de coupe doré, bref éclat au moment du cisaillement
      const [x, y] = sp(.54, t), flash = Math.max(0, 1 - cyc / .2);
      c.strokeStyle = `rgba(214, 170, 110, ${.35 + flash * .6})`; c.lineWidth = 1.2; c.setLineDash([4, 4]);
      c.beginPath(); c.moveTo(x - w * .22, y - 6); c.lineTo(x + w * .22, y + 6); c.stroke(); c.setLineDash([]);
    },
    // racines : dégradé du cacao profond vers le champagne lumineux
    root(c, w, h, t) {
      const A = SATIN.cocoa, B = SATIN.champ;
      ribbon(c, (u, t) => [w * .5 + Math.sin(u * Math.PI * 1.5 + t * .35) * w * .15, h * .05 + u * h * .9],
        (u, t) => u * 3.6 + t * .45, w * .24, u => { const k = Math.min(1, Math.max(0, (u - .18) / .5)); return [A[0].map((v, i) => lerp(v, B[0][i], k)), A[1].map((v, i) => lerp(v, B[1][i], k))]; }, t, { edge: 'rgba(230, 200, 150, .5)' });
    },
    // Mini Glow : un nœud de satin rose qui respire
    mini(c, w, h, t) {
      const cx = w * .5, cy = h * .36, br = 1 + Math.sin(t * 1.6) * .03;
      [-1, 1].forEach(sd => {
        // traîne
        ribbon(c, (u, t) => [cx + sd * (u * w * .16 + Math.sin(u * 4 + t) * w * .02), cy + u * h * .5], (u, t) => .4 + u * 1.6 * sd, w * .12, SATIN.rose, t, { n: 60, edge: 'rgba(214, 170, 110, .5)' });
      });
      [-1, 1].forEach(sd => {
        // boucle
        ribbon(c, (u, t) => { const a = u * TAU; return [cx + sd * (Math.sin(a / 2) * w * .26 * br), cy - Math.sin(a) * h * .11 * br]; }, (u, t) => Math.sin(u * Math.PI) * 1.1, w * .13, SATIN.rose, t, { n: 90, edge: 'rgba(214, 170, 110, .5)' });
      });
      // nœud central
      const g = c.createLinearGradient(cx, cy - 12, cx, cy + 12); g.addColorStop(0, '#F7C9D6'); g.addColorStop(1, '#C27390');
      c.fillStyle = g; c.beginPath(); c.ellipse(cx, cy, w * .055, w * .065, 0, 0, TAU); c.fill();
      c.strokeStyle = 'rgba(214, 170, 110, .7)'; c.lineWidth = 1; c.stroke();
    }
  };

  function drawLook(c, w, h, t, id) { (LOOKS[id] || LOOKS.glow)(c, w, h, t); }

  /* ---------- moteur ---------- */
  const items = new Set();
  const seen = new WeakSet();
  const io = 'IntersectionObserver' in window ? new IntersectionObserver(es => es.forEach(e => { const it = e.target.__look; if (it) { it.visible = e.isIntersecting; if (it.visible) kick(); } }), { rootMargin: '80px' }) : null;
  function setup(cv) {
    if (seen.has(cv)) return; seen.add(cv);
    const it = { cv, ctx: cv.getContext('2d'), id: cv.dataset.look, w: 0, h: 0, visible: !io };
    const size = () => { const d = Math.min(2, devicePixelRatio || 1); it.w = cv.clientWidth; it.h = cv.clientHeight; if (!it.w || !it.h) return; cv.width = Math.round(it.w * d); cv.height = Math.round(it.h * d); it.ctx.setTransform(d, 0, 0, d, 0, 0); if (reduce) paint(it, 3); };
    cv.__look = it; size();
    if ('ResizeObserver' in window) new ResizeObserver(size).observe(cv);
    if (io) io.observe(cv);
    items.add(it);
    if (reduce) paint(it, 3);
  }
  function paint(it, t) { if (!it.w) return; it.ctx.clearRect(0, 0, it.w, it.h); try { it.ctx.save(); drawLook(it.ctx, it.w, it.h, t, it.id); } catch (e) { console.error('[QAMAR looks-fx]', e); } finally { it.ctx.restore(); } }
  let raf = 0;
  function loop(ms) {
    let any = false;
    items.forEach(it => { if (!it.cv.isConnected) { items.delete(it); return; } if (!it.visible) return; any = true; paint(it, ms / 1000); });
    raf = any && !reduce ? requestAnimationFrame(loop) : 0;
  }
  function kick() { if (!raf && !reduce) raf = requestAnimationFrame(loop); }
  const scan = (root = document) => { root.querySelectorAll('canvas.look-canvas').forEach(setup); kick(); };
  window.QamarLooks = { scan, paint: (cv, t) => cv.__look && paint(cv.__look, t) };
  // les cartes sont re-rendues (langue, filtres, mises à jour) : on attache les nouveaux canvas automatiquement
  let pending = 0;
  new MutationObserver(() => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; scan(); }); }).observe(document.body, { childList: true, subtree: true });
  scan();
})();
