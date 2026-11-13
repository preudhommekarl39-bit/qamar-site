/* QAMAR — sakura sur tout le site :
   1) branches de cerisier en fleurs qui se balancent dans les sections ([data-branch="tr|tl"])
   2) pluie légère de pétales derrière le texte (au-dessus des fonds de section, sous .wrap / .app), après le hero ou partout s'il n'y a pas de hero. */
(function () {
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Pétale de sakura : deux lobes arrondis et l'échancrure en cœur au bout
  function petalPath(c, r) {
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(-r * .2, -r * .1, -r * .64, -r * .42, -r * .5, -r * .8);
    c.bezierCurveTo(-r * .42, -r * .98, -r * .24, -r * 1.02, -r * .12, -r * .98);
    c.quadraticCurveTo(-r * .04, -r * .95, 0, -r * .85);
    c.quadraticCurveTo(r * .04, -r * .95, r * .12, -r * .98);
    c.bezierCurveTo(r * .24, -r * 1.02, r * .42, -r * .98, r * .5, -r * .8);
    c.bezierCurveTo(r * .64, -r * .42, r * .2, -r * .1, 0, 0);
    c.closePath();
  }
  // un pétale peint : dégradé rose (base) → blanc (bout), nervures, reflet nacré, ombre douce
  function paintPetal(g, r, pal, back) {
    g.save();
    g.shadowColor = 'rgba(176, 82, 112, .22)'; g.shadowBlur = r * .14; g.shadowOffsetY = r * .05;
    const gr = g.createRadialGradient(0, 0, 0, 0, -r * .2, r * 1.02);
    gr.addColorStop(0, back ? pal[2] : pal[2]); gr.addColorStop(.42, pal[1]); gr.addColorStop(1, back ? pal[1] : pal[0]);
    g.fillStyle = gr; petalPath(g, r); g.fill();
    g.restore();
    g.save(); petalPath(g, r); g.clip();
    g.strokeStyle = back ? 'rgba(214, 104, 140, .22)' : 'rgba(222, 120, 152, .16)'; g.lineWidth = Math.max(.4, r / 46);
    [-.3, 0, .3].forEach(k => { g.beginPath(); g.moveTo(0, -r * .06); g.quadraticCurveTo(k * r * .45, -r * .5, k * r * .62, -r * .9); g.stroke(); });
    const sh = g.createLinearGradient(-r * .5, 0, r * .5, 0);
    sh.addColorStop(0, back ? 'rgba(255,255,255,0)' : 'rgba(255,255,255,.4)'); sh.addColorStop(.45, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(200, 96, 128, .1)');
    g.fillStyle = sh; g.fillRect(-r, -r * 1.1, r * 2, r * 1.2);
    g.restore();
  }
  const PALETTES = [
    ['#FFFFFF', '#FFE6EE', '#F4A9BF'],
    ['#FFF8FA', '#FFD9E4', '#EE98B2'],
    ['#FFFFFF', '#FDEAF0', '#EDB6C7'],
    ['#FFF4F7', '#FFD0DD', '#E88AA8']
  ];
  function blossom(size, pal) {
    const s = Math.ceil(size * 2 + 8);
    const c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'); g.translate(s / 2, s / 2); g.rotate(rnd(0, TAU));
    for (let i = 0; i < 5; i++) { g.save(); g.rotate(i * TAU / 5 + rnd(-.06, .06)); paintPetal(g, size * rnd(.94, 1.04), pal, false); g.restore(); }
    const core = g.createRadialGradient(0, 0, 0, 0, 0, size * .36);
    core.addColorStop(0, 'rgba(200, 70, 112, .8)'); core.addColorStop(1, 'rgba(214, 90, 130, 0)');
    g.fillStyle = core; g.beginPath(); g.arc(0, 0, size * .36, 0, TAU); g.fill();
    for (let i = 0; i < 11; i++) {
      const a = i * TAU / 11 + rnd(-.15, .15), l = size * rnd(.26, .38);
      g.strokeStyle = 'rgba(206, 92, 128, .55)'; g.lineWidth = Math.max(.5, size / 50);
      g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(Math.cos(a + .2) * l * .5, Math.sin(a + .2) * l * .5, Math.cos(a) * l, Math.sin(a) * l); g.stroke();
      g.fillStyle = '#C98577'; g.beginPath(); g.arc(Math.cos(a) * l, Math.sin(a) * l, Math.max(.8, size / 24), 0, TAU); g.fill();
    }
    return c;
  }
  function petal(size, pal, back, blur) {
    const pad = blur ? blur * 3 : 4, s = Math.ceil(size * 1.3 + pad * 2);
    const c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d');
    if (blur && 'filter' in g) g.filter = `blur(${blur}px)`;
    g.translate(s / 2, s / 2 + size * .5);
    paintPetal(g, size, pal, back);
    return c;
  }

  /* ---------- Image de branche (dessinée une fois, réutilisée partout) ---------- */
  function branchImage() {
    const W = 620, H = 440, k = 2;
    const c = document.createElement('canvas'); c.width = W * k; c.height = H * k;
    const g = c.getContext('2d'); g.scale(k, k);
    const big = PALETTES.map(p => blossom(30, p));
    const wood = (p, w) => {
      g.beginPath(); g.moveTo(p[0], p[1]); g.bezierCurveTo(p[2], p[3], p[4], p[5], p[6], p[7]);
      g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = '#6E4650'; g.stroke();
      g.lineWidth = w * .35; g.strokeStyle = 'rgba(255, 220, 228, .35)'; g.stroke();
    };
    wood([640, -10, 520, 60, 420, 70, 300, 150], 11);
    wood([300, 150, 230, 200, 170, 190, 90, 250], 6.5);
    wood([430, 80, 420, 150, 380, 210, 330, 270], 5);
    wood([230, 190, 220, 240, 200, 290, 160, 330], 3.5);
    wood([360, 120, 330, 80, 300, 60, 260, 50], 3.5);
    const clusters = [[90, 250], [120, 236], [70, 268], [160, 330], [176, 312], [330, 270], [350, 252], [312, 286], [260, 50], [282, 66], [300, 150], [250, 186], [200, 200], [400, 100], [460, 66], [140, 300], [370, 230], [225, 150], [520, 110]];
    clusters.forEach(([x, y], i) => {
      for (let n = 0; n < 2 + (i % 3); n++) {
        const spr = big[(i + n) % big.length], s = rnd(.75, 1.25);
        g.save(); g.translate(x + rnd(-18, 18), y + rnd(-14, 14)); g.rotate(rnd(0, TAU));
        g.drawImage(spr, -spr.width * s / 2, -spr.height * s / 2, spr.width * s, spr.height * s); g.restore();
      }
      g.fillStyle = '#F29BB4'; g.beginPath(); g.ellipse(x + rnd(-26, 26), y + rnd(-22, 22), 4, 6, rnd(0, TAU), 0, TAU); g.fill();
    });
    return c.toDataURL('image/png');
  }

  function decorate() {
    const els = document.querySelectorAll('[data-branch]');
    if (!els.length) return;
    const url = branchImage();
    els.forEach(el => {
      const wrap = document.createElement('span');
      wrap.className = 'branch-deco ' + (el.dataset.branch || 'tr');
      wrap.setAttribute('aria-hidden', 'true');
      wrap.innerHTML = `<img src="${url}" alt="">`;
      el.prepend(wrap);
    });
  }

  /* ---------- Pluie de pétales légère ---------- */
  function rain() {
    if (reduce) return;
    const cv = document.createElement('canvas');
    cv.className = 'sakura-rain'; cv.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    // sprites 2x (Q) : nets jusqu'à devicePixelRatio 1,5 ; recto/verso pour le retournement, version floue pour le plan lointain
    const Q = 2;
    const sprF = PALETTES.map(p => petal(14 * Q, p, false)), sprR = PALETTES.map(p => petal(14 * Q, p, true)), sprZ = PALETTES.map(p => petal(14 * Q, p, false, 2.4 * Q)), sprB = PALETTES.map(p => blossom(15 * Q, p));
    const LAYERS = [{ s: .55, a: .42, v: .6 }, { s: .85, a: .78, v: .85 }, { s: 1.15, a: .92, v: 1.1 }]; // loin, milieu, près
    const hasHero = !!document.querySelector('.stage');
    let W = 0, H = 0, dpr = 1, items = [], raf = 0, last = 0, on = !hasHero;
    const make = top => {
      const L = Math.random() < .35 ? 0 : Math.random() < .6 ? 1 : 2, ly = LAYERS[L];
      return { x: rnd(0, W), y: top ? rnd(-80, -20) : rnd(-H * .2, H), L, b: L > 0 && Math.random() < .14, pal: Math.floor(rnd(0, 4)), s: ly.s * rnd(.85, 1.15), a: ly.a, vy: rnd(24, 38) * ly.v, sway: rnd(16, 40) * ly.v, ph: rnd(0, TAU), rot: rnd(0, TAU), vr: rnd(-1.1, 1.1), fl: rnd(0, TAU), vf: rnd(1.6, 3.2), fl2: rnd(0, TAU) };
    };
    function size() {
      dpr = Math.min(1.5, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      items = Array.from({ length: W < 700 ? 5 : 14 }, () => make(false)).sort((a, b) => a.L - b.L);
    }
    // iOS déclenche « resize » quand la barre d'adresse bouge : on ne relance la pluie que si la largeur change
    function onResize() {
      if (innerWidth !== W) return size();
      if (innerHeight !== H) { H = innerHeight; cv.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    }
    function frame(ms) {
      if (last && ms - last < 33) { if (on && !document.hidden) raf = requestAnimationFrame(frame); return; }
      const dt = Math.min(.05, last ? (ms - last) / 1000 : .016); last = ms;
      const t = ms / 1000, wind = Math.sin(t * .2) * 10 + Math.sin(t * .53) * 4;
      ctx.clearRect(0, 0, W, H);
      for (const p of items) {
        // chute en feuille morte : la dérive latérale suit l'inclinaison du pétale
        const sw = Math.sin(t * .8 + p.ph);
        p.y += p.vy * dt * (1 - .25 * Math.abs(sw)); p.x += (wind * LAYERS[p.L].v + sw * p.sway * .7) * dt; p.rot += (p.vr + sw * .5) * dt; p.fl += p.vf * dt; p.fl2 += p.vf * .55 * dt;
        if (p.y > H + 30) { Object.assign(p, make(true), { L: p.L, s: p.s, a: p.a }); }
        const fx = Math.cos(p.fl), fy = .75 + .25 * Math.cos(p.fl2);
        const spr = (p.b ? sprB : p.L === 0 ? sprZ : fx < 0 ? sprR : sprF)[p.pal], k = p.s / Q;
        ctx.globalAlpha = p.a;
        ctx.setTransform(dpr, 0, 0, dpr, dpr * p.x, dpr * p.y); ctx.rotate(p.rot); ctx.scale(Math.abs(fx) < .1 ? (fx < 0 ? -.1 : .1) : fx, fy);
        ctx.drawImage(spr, -spr.width * k / 2, -spr.height * k / 2, spr.width * k, spr.height * k);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1;
      if (on && !document.hidden) raf = requestAnimationFrame(frame);
    }
    const start = () => { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(frame); };
    size(); addEventListener('resize', onResize);
    // Sur la page d'accueil, la pluie prend le relais quand on quitte le hero
    if (hasHero) {
      new MutationObserver(() => {
        const past = document.body.classList.contains('past-hero');
        if (past && !on) { on = true; cv.classList.add('on'); start(); }
        if (!past && on) { on = false; cv.classList.remove('on'); }
      }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    } else { cv.classList.add('on'); start(); }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && on) start(); });
  }

  const style = document.createElement('style');
  style.textContent = `
    .sakura-rain { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 0; opacity: 0; transition: opacity .8s; }
    .sakura-rain.on { opacity: 1; }
    .branch-deco { position: absolute; top: -4px; z-index: 0; width: min(400px, 40%); pointer-events: none; }
    .branch-deco.tr { right: -6px; }
    .branch-deco.tl { left: -6px; transform: scaleX(-1); }
    .branch-deco img { display: block; width: 100%; height: auto; transform-origin: 100% 0; animation: branchSway 7s ease-in-out infinite alternate; filter: drop-shadow(0 10px 18px rgba(214, 120, 150, .18)); }
    @keyframes branchSway { from { transform: rotate(-1.4deg); } to { transform: rotate(1.6deg); } }
    @media (max-width: 760px) { .branch-deco { width: 46%; opacity: .9; } }
    @media (prefers-reduced-motion: reduce), (pointer: coarse) { .branch-deco img { animation: none; } }
  `;
  document.head.appendChild(style);

  const boot = () => { decorate(); rain(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
