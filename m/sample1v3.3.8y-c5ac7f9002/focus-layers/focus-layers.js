/* v3.2.10-staged Focus layers (Drue 111426 6:13 PM-8:19 PM CT): the Focus is separate objects, not one unit.
   Pieces and positions come from focus-parts/focus-parts-mover.html (its saved defaults), in 720x1168 face coords:
   ear glow, face glow, under-eye glow (screen blend, switch off with the ring), the triangle Focus (from Drue's photo),
   the ring with breathing runes (each rune pulses on its own timer; ring turns one way, eases to a stop, turns back),
   and the laser trace on its own layer (curved, from the Focus centre up and over the cheekbone to the eye corner,
   slow draw, head fades, then retraces). Mode: off / on (all) / ear (triangle only). */
(function () {
  'use strict';
  const FL = window.FocusLayers = {ready: false, mode: 'on', ringOn: true, glowOn: true};
  let C = null, IM = {}, icv = null, ix = null, tcv = null, tx = null;
  const loadImg = src => window.egFetchImg ? window.egFetchImg(src) : new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });   // v3.3.8w: shared 8-at-a-time queue with retries
  FL.load = async function (base) {
    base = base || 'focus-layers/';
    C = await fetch(base + 'focus-layers.json').then(r => r.json());
    const names = C.layers.filter(l => l.src).map(l => l.src).concat(['runes-dim.webp', 'runes-bright.webp']);
    const ims = await Promise.all(names.map(n => loadImg(base + n)));
    names.forEach((n, i) => IM[n] = ims[i]);
    icv = document.createElement('canvas'); icv.width = C.runes.IW; icv.height = C.runes.IH; ix = icv.getContext('2d');
    tcv = document.createElement('canvas'); tcv.width = C.trace.W; tcv.height = C.trace.H; tx = tcv.getContext('2d');
    initTrace(); FL.ready = true;
    if (!/[?&]ring=live/.test(location.search)) {   // v3.3.8x 1422: not awaited; starts once the opening bed + greeting are going (boot was waiting ~55 s for these sheets at 1.5 Mbps)
      let did = false; const go = () => { if (did) return; did = true; FL.loopAskedAt = +(performance.now() / 1000).toFixed(2); loadLoop(base).catch(err => { FL.sprite = null; console.warn('ring loop', err); }); };
      if (window.EMOTE_OPEN_AT) setTimeout(go, 500); else { window.addEventListener('emote-open', () => setTimeout(go, 500)); setTimeout(go, 30000); } }
    return FL;
  };
  /* v3.3.7p: pre-made looping ring. The rune ring, its pulses and the two laser traces are baked into sprite sheets
     (loop/*.webp; sources and bake scripts in evidence-v337p/ringbake). Per frame the app only picks a cell and blits it.
     If anything fails to load, the live drawing below stays as the fallback. ?ring=live forces the live drawing. */
  const SP = {ok: false};
  async function loadLoop(base) {
    const M = await fetch(base + 'loop/loop-v337p.json').then(r => r.json()), G = await fetch(base + 'loop/halo-geo-v337p.json').then(r => r.json());
    const names = [], R = M.runes; for (let i = 0; i < Math.ceil(R.n / R.per); i++) names.push(`runes-${i}-v337p.webp`);
    M.trace.forEach((t, k) => { for (let i = 0; i < Math.ceil(t.n / t.per); i++) names.push(`trace${k}-${i}-v337p.webp`); });
    names.push('ring-halo-v337p.webp', 'ring-shadow-v337p.webp');
    const ims = await Promise.all(names.map(n => loadImg(base + 'loop/' + n))); if (ims.some(i => !i)) throw new Error('missing loop sheet');
    await Promise.all(ims.map(i => (i.decode ? i.decode().catch(() => {}) : 0)));   // decode now so the first frames do not stall
    const wc = document.createElement('canvas'); wc.width = wc.height = 2; const wx = wc.getContext('2d');
    ims.forEach(i => { try { wx.drawImage(i, 0, 0, 1, 1, 0, 0, 1, 1); } catch (e) {} });   // warm every sheet once so the first real draw does not stall
    SP.M = M; SP.G = G; SP.im = {}; names.forEach((n, i) => SP.im[n] = ims[i]);
    SP.tcv = document.createElement('canvas'); SP.tcv.width = 220; SP.tcv.height = 80; SP.tx = SP.tcv.getContext('2d');
    SP.T = M.trace.map(t => ({T0: null, was: false})); SP.ok = true; FL.sprite = SP;
  }
  function cell(ctx, sheetName, per, cols, w, h, idx, dx, dy) {
    const s = Math.floor(idx / per), k = idx - s * per; const im = SP.im[sheetName.replace('#', s)];
    ctx.drawImage(im, (k % cols) * w, Math.floor(k / cols) * h, w, h, dx, dy, w, h);
  }
  function drawLoopRunes(ctx, wall, alpha) {
    const R = SP.M.runes, idx = Math.min(R.n - 1, Math.floor((((wall % R.loop) + R.loop) % R.loop) * R.fps));
    ctx.save(); ctx.globalAlpha = alpha; cell(ctx, 'runes-#-v337p.webp', R.per, R.cols, R.w, R.h, idx, R.ox, R.oy); ctx.restore();
  }
  function drawLoopTrace(ctx, wall, on, alpha, l) {
    const x = SP.tx; x.clearRect(0, 0, 220, 80); let any = false;
    SP.M.trace.forEach((t, k) => { const S = SP.T[k];
      if (on && !S.was) S.T0 = wall + t.off; S.was = on; if (!on || S.T0 == null || wall < S.T0) return;
      const u = wall - S.T0; let idx;
      if (u < t.cyc) idx = Math.min(t.m - 1, Math.floor(u * t.fps)); else idx = t.m + Math.min(t.m - 1, Math.floor((((u - t.cyc) % t.cyc) + t.cyc) % t.cyc * t.fps));
      cell(x, `trace${k}-#-v337p.webp`, t.per, t.cols, t.w, t.h, idx, t.ox - 140, t.oy - 360); any = true; });
    if (any) put(ctx, l, SP.tcv, alpha);
  }
  FL.setMode = m => { FL.mode = m; };
  FL.setRingOn = on => { FL.ringOn = !!on; };
  FL.setGlowOn = on => { FL.glowOn = !!on; };
  FL.layer = id => C && C.layers.find(l => l.id === id);
  /* ring spin: cruise, ease out, hold, reverse, ease in (mover timings) */
  const R = {th: 0, sp: 0, sg: 1, ph: 'cruise', pt: 0, cru: 10, lt: null};
  function spin(t) {
    const r = C.runes, h = R.lt == null ? 0 : Math.min(0.1, t - R.lt); R.lt = t; R.pt += h;
    if (R.ph === 'cruise') { R.sp = R.sg * r.CR; if (R.pt >= R.cru) { R.ph = 'out'; R.pt = 0; } }
    else if (R.ph === 'out') { const u = Math.min(1, R.pt / r.EASE); R.sp = R.sg * r.CR * (1 - u * u * (3 - 2 * u)); if (u >= 1) { R.ph = 'hold'; R.pt = 0; R.sp = 0; } }
    else if (R.ph === 'hold') { R.sp = 0; if (R.pt >= r.HOLD) { R.sg = -R.sg; R.ph = 'in'; R.pt = 0; } }
    else { const u = Math.min(1, R.pt / r.EASE); R.sp = R.sg * r.CR * u * u * (3 - 2 * u); if (u >= 1) { R.ph = 'cruise'; R.pt = 0; R.cru = 7 + Math.random() * 7; } }
    R.th += R.sp * h;
  }
  function drawIcons(t) {
    const r = C.runes, x = ix; spin(t);
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, r.IW, r.IH);
    x.translate(r.CX, r.CY); x.scale(1, r.SQ); x.rotate(R.th * Math.PI / 180); x.scale(1, 1 / r.SQ); x.translate(-r.CX, -r.CY);
    x.globalAlpha = 1; if (IM['runes-dim.webp']) x.drawImage(IM['runes-dim.webp'], 0, 0);
    const B = IM['runes-bright.webp'];
    if (B) r.list.forEach(q => { x.globalAlpha = (Math.exp(Math.sin(6.2832 * t / q.p + q.o)) - 0.36788) / 2.3504; x.drawImage(B, q.sx, 0, q.w, q.h, q.x, q.y, q.w, q.h); });
    x.globalAlpha = 1; x.setTransform(1, 0, 0, 1, 0, 0);
  }
  /* laser traces (v3.3.3: trace 1 from the Focus centre to the eyeliner tip; trace 2 runs beside it like a circuit
     trace to the cheekbone, dips under it and follows just below the lower lashes to the inner eye corner; own timing) */
  let pts = [], TR = [];
  function initTrace() {
    const c = C.trace, S = c.S; const P = c.P.map(p => [(p[0] - c.OX) * S, (p[1] - c.OY) * S]);
    const bz = u => { const v = 1 - u; return [0, 1].map(i => v * v * v * P[0][i] + 3 * v * v * u * P[1][i] + 3 * v * u * u * P[2][i] + u * u * u * P[3][i]); };
    pts = []; for (let i = 0; i <= 200; i++) pts.push(bz(i / 200));
    TR = [{ pts, cfg: c, off: 0, T0: null, first: true, was: false }];
    const c2 = C.trace2; if (c2 && c2.pts && c2.pts.length > 1) {
      const Q = c2.pts.map(p => [(p[0] - c.OX) * S, (p[1] - c.OY) * S]), raw = [];
      for (let j = 0; j < Q.length - 1; j++) { const p0 = Q[Math.max(0, j - 1)], p1 = Q[j], p2 = Q[j + 1], p3 = Q[Math.min(Q.length - 1, j + 2)];
        for (let s = 0; s < 1; s += 0.05) { const s2 = s * s, s3 = s2 * s;
          raw.push([0, 1].map(i => 0.5 * (2 * p1[i] + (-p0[i] + p2[i]) * s + (2 * p0[i] - 5 * p1[i] + 4 * p2[i] - p3[i]) * s2 + (-p0[i] + 3 * p1[i] - 3 * p2[i] + p3[i]) * s3))); } }
      raw.push(Q[Q.length - 1]);
      const cum = [0]; for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i][0] - raw[i - 1][0], raw[i][1] - raw[i - 1][1]));
      const tot = cum[cum.length - 1], p2s = []; let j = 0;
      for (let i = 0; i <= 200; i++) { const dd = tot * i / 200; while (j < raw.length - 2 && cum[j + 1] < dd) j++;
        const f = (dd - cum[j]) / Math.max(1e-6, cum[j + 1] - cum[j]); p2s.push([raw[j][0] + (raw[j + 1][0] - raw[j][0]) * f, raw[j][1] + (raw[j + 1][1] - raw[j][1]) * f]); }
      TR.push({ pts: p2s, cfg: c2, off: c2.T_OFF || 0, T0: null, first: true, was: false });
    }
  }
  FL.tracePath = (n) => (TR[n || 0] ? TR[n || 0].pts : pts).map(p => [p[0] / C.trace.S + C.trace.OX, p[1] / C.trace.S + C.trace.OY]);
  FL.traceCount = () => TR.length;
  let cur = pts;
  function taper(a, b, w0, w1, col, blur, al) { const x = tx, n = Math.max(1, b - a), pts = cur;
    for (let i = a; i < b; i += 2) { const f = (i - a) / n; x.globalAlpha = al * (0.7 + 0.3 * f); x.lineWidth = w0 + (w1 - w0) * f; x.strokeStyle = col; x.filter = blur ? `blur(${blur}px)` : 'none';
      x.beginPath(); x.moveTo(...pts[i]); x.lineTo(...pts[Math.min(b, i + 2)]); x.stroke(); } }
  function drawOne(R, t, on) {
    const c = R.cfg, x = tx, N = 200, CYC = c.DRAW + c.FADE + c.GAP, pts = R.pts; cur = pts;
    if (on && !R.was) { R.T0 = t + R.off; R.first = true; } R.was = on;
    if (!on || R.T0 == null || t < R.T0) return false;
    let u = t - R.T0; if (u >= CYC) { R.first = false; R.T0 += CYC * Math.floor(u / CYC); u = t - R.T0; }
    const d = Math.min(1, u / c.DRAW), e = d < .5 ? 2 * d * d : 1 - 2 * (1 - d) * (1 - d), k = Math.round(e * N), ha = u < c.DRAW ? 1 : Math.max(0, 1 - (u - c.DRAW) / c.FADE);
    x.lineCap = 'round'; x.lineJoin = 'round'; const tr = R.first ? k : N;
    taper(0, tr, 7, 11, 'rgb(0,50,220)', 5, 0.8); taper(0, tr, 1.8, 3, 'rgb(40,120,255)', 1, 0.95);
    if (ha > 0 && k > 2) { const a0 = Math.max(0, k - 40);
      taper(a0, k, 6, 16, 'rgb(0,60,255)', 6, 0.9 * ha); taper(a0, k, 2, 4.5, 'rgb(70,150,255)', 1.2, ha);
      const h = pts[k], q = pts[Math.max(0, k - 3)], ang = Math.atan2(h[1] - q[1], h[0] - q[0]);
      x.filter = 'blur(2px)'; x.save(); x.translate(h[0], h[1]); x.rotate(ang); x.scale(1.8, 1.15);
      const G = x.createRadialGradient(0, 0, 0, 0, 0, 26); G.addColorStop(0, 'rgba(150,205,255,' + ha + ')'); G.addColorStop(0.3, 'rgba(30,100,255,' + ha + ')'); G.addColorStop(1, 'rgba(0,40,200,0)');
      x.globalAlpha = 1; x.fillStyle = G; x.beginPath(); x.arc(0, 0, 26, 0, 6.3); x.fill(); x.restore();
      const src = pts[0], sx = src[0] - 6, sy = src[1] - 34, B = x.createLinearGradient(sx, sy, h[0], h[1]);
      B.addColorStop(0, 'rgba(60,140,255,0)'); B.addColorStop(0.5, 'rgba(40,110,255,' + (0.16 * ha) + ')'); B.addColorStop(1, 'rgba(60,140,255,' + (0.35 * ha) + ')');
      x.filter = 'blur(3px)'; x.strokeStyle = B; x.lineWidth = 5; x.globalAlpha = 1; x.beginPath(); x.moveTo(sx, sy); x.lineTo(h[0], h[1]); x.stroke(); }
    x.globalAlpha = 1; x.filter = 'none'; return true;
  }
  function drawTrace(t, on) {
    const c = C.trace; tx.clearRect(0, 0, c.W, c.H); tx.filter = 'none'; let any = false;
    for (const R of TR) any = drawOne(R, t, on) || any;
    return any;
  }
  function put(ctx, l, src, alpha) {
    if (!src) return; const w = l.w, h = l.h, cx = l.x + w / 2, cy = l.y + h / 2;
    ctx.save(); ctx.globalAlpha = alpha * (l.opacity == null ? 1 : l.opacity); ctx.globalCompositeOperation = l.blend === 'screen' ? 'screen' : 'source-over';
    ctx.translate(cx, cy); if (l.rot) ctx.rotate(l.rot * Math.PI / 180); ctx.drawImage(src, -w / 2, -h / 2, w, h); ctx.restore();
  }
  FL.visible = function () {
    const m = FL.mode, v = {};
    C.layers.forEach(l => {
      let on = m !== 'off';
      if (m === 'ear') on = l.id === 'photo';
      else if (on && l.id !== 'photo') on = FL.ringOn && (['earglow', 'glow', 'under'].includes(l.id) ? FL.glowOn : true);
      v[l.id] = on;
    });
    return v;
  };
  function drawLoop(ctx, wall, alpha, v) {
    const L = id => C.layers.find(l => l.id === id), G = SP.G, ringOn = v.ring, ims = SP.im;
    C.layers.slice().map((l, i) => [l, i]).sort((a, b) => (a[0].z - b[0].z) || (a[1] - b[1])).forEach(([l]) => {
      if (!v[l.id]) return;
      if (l.id === 'ring') {                                  // contact shadow under, ring, then the halo that falls off into hair and skin
        ctx.save(); ctx.globalAlpha = alpha; ctx.drawImage(ims['ring-shadow-v337p.webp'], G.ox, G.oy); ctx.restore();
        put(ctx, l, IM[l.src], alpha);
        ctx.save(); ctx.globalAlpha = alpha * (0.82 + 0.18 * Math.sin(6.2832 * wall / 8)); ctx.globalCompositeOperation = G.op || 'screen'; ctx.drawImage(ims['ring-halo-v337p.webp'], G.ox, G.oy); ctx.restore();
      }
      else if (l.id === 'icons') drawLoopRunes(ctx, wall, alpha);
      else if (l.id === 'trace') drawLoopTrace(ctx, wall, true, alpha, l);
      else put(ctx, l, IM[l.src], alpha);
    });
    if (!v.trace) SP.T.forEach(S => { S.was = false; });     // like the live path: the draw-in starts over when the traces come back
  }
  FL.draw = function (ctx, wall, alpha) {
    if (!FL.ready || alpha <= 0.001) return;
    const v = FL.visible(), t = wall;
    if (SP.ok) return drawLoop(ctx, wall, alpha, v);
    if (v.icons) drawIcons(t);
    const traceOn = drawTrace(t, !!v.trace);
    C.layers.slice().map((l, i) => [l, i]).sort((a, b) => (a[0].z - b[0].z) || (a[1] - b[1])).forEach(([l]) => {
      if (!v[l.id]) return;
      if (l.id === 'icons') put(ctx, l, icv, alpha);
      else if (l.id === 'trace') { if (traceOn) put(ctx, l, tcv, alpha); }
      else put(ctx, l, IM[l.src], alpha);
    });
  };
})();
