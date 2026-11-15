/* Emotion pad (Drue 111426 0423 via Aloy). Self-contained module for v3.2.6.
   Tap or drag on the face: Aloy blends to that spot and HOLDS on release.
   Center = neutral; straight down = sad, tears at the very bottom; top-left = angry,
   top-right = happy. Other moods sit around the pad so all are reachable.
   Hook points: see ../../PAD-MERGE.md (this file lives in the build/ copy). */
'use strict';
const PAD = window.PAD = {
  on: false, x: 0, y: 0, tx: 0, ty: 0, dragging: false, last: 0,
  face: 'amused', label: 'Neutral', arousal: 0, tears: 0, tearName: null,
  blend: [], map: [], ptr: null, KEY: 'aloyPad', POS: 'aloyPadPos',
  EASE: 0.14,            // seconds, follow the pointer (no snap)
  RAD_POW: 1.65,         // extremes only near the edges (Drue ease-in)
  TEAR_Y: -0.82          // tears trigger in the bottom zone
};

const PAD_DEFAULT_MAP = [
  {id: 'amused',                    x:  0.00, y:  0.00, label: 'Neutral'},
  {id: 'thinking',                  x:  0.00, y:  0.40, label: 'Thinking'},
  {id: 'listening',                 x:  0.28, y:  0.12, label: 'Listening'},
  {id: 'focused',                   x: -0.42, y:  0.52, label: 'Focused'},
  {id: 'determined',                x: -0.92, y:  0.92, label: 'Angry'},
  {id: 'alert',                     x: -0.28, y:  0.90, label: 'Alert'},
  {id: 'surprised',                 x:  0.22, y:  0.86, label: 'Surprised'},
  {id: 'proud',                     x:  0.62, y:  0.58, label: 'Proud'},
  {id: 'excited',                   x:  0.86, y:  0.78, label: 'Excited'},
  {id: 'laughing',                  x:  0.98, y:  0.98, label: 'Laugh'},
  {id: 'confused',                  x: -0.80, y:  0.32, label: 'Confused'},
  {id: 'skeptical',                 x: -0.88, y:  0.02, label: 'Skeptical'},
  {id: 'worried',                   x: -0.78, y: -0.32, label: 'Worried'},
  {id: 'apologetic',                x: -0.58, y: -0.62, label: 'Sorry'},
  {id: 'flirty-halflid',            x:  0.58, y:  0.22, label: 'Flirty'},
  {id: 'relieved',                  x:  0.52, y: -0.12, label: 'Relieved'},
  {id: 'crosseyed',                 x:  0.82, y: -0.42, label: 'Silly'},
  {id: 'sleepy',                    x: -0.38, y: -0.50, label: 'Sleepy'},
  {id: 'drowsy',                    x: -0.52, y: -0.68, label: 'Drowsy'},
  {id: 'justwoke',                  x: -0.18, y: -0.34, label: 'Just woke'},
  {id: 'sad',                       x:  0.00, y: -0.70, label: 'Sad'},
  {id: 'hurt-holding-back-tears',   x:  0.00, y: -1.00, label: 'Tears',  tears: true},
  {id: 'furious-hurt-tears',        x: -0.62, y: -0.92, label: 'Hurt',   tears: true}
];

const padEase = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
const padClamp = (v, a, b) => Math.max(a, Math.min(b, v));

function padFaceOk(id) {
  return !!(id && window.EG && EG.A && EG.A.faces && EG.A.faces[id] && EG.IM[EG.A.faces[id]] && EG.IM[EG.A.faces[id]].naturalWidth);
}

function padRebuildMap() {
  const src = (PAD._cfg && Array.isArray(PAD._cfg.anchors) && PAD._cfg.anchors.length) ? PAD._cfg.anchors : PAD_DEFAULT_MAP;
  PAD.map = src.filter(a => a && a.id && padFaceOk(a.id)).map(a => ({
    id: a.id, x: +a.x, y: +a.y, label: a.label || a.id, tears: !!a.tears
  }));
  if (!PAD.map.some(a => a.id === 'amused') && padFaceOk('amused')) PAD.map.unshift({id: 'amused', x: 0, y: 0, label: 'Neutral'});
}

function padApplyRadius(x, y) {
  const r = Math.hypot(x, y); if (r < 1e-6) return [0, 0];
  const rEdge = r / Math.max(Math.abs(x), Math.abs(y), 1e-6); // distance to the square edge in this direction
  const u = padClamp(r / rEdge, 0, 1);
  const e = Math.pow(u, PAD.RAD_POW);
  const r2 = e * rEdge;
  return [x / r * r2, y / r * r2];
}

function padPairFrames(a, b) {
  const pairs = (EG.A && EG.A.pairs) || {}, Fa = EG.A.faces[a], Fb = EG.A.faces[b];
  if (!Fa || !Fb) return null;
  if (pairs[a + '-to-' + b]) return [Fa, ...pairs[a + '-to-' + b], Fb];
  if (pairs[b + '-to-' + a]) return [Fb, ...pairs[b + '-to-' + a], Fa].slice().reverse();
  return null;
}

function padWeights(x, y) {
  const pts = PAD.map; if (!pts.length) return [];
  const ds = pts.map(p => ({p, d: Math.hypot(x - p.x, y - p.y)}));
  ds.sort((a, b) => a.d - b.d);
  const near = ds.slice(0, 3);
  if (near[0].d < 0.045) return [{id: near[0].p.id, w: 1, label: near[0].p.label, tears: near[0].p.tears, d: near[0].d}];
  // drop a 3rd neighbour that's clearly farther than the first two
  if (near.length === 3 && near[2].d > near[1].d * 2.1 && near[2].d > 0.55) near.pop();
  const k = 2, eps = 0.018;
  let sum = 0; const out = near.map(n => { const w = 1 / Math.pow(n.d + eps, k); sum += w; return {id: n.p.id, w, label: n.p.label, tears: n.p.tears, d: n.d}; });
  out.forEach(o => o.w /= sum);
  return out;
}

function padEnsureTears(wts, x, y) {
  if (y > PAD.TEAR_Y) return wts;
  const name = x < -0.35 ? 'furious-hurt-tears' : 'hurt-holding-back-tears';
  if (!padFaceOk(name)) return wts;
  const depth = padClamp((-PAD.TEAR_Y - y) / (1 + PAD.TEAR_Y), 0, 1); // 0 at tear line, 1 at y=-1
  if (depth <= 0) return wts;
  const already = wts.find(w => w.id === name);
  if (already) { already.w = Math.max(already.w, 0.25 + 0.75 * depth); }
  else wts.push({id: name, w: 0.25 + 0.75 * depth, label: name === 'furious-hurt-tears' ? 'Hurt' : 'Tears', tears: true, d: 0});
  let s = wts.reduce((a, w) => a + w.w, 0) || 1; wts.forEach(w => w.w /= s);
  return wts;
}

function padClosed(img) { return (EG.A.closed_of && EG.A.closed_of[img]) || null; }

function padDrawBlend(wts, blink) {
  // If the two heaviest faces have a known in-between walk, use it (smoother than a raw crossfade).
  const sorted = wts.slice().sort((a, b) => b.w - a.w);
  if (sorted.length >= 2 && sorted[0].w + sorted[1].w >= 0.72) {
    const fr = padPairFrames(sorted[0].id, sorted[1].id);
    if (fr && fr.length >= 3) {
      const u = sorted[1].w / (sorted[0].w + sorted[1].w);
      const p = u * (fr.length - 1), i = Math.min(fr.length - 2, Math.floor(p)), fu = p - i;
      let a = fr[i], b = fr[i + 1];
      if (blink) { a = padClosed(a) || a; b = padClosed(b) || b; }
      draw(a, 1); if (fu > 0.002) draw(b, fu);
      return;
    }
  }
  const imgs = sorted.map(w => {
    let n = EG.A.faces[w.id]; if (blink) n = padClosed(n) || n; return {n, w: w.w};
  }).filter(x => x.n && EG.IM[x.n]);
  if (!imgs.length) { if (padFaceOk('amused')) draw(EG.A.faces.amused, 1); return; }
  draw(imgs[0].n, 1);
  let acc = imgs[0].w;
  for (let i = 1; i < imgs.length; i++) {
    acc += imgs[i].w;
    const a = imgs[i].w / (acc || 1);
    if (a > 0.002) draw(imgs[i].n, a);
  }
}

function padFollow(wall) {
  const dt = Math.min(0.05, PAD.last ? wall - PAD.last : 0.016); PAD.last = wall;
  const k = 1 - Math.exp(-dt / PAD.EASE);
  PAD.x += (PAD.tx - PAD.x) * k;
  PAD.y += (PAD.ty - PAD.y) * k;
}

function padArousal(x, y) {
  // Intensity follows distance from center, but only the upward component (sad/tears stay calm).
  const up = Math.hypot(x, Math.max(0, y));
  return padEase(padClamp(up / Math.SQRT2, 0, 1));
}

PAD.tick = function (t, wall) {
  if (!PAD.on) return PAD.face;
  padFollow(wall);
  const [ex, ey] = padApplyRadius(PAD.x, PAD.y);
  let wts = padEnsureTears(padWeights(ex, ey), ex, ey);
  PAD.blend = wts;
  const top = wts.slice().sort((a, b) => b.w - a.w)[0];
  PAD.face = (top && top.id) || 'amused';
  PAD.label = (top && top.label) || PAD.face;
  PAD.arousal = padArousal(ex, ey);
  let tearW = 0, tearName = null;
  wts.forEach(w => { if (w.tears || (EG.A.tears && EG.A.tears[w.id])) { tearW += w.w; tearName = w.id; } });
  if (ey < PAD.TEAR_Y) {
    const depth = padClamp((-PAD.TEAR_Y - ey) / (1 + PAD.TEAR_Y), 0, 1);
    tearW = Math.max(tearW, depth);
    tearName = tearName || (ex < -0.35 ? 'furious-hurt-tears' : 'hurt-holding-back-tears');
  }
  PAD.tears = tearW; PAD.tearName = tearW > 0.02 ? tearName : null;

  CX.clearRect(0, 0, EG.A.W, EG.A.H);
  const blink = (typeof blinkUntil !== 'undefined') && wall < blinkUntil;
  padDrawBlend(wts, blink);
  const st = {t: +t.toFixed(3), layer: 'talk', patch: PAD.tearName, patchA: tearW, beat: PAD.face};
  if (typeof egTears === 'function') egTears(st, wall);
  padSyncUi();
  return PAD.face;
};

PAD.state = function () {
  return {
    on: !!PAD.on, x: +PAD.x.toFixed(4), y: +PAD.y.toFixed(4), tx: +PAD.tx.toFixed(4), ty: +PAD.ty.toFixed(4),
    face: PAD.face, label: PAD.label, arousal: +PAD.arousal.toFixed(3), tears: +PAD.tears.toFixed(3),
    tearName: PAD.tearName, dragging: !!PAD.dragging, held: !PAD.dragging,
    blend: (PAD.blend || []).map(w => ({id: w.id, w: +w.w.toFixed(3), label: w.label})),
    map: PAD.map.map(a => ({id: a.id, x: a.x, y: a.y, label: a.label}))
  };
};

function padSavePos() {
  try { localStorage.setItem(PAD.POS, JSON.stringify({x: PAD.tx, y: PAD.ty})); } catch (e) {}
}
function padSaveOn() {
  try { localStorage.setItem(PAD.KEY, PAD.on ? '1' : '0'); } catch (e) {}
}
function padLoadPos() {
  try {
    const p = JSON.parse(localStorage.getItem(PAD.POS) || 'null');
    if (p && isFinite(+p.x) && isFinite(+p.y)) {
      PAD.tx = padClamp(+p.x, -1, 1); PAD.ty = padClamp(+p.y, -1, 1);
      PAD.x = PAD.tx; PAD.y = PAD.ty;
    }
  } catch (e) {}
}

function padSurface() { return document.getElementById('padSurface'); }
function padDot() { return document.getElementById('padDot'); }
function padLabelEl() { return document.getElementById('padLabel'); }

function padSyncUi() {
  const surf = padSurface(); if (!surf) return;
  surf.hidden = !PAD.on;
  document.body.classList.toggle('pad-on', !!PAD.on);
  const tog = document.getElementById('padToggle');
  if (tog && tog.checked !== !!PAD.on) tog.checked = !!PAD.on;
  const dot = padDot(), lab = padLabelEl();
  if (!PAD.on) { if (dot) dot.hidden = true; if (lab) lab.hidden = true; return; }
  const r = surf.getBoundingClientRect(), x = (PAD.tx + 1) / 2 * r.width, y = (1 - PAD.ty) / 2 * r.height;
  if (dot) { dot.hidden = false; dot.style.left = x + 'px'; dot.style.top = y + 'px'; }
  if (lab) { lab.hidden = false; lab.textContent = PAD.label || ''; }
}

function padFromEvent(e) {
  const surf = padSurface(); if (!surf) return null;
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
  const cx = t.clientX, cy = t.clientY; if (cx == null) return null;
  const r = surf.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  // Map against the stage/face; points outside clamp to the edge so a drag can start or travel anywhere on screen.
  return {
    x: padClamp(((cx - r.left) / r.width) * 2 - 1, -1, 1),
    y: padClamp(-(((cy - r.top) / r.height) * 2 - 1), -1, 1)
  };
}

function padAim(e) {
  const p = padFromEvent(e); if (!p) return;
  PAD.tx = p.x; PAD.ty = p.y; padSavePos(); padSyncUi();
}

function padEventPoint(e) {
  const t = (e.touches && e.touches[0]) || (e.changedTouches && e.changedTouches[0]) || e;
  return (t && t.clientX != null) ? {x: t.clientX, y: t.clientY} : null;
}

function padIsUi(el) {
  if (!el || !el.closest) return false;
  // Real controls keep their taps. Focus is special: a tap still cycles it, a drag is the pad
  // (the Focus chip sits on the happy / top-right corner of the stage).
  if (el.closest('#focusBtn, #toast, #statusLine, #pcNote, #tapGate')) return 'soft';
  if (el.closest('button, input, textarea, select, a, #setup, #setupTabs, #compose, #menu, #pull, #marksBox, #suggest, #palette')) return 'hard';
  return null;
}

function padDown(e) {
  if (!PAD.on) return;
  if (e.pointerType === 'mouse' && e.button != null && e.button !== 0) return;
  if (e.pointerId != null && PAD.ptr != null && PAD.dragging) return;
  const kind = padIsUi(e.target);
  const pt = padEventPoint(e); if (!pt) return;
  PAD._sx = pt.x; PAD._sy = pt.y; PAD.ptr = (e.pointerId != null) ? e.pointerId : 'touch';
  if (kind === 'hard') { PAD.dragging = false; PAD.ptr = null; return; }
  if (kind === 'soft') { PAD.dragging = 'maybe'; return; }   // wait to see if this is a drag
  e.preventDefault();
  PAD.dragging = true;
  try { if (e.pointerId != null && e.currentTarget && e.currentTarget.setPointerCapture) e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
  padAim(e);
}
function padMove(e) {
  if (!PAD.on) return;
  if (e.pointerId != null && PAD.ptr != null && e.pointerId !== PAD.ptr && PAD.ptr !== 'touch') return;
  const pt = padEventPoint(e);
  if (PAD.dragging === 'maybe') {
    if (!pt) return;
    const d = Math.hypot(pt.x - PAD._sx, pt.y - PAD._sy);
    if (d < 8) return;
    PAD.dragging = true;
    e.preventDefault();
    padAim(e);
    return;
  }
  if (!PAD.dragging) return;
  e.preventDefault();
  padAim(e);
}
function padUp(e) {
  if (!PAD.dragging) { PAD.ptr = null; return; }
  if (e.pointerId != null && PAD.ptr != null && e.pointerId !== PAD.ptr && PAD.ptr !== 'touch') return;
  if (PAD.dragging === 'maybe') { PAD.dragging = false; PAD.ptr = null; return; }  // a tap, let Focus handle it
  if (e && e.preventDefault) e.preventDefault();
  padAim(e);
  PAD.dragging = false; PAD.ptr = null;        // HOLD: target stays, ease finishes, face stays
}

PAD.setOn = function (on, save) {
  on = !!on;
  if (on && (window.BOT && BOT !== 'aloy' || window.MSG)) on = false;
  const was = PAD.on; PAD.on = on;
  if (save) padSaveOn();
  if (on) {
    padRebuildMap();
    if (typeof stopAll === 'function') stopAll();
    if (typeof egReset === 'function') egReset(false);
    if (typeof P !== 'undefined') { P.mode = 'pad'; P.amb = null; P.idleNext = Infinity; }
    if (typeof setCaption === 'function') setCaption('Emotion pad');
    if (typeof setPb === 'function') setPb(true);
    if (typeof openSettings === 'function' && was !== true) openSettings(false);
    const compose = document.getElementById('compose'); if (compose) compose.hidden = true;
    PAD.last = 0;
  } else {
    if (window.FocusRotate && FocusRotate.setActivity) FocusRotate.setActivity(null);
    if (typeof P !== 'undefined' && P.mode === 'pad') {
      P.mode = 'idle';
      if (typeof toNeutral === 'function') toNeutral(P.clock());
    }
    if (typeof setCaption === 'function' && was) setCaption('');
  }
  padSyncUi();
  return PAD.on;
};

PAD.boot = function () {
  padRebuildMap();
  padLoadPos();
  let want = false;
  try { want = localStorage.getItem(PAD.KEY) === '1'; } catch (e) {}
  if (want && !(window.MSG) && (typeof BOT === 'undefined' || BOT === 'aloy')) {
    PAD.setOn(true, false);
    return true;
  }
  padSyncUi();
  return false;
};

PAD.initUi = function () {
  const tog = document.getElementById('padToggle');
  if (tog && !tog._padBound) {
    tog._padBound = true;
    tog.onchange = () => PAD.setOn(tog.checked, true);
  }
  // Listen on the document in capture so a drag can start anywhere on the screen
  // (Drue: "tap or drag anywhere"), including the top-right corner under the Focus chip.
  // Hard UI (gear, playback, settings, compose) keeps its taps; Focus is tap-or-drag.
  if (!document._padBound) {
    document._padBound = true;
    const opt = {passive: false, capture: true};
    document.addEventListener('pointerdown', padDown, opt);
    document.addEventListener('pointermove', padMove, opt);
    document.addEventListener('pointerup', padUp, opt);
    document.addEventListener('pointercancel', padUp, opt);
    // Touch fallback only when PointerEvent is missing (Chromium already turns touches into pointers;
    // binding both would fire padDown twice and drop the pointerId).
    if (!window.PointerEvent) {
      document.addEventListener('touchstart', padDown, opt);
      document.addEventListener('touchmove', padMove, opt);
      document.addEventListener('touchend', padUp, opt);
      document.addEventListener('touchcancel', padUp, opt);
    }
  }
  // If a control takes the face (demo / compose / type), leave the pad.
  ['playbackBtn', 'composeBtn', 'composePlay', 'pdRoundBtn'].forEach(id => {
    const el = document.getElementById(id); if (!el || el._padBound) return;
    el._padBound = true;
    el.addEventListener('click', () => { if (PAD.on) PAD.setOn(false, true); }, true);
  });
  const demo = document.getElementById('demoList');
  if (demo && !demo._padBound) { demo._padBound = true; demo.addEventListener('click', () => { if (PAD.on) PAD.setOn(false, true); }, true); }
};

async function padLoadCfg() {
  try {
    const r = await fetch('pad-map.json', {cache: 'no-cache'});
    if (r.ok) PAD._cfg = await r.json();
  } catch (e) { PAD._cfg = null; }
  padRebuildMap();
}
PAD.loadCfg = padLoadCfg;

// Bind UI now (scripts sit at the end of body). Map rebuild waits for egLoad via PAD.boot().
PAD.initUi();
padLoadCfg();
document.addEventListener('gesturestart', e => { if (PAD.on) e.preventDefault(); }, {passive: false});
