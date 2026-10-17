/* QAMAR — sakura sur tout le site :
   1) branches de cerisier en fleurs qui se balancent dans les sections ([data-branch="tr|tl"])
   2) pluie légère de pétales par-dessus la page (après le hero, ou partout s'il n'y a pas de hero). */
(function () {
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PALETTES = [
    ['#FFFFFF', '#FFE6EE', '#F7B3C6'],
    ['#FFF6F9', '#FFD3E0', '#F29BB4'],
    ['#FFFFFF', '#FDEAF0', '#EFC0CF'],
    ['#FFF0F4', '#FFC9D8', '#EC8FAB']
  ];

  function petalPath(c, r) {
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(-r * .58, -r * .3, -r * .56, -r * .92, -r * .14, -r);
    c.lineTo(0, -r * .84);
    c.lineTo(r * .14, -r);
    c.bezierCurveTo(r * .56, -r * .92, r * .58, -r * .3, 0, 0);
    c.closePath();
  }
  function blossom(size, pal) {
    const s = Math.ceil(size * 2 + 4);
    const c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'); g.translate(s / 2, s / 2);
    for (let i = 0; i < 5; i++) {
      g.save(); g.rotate(i * TAU / 5);
      const gr = g.createLinearGradient(0, 0, 0, -size);
      gr.addColorStop(0, pal[2]); gr.addColorStop(.45, pal[1]); gr.addColorStop(1, pal[0]);
      g.fillStyle = gr; petalPath(g, size); g.fill();
      g.strokeStyle = 'rgba(236, 143, 171, .25)'; g.lineWidth = Math.max(.5, size / 40); g.stroke();
      g.restore();
    }
    const core = g.createRadialGradient(0, 0, 0, 0, 0, size * .32);
    core.addColorStop(0, 'rgba(214, 74, 120, .85)'); core.addColorStop(1, 'rgba(214, 74, 120, 0)');
    g.fillStyle = core; g.beginPath(); g.arc(0, 0, size * .32, 0, TAU); g.fill();
    for (let i = 0; i < 9; i++) {
      const a = i * TAU / 9 + .2, l = size * rnd(.24, .34);
      g.strokeStyle = 'rgba(205, 70, 110, .7)'; g.lineWidth = Math.max(.5, size / 45);
      g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * l, Math.sin(a) * l); g.stroke();
      g.fillStyle = '#F6C66B'; g.beginPath(); g.arc(Math.cos(a) * l, Math.sin(a) * l, Math.max(.8, size / 22), 0, TAU); g.fill();
    }
    return c;
  }
  function petal(size, pal) {
    const s = Math.ceil(size * 1.3 + 4);
    const c = document.createElement('canvas'); c.width = c.height = s;
    const g = c.getContext('2d'); g.translate(s / 2, s / 2 + size * .5);
    const gr = g.createLinearGradient(0, 0, 0, -size);
    gr.addColorStop(0, pal[2]); gr.addColorStop(.5, pal[1]); gr.addColorStop(1, pal[0]);
    g.fillStyle = gr; petalPath(g, size); g.fill();
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
    const sprB = PALETTES.map(p => blossom(16, p)), sprP = PALETTES.map(p => petal(14, p));
    const hasHero = !!document.querySelector('.stage');
    let W = 0, H = 0, dpr = 1, items = [], raf = 0, last = 0, on = !hasHero;
    const make = top => ({ x: rnd(0, W), y: top ? rnd(-80, -20) : rnd(-H, H), b: Math.random() < .35, pal: Math.floor(rnd(0, 4)), s: rnd(.55, 1.05), vy: rnd(22, 42), sway: rnd(18, 46), ph: rnd(0, TAU), rot: rnd(0, TAU), vr: rnd(-1.4, 1.4), fl: rnd(0, TAU), vf: rnd(1.4, 3) });
    function size() {
      dpr = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      items = Array.from({ length: W < 700 ? 9 : 16 }, () => make(false));
    }
    function frame(ms) {
      const dt = Math.min(.05, last ? (ms - last) / 1000 : .016); last = ms;
      const t = ms / 1000, wind = Math.sin(t * .2) * 10;
      ctx.clearRect(0, 0, W, H);
      for (const p of items) {
        p.y += p.vy * dt; p.x += (wind + Math.sin(t * .8 + p.ph) * p.sway * .6) * dt; p.rot += p.vr * dt; p.fl += p.vf * dt;
        if (p.y > H + 30) Object.assign(p, make(true));
        const spr = (p.b ? sprB : sprP)[p.pal], fx = Math.cos(p.fl);
        ctx.save(); ctx.globalAlpha = .85; ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(Math.abs(fx) < .1 ? .1 : fx, 1);
        ctx.drawImage(spr, -spr.width * p.s / 2, -spr.height * p.s / 2, spr.width * p.s, spr.height * p.s); ctx.restore();
      }
      if (on && !document.hidden) raf = requestAnimationFrame(frame);
    }
    const start = () => { cancelAnimationFrame(raf); last = 0; raf = requestAnimationFrame(frame); };
    size(); addEventListener('resize', size);
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
    .sakura-rain { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; z-index: 40; opacity: 0; transition: opacity .8s; }
    .sakura-rain.on { opacity: 1; }
    .branch-deco { position: absolute; top: -4px; z-index: 0; width: min(400px, 40%); pointer-events: none; }
    .branch-deco.tr { right: -6px; }
    .branch-deco.tl { left: -6px; transform: scaleX(-1); }
    .branch-deco img { display: block; width: 100%; height: auto; transform-origin: 100% 0; animation: branchSway 7s ease-in-out infinite alternate; filter: drop-shadow(0 10px 18px rgba(214, 120, 150, .18)); }
    @keyframes branchSway { from { transform: rotate(-1.4deg); } to { transform: rotate(1.6deg); } }
    @media (max-width: 760px) { .branch-deco { width: 46%; opacity: .9; } }
    @media (prefers-reduced-motion: reduce) { .branch-deco img { animation: none; } }
  `;
  document.head.appendChild(style);

  const boot = () => { decorate(); rain(); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
