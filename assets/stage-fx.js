/* QAMAR — fond animé du hero, dessiné en direct (aucune vidéo à charger) :
   couloir d'arches rose-or, lumières douces, branche de cerisier qui se balance
   et pluie de fleurs de sakura sur trois profondeurs. Les fleurs s'écartent au
   passage de la souris et une pluie de pétales part de l'endroit touché. */
(function stageFx() {
  const cv = document.getElementById('stageFx');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const stage = cv.closest('.stage') || cv.parentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, running = true, raf = 0, last = 0;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const TAU = Math.PI * 2;
  const pointer = { x: -9999, y: -9999, active: false };

  /* ---------- Sprites pré-dessinés (performances) ---------- */
  function petalPath(c, r) {
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(-r * .58, -r * .3, -r * .56, -r * .92, -r * .14, -r);
    c.lineTo(0, -r * .84);                       // l'échancrure typique du sakura
    c.lineTo(r * .14, -r);
    c.bezierCurveTo(r * .56, -r * .92, r * .58, -r * .3, 0, 0);
    c.closePath();
  }
  const PALETTES = [
    ['#FFFFFF', '#FFE6EE', '#F7B3C6'],
    ['#FFF6F9', '#FFD3E0', '#F29BB4'],
    ['#FFFFFF', '#FDEAF0', '#EFC0CF'],
    ['#FFF0F4', '#FFC9D8', '#EC8FAB']
  ];
  function makeBlossom(size, pal, blur) {
    const pad = blur ? 8 : 2, s = size * 2 + pad * 2;
    const c = document.createElement('canvas'); c.width = c.height = Math.ceil(s);
    const g = c.getContext('2d');
    if (blur && 'filter' in g) g.filter = `blur(${blur}px)`;
    g.translate(s / 2, s / 2);
    for (let i = 0; i < 5; i++) {
      g.save(); g.rotate(i * TAU / 5);
      const gr = g.createLinearGradient(0, 0, 0, -size);
      gr.addColorStop(0, pal[2]); gr.addColorStop(.45, pal[1]); gr.addColorStop(1, pal[0]);
      g.fillStyle = gr; petalPath(g, size); g.fill();
      g.strokeStyle = 'rgba(236, 143, 171, .25)'; g.lineWidth = Math.max(.5, size / 40); g.stroke();
      // nervure centrale
      g.beginPath(); g.moveTo(0, -size * .12); g.lineTo(0, -size * .7);
      g.strokeStyle = 'rgba(232, 120, 155, .18)'; g.lineWidth = Math.max(.4, size / 50); g.stroke();
      g.restore();
    }
    // cœur et étamines
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
  function makePetal(size, pal, blur) {
    const pad = blur ? 8 : 2, s = size * 1.3 + pad * 2;
    const c = document.createElement('canvas'); c.width = c.height = Math.ceil(s);
    const g = c.getContext('2d');
    if (blur && 'filter' in g) g.filter = `blur(${blur}px)`;
    g.translate(s / 2, s / 2 + size * .5);
    const gr = g.createLinearGradient(0, 0, 0, -size);
    gr.addColorStop(0, pal[2]); gr.addColorStop(.5, pal[1]); gr.addColorStop(1, pal[0]);
    g.fillStyle = gr; petalPath(g, size); g.fill();
    return c;
  }
  let SPR = { blossom: [], petal: [], blurBlossom: [], blurPetal: [] };
  function buildSprites() {
    SPR = { blossom: [], petal: [], blurBlossom: [], blurPetal: [] };
    PALETTES.forEach(p => {
      SPR.blossom.push(makeBlossom(30, p, 0));
      SPR.petal.push(makePetal(26, p, 0));
      SPR.blurBlossom.push(makeBlossom(30, p, 3.5));
      SPR.blurPetal.push(makePetal(26, p, 3.5));
    });
  }

  /* ---------- Branche de cerisier ---------- */
  let branchCv = null, branchAnchor = { x: 0, y: 0 };
  function buildBranch() {
    // assez petite pour ne jamais passer sur le titre
    const scale = W >= 1300 ? .62 : W >= 900 ? .46 : .34;
    const bw = Math.round(620 * scale), bh = Math.round(440 * scale);
    branchCv = document.createElement('canvas');
    branchCv.width = Math.round(bw * dpr); branchCv.height = Math.round(bh * dpr);
    const g = branchCv.getContext('2d');
    g.scale(dpr * scale, dpr * scale);
    // la branche part du coin haut droit et descend vers la gauche
    const wood = (pts, w) => {
      g.beginPath(); g.moveTo(pts[0], pts[1]);
      g.bezierCurveTo(pts[2], pts[3], pts[4], pts[5], pts[6], pts[7]);
      g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = '#6E4650'; g.stroke();
      g.lineWidth = w * .35; g.strokeStyle = 'rgba(255, 220, 228, .35)'; g.stroke();
    };
    wood([640, -10, 520, 60, 420, 70, 300, 150], 11);
    wood([300, 150, 230, 200, 170, 190, 90, 250], 6.5);
    wood([430, 80, 420, 150, 380, 210, 330, 270], 5);
    wood([520, 40, 500, 0, 470, -10, 430, -20], 4);
    wood([230, 190, 220, 240, 200, 290, 160, 330], 3.5);
    wood([360, 120, 330, 80, 300, 60, 260, 50], 3.5);
    const clusters = [[90, 250], [120, 236], [70, 268], [160, 330], [176, 312], [330, 270], [350, 252], [312, 286], [260, 50], [282, 66], [430, -6], [300, 150], [250, 186], [200, 200], [400, 100], [460, 66], [140, 300], [370, 230], [225, 150], [520, 110]];
    clusters.forEach(([x, y], i) => {
      const n = 2 + (i % 3);
      for (let k = 0; k < n; k++) {
        const spr = SPR.blossom[(i + k) % SPR.blossom.length];
        const s = rnd(.75, 1.25), ox = rnd(-18, 18), oy = rnd(-14, 14);
        g.save(); g.translate(x + ox, y + oy); g.rotate(rnd(0, TAU));
        g.drawImage(spr, -spr.width * s / 2, -spr.height * s / 2, spr.width * s, spr.height * s);
        g.restore();
      }
      // boutons
      g.fillStyle = '#F29BB4';
      g.beginPath(); g.ellipse(x + rnd(-26, 26), y + rnd(-22, 22), 4, 6, rnd(0, TAU), 0, TAU); g.fill();
    });
    branchAnchor = { x: W - bw, y: 0, w: bw, h: bh };
  }

  /* ---------- Particules ---------- */
  let flowers = [], bokeh = [];
  function newFlower(anywhere, x, y) {
    const z = Math.random() < .18 ? rnd(1.25, 1.7) : Math.random() < .5 ? rnd(.75, 1.15) : rnd(.35, .7);
    const isBlossom = Math.random() < .45;
    return {
      x: x ?? rnd(-60, W + 60), y: y ?? (anywhere ? rnd(-H, H) : rnd(-120, -30)),
      z, isBlossom, pal: Math.floor(Math.random() * PALETTES.length),
      size: (isBlossom ? rnd(.55, .9) : rnd(.45, .75)) * z,
      vy: rnd(18, 34) * z, vx: rnd(-8, 8), sway: rnd(20, 60) * z, ph: rnd(0, TAU),
      rot: rnd(0, TAU), vr: rnd(-1.2, 1.2), flip: rnd(0, TAU), vf: rnd(1.2, 2.8), push: 0, pushX: 0, pushY: 0
    };
  }
  /* ---------- Sol en époxy effet marbre (crème, veines beige-grège et fines veines dorées) ---------- */
  let floorCv = null, horizon = 0;
  function buildFloor() {
    horizon = Math.round(H * .62);
    const FH = H - horizon; if (FH <= 0) return;
    floorCv = document.createElement('canvas');
    floorCv.width = Math.round(W * dpr); floorCv.height = Math.round(FH * dpr);
    const g = floorCv.getContext('2d'); g.scale(dpr, dpr);
    const cx = W / 2, persp = v => Math.pow(v, 1.7);
    const toScreen = (u, v) => [cx + u * W * .8 * (.12 + persp(v) * .88), FH * persp(v)];
    // fond crème satiné
    const base = g.createLinearGradient(0, 0, 0, FH);
    base.addColorStop(0, '#F8E9E6'); base.addColorStop(.5, '#F4E1DB'); base.addColorStop(1, '#EED5CE');
    g.fillStyle = base; g.fillRect(0, 0, W, FH);
    // veines du marbre, en perspective
    const vein = (u0, amp, freq, ph, drift, width, color) => {
      g.beginPath();
      for (let v = .02; v <= 1.001; v += .02) {
        const u = u0 + Math.sin(v * freq + ph) * amp + drift * v;
        const [x, y] = toScreen(u, v);
        v === .02 ? g.moveTo(x, y) : g.lineTo(x, y);
      }
      g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.stroke();
    };
    for (let k = 0; k < 22; k++) vein(rnd(-1.3, 1.3), rnd(.04, .14), rnd(3, 8), rnd(0, TAU), rnd(-.4, .4), rnd(.6, 2.4), `rgba(190, 160, 148, ${rnd(.16, .32)})`);
    for (let k = 0; k < 7; k++) vein(rnd(-1.1, 1.1), rnd(.03, .1), rnd(4, 9), rnd(0, TAU), rnd(-.3, .3), rnd(.5, 1.1), `rgba(206, 164, 104, ${rnd(.35, .55)})`);
    // flaque de lumière au centre (reflet satiné)
    const pool = g.createRadialGradient(cx, FH * .35, 0, cx, FH * .35, W * .45);
    pool.addColorStop(0, 'rgba(255, 252, 250, .75)'); pool.addColorStop(.5, 'rgba(255, 245, 246, .25)'); pool.addColorStop(1, 'rgba(255, 245, 246, 0)');
    g.save(); g.scale(1, .45); g.fillStyle = pool; g.beginPath(); g.arc(cx, FH * .35 / .45, W * .45, 0, TAU); g.fill(); g.restore();
    // pétales tombés au sol
    for (let k = 0; k < 16; k++) {
      const v = rnd(.15, 1), [x, y] = toScreen(rnd(-1, 1), v);
      const spr = SPR.petal[k % SPR.petal.length], sc = (.35 + persp(v) * .75);
      g.save(); g.translate(x, y); g.scale(1, .5); g.rotate(rnd(0, TAU)); g.globalAlpha = .85;
      g.drawImage(spr, -spr.width * sc / 2, -spr.height * sc / 2, spr.width * sc, spr.height * sc); g.restore();
    }
    // fondu à l'horizon : le haut du sol s'efface progressivement dans le couloir (pas de ligne nette)
    g.globalCompositeOperation = 'destination-out';
    const fog = g.createLinearGradient(0, 0, 0, FH * .45);
    fog.addColorStop(0, 'rgba(0,0,0,1)'); fog.addColorStop(.35, 'rgba(0,0,0,.6)'); fog.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = fog; g.fillRect(0, 0, W, FH * .45);
    g.globalCompositeOperation = 'source-over';
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = W < 700 ? 34 : 70;
    flowers = Array.from({ length: n }, () => newFlower(true)).sort((a, b) => a.z - b.z);
    bokeh = Array.from({ length: W < 700 ? 10 : 18 }, () => ({ x: rnd(0, W), y: rnd(0, H), r: rnd(40, W < 700 ? 90 : 160), vx: rnd(-5, 5), vy: rnd(-6, -2), a: rnd(.25, .5), ph: rnd(0, TAU), white: Math.random() < .5 }));
    buildBranch();
    buildFloor();
  }

  function archPath(cx, baseY, w, h) {
    const r = w / 2;
    ctx.beginPath(); ctx.moveTo(cx - r, baseY); ctx.lineTo(cx - r, baseY - h + r);
    ctx.arc(cx, baseY - h + r, r, Math.PI, 0); ctx.lineTo(cx + r, baseY);
  }

  function drawFlower(f, t) {
    const sprList = f.z > 1.22 ? (f.isBlossom ? SPR.blurBlossom : SPR.blurPetal) : (f.isBlossom ? SPR.blossom : SPR.petal);
    const spr = sprList[f.pal];
    const flipX = Math.cos(f.flip);                      // effet de retournement en 3D
    const w = spr.width * f.size, h = spr.height * f.size;
    ctx.save();
    ctx.globalAlpha = f.z < .6 ? .55 : f.z > 1.22 ? .8 : .95;
    ctx.translate(f.x, f.y); ctx.rotate(f.rot);
    ctx.scale(Math.abs(flipX) < .08 ? .08 : flipX, 1);
    ctx.drawImage(spr, -w / 2, -h / 2, w, h);
    ctx.restore();
  }

  function draw(ms) {
    const t = ms / 1000;
    const dt = Math.min(.05, last ? (ms - last) / 1000 : .016); last = ms;
    ctx.clearRect(0, 0, W, H);
    const wind = Math.sin(t * .23) * 14 + Math.sin(t * .71) * 6;

    // sol marbre (pré-dessiné), posé sous le couloir
    if (floorCv && floorCv.width && floorCv.height && H > horizon) ctx.drawImage(floorCv, 0, horizon, W, H - horizon);

    // Couloir d'arches architecturales : moulure en relief rose-or, ombre intérieure, brume de profondeur
    const cx = W * .5, vy = H * .62, phase = (t / 14) % 1, N = 6, base = Math.min(W, H) * .17;
    const addArch = (x, by, w, h) => { const r = w / 2; ctx.moveTo(x - r, by); ctx.lineTo(x - r, by - h + r); ctx.arc(x, by - h + r, r, Math.PI, 0); ctx.lineTo(x + r, by); };
    for (let i = 0; i < N; i++) {
      const k = i + phase, s = base * Math.pow(1.6, k), w = s, h = s * 1.55, baseY = vy + s * .62;
      const a = Math.min(1, k / 1.6) * Math.max(0, 1 - Math.max(0, s - Math.max(W, H) * 1.15) / (Math.max(W, H) * .8));
      if (a <= .01) continue;
      const depth = Math.min(1, s / (Math.max(W, H) * .9));       // 0 = loin, 1 = proche
      const b = Math.max(3, s * .05);                               // épaisseur de la moulure
      // lumière douce dans l'ouverture
      ctx.beginPath(); addArch(cx, baseY, w - 2 * b, h - b); ctx.closePath();
      const glow = ctx.createRadialGradient(cx, baseY - h * .5, 0, cx, baseY - h * .5, w * .8);
      glow.addColorStop(0, `rgba(255, 248, 250, ${.18 * a})`); glow.addColorStop(1, 'rgba(255, 248, 250, 0)');
      ctx.fillStyle = glow; ctx.fill();
      // moulure : cadre plein (extérieur moins intérieur)
      ctx.save();
      ctx.globalAlpha = a * (.45 + .55 * depth);                    // les arches lointaines se fondent dans la brume
      ctx.beginPath(); addArch(cx, baseY, w, h); ctx.closePath(); addArch(cx, baseY, w - 2 * b, h - b); ctx.closePath();
      const fg = ctx.createLinearGradient(cx - w / 2, baseY - h, cx + w / 2, baseY);
      fg.addColorStop(0, '#FFF3EE'); fg.addColorStop(.35, '#F6D9CF'); fg.addColorStop(.7, '#EDC3B7'); fg.addColorStop(1, '#E3B0A4');
      ctx.fillStyle = fg;
      if (depth > .35) { ctx.shadowColor = 'rgba(160, 80, 95, .18)'; ctx.shadowBlur = s * .05; ctx.shadowOffsetY = s * .012; }
      ctx.fill('evenodd');
      ctx.shadowColor = 'transparent';
      // arête extérieure éclairée
      ctx.beginPath(); addArch(cx, baseY, w, h);
      ctx.strokeStyle = 'rgba(255, 255, 255, .75)'; ctx.lineWidth = Math.max(.8, b * .1); ctx.stroke();
      // ombre sur l'arête intérieure (donne la profondeur du mur)
      ctx.beginPath(); addArch(cx, baseY, w - 2 * b, h - b);
      ctx.strokeStyle = 'rgba(176, 104, 112, .32)'; ctx.lineWidth = Math.max(.8, b * .22); ctx.stroke();
      // filet doré au milieu de la moulure
      ctx.beginPath(); addArch(cx, baseY, w - b, h - b * .5);
      ctx.strokeStyle = 'rgba(206, 164, 112, .7)'; ctx.lineWidth = Math.max(.6, b * .07); ctx.stroke();
      ctx.restore();
      // socles au pied des colonnes + reflet satiné de l'arche dans le sol
      if (baseY < H + s) {
        ctx.save(); ctx.globalAlpha = a * (.45 + .55 * depth);
        const pw = b * 1.5, ph2 = b * .9;
        [-1, 1].forEach(sd => { const px = cx + sd * (w / 2 - b / 2); const pg = ctx.createLinearGradient(px - pw / 2, 0, px + pw / 2, 0); pg.addColorStop(0, '#FFF1EC'); pg.addColorStop(1, '#E2B2A6'); ctx.fillStyle = pg; ctx.fillRect(px - pw / 2, baseY - ph2, pw, ph2); ctx.fillStyle = 'rgba(206, 164, 112, .6)'; ctx.fillRect(px - pw / 2, baseY - ph2, pw, Math.max(.6, b * .08)); });
        ctx.restore();
        ctx.save();
        ctx.beginPath(); ctx.rect(0, baseY, W, H - baseY); ctx.clip();
        ctx.translate(0, baseY * 2); ctx.scale(1, -1);
        ctx.globalAlpha = a * .13 * (.5 + .5 * depth);
        ctx.beginPath(); addArch(cx, baseY, w, h); ctx.closePath(); addArch(cx, baseY, w - 2 * b, h - b); ctx.closePath();
        ctx.fillStyle = '#E9BDB2'; ctx.fill('evenodd');
        ctx.restore();
      }
      // clé de voûte : petit croissant de lune doré
      const r = w / 2, apexY = baseY - h;
      if (s > base * 1.3) {
        const R = Math.max(3, s * .022);
        ctx.save(); ctx.translate(cx, apexY + b * .5); ctx.globalAlpha = a;
        ctx.beginPath(); ctx.arc(0, 0, R, Math.PI * .3, Math.PI * 1.7, false); ctx.arc(R * .5, 0, R * .82, Math.PI * 1.62, Math.PI * .38, true); ctx.closePath();
        ctx.fillStyle = '#D9AE6E'; ctx.fill();
        ctx.restore();
      }
      // branche de sakura qui grimpe le long de l'arche (un côté sur deux, alternance stable)
      const archId = i - Math.floor(t / 14);
      if (depth > .22 && a > .15 && SPR.blossom.length && ((archId % 3) + 3) % 3 !== 2) {
        const side = (((archId % 2) + 2) % 2) ? 1 : -1;
        const rv = r - b * .5, cyA = baseY - h + r;
        const hash = n => { const x = Math.sin(archId * 91.7 + n * 13.3) * 43758.5; return x - Math.floor(x); };
        // tracé : colonne (montée) puis courbe de l'arche jusqu'un peu après la clé de voûte
        const pts = [];
        const colLen = Math.min(h - r, s * .55);
        for (let q = 0; q <= 1; q += .1) pts.push([cx + side * rv, cyA + colLen * (1 - q)]);
        for (let q = 0; q <= 1; q += .05) { const th = side < 0 ? Math.PI + q * Math.PI * .62 : TAU - q * Math.PI * .62; pts.push([cx + Math.cos(th) * rv, cyA + Math.sin(th) * rv]); }
        ctx.save(); ctx.globalAlpha = a * .95;
        // tige fine et ondulée
        ctx.beginPath();
        pts.forEach(([x, y], n) => { const wob = Math.sin(n * .9 + archId) * b * .28; const px = x + wob * (n < 11 ? 1 : 0), py = y + (n >= 11 ? wob : 0); n ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
        ctx.strokeStyle = 'rgba(140, 92, 100, .42)'; ctx.lineWidth = Math.max(.7, b * .09); ctx.lineCap = 'round'; ctx.stroke();
        // fleurs, boutons et petites feuilles réparties le long de la tige
        for (let n = 1; n < pts.length; n += 2) {
          const [x, y] = pts[n], off = (n % 2 ? 1 : -1) * b * .6;
          const nx = n < 11 ? x + off : x + off * Math.cos(n), ny = n < 11 ? y : y + off * .6;
          if (hash(n) < .72) {
            const L = SPR.blossom.length, spr = SPR.blossom[(((archId + n) % L) + L) % L];
            const sz = s * (.04 + hash(n + 7) * .035) / spr.width * 1.3;
            ctx.save(); ctx.translate(nx, ny); ctx.rotate(hash(n + 3) * TAU);
            ctx.drawImage(spr, -spr.width * sz / 2, -spr.height * sz / 2, spr.width * sz, spr.height * sz); ctx.restore();
          } else if (hash(n) < .85) {
            ctx.fillStyle = 'rgba(236, 140, 168, .9)'; ctx.beginPath(); ctx.ellipse(nx, ny, s * .007, s * .011, hash(n) * TAU, 0, TAU); ctx.fill();
          } else {
            ctx.fillStyle = 'rgba(150, 170, 110, .7)'; ctx.beginPath(); ctx.ellipse(nx, ny, s * .012, s * .005, hash(n) * TAU, 0, TAU); ctx.fill();
          }
        }
        ctx.restore();
      }
    }

    // Lumières douces
    ctx.globalCompositeOperation = 'screen';
    for (const b of bokeh) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.y < -b.r) { b.y = H + b.r; b.x = rnd(0, W); }
      const tw = .75 + .25 * Math.sin(t * .7 + b.ph);
      const col = b.white ? '255, 255, 255' : '255, 196, 214';
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, `rgba(${col}, ${b.a * tw})`); g.addColorStop(1, `rgba(${col}, 0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    const sweep = ((t / 12) % 1) * (W + H * 1.5) - H * .75;
    const lg = ctx.createLinearGradient(sweep - 240, 0, sweep + 240, H * .6);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.5, 'rgba(255,245,248,.18)'); lg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'source-over';

    // Fleurs lointaines et moyennes (derrière la branche)
    const step = f => {
      f.flip += f.vf * dt; f.rot += f.vr * dt;
      f.x += (f.vx + wind * f.z + Math.sin(t * .8 + f.ph) * f.sway * .6) * dt + f.pushX * dt;
      f.y += (f.vy + f.pushY) * dt;
      // la souris écarte les fleurs proches
      if (pointer.active) {
        const dx = f.x - pointer.x, dy = f.y - pointer.y, d2 = dx * dx + dy * dy, R = 130;
        if (d2 < R * R) { const d = Math.sqrt(d2) || 1, k = (1 - d / R) * 320; f.pushX += dx / d * k * dt * 6; f.pushY += dy / d * k * dt * 6; }
      }
      f.pushX *= .94; f.pushY *= .94;
      if (f.y > H + 60 || f.x < -140 || f.x > W + 140) Object.assign(f, newFlower(false));
    };
    for (const f of flowers) { if (f.z <= 1.22) { step(f); drawFlower(f, t); } }

    // Branche qui se balance
    if (branchCv) {
      ctx.save();
      ctx.translate(W, 0); ctx.rotate(Math.sin(t * .6) * .018 + Math.sin(t * 1.7) * .006); ctx.translate(-W, 0);
      ctx.drawImage(branchCv, branchAnchor.x, branchAnchor.y, branchAnchor.w, branchAnchor.h);
      ctx.restore();
    }

    // Fleurs du premier plan, floues, devant tout
    for (const f of flowers) { if (f.z > 1.22) { step(f); drawFlower(f, t); } }

    // (la boucle est relancée par frame(), même si une erreur survient)
  }

  // Boucle protégée : une erreur de dessin ne doit jamais figer toute l'animation
  function frame(ms) {
    try { draw(ms); }
    catch (e) { console.error('[QAMAR stage-fx]', e); try { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.globalAlpha = 1; ctx.shadowBlur = 0; ctx.setLineDash([]); } catch (_) {} }
    if (running && !reduce) raf = requestAnimationFrame(frame);
  }

  // Interaction : la souris écarte, un clic ou un toucher fait pleuvoir des pétales
  const local = e => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  stage.addEventListener('pointermove', e => { const p = local(e); pointer.x = p.x; pointer.y = p.y; pointer.active = true; });
  stage.addEventListener('pointerleave', () => { pointer.active = false; });
  stage.addEventListener('pointerdown', e => {
    if (e.target.closest('a, button')) return;
    const p = local(e);
    for (let i = 0; i < 22; i++) {
      const f = newFlower(false, p.x, p.y);
      const a = rnd(0, TAU), sp = rnd(80, 260);
      f.pushX = Math.cos(a) * sp; f.pushY = Math.sin(a) * sp - 60; f.z = rnd(.7, 1.15); f.size = rnd(.5, .85) * f.z;
      flowers.push(f);
    }
    flowers.sort((a, b) => a.z - b.z);
    if (flowers.length > 180) flowers.splice(0, flowers.length - 180);
  });

  buildSprites();
  resize();
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { resize(); if (reduce || !running) frame(performance.now()); }, 150); });
  new IntersectionObserver(([en]) => {
    if (en.isIntersecting && !running) { running = true; last = 0; raf = requestAnimationFrame(frame); }
    if (!en.isIntersecting) { running = false; cancelAnimationFrame(raf); }
  }).observe(cv);
  raf = requestAnimationFrame(frame);
})();
