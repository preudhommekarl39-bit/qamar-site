/* QAMAR — traînée de curseur rose (2D, légère). Toujours la même teinte rose, jamais de noir.
   La traînée est un seul ruban effilé et lissé (pas de points superposés), avec un halo doux. */
(function () {
  if (window.__qamarCursor) return;
  if (!matchMedia('(pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  window.__qamarCursor = true;

  const PINK = '236, 146, 172';      // rose Qamar
  const LIFE = 360;                   // durée de vie d'un point de traînée (ms)
  const HEAD = 3.2;                   // demi-largeur du ruban à la tête (px)
  const cv = document.createElement('canvas');
  cv.setAttribute('aria-hidden', 'true');
  cv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:45';
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0;
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  size(); addEventListener('resize', size);

  const pts = [];
  let raf = 0, lastMove = 0;
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    const p = { x: e.clientX, y: e.clientY, t: performance.now() };
    const q = pts[pts.length - 1];
    if (q && Math.hypot(p.x - q.x, p.y - q.y) < 2) { q.t = p.t; } else pts.push(p);
    if (pts.length > 40) pts.shift();
    lastMove = p.t;
    if (!raf) raf = requestAnimationFrame(draw);
  }, { passive: true });

  // lissage de Chaikin : supprime les angles entre événements souris
  const smooth = a => {
    if (a.length < 3) return a;
    const o = [a[0]];
    for (let i = 0; i < a.length - 1; i++) {
      const p = a[i], q = a[i + 1];
      o.push({ x: p.x * .75 + q.x * .25, y: p.y * .75 + q.y * .25, t: p.t * .75 + q.t * .25 });
      o.push({ x: p.x * .25 + q.x * .75, y: p.y * .25 + q.y * .75, t: p.t * .25 + q.t * .75 });
    }
    o.push(a[a.length - 1]);
    return o;
  };

  function draw(now) {
    ctx.clearRect(0, 0, W, H);
    while (pts.length && now - pts[0].t > LIFE) pts.shift();
    const s = smooth(smooth(pts));
    if (s.length > 1) {
      // contour du ruban : largeur = fonction de l'âge du point (fin à la queue, plein à la tête)
      const L = [], R = [];
      for (let i = 0; i < s.length; i++) {
        const a = s[Math.max(0, i - 1)], b = s[Math.min(s.length - 1, i + 1)];
        let dx = b.x - a.x, dy = b.y - a.y; const n = Math.hypot(dx, dy) || 1; dx /= n; dy /= n;
        const k = Math.max(0, 1 - (now - s[i].t) / LIFE), w = HEAD * Math.pow(k, .8) * (i / (s.length - 1));
        L.push([s[i].x - dy * w, s[i].y + dx * w]); R.push([s[i].x + dy * w, s[i].y - dx * w]);
      }
      const tail = s[0], head = s[s.length - 1];
      const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
      g.addColorStop(0, `rgba(${PINK}, 0)`); g.addColorStop(1, `rgba(${PINK}, .75)`);
      ctx.save();
      ctx.shadowColor = `rgba(${PINK}, .9)`; ctx.shadowBlur = 16;
      ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]);
      for (let i = 1; i < L.length; i++) ctx.lineTo(L[i][0], L[i][1]);
      for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]);
      ctx.closePath(); ctx.fillStyle = g; ctx.fill();
      ctx.restore();
    }
    // petit halo rose qui reste un instant sur la position du curseur
    const head = pts[pts.length - 1] || null, k = Math.max(0, 1 - (now - lastMove) / 900);
    if (head && k > 0) {
      const r = 17, g = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, r);
      g.addColorStop(0, `rgba(${PINK}, ${.42 * k})`); g.addColorStop(1, `rgba(${PINK}, 0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(head.x, head.y, r, 0, Math.PI * 2); ctx.fill();
    }
    raf = (now - lastMove < 900 || pts.length > 1) ? requestAnimationFrame(draw) : (ctx.clearRect(0, 0, W, H), 0);
  }
})();
