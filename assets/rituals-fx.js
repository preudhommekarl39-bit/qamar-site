/* QAMAR — illustrations animées des rituels, dessinées en direct dans des <canvas data-scene="…">.
   Une seule boucle d'animation pour toutes les scènes ; chaque scène ne tourne que lorsqu'elle est visible. */
(function () {
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lerp = (a, b, k) => a + (b - a) * k;

  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function crescent(c, x, y, R, col) { c.save(); c.translate(x, y); c.beginPath(); c.arc(0, 0, R, Math.PI * .3, Math.PI * 1.7, false); c.arc(R * .5, 0, R * .82, Math.PI * 1.62, Math.PI * .38, true); c.closePath(); c.fillStyle = col; c.fill(); c.restore(); }
  function petal(c, x, y, s, rot, col) { c.save(); c.translate(x, y); c.rotate(rot); c.beginPath(); c.moveTo(0, 0); c.bezierCurveTo(-s * .6, -s * .3, -s * .55, -s * .95, -s * .12, -s); c.lineTo(0, -s * .84); c.lineTo(s * .12, -s); c.bezierCurveTo(s * .55, -s * .95, s * .6, -s * .3, 0, 0); c.fillStyle = col; c.fill(); c.restore(); }
  // place l'illustration à droite sur grand écran, en bas au centre sur petit
  const anchor = (w, h, right = .7) => (w > 560 ? { x: w * right, y: h } : { x: w * .5, y: h });

  /* ================= MATCHA ================= */
  const matcha = {
    init(s) {
      s.bubbles = Array.from({ length: 16 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(1.2, 3.2), v: rnd(.05, .14) }));
      s.drops = Array.from({ length: 9 }, () => ({ x: Math.random(), y: Math.random(), l: rnd(4, 9), v: rnd(.01, .04) }));
      s.leaves = Array.from({ length: 6 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(8, 15), r: rnd(0, TAU), vr: rnd(-.6, .6), vy: rnd(8, 16), ph: rnd(0, TAU) }));
      s.ice = [{ dx: -.22, dy: .1, s: .3, ph: 0 }, { dx: .16, dy: .04, s: .27, ph: 2 }, { dx: -.02, dy: .2, s: .24, ph: 4 }];
    },
    draw(c, w, h, t, s, dt) {
      const a = anchor(w, h, .72);
      const baseY0 = a.y - Math.max(22, h * .06);
      const H = Math.min(h * .62, 330, baseY0 - h * (w > 560 ? .12 : .44)), topW = H * .64, botW = topW * .76;
      const cx = a.x, base = a.y - Math.max(22, h * .06), top = base - H;
      // feuilles qui volent
      s.leaves.forEach(l => {
        l.y += l.vy * dt / h; l.r += l.vr * dt; if (l.y > 1.1) { l.y = -.1; l.x = Math.random(); }
        const x = l.x * w + Math.sin(t * .7 + l.ph) * 20, y = l.y * h;
        c.save(); c.translate(x, y); c.rotate(l.r); c.beginPath(); c.ellipse(0, 0, l.s, l.s * .45, 0, 0, TAU);
        c.fillStyle = 'rgba(126, 160, 80, .55)'; c.fill();
        c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1; c.beginPath(); c.moveTo(-l.s, 0); c.lineTo(l.s, 0); c.stroke(); c.restore();
      });
      // ombre
      const sh = c.createRadialGradient(cx, base + 6, 2, cx, base + 6, botW * .9);
      sh.addColorStop(0, 'rgba(70, 95, 40, .28)'); sh.addColorStop(1, 'rgba(70, 95, 40, 0)');
      c.fillStyle = sh; c.beginPath(); c.ellipse(cx, base + 6, botW * .9, 12, 0, 0, TAU); c.fill();
      // forme du verre
      const glass = () => { c.beginPath(); c.moveTo(cx - topW / 2, top); c.lineTo(cx + topW / 2, top); c.lineTo(cx + botW / 2, base - 14); c.quadraticCurveTo(cx + botW / 2, base, cx + botW / 2 - 14, base); c.lineTo(cx - botW / 2 + 14, base); c.quadraticCurveTo(cx - botW / 2, base, cx - botW / 2, base - 14); c.closePath(); };
      // paille (partie extérieure)
      c.save(); c.translate(cx + topW * .2, top + H * .2); c.rotate(.18);
      const strawG = c.createLinearGradient(-5, 0, 5, 0); strawG.addColorStop(0, '#E78FA9'); strawG.addColorStop(.5, '#F7C1D1'); strawG.addColorStop(1, '#D9718F');
      c.fillStyle = strawG; rr(c, -5, -H * .42, 10, H * .45, 5); c.fill(); c.restore();
      // liquide
      c.save(); glass(); c.clip();
      const level = top + H * .16;
      const lg = c.createLinearGradient(0, level, 0, base);
      lg.addColorStop(0, '#FBF6EA'); lg.addColorStop(.38, '#EEF0D6'); lg.addColorStop(.52, '#A9C77A'); lg.addColorStop(1, '#6E9A44');
      c.fillStyle = lg;
      c.beginPath(); c.moveTo(cx - topW, base + 5);
      for (let x = cx - topW; x <= cx + topW; x += 6) c.lineTo(x, level + Math.sin(x * .05 + t * 1.8) * 3 + Math.sin(x * .021 - t) * 2);
      c.lineTo(cx + topW, base + 5); c.closePath(); c.fill();
      // marbrures de lait qui tournent
      for (let k = 0; k < 5; k++) {
        const yy = lerp(level + H * .22, base - H * .1, k / 4);
        c.beginPath();
        for (let x = cx - topW / 2; x <= cx + topW / 2; x += 4) {
          const y = yy + Math.sin(x * .045 + t * (1 + k * .15) + k * 1.7) * (8 + k * 2) + Math.cos(x * .02 - t * .6 + k) * 5;
          x === cx - topW / 2 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.strokeStyle = `rgba(250, 247, 235, ${.42 - k * .06})`; c.lineWidth = 6 - k * .8; c.lineCap = 'round'; c.stroke();
      }
      // glaçons
      s.ice.forEach(i => {
        const sz = topW * i.s, x = cx + topW * i.dx, y = level + H * i.dy + Math.sin(t * 1.4 + i.ph) * 4;
        c.save(); c.translate(x, y); c.rotate(Math.sin(t * .9 + i.ph) * .12 + i.ph * .3);
        const ig = c.createLinearGradient(-sz / 2, -sz / 2, sz / 2, sz / 2);
        ig.addColorStop(0, 'rgba(255,255,255,.85)'); ig.addColorStop(.6, 'rgba(235,248,240,.45)'); ig.addColorStop(1, 'rgba(255,255,255,.7)');
        c.fillStyle = ig; rr(c, -sz / 2, -sz / 2, sz, sz, sz * .2); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.2; c.stroke();
        c.beginPath(); c.moveTo(-sz * .3, -sz * .25); c.lineTo(sz * .1, -sz * .3); c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2; c.stroke();
        c.restore();
      });
      // paille dans le liquide (décalée : réfraction)
      c.save(); c.translate(cx + topW * .2, top + H * .2); c.rotate(.18);
      c.fillStyle = 'rgba(231, 143, 169, .65)'; rr(c, -5, 0, 10, H * .72, 5); c.fill(); c.restore();
      c.restore();
      // verre : contour, reflets, logo
      glass(); c.fillStyle = 'rgba(255,255,255,.12)'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2; c.stroke();
      c.beginPath(); c.moveTo(cx - topW / 2 + 12, top + 14); c.lineTo(cx - botW / 2 + 12, base - 22);
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 5; c.lineCap = 'round'; c.stroke();
      c.beginPath(); c.ellipse(cx, top, topW / 2, 7, 0, 0, TAU); c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.stroke();
      crescent(c, cx, top + H * .58, Math.max(6, H * .045), 'rgba(196, 154, 90, .9)');
      c.font = `600 ${Math.max(8, H * .032)}px Helvetica, Arial, sans-serif`; c.textAlign = 'center'; c.fillStyle = 'rgba(196, 154, 90, .9)';
      c.fillText('Q A M A R', cx, top + H * .66);
      // buée qui coule
      s.drops.forEach(d => {
        d.y += d.v * dt; if (d.y > 1) { d.y = 0; d.x = Math.random(); }
        const y = lerp(top + 20, base - 16, d.y), half = lerp(topW, botW, d.y) / 2, x = cx - half + 8 + d.x * (half * 2 - 16);
        c.beginPath(); c.ellipse(x, y, 1.8, d.l / 2, 0, 0, TAU); c.fillStyle = 'rgba(255,255,255,.75)'; c.fill();
      });
      // scintillements
      for (let k = 0; k < 4; k++) {
        const p = (t * .5 + k * .25) % 1, x = cx + Math.cos(k * 2.1) * topW * .9, y = top + H * (.15 + k * .2), r = 3 + Math.sin(p * Math.PI) * 4;
        c.save(); c.globalAlpha = Math.sin(p * Math.PI); c.strokeStyle = '#fff'; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke(); c.restore();
      }
    }
  };

  /* ================= PARFUM ================= */
  const perfume = {
    init(s) {
      s.mist = []; s.smoke = []; s.lastSpray = 0;
      s.petals = Array.from({ length: 7 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(6, 11), r: rnd(0, TAU), vr: rnd(-.8, .8), vy: rnd(6, 14), ph: rnd(0, TAU) }));
      s.spark = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random() * .7, ph: rnd(0, TAU) }));
    },
    draw(c, w, h, t, s, dt) {
      const a = anchor(w, h, .64);
      const base = a.y - Math.max(36, h * .1), U = Math.min(h * .0055, w > 560 ? 1.15 : .95) * 100;
      // halo doré
      const halo = c.createRadialGradient(a.x, base - U * 1.2, 10, a.x, base - U * 1.2, U * 3.2);
      halo.addColorStop(0, 'rgba(232, 207, 160, .22)'); halo.addColorStop(1, 'rgba(232, 207, 160, 0)');
      c.fillStyle = halo; c.fillRect(0, 0, w, h);
      // étincelles
      s.spark.forEach(p => { const al = (Math.sin(t * 1.5 + p.ph) + 1) / 2; c.fillStyle = `rgba(255, 236, 200, ${al * .8})`; c.beginPath(); c.arc(p.x * w, p.y * h, 1.2 + al, 0, TAU); c.fill(); });
      const bottles = [
        { dx: -1.15, w: .78, h: 1.05, liq: ['#B07A4E', '#5A3420'], cap: 'facet', name: 'OUD', lvl: .62 },
        { dx: 0, w: .74, h: 1.45, liq: ['#F7B6C8', '#C9617F'], cap: 'round', name: 'ROSE', lvl: .66 },
        { dx: 1.1, w: .82, h: .95, liq: ['#FFF8F2', '#E2D3C6'], cap: 'flat', name: 'MUSK', lvl: .58 }
      ];
      const drawBottle = (b, mirror) => {
        const bw = U * b.w, bh = U * b.h, x = a.x + b.dx * U, y0 = base - bh;
        c.save();
        if (mirror) { c.translate(0, base * 2 + 4); c.scale(1, -1); c.globalAlpha = .18; }
        // verre
        const shape = () => rr(c, x - bw / 2, y0, bw, bh, bw * .22);
        shape(); const gg = c.createLinearGradient(x - bw / 2, 0, x + bw / 2, 0);
        gg.addColorStop(0, 'rgba(255,255,255,.22)'); gg.addColorStop(.3, 'rgba(255,255,255,.06)'); gg.addColorStop(.8, 'rgba(255,255,255,.1)'); gg.addColorStop(1, 'rgba(255,255,255,.28)');
        c.fillStyle = gg; c.fill();
        // liquide qui bouge
        c.save(); shape(); c.clip();
        const lv = y0 + bh * (1 - b.lvl);
        const lgq = c.createLinearGradient(0, lv, 0, base); lgq.addColorStop(0, b.liq[0]); lgq.addColorStop(1, b.liq[1]);
        c.fillStyle = lgq; c.beginPath(); c.moveTo(x - bw, base + 2);
        for (let xx = x - bw; xx <= x + bw; xx += 3) c.lineTo(xx, lv + Math.sin(xx * .08 + t * 2 + b.dx) * 2.2);
        c.lineTo(x + bw, base + 2); c.closePath(); c.fill();
        c.restore();
        shape(); c.strokeStyle = 'rgba(232, 207, 160, .55)'; c.lineWidth = 1.4; c.stroke();
        // reflet
        c.beginPath(); c.moveTo(x - bw * .32, y0 + bh * .14); c.lineTo(x - bw * .32, base - bh * .14); c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = Math.max(2, bw * .06); c.lineCap = 'round'; c.stroke();
        // étiquette
        rr(c, x - bw * .32, y0 + bh * .5, bw * .64, bh * .2, 3); c.fillStyle = 'rgba(18, 11, 15, .55)'; c.fill(); c.strokeStyle = 'rgba(232, 207, 160, .7)'; c.lineWidth = 1; c.stroke();
        c.fillStyle = '#E8CFA0'; c.font = `600 ${Math.max(7, bw * .14)}px Helvetica, Arial, sans-serif`; c.textAlign = 'center'; c.fillText(b.name, x, y0 + bh * .63);
        // col et bouchon
        const capG = c.createLinearGradient(x - bw * .3, 0, x + bw * .3, 0); capG.addColorStop(0, '#A9803F'); capG.addColorStop(.45, '#F6E1AE'); capG.addColorStop(1, '#9A7034');
        c.fillStyle = capG;
        rr(c, x - bw * .14, y0 - bh * .08, bw * .28, bh * .1, 2); c.fill();
        if (b.cap === 'round') { c.beginPath(); c.arc(x, y0 - bh * .2, bw * .22, 0, TAU); c.fill(); }
        else if (b.cap === 'facet') { c.beginPath(); c.moveTo(x - bw * .26, y0 - bh * .08); c.lineTo(x - bw * .16, y0 - bh * .32); c.lineTo(x + bw * .16, y0 - bh * .32); c.lineTo(x + bw * .26, y0 - bh * .08); c.closePath(); c.fill(); }
        else { rr(c, x - bw * .3, y0 - bh * .24, bw * .6, bh * .16, 4); c.fill(); }
        c.restore();
        return { x, top: y0 - bh * .32, bw, bh };
      };
      const tops = bottles.map(b => drawBottle(b, false));
      bottles.forEach(b => drawBottle(b, true));
      // ligne de sol
      const fl = c.createLinearGradient(a.x - U * 2.4, 0, a.x + U * 2.4, 0); fl.addColorStop(0, 'rgba(232,207,160,0)'); fl.addColorStop(.5, 'rgba(232,207,160,.45)'); fl.addColorStop(1, 'rgba(232,207,160,0)');
      c.fillStyle = fl; c.fillRect(a.x - U * 2.4, base + 1, U * 4.8, 1);
      // vaporisation du flacon rose
      if (t - s.lastSpray > 3.6) { s.lastSpray = t; for (let k = 0; k < 46; k++) s.mist.push({ x: tops[1].x - tops[1].bw * .1, y: tops[1].top + tops[1].bw * .05, vx: rnd(-90, -30), vy: rnd(-60, -10), r: rnd(2, 6), life: 0, max: rnd(1.4, 2.6) }); }
      s.mist = s.mist.filter(m => (m.life += dt) < m.max);
      s.mist.forEach(m => {
        m.x += m.vx * dt; m.y += m.vy * dt; m.vx *= .985; m.vy = m.vy * .985 - 4 * dt; m.r += 9 * dt;
        const al = (1 - m.life / m.max) * .35;
        const g = c.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r); g.addColorStop(0, `rgba(255, 210, 225, ${al})`); g.addColorStop(1, 'rgba(255, 210, 225, 0)');
        c.fillStyle = g; c.beginPath(); c.arc(m.x, m.y, m.r, 0, TAU); c.fill();
      });
      // fumée d'oud
      if (Math.random() < dt * 3) s.smoke.push({ life: 0, max: rnd(3, 4.5), ph: rnd(0, TAU), x: tops[0].x });
      s.smoke = s.smoke.filter(m => (m.life += dt) < m.max);
      s.smoke.forEach(m => {
        const k = m.life / m.max; c.beginPath();
        for (let i = 0; i <= 20; i++) { const q = i / 20, y = tops[0].top - 6 - q * U * 1.6 * (.4 + k), x = m.x + Math.sin(q * 6 + t * 1.2 + m.ph) * (6 + q * 18) * (.5 + k); i ? c.lineTo(x, y) : c.moveTo(x, y); }
        c.strokeStyle = `rgba(232, 207, 160, ${(1 - k) * .28})`; c.lineWidth = 1.6; c.stroke();
      });
      // pétales
      s.petals.forEach(p => { p.y += p.vy * dt / h; p.r += p.vr * dt; if (p.y > 1.1) { p.y = -.1; p.x = Math.random(); } petal(c, p.x * w + Math.sin(t * .6 + p.ph) * 18, p.y * h, p.s, p.r, 'rgba(242, 160, 186, .7)'); });
    }
  };

  /* ================= PHOTOS ================= */
  const photo = {
    init(s) {
      s.cards = []; s.last = -10; s.flash = 0;
      s.petals = Array.from({ length: 9 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(6, 11), r: rnd(0, TAU), vr: rnd(-.8, .8), vy: rnd(8, 16), ph: rnd(0, TAU) }));
    },
    draw(c, w, h, t, s, dt) {
      const big = w > 760;
      const cx = big ? w * .74 : w * .5, base = h, R = big ? Math.min(h * .42, 230) : Math.min(w * .36, 150);
      // arches lumineuses
      for (let i = 0; i < 4; i++) {
        const r = R * (1 - i * .22), hgt = r * 2.2, yTop = base - hgt;
        const path = () => { c.beginPath(); c.moveTo(cx - r, base); c.lineTo(cx - r, yTop + r); c.arc(cx, yTop + r, r, Math.PI, 0); c.lineTo(cx + r, base); };
        path(); const g = c.createLinearGradient(0, base, 0, yTop); g.addColorStop(0, 'rgba(217,150,166,.25)'); g.addColorStop(1, 'rgba(244,206,170,.95)');
        c.strokeStyle = g; c.lineWidth = 2.2 - i * .3; c.shadowColor = 'rgba(255, 190, 210, .9)'; c.shadowBlur = 16; c.stroke(); c.shadowBlur = 0;
        path(); c.setLineDash([r * .3, r * 3]); c.lineDashOffset = -t * r * .6 - i * 40; c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 2.4; c.stroke(); c.setLineDash([]);
      }
      // flash + polaroid
      if (t - s.last > 3.2) { s.last = t; s.flash = 1; s.cards.push({ born: t, x: cx + rnd(-R * .5, R * .5), rot: rnd(-.25, .25), tx: cx + rnd(-R * 1.4, R * 1.1), ty: base - R * rnd(1.1, 2) , hue: Math.floor(rnd(0, 3)) }); if (s.cards.length > 4) s.cards.shift(); }
      s.cards.forEach(cd => {
        const k = Math.min(1, (t - cd.born) / 1.4), e = 1 - Math.pow(1 - k, 3);
        const x = lerp(cx, cd.tx, e), y = lerp(base + 40, cd.ty, e) + Math.sin(t + cd.born) * 4, cw = big ? 78 : 60, ch = cw * 1.18;
        c.save(); c.translate(x, y); c.rotate(cd.rot * e + Math.sin(t * .8 + cd.born) * .04);
        c.shadowColor = 'rgba(120, 60, 80, .25)'; c.shadowBlur = 16; c.shadowOffsetY = 8;
        c.fillStyle = '#fff'; rr(c, -cw / 2, -ch / 2, cw, ch, 3); c.fill(); c.shadowColor = 'transparent';
        const tones = [['#FBD3DF', '#E59AB0'], ['#F8E0CC', '#E3AE88'], ['#EAD6F0', '#C79BD3']][cd.hue];
        const pg = c.createLinearGradient(0, -ch / 2, 0, ch * .2); pg.addColorStop(0, tones[0]); pg.addColorStop(1, tones[1]);
        c.fillStyle = pg; c.fillRect(-cw / 2 + 5, -ch / 2 + 5, cw - 10, cw - 10);
        // silhouette : tête + cheveux
        c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(0, -ch / 2 + cw * .42, cw * .14, 0, TAU); c.fill();
        c.beginPath(); c.ellipse(0, -ch / 2 + cw * .82, cw * .26, cw * .18, 0, Math.PI, 0); c.fill();
        crescent(c, cw * .28, -ch / 2 + cw * .2, 4, 'rgba(255,255,255,.8)');
        c.restore();
      });
      if (s.flash > 0) { c.fillStyle = `rgba(255,255,255,${s.flash * .55})`; c.fillRect(0, 0, w, h); s.flash = Math.max(0, s.flash - dt * 2.4); }
      s.petals.forEach(p => { p.y += p.vy * dt / h; p.r += p.vr * dt; if (p.y > 1.1) { p.y = -.1; p.x = Math.random(); } petal(c, p.x * w + Math.sin(t * .6 + p.ph) * 18, p.y * h, p.s, p.r, 'rgba(236, 143, 171, .55)'); });
    }
  };

  /* ================= MIROIR INFINI ================= */
  const mirror = {
    init(s) {
      s.flash = 0; s.lastFlash = 0;
      s.petals = Array.from({ length: 10 }, () => ({ x: Math.random(), y: Math.random(), s: rnd(6, 11), r: rnd(0, TAU), vr: rnd(-.8, .8), vy: rnd(8, 16), ph: rnd(0, TAU) }));
    },
    draw(c, w, h, t, s, dt) {
      const big = w > 760;
      const MW = big ? Math.min(h * .56, w * .36, 330) : Math.min(w * .78, 300);
      const MH = MW * 1.5, cx = big ? w * .7 : w * .5, base = h - (big ? 34 : 26), top = base - MH, r = MW / 2;
      const arch = (x, y0, ww, hh) => { const rr2 = ww / 2; c.beginPath(); c.moveTo(x - rr2, y0 + hh); c.lineTo(x - rr2, y0 + rr2); c.arc(x, y0 + rr2, rr2, Math.PI, 0); c.lineTo(x + rr2, y0 + hh); c.closePath(); };
      // ombre portée et halo rose autour du miroir
      const halo = c.createRadialGradient(cx, top + MH * .45, MW * .2, cx, top + MH * .45, MW * 1.1);
      halo.addColorStop(0, 'rgba(255, 170, 200, .35)'); halo.addColorStop(1, 'rgba(255, 170, 200, 0)');
      c.fillStyle = halo; c.fillRect(0, 0, w, h);
      // intérieur du miroir : profondeur sombre et rosée
      c.save(); arch(cx, top, MW, MH); c.clip();
      const vx = cx, vy = top + MH * .42;
      const deep = c.createRadialGradient(vx, vy, 2, vx, vy, MH * .9);
      deep.addColorStop(0, '#FFE3EC'); deep.addColorStop(.18, '#C9708F'); deep.addColorStop(.55, '#4A2232'); deep.addColorStop(1, '#2A1520');
      c.fillStyle = deep; c.fillRect(cx - MW, top, MW * 2, MH);
      // sol réfléchissant
      const floor = c.createLinearGradient(0, vy, 0, base); floor.addColorStop(0, 'rgba(255,255,255,0)'); floor.addColorStop(1, 'rgba(255, 200, 220, .18)');
      c.fillStyle = floor; c.fillRect(cx - MW, vy, MW * 2, base - vy);
      // tunnel infini d'arches de LED
      const N = 15, k = .8, phase = (t * .18) % 1;
      for (let i = N - 1; i >= 0; i--) {
        const sc = Math.pow(k, i + 1 - phase);
        const aw = MW * .9 * sc, ah = MH * .9 * sc;
        const ax = lerp(vx, cx, sc), ay = lerp(vy, top + MH * .05, sc) ;
        const depthA = Math.min(1, sc * 1.6) * (i === 0 ? Math.min(1, (1 - phase) * 3) : 1);
        // contour doux
        arch(ax, ay, aw, ah);
        c.strokeStyle = `rgba(255, 196, 214, ${.22 * depthA})`; c.lineWidth = Math.max(.6, 3 * sc); c.stroke();
        // points LED le long de l'arche
        const rad = aw / 2, cyA = ay + rad, n = Math.max(10, Math.round(46 * sc + 10));
        const perim = Math.PI * rad + 2 * (ah - rad), step = perim / n;
        for (let j = 0; j < n; j++) {
          let d = j * step, px, py;
          const side = ah - rad;
          if (d < side) { px = ax - rad; py = ay + ah - d; }
          else if (d < side + Math.PI * rad) { const a2 = Math.PI + (d - side) / rad; px = ax + Math.cos(a2) * rad; py = cyA + Math.sin(a2) * rad; }
          else { px = ax + rad; py = cyA + (d - side - Math.PI * rad); }
          const wave = .5 + .5 * Math.sin(i * .9 - t * 3.2 + j * .35);
          const al = depthA * (.35 + .65 * wave);
          const pr = Math.max(.6, 2.4 * sc);
          c.fillStyle = `rgba(255, ${Math.round(228 - wave * 30)}, ${Math.round(236 - wave * 10)}, ${al})`;
          c.shadowColor = 'rgba(255, 190, 215, .9)'; c.shadowBlur = 8 * sc;
          c.beginPath(); c.arc(px, py, pr, 0, TAU); c.fill();
        }
        c.shadowBlur = 0;
        // croissant de lune en néon à la clé de chaque arche
        if (sc > .12) {
          const R = Math.max(2, 9 * sc);
          c.save(); c.shadowColor = '#FF8FB4'; c.shadowBlur = 14 * sc;
          crescent(c, ax, ay + R * 2.4, R, `rgba(255, 170, 205, ${depthA})`);
          c.restore();
        }
      }
      // reflet de la cliente qui prend un selfie
      const sx = cx - MW * .04, sy = base, S = MH * .44;
      const sway = Math.sin(t * 1.2) * S * .015;
      const body = c.createLinearGradient(0, sy - S * .6, 0, sy);
      body.addColorStop(0, 'rgba(58, 26, 40, .92)'); body.addColorStop(1, 'rgba(30, 12, 22, .95)');
      c.fillStyle = body; c.strokeStyle = 'rgba(255, 190, 214, .55)'; c.lineWidth = 1.2;
      // épaules et buste
      c.beginPath();
      c.moveTo(sx - S * .34, sy);
      c.bezierCurveTo(sx - S * .33, sy - S * .16, sx - S * .22, sy - S * .24, sx - S * .07, sy - S * .26);
      c.lineTo(sx - S * .055, sy - S * .33); c.lineTo(sx + S * .055, sy - S * .33); c.lineTo(sx + S * .07, sy - S * .26);
      c.bezierCurveTo(sx + S * .22, sy - S * .24, sx + S * .33, sy - S * .16, sx + S * .34, sy);
      c.closePath(); c.fill(); c.stroke();
      // cheveux : brushing ondulé qui tombe sur les épaules
      c.beginPath();
      c.moveTo(sx, sy - S * .56);
      c.bezierCurveTo(sx - S * .15, sy - S * .56, sx - S * .17, sy - S * .42, sx - S * .15, sy - S * .34);
      c.bezierCurveTo(sx - S * .13 + sway, sy - S * .26, sx - S * .2 + sway, sy - S * .2, sx - S * .16 + sway, sy - S * .12);
      c.bezierCurveTo(sx - S * .13 + sway, sy - S * .07, sx - S * .19 + sway, sy - S * .03, sx - S * .14 + sway, sy - S * .02);
      c.bezierCurveTo(sx - S * .09, sy - S * .1, sx - S * .1, sy - S * .2, sx - S * .085, sy - S * .3);
      c.lineTo(sx + S * .085, sy - S * .3);
      c.bezierCurveTo(sx + S * .1, sy - S * .2, sx + S * .09, sy - S * .1, sx + S * .14 - sway, sy - S * .02);
      c.bezierCurveTo(sx + S * .19 - sway, sy - S * .03, sx + S * .13 - sway, sy - S * .07, sx + S * .16 - sway, sy - S * .12);
      c.bezierCurveTo(sx + S * .2 - sway, sy - S * .2, sx + S * .13 - sway, sy - S * .26, sx + S * .15, sy - S * .34);
      c.bezierCurveTo(sx + S * .17, sy - S * .42, sx + S * .15, sy - S * .56, sx, sy - S * .56);
      c.closePath(); c.fill(); c.stroke();
      // visage (ovale plus clair, sans traits)
      c.fillStyle = 'rgba(92, 46, 62, .9)'; c.beginPath(); c.ellipse(sx, sy - S * .42, S * .07, S * .09, 0, 0, TAU); c.fill();
      // bras levé et téléphone à l'écran rose
      c.strokeStyle = 'rgba(40, 16, 28, .95)'; c.lineWidth = S * .05; c.lineCap = 'round';
      c.beginPath(); c.moveTo(sx + S * .28, sy - S * .12); c.quadraticCurveTo(sx + S * .4, sy - S * .3, sx + S * .3, sy - S * .48); c.stroke();
      c.fillStyle = 'rgba(20, 8, 14, .95)'; rr(c, sx + S * .24, sy - S * .64, S * .11, S * .19, 3); c.fill();
      c.fillStyle = 'rgba(255, 170, 205, .85)'; rr(c, sx + S * .25, sy - S * .63, S * .09, S * .17, 2); c.fill();
      // flash du selfie
      if (t - s.lastFlash > 4) { s.lastFlash = t; s.flash = 1; }
      if (s.flash > 0) {
        const fx = sx + S * .3, fy = sy - S * .56;
        const fg = c.createRadialGradient(fx, fy, 0, fx, fy, MW * .9);
        fg.addColorStop(0, `rgba(255,255,255,${s.flash})`); fg.addColorStop(.25, `rgba(255,240,246,${s.flash * .5})`); fg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = fg; c.fillRect(cx - MW, top, MW * 2, MH);
        s.flash = Math.max(0, s.flash - dt * 2.2);
      }
      // pétales dans le reflet (plus pâles)
      s.petals.forEach(p => petal(c, cx + (p.x - .5) * MW * .8 + Math.sin(t * .6 + p.ph) * 10, top + p.y * MH, p.s * .6, -p.r, 'rgba(255, 200, 220, .35)'));
      // reflet de verre en diagonale
      const gl = c.createLinearGradient(cx - r, top, cx + r, top + MH);
      gl.addColorStop(0, 'rgba(255,255,255,.18)'); gl.addColorStop(.35, 'rgba(255,255,255,0)'); gl.addColorStop(.6, 'rgba(255,255,255,0)'); gl.addColorStop(.7, 'rgba(255,255,255,.07)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gl; c.fillRect(cx - MW, top, MW * 2, MH);
      c.restore();
      // cadre doré
      const gold = c.createLinearGradient(cx - r, top, cx + r, base);
      gold.addColorStop(0, '#A9803F'); gold.addColorStop(.3, '#F6E1AE'); gold.addColorStop(.55, '#B88A48'); gold.addColorStop(.8, '#F2DCA4'); gold.addColorStop(1, '#9A7034');
      arch(cx, top, MW, MH); c.strokeStyle = gold; c.lineWidth = Math.max(6, MW * .035); c.stroke();
      arch(cx, top - MW * .03, MW * 1.06, MH * 1.03); c.strokeStyle = 'rgba(196, 154, 90, .5)'; c.lineWidth = 1.5; c.stroke();
      // ampoules Hollywood autour du cadre
      const bulbs = 17, R2 = MW * .53, cyF = top + r;
      for (let b = 0; b < bulbs; b++) {
        let bx, by;
        const frac = b / (bulbs - 1);
        if (frac < .25) { bx = cx - R2; by = base - (frac / .25) * (MH - r); }
        else if (frac > .75) { bx = cx + R2; by = cyF + ((frac - .75) / .25) * (MH - r); }
        else { const a2 = Math.PI + ((frac - .25) / .5) * Math.PI; bx = cx + Math.cos(a2) * R2; by = cyF + Math.sin(a2) * R2; }
        const tw = .6 + .4 * Math.sin(t * 2.4 + b * 1.7);
        const bg = c.createRadialGradient(bx, by, 0, bx, by, MW * .07);
        bg.addColorStop(0, `rgba(255, 246, 225, ${tw})`); bg.addColorStop(.35, `rgba(255, 214, 170, ${tw * .6})`); bg.addColorStop(1, 'rgba(255, 214, 170, 0)');
        c.fillStyle = bg; c.beginPath(); c.arc(bx, by, MW * .07, 0, TAU); c.fill();
        c.fillStyle = `rgba(255, 252, 240, ${.7 + tw * .3})`; c.beginPath(); c.arc(bx, by, Math.max(2.5, MW * .018), 0, TAU); c.fill();
      }
      // pétales devant le miroir
      s.petals.forEach(p => { p.y += p.vy * dt / h; p.r += p.vr * dt; if (p.y > 1.1) { p.y = -.1; p.x = Math.random(); } petal(c, p.x * w + Math.sin(t * .6 + p.ph) * 18, p.y * h, p.s, p.r, 'rgba(236, 143, 171, .6)'); });
    }
  };

  /* ================= BAC À SHAMPOING ================= */
  const goldGrad = (c, x0, x1) => { const g = c.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, '#9A7034'); g.addColorStop(.35, '#F6E1AE'); g.addColorStop(.6, '#B88A48'); g.addColorStop(1, '#8E6A30'); return g; };
  const wash = {
    init(s) { s.ripples = []; s.bubbles = []; s.steam = []; s.lastRip = 0; },
    draw(c, w, h, t, s, dt) {
      const ground = h - 22, cx = w * .5, U = Math.min(w, 380) / 380;
      // fauteuil en velours rose capitonné
      const chX = cx - w * .44, chW = w * .5, chY = ground - h * .36;
      const vel = c.createLinearGradient(chX, chY, chX + chW, ground); vel.addColorStop(0, '#F5B4C7'); vel.addColorStop(.6, '#DE8AA4'); vel.addColorStop(1, '#C26F8A');
      const chH = ground - chY;
      const chair = () => { c.beginPath(); c.moveTo(chX, ground); c.lineTo(chX, chY + 40 * U); c.quadraticCurveTo(chX, chY, chX + 40 * U, chY); c.lineTo(chX + chW * .62, chY + chH * .2); c.quadraticCurveTo(chX + chW, chY + chH * .3, chX + chW, chY + chH * .58); c.lineTo(chX + chW, ground); c.closePath(); };
      c.save(); c.shadowColor = 'rgba(160, 70, 100, .25)'; c.shadowBlur = 16; c.shadowOffsetY = 6; chair(); c.fillStyle = vel; c.fill(); c.restore();
      c.save(); chair(); c.clip();
      for (let k = 1; k < 5; k++) { const x = chX + chW * k / 5; c.beginPath(); c.moveTo(x, chY + 16); c.quadraticCurveTo(x + 4, (chY + ground) / 2, x, ground - 10); c.strokeStyle = 'rgba(255, 220, 230, .45)'; c.lineWidth = 2; c.stroke(); }
      for (let k = 0; k < 4; k++) for (let j = 1; j < 5; j++) { c.fillStyle = 'rgba(160, 70, 100, .35)'; c.beginPath(); c.arc(chX + chW * (k + .5) / 4, chY + (ground - chY) * j / 5, 2.2, 0, TAU); c.fill(); }
      const vs = c.createLinearGradient(chX, 0, chX + chW, 0); vs.addColorStop(0, 'rgba(255,255,255,.25)'); vs.addColorStop(.4, 'rgba(255,255,255,0)'); c.fillStyle = vs; c.fillRect(chX, chY, chW, chH);
      c.restore();
      // vasque noire laquée sur pied doré
      const bx = cx + w * .14, rimY = ground - h * .25, bw = w * .48, bh = bw * .32;
      c.fillStyle = goldGrad(c, bx - 8, bx + 8); c.fillRect(bx - 7 * U, rimY + bh * .4, 14 * U, ground - rimY - bh * .4);
      c.beginPath(); c.ellipse(bx, ground, 34 * U, 6, 0, 0, TAU); c.fillStyle = '#B88A48'; c.fill();
      const lac = c.createLinearGradient(0, rimY, 0, rimY + bh); lac.addColorStop(0, '#3A2C32'); lac.addColorStop(1, '#0B0809');
      c.fillStyle = lac; c.beginPath(); c.moveTo(bx - bw / 2, rimY); c.bezierCurveTo(bx - bw / 2, rimY + bh * 1.2, bx + bw / 2, rimY + bh * 1.2, bx + bw / 2, rimY); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(bx - bw * .38, rimY + bh * .25); c.quadraticCurveTo(bx - bw * .1, rimY + bh * .7, bx + bw * .1, rimY + bh * .72); c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = 3; c.stroke();
      c.beginPath(); c.ellipse(bx, rimY, bw / 2, bh * .26, 0, 0, TAU); c.fillStyle = '#1A1215'; c.fill(); c.strokeStyle = 'rgba(255, 220, 230, .6)'; c.lineWidth = 1.5; c.stroke();
      // eau dans la vasque
      c.save(); c.beginPath(); c.ellipse(bx, rimY + 2, bw / 2 - 8, bh * .26 - 5, 0, 0, TAU); c.clip();
      const wg = c.createLinearGradient(0, rimY - bh * .3, 0, rimY + bh * .3); wg.addColorStop(0, '#F3E4EC'); wg.addColorStop(1, '#C9DDE8');
      c.fillStyle = wg; c.fillRect(bx - bw, rimY - bh, bw * 2, bh * 2);
      // robinet : point d'arrivée de l'eau
      const fx = bx + bw * .06, fy = rimY - h * .2;
      if (t - s.lastRip > .45) { s.lastRip = t; s.ripples.push({ age: 0 }); }
      s.ripples = s.ripples.filter(r => (r.age += dt) < 1.8);
      s.ripples.forEach(r => { const k = r.age / 1.8, R = 4 + k * bw * .35; c.beginPath(); c.ellipse(fx, rimY + 2, R, R * .26, 0, 0, TAU); c.strokeStyle = `rgba(255,255,255,${(1 - k) * .9})`; c.lineWidth = 1.4; c.stroke(); });
      c.restore();
      // robinet col de cygne doré
      const px = bx + bw * .36;
      c.strokeStyle = goldGrad(c, px - 10, px + 10); c.lineWidth = 8 * U; c.lineCap = 'round';
      c.beginPath(); c.moveTo(px, rimY - 2); c.lineTo(px, fy - 10 * U); c.quadraticCurveTo(px, fy - 34 * U, px - 24 * U, fy - 34 * U); c.quadraticCurveTo(fx, fy - 34 * U, fx, fy - 6 * U); c.stroke();
      c.fillStyle = '#F6E1AE'; c.beginPath(); c.arc(px + 9 * U, rimY - 14 * U, 5 * U, 0, TAU); c.fill();
      // filet d'eau scintillant
      const sg = c.createLinearGradient(0, fy, 0, rimY); sg.addColorStop(0, 'rgba(220, 240, 250, .95)'); sg.addColorStop(1, 'rgba(190, 225, 240, .8)');
      c.beginPath(); c.moveTo(fx, fy - 4); for (let y = fy - 4; y <= rimY; y += 3) c.lineTo(fx + Math.sin(y * .25 + t * 14) * .8, y);
      c.strokeStyle = sg; c.lineWidth = 3.6 * U; c.lineCap = 'round'; c.stroke();
      c.setLineDash([4, 10]); c.lineDashOffset = -t * 90; c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = 1.4; c.stroke(); c.setLineDash([]);
      // bulles irisées
      if (Math.random() < dt * 4) s.bubbles.push({ x: bx + rnd(-bw * .3, bw * .3), y: rimY - 4, r: rnd(4, 10) * U, vx: rnd(-8, 8), vy: rnd(-30, -16), life: 0, max: rnd(2.5, 4.5), ph: rnd(0, TAU) });
      s.bubbles = s.bubbles.filter(b => (b.life += dt) < b.max);
      s.bubbles.forEach(b => {
        b.x += (b.vx + Math.sin(t * 2 + b.ph) * 8) * dt; b.y += b.vy * dt;
        const al = Math.min(1, b.life * 2) * (1 - b.life / b.max);
        const g = c.createRadialGradient(b.x - b.r * .3, b.y - b.r * .3, 0, b.x, b.y, b.r);
        g.addColorStop(0, `rgba(255,255,255,${al * .1})`); g.addColorStop(.7, `rgba(255, 210, 235, ${al * .25})`); g.addColorStop(.9, `rgba(180, 220, 255, ${al * .55})`); g.addColorStop(1, `rgba(255,255,255,${al * .1})`);
        c.fillStyle = g; c.beginPath(); c.arc(b.x, b.y, b.r, 0, TAU); c.fill();
        c.fillStyle = `rgba(255,255,255,${al * .9})`; c.beginPath(); c.arc(b.x - b.r * .35, b.y - b.r * .35, b.r * .2, 0, TAU); c.fill();
      });
      // vapeur douce
      if (Math.random() < dt * 3) s.steam.push({ x: bx + rnd(-bw * .25, bw * .2), y: rimY - 6, r: rnd(10, 18) * U, life: 0, max: rnd(2.5, 3.5) });
      s.steam = s.steam.filter(p => (p.life += dt) < p.max);
      s.steam.forEach(p => { p.y -= 22 * dt; p.x += Math.sin(t + p.r) * 6 * dt; p.r += 8 * dt; const al = Math.sin(Math.PI * p.life / p.max) * .32; const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(255,255,255,${al})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); });
      // serviettes roulées
      const tw = 46 * U, th = 22 * U, tx = cx - w * .3;
      [[0, 0, '#FFFFFF'], [tw * .96, 0, '#FBE3EA'], [tw * .48, -th * .9, '#FFF6F8']].forEach(([dx, dy, col], i) => {
        const x = tx + dx, y = ground - th / 2 + dy - 2;
        c.fillStyle = col; rr(c, x - tw / 2, y - th / 2, tw, th, th / 2); c.fill(); c.strokeStyle = 'rgba(201, 120, 143, .25)'; c.lineWidth = 1; c.stroke();
        c.beginPath(); c.ellipse(x + tw / 2 - th * .3, y, th * .32, th * .48, 0, 0, TAU); c.fillStyle = 'rgba(240, 210, 220, .9)'; c.fill();
        c.beginPath(); for (let a = 0; a < TAU * 1.6; a += .2) { const rr3 = 1 + a * th * .045; c.lineTo(x + tw / 2 - th * .3 + Math.cos(a) * rr3 * .65, y + Math.sin(a) * rr3); } c.strokeStyle = 'rgba(190, 120, 145, .5)'; c.stroke();
        if (i === 2) crescent(c, x - tw * .1, y, 4 * U, '#C49A5A');
      });
    }
  };

  /* ================= BAR À HIJAB ================= */
  const hijab = {
    init(s) { s.puffs = []; },
    draw(c, w, h, t, s, dt) {
      const rodY = h * .45, rx0 = w * .1, rx1 = w * .86, ground = h - 20;
      const sheenX = ((t * .35) % 1.6 - .3);
      const panels = [
        { x0: w * .15, x1: w * .47, len: h * .44, ph: 0, cols: ['#F9CFDB', '#EA9AB2', '#D9799A'] },
        { x0: w * .42, x1: w * .76, len: h * .4, ph: 1.6, cols: ['#FFF0F4', '#F6CBD7', '#E9AEC0'] }
      ];
      panels.forEach((p, idx) => {
        const top = rodY + 3, bot = top + p.len, wdt = p.x1 - p.x0;
        const sway = y => Math.sin(t * 1.15 + p.ph) * 9 * Math.pow((y - top) / p.len, 1.6);
        const edgeL = y => p.x0 + sway(y) + Math.sin((y - top) * .05 + p.ph) * 2 * ((y - top) / p.len);
        const edgeR = y => p.x1 + sway(y) - Math.sin((y - top) * .05 + p.ph + 1) * 2 * ((y - top) / p.len);
        const hem = x => bot + Math.sin((x - p.x0) * .09 + t * 1.6 + p.ph) * 5 + Math.sin((x - p.x0) * .035) * 6;
        const shape = () => {
          c.beginPath(); c.moveTo(p.x0, top);
          for (let y = top; y <= bot; y += 6) c.lineTo(edgeL(y), y);
          for (let x = edgeL(bot); x <= edgeR(bot); x += 5) c.lineTo(x, hem(x - sway(bot)));
          for (let y = bot; y >= top; y -= 6) c.lineTo(edgeR(y), y);
          c.closePath();
        };
        c.save(); c.shadowColor = 'rgba(180, 90, 120, .25)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
        shape(); const g = c.createLinearGradient(0, top, 0, bot); g.addColorStop(0, p.cols[0]); g.addColorStop(.6, p.cols[1]); g.addColorStop(1, p.cols[2]); c.fillStyle = g; c.fill(); c.restore();
        c.save(); shape(); c.clip();
        // plis verticaux
        const folds = 6;
        for (let k = 0; k < folds; k++) {
          const fx = p.x0 + wdt * (k + .5) / folds;
          c.beginPath();
          for (let y = top; y <= bot + 10; y += 6) { const x = fx + sway(y) + Math.sin(y * .02 + k + t * .8) * 3; y === top ? c.moveTo(x, y) : c.lineTo(x, y); }
          c.strokeStyle = k % 2 ? 'rgba(255,255,255,.45)' : 'rgba(150, 60, 90, .16)'; c.lineWidth = wdt / folds * .45; c.stroke();
        }
        // reflet satiné qui glisse
        const sx = p.x0 + wdt * sheenX;
        const sh = c.createLinearGradient(sx - 30, top, sx + 30, bot); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.5, 'rgba(255,255,255,.4)'); sh.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = sh; c.fillRect(p.x0 - 20, top, wdt + 40, p.len + 20);
        c.restore();
        // perles au bas du premier voile
        if (idx === 0) for (let k = 0; k < 5; k++) { const x = p.x0 + wdt * (k + .5) / 5 + sway(bot); const y = hem(x - sway(bot)) + 7; c.strokeStyle = 'rgba(196,154,90,.7)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x, y - 7); c.lineTo(x, y); c.stroke(); const pg = c.createRadialGradient(x - 1, y - 1, .5, x, y, 3.6); pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#E6D8D0'); c.fillStyle = pg; c.beginPath(); c.arc(x, y + 2, 3.4, 0, TAU); c.fill(); }
      });
      // barre dorée avec embouts
      c.fillStyle = goldGrad(c, rx0, rx1); rr(c, rx0, rodY - 4, rx1 - rx0, 8, 4); c.fill();
      [rx0, rx1].forEach(x => { const g = c.createRadialGradient(x - 2, rodY - 2, 1, x, rodY, 9); g.addColorStop(0, '#FFF2CF'); g.addColorStop(1, '#A9803F'); c.fillStyle = g; c.beginPath(); c.arc(x, rodY, 8, 0, TAU); c.fill(); });
      // défroisseur vapeur
      const stx = w * .88, sty = ground;
      c.fillStyle = '#FFF6F8'; rr(c, stx - 16, sty - 46, 32, 46, 10); c.fill(); c.strokeStyle = 'rgba(201,120,143,.35)'; c.stroke();
      c.fillStyle = '#F2A9BF'; rr(c, stx - 16, sty - 18, 32, 8, 3); c.fill();
      const hx = w * .8 + Math.sin(t * 1.3) * 4, hy = h * .66 + Math.cos(t * 1.1) * 4;
      c.beginPath(); c.moveTo(stx, sty - 46); c.bezierCurveTo(stx + 20, sty - 90, hx + 30, hy + 40, hx + 6, hy + 10); c.strokeStyle = 'rgba(160, 120, 130, .7)'; c.lineWidth = 3; c.stroke();
      c.save(); c.translate(hx, hy); c.rotate(-.5); c.fillStyle = goldGrad(c, -6, 6); rr(c, -6, -4, 12, 22, 4); c.fill(); c.fillStyle = '#FFFFFF'; rr(c, -9, -12, 18, 10, 4); c.fill(); c.restore();
      if (Math.random() < dt * 9) s.puffs.push({ x: hx - 10, y: hy - 12, vx: rnd(-40, -20), vy: rnd(-26, -10), r: rnd(6, 10), life: 0, max: rnd(1.2, 2) });
      s.puffs = s.puffs.filter(p => (p.life += dt) < p.max);
      s.puffs.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.r += 12 * dt; const al = Math.sin(Math.PI * p.life / p.max) * .5; const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r); g.addColorStop(0, `rgba(255,255,255,${al})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); });
      // coupelle dorée : épingles perle et aimant QAMAR
      const dx = w * .14, dy = ground - 6;
      c.beginPath(); c.ellipse(dx, dy, 30, 9, 0, 0, TAU); c.fillStyle = goldGrad(c, dx - 30, dx + 30); c.fill();
      c.beginPath(); c.ellipse(dx, dy - 2, 24, 6, 0, 0, TAU); c.fillStyle = '#F4DDB0'; c.fill();
      [[-12, -5], [-2, -7], [8, -5]].forEach(([ox, oy], i) => { const pg = c.createRadialGradient(dx + ox - 1, dy + oy - 1, .5, dx + ox, dy + oy, 4.5); pg.addColorStop(0, '#fff'); pg.addColorStop(1, i === 1 ? '#F2B4C6' : '#E6D8D0'); c.fillStyle = pg; c.beginPath(); c.arc(dx + ox, dy + oy, 4.2, 0, TAU); c.fill(); });
      c.fillStyle = '#1F1417'; c.beginPath(); c.arc(dx + 18, dy - 6, 6, 0, TAU); c.fill(); crescent(c, dx + 18, dy - 6, 3.4, '#E8CFA0');
    }
  };

  /* ================= SALLE DE PRIÈRE ================= */
  const prayer = {
    init(s) { s.motes = Array.from({ length: 22 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(.6, 1.8), ph: rnd(0, TAU), sp: rnd(.2, .6) })); },
    draw(c, w, h, t, s) {
      const ground = h - 18, cx = w * .5;
      const AW = Math.min(w * .62, (ground - h * .14 - h * .42) / 1.5);
      const spring = ground - h * .14 - AW * .6, apex = spring - AW * .866, L = cx - AW / 2, R = cx + AW / 2;
      const mihrab = (inset = 0) => { const l = L + inset, r = R - inset, aw = r - l; c.beginPath(); c.moveTo(l, ground - h * .14); c.lineTo(l, spring); c.arc(r, spring, aw, Math.PI, Math.PI * 1.3333, false); c.arc(l, spring, aw, Math.PI * 1.6667, TAU, false); c.lineTo(r, ground - h * .14); c.closePath(); };
      // niche profonde
      mihrab(); const ng = c.createLinearGradient(0, apex, 0, ground); ng.addColorStop(0, '#E7A7B9'); ng.addColorStop(.55, '#C47A93'); ng.addColorStop(1, '#8E5068'); c.fillStyle = ng; c.fill();
      // alvéoles (muqarnas) en haut
      c.save(); mihrab(); c.clip();
      for (let row = 0; row < 3; row++) for (let k = -3; k <= 3; k++) { const x = cx + k * AW * .16 + (row % 2) * AW * .08, y = apex + AW * (.2 + row * .14); c.beginPath(); c.arc(x, y, AW * .08, Math.PI, 0); c.strokeStyle = `rgba(255, 228, 200, ${.45 - row * .1})`; c.lineWidth = 1.2; c.stroke(); }
      // rayon de lumière depuis la lanterne
      const lx = cx + Math.sin(t * 1.1) * AW * .05, ly = spring + AW * .08;
      const ray = c.createLinearGradient(0, ly, 0, ground); ray.addColorStop(0, 'rgba(255, 226, 170, .55)'); ray.addColorStop(1, 'rgba(255, 226, 170, 0)');
      c.fillStyle = ray; c.beginPath(); c.moveTo(lx - AW * .08, ly); c.lineTo(lx + AW * .08, ly); c.lineTo(cx + AW * .45, ground); c.lineTo(cx - AW * .45, ground); c.closePath(); c.fill();
      c.restore();
      // liseré doré double + points
      mihrab(); c.strokeStyle = goldGrad(c, L, R); c.lineWidth = 5; c.stroke();
      mihrab(-9); c.strokeStyle = 'rgba(196, 154, 90, .55)'; c.lineWidth = 1.5; c.stroke();
      for (let k = 0; k < 9; k++) { const y = lerp(ground - h * .14, spring, k / 8); [L - 4.5, R + 4.5].forEach(x => { c.fillStyle = '#E8CFA0'; c.beginPath(); c.arc(x, y, 1.6, 0, TAU); c.fill(); }); }
      // lanterne qui se balance (suspendue à la clé)
      const sw = Math.sin(t * 1.1) * .07, Lh = AW * .55, lw = Lh * .42;
      c.save(); c.translate(cx, apex + AW * .12); c.rotate(sw);
      c.strokeStyle = 'rgba(169,128,63,.9)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, Lh * .25); c.stroke();
      const flick = .85 + Math.sin(t * 9) * .05 + Math.sin(t * 13.7) * .04;
      const glow = c.createRadialGradient(0, Lh * .62, 2, 0, Lh * .62, Lh * 1.1 * flick); glow.addColorStop(0, 'rgba(255, 220, 160, .6)'); glow.addColorStop(1, 'rgba(255, 220, 160, 0)');
      c.fillStyle = glow; c.beginPath(); c.arc(0, Lh * .62, Lh * 1.1, 0, TAU); c.fill();
      const gld = goldGrad(c, -lw, lw);
      c.fillStyle = gld; c.beginPath(); c.moveTo(-lw * .55, Lh * .38); c.quadraticCurveTo(0, Lh * .12, lw * .55, Lh * .38); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(-lw * .55, Lh * .38); c.lineTo(-lw * .48, Lh * .9); c.lineTo(lw * .48, Lh * .9); c.lineTo(lw * .55, Lh * .38); c.closePath();
      const gl = c.createLinearGradient(0, Lh * .38, 0, Lh * .9); gl.addColorStop(0, `rgba(255, 232, 186, ${.9 * flick})`); gl.addColorStop(1, `rgba(244, 170, 120, ${.8 * flick})`); c.fillStyle = gl; c.fill(); c.strokeStyle = gld; c.lineWidth = 2; c.stroke();
      c.beginPath(); for (let i = -1; i <= 1; i++) { c.moveTo(i * lw * .26, Lh * .38); c.lineTo(i * lw * .24, Lh * .9); } c.strokeStyle = 'rgba(154,112,52,.8)'; c.lineWidth = 1.2; c.stroke();
      c.fillStyle = `rgba(255, 250, 230, ${flick})`; c.beginPath(); c.ellipse(0, Lh * .66, lw * .07, lw * .15 * flick, 0, 0, TAU); c.fill();
      c.fillStyle = gld; c.beginPath(); c.moveTo(-lw * .5, Lh * .9); c.lineTo(lw * .5, Lh * .9); c.lineTo(lw * .28, Lh * 1.02); c.lineTo(-lw * .28, Lh * 1.02); c.closePath(); c.fill();
      c.restore();
      // tapis de prière en perspective
      const ty = ground - h * .14, by = ground, tw2 = AW * .7, bw2 = AW * 1.25;
      const rug = (ins) => { c.beginPath(); c.moveTo(cx - tw2 / 2 + ins * .6, ty + ins * .5); c.lineTo(cx + tw2 / 2 - ins * .6, ty + ins * .5); c.lineTo(cx + bw2 / 2 - ins, by - ins * .5); c.lineTo(cx - bw2 / 2 + ins, by - ins * .5); c.closePath(); };
      rug(0); c.fillStyle = '#C9788F'; c.fill();
      rug(6); c.fillStyle = '#FBEFE6'; c.fill();
      rug(10); c.strokeStyle = 'rgba(196, 154, 90, .8)'; c.lineWidth = 1.2; c.stroke();
      // petit mihrab dessiné sur le tapis + médaillon
      c.beginPath(); c.moveTo(cx - tw2 * .22, by - 10); c.lineTo(cx - tw2 * .22, ty + 16); c.quadraticCurveTo(cx, ty + 4, cx + tw2 * .22, ty + 16); c.lineTo(cx + tw2 * .22, by - 10); c.strokeStyle = 'rgba(201, 120, 143, .7)'; c.lineWidth = 1.4; c.stroke();
      c.save(); c.translate(cx, (ty + by) / 2 + 2); c.scale(1, .5); c.rotate(Math.PI / 4); c.fillStyle = 'rgba(196, 154, 90, .7)'; c.fillRect(-5, -5, 10, 10); c.restore();
      // franges
      for (let k = 0; k <= 16; k++) { const x = lerp(cx - bw2 / 2 + 3, cx + bw2 / 2 - 3, k / 16); c.beginPath(); c.moveTo(x, by); c.lineTo(x + Math.sin(t * 1.5 + k) * .8, by + 6); c.strokeStyle = 'rgba(201, 120, 143, .8)'; c.lineWidth = 1; c.stroke(); }
      // particules dorées dans la lumière
      s.motes.forEach(m => {
        const x = cx + (m.x - .5) * AW * .9 + Math.sin(t * m.sp + m.ph) * 8, y = lerp(spring, ground - 10, m.y) + Math.cos(t * m.sp * .8 + m.ph) * 6;
        const al = .4 + .4 * Math.sin(t * 1.4 + m.ph);
        c.fillStyle = `rgba(255, 236, 190, ${al})`; c.beginPath(); c.arc(x, y, m.r, 0, TAU); c.fill();
      });
      // boussole de qibla discrète
      const qx = R + AW * .28, qy = ground - h * .1;
      if (qx < w - 16) { c.beginPath(); c.arc(qx, qy, 12, 0, TAU); c.fillStyle = 'rgba(255,255,255,.7)'; c.fill(); c.strokeStyle = 'rgba(196,154,90,.8)'; c.lineWidth = 1.2; c.stroke(); c.save(); c.translate(qx, qy); c.rotate(-.6 + Math.sin(t * .7) * .05); c.beginPath(); c.moveTo(0, -9); c.lineTo(3, 0); c.lineTo(0, 9); c.lineTo(-3, 0); c.closePath(); c.fillStyle = '#C9788F'; c.fill(); c.restore(); }
    }
  };

  const SCENES = { matcha, perfume, photo, mirror, wash, hijab, prayer };
  const items = [];
  function setup(cv) {
    const scene = SCENES[cv.dataset.scene]; if (!scene) return;
    const it = { cv, ctx: cv.getContext('2d'), scene, state: {}, w: 0, h: 0, visible: false };
    scene.init(it.state);
    const size = () => { const dpr = Math.min(2, devicePixelRatio || 1); it.w = cv.clientWidth; it.h = cv.clientHeight; cv.width = Math.round(it.w * dpr); cv.height = Math.round(it.h * dpr); it.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); new ResizeObserver(size).observe(cv);
    new IntersectionObserver(([en]) => { it.visible = en.isIntersecting; if (it.visible) kick(); }, { rootMargin: '120px' }).observe(cv);
    items.push(it);
  }
  let raf = 0, last = 0;
  function loop(ms) {
    const t = ms / 1000, dt = Math.min(.05, last ? (ms - last) / 1000 : .016); last = ms;
    let any = false;
    items.forEach(it => {
      if (!it.visible || !it.w) return; any = true;
      it.ctx.clearRect(0, 0, it.w, it.h);
      try { it.ctx.save(); it.scene.draw(it.ctx, it.w, it.h, t, it.state, dt); }
      catch (e) { console.error('[QAMAR rituals-fx]', e); }
      finally { it.ctx.restore(); }
    });
    raf = any && !reduce ? requestAnimationFrame(loop) : 0;
  }
  function kick() { if (!raf) { last = 0; raf = requestAnimationFrame(loop); } }
  const boot = () => { document.querySelectorAll('canvas[data-scene]').forEach(setup); if (reduce) requestAnimationFrame(t => items.forEach(it => { it.visible = true; it.scene.draw(it.ctx, it.w, it.h, 2, it.state, .016); })); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
