/* Aloy emote engine v2 (Jarvis 111326 2050). One renderer, two drivers:
   - Eve demos: tracks built from demos/<id>/script.json, clock = audio.currentTime
   - Type-and-play: the bot's server voice (MP3 + Rhubarb cues), clock = performance.now()
   Layers: base frame (beats use full frames) | mouth frame (viseme) | upper-face patch (expression) | blink patch. */
'use strict';
const BREAKS = ',.!?;:\u2014\u2026';
const EG = window.EG = {A:null, VM:null, EM:null, IM:{}, emo:{}, tags:{}, rec:null};
const ease = u => u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u);
async function egLoad() {
  const j = p => fetch(p, {cache: 'no-cache'}).then(r => r.json());
  [EG.A, EG.VM, EG.EM, EG.demos] = await Promise.all([j('assets.json'), j('viseme-map.json'), j('emote-map.json'), j('demos.json')]);
  for (const m of EG.EM.markers) { m.emoji.forEach(e => EG.emo[e.replace(/\uFE0F/g, '')] = m); m.tags.forEach(t => EG.tags[t.toLowerCase()] = m); }
  const names = new Set([...Object.values(EG.A.faces), ...Object.values(EG.A.patches), ...Object.values(EG.A.pairs).flat(), ...Object.values((EG.A.eyes || {}).dirs || {}), ...Object.values(EG.A.mouth_patch || {}), ...Object.values(EG.A.tears || {}).map(x => x.sprite)]);
  const loadOne = n => new Promise(res => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = 'img/' + n; EG.IM[n] = i; });
  const pri = egPriorityNames([...names]), priSet = new Set(pri);
  await Promise.all(pri.map(loadOne));                                          // v3.2.8: first face can show before the rest of the pack
  EG._pendingNames = [...names].filter(n => !priSet.has(n));
  EG._loadOne = loadOne;
  EG.loadRest = null;   // started after data-ready so boot fetches are not stuck behind ~20 MB of images
  if (/[?&]rec/.test(location.search)) EG.rec = [];
}
function egStartLoadRest() {
  if (EG.loadRest) return EG.loadRest;
  const loadOne = EG._loadOne || (n => new Promise(res => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = 'img/' + n; EG.IM[n] = i; }));
  const pending = EG._pendingNames || [], prefer = [];
  const add = n => { if (n && pending.includes(n) && !prefer.includes(n)) prefer.push(n); };
  const A = EG.A || {}, F = A.faces || {};
  const demo = (EG.demos || []).find(d => d.id === 'all-expressions') || {};
  (demo.seq || []).forEach(f => { add(F[f]); add((A.closed_of || {})[F[f]]); });
  Object.values(A.pairs || {}).forEach(fr => fr.forEach(add));
  EG.loadRest = Promise.all([...prefer, ...pending.filter(n => !prefer.includes(n))].map(loadOne));
  return EG.loadRest;
}
function egPriorityNames(all) {                  // only the first face + the laugh walk (~1.3 MB) so data-ready is not stuck behind the 20 MB pack
  const A = EG.A, F = A.faces || {}, have = new Set(all), out = [];
  const add = n => { if (n && have.has(n) && !out.includes(n)) out.push(n); };
  const addFace = f => { if (F[f]) { add(F[f]); add((A.closed_of || {})[F[f]] || F[f + '-closed']); } };
  addFace('amused'); addFace('laughing');
  ((A.pairs || {})['laughing-to-amused'] || []).forEach(add);
  return out;
}
function egTeethConflict(a, b) {                 // v3.2.8: two teeth-showing faces at different jaw positions must not be crossfaded
  if (!a || !b || a === b) return false;
  const C = EG.A.teeth_conflict; if (!C) return false;
  const k = a < b ? a + '|' + b : b + '|' + a;
  return Array.isArray(C) ? C.indexOf(k) >= 0 : !!C[k];
}
/* ---------- marker parser (twin of markers.py) ---------- */
function egTokenize(text) {
  text = text.replace(/\uFE0F/g, '');
  const keys = Object.keys(EG.emo).sort((a, b) => b.length - a.length).map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp('\\[([A-Za-z][A-Za-z\\- ]*)\\]|' + keys.join('|'), 'gu'); const out = []; let pos = 0, m;
  while ((m = re.exec(text))) { out.push(['text', text.slice(pos, m.index)]); pos = re.lastIndex;
    const ent = m[1] ? EG.tags[m[1].trim().toLowerCase()] : EG.emo[m[0]]; if (ent) out.push(['m', ent]); }
  out.push(['text', text.slice(pos)]);
  return out.map(([k, v]) => k === 'text' ? [k, v.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u200d]/gu, '')] : [k, v]);
}
function egParse(text) {
  const items = []; let buf = '', cues = [], pending = null;
  const squeeze = raw => { let out = '', sp = false; const mp = [];        // raw index -> text index, so a cue keeps its exact spot (even inside a word)
    for (const ch of raw) { const n = ch.length; if (/\s/.test(ch)) { for (let i = 0; i < n; i++) mp.push(out.length); sp = out.length > 0; }
      else { if (sp) { out += ' '; sp = false; } for (let i = 0; i < n; i++) mp.push(out.length + i); out += ch; } }
    mp.push(out.length); return [out, mp]; };
  const flush = () => { const [t, mp] = squeeze(buf);
    if (t) items.push({say: t, cues: cues.map(([c, f, k]) => [Math.min(mp[c], t.length), f, k])});
    else if (cues.length) items.push({say: '', cues: cues.map(([, f, k]) => [0, f, k])});
    buf = ''; cues = []; };
  const atBreak = () => { const s = buf.trimEnd(); return !s || BREAKS.includes(s[s.length - 1]); };
  for (let [k, v] of egTokenize(text)) {
    if (k === 'm') { if (v.kind === 'peak') { if (atBreak()) { flush(); items.push({beat: v.face}); } else pending = v.face; }
      else cues.push([buf.length, v.face, v.kind]); continue; }
    while (pending && v) { let idx = -1;
      for (let i = 0; i < v.length; i++) if (BREAKS.includes(v[i]) && (i + 1 === v.length || /\s/.test(v[i + 1]))) { idx = i; break; }
      if (idx < 0) break; buf += v.slice(0, idx + 1); v = v.slice(idx + 1); flush(); items.push({beat: pending}); pending = null; }
    buf += v;
  }
  flush(); if (pending) items.push({beat: pending});
  return items;
}
/* ---------- tracks ---------- */
const T = EG.T = {base: [], beats: [], mouth: [], patch: [], caps: []};
function egReset(keepPatch) { const p = keepPatch ? egPatchAt(Infinity) : null;
  T.base = []; T.beats = []; T.mouth = []; T.patch = p ? [{t: -1, name: p.name, fade: 0, k: 1}] : []; T.caps = []; EG.mouthPrev = 'closed'; if (typeof egTearsClear === 'function') egTearsClear(); }
const ins = (arr, e) => { let i = arr.length; while (i > 0 && arr[i - 1].t > e.t) i--; arr.splice(i, 0, e); };
const last = (arr, t) => { let lo = 0, hi = arr.length - 1, r = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (arr[m].t <= t) { r = m; lo = m + 1; } else hi = m - 1; } return r; };
function egBeat(t0, face) {
  const b = EG.A.beats[face]; if (!b) return 0;
  for (const [dt, img, mix, u] of b.plan) ins(T.base, {t: t0 + dt, img, mix, u});
  T.beats.push({t0, t1: t0 + b.dur, solid: t0 + EG.EM.beat.lead, peak: t0 + b.peak_at, face});
  ins(T.patch, {t: t0, name: null, fade: EG.EM.beat.lead * 0.9, k: 1});
  return b.dur;
}
function egCue(t, face, kind) { ins(T.patch, {t, name: kind === 'smile' || face === 'amused' ? null : face, fade: EG.EM.talk_fade, k: 1}); }
/* mouth: segs [[t0,t1,viseme]] -> frame events with half-frame entries/exits */
function egMouth(segs, close = true) {
  const V = EG.VM.visemes, tm = EG.VM.timing, half = tm.half_ms / 1000, minS = tm.min_segment_ms / 1000;
  const r = [];                                     // resolve hold / next / gap
  for (let i = 0; i < segs.length; i++) { let [a, b, v] = segs[i];
    if (v === 'skip') continue;
    if (v === 'next') { const n = segs.slice(i + 1).find(s => V[s[2]]); v = n ? n[2] : 'sil'; }
    if (v === 'gap') v = (b - a > 0.09) ? 'sil' : 'hold';
    if (v === 'hold' || !V[v]) { if (r.length) { r[r.length - 1][1] = b; continue; } v = 'sil'; }
    const s = V[v].shape, lv = s === 'closed' ? 'full' : V[v].level, key = s + ':' + lv, p = r[r.length - 1];
    if (p && (p[2] === key || b - a < minS)) { p[1] = b; continue; }
    r.push([a, b, key]);
  }
  const SH = EG.VM.shapes || {}, direct = s => (SH[s] && SH[s].entry === 'direct') || EG.A.mouth[s].half === EG.A.mouth[s].full;
  const hf = s => direct(s) ? EG.A.mouth[s].full : EG.A.mouth[s].half;     // v3: 'direct' shapes (pbm, th) never show their half frame
  let prev = EG.mouthPrev || 'closed';
  for (const [a, b, key] of r) { const [s, lv] = key.split(':');
    if (s === 'closed') { if (prev !== 'closed') { ins(T.mouth, {t: a, img: hf(prev)}); ins(T.mouth, {t: a + Math.min(half, (b - a) / 2), img: null}); } else ins(T.mouth, {t: a, img: null}); prev = 'closed'; continue; }
    const M = EG.A.mouth[s];
    if (direct(s)) ins(T.mouth, {t: a, img: M.full});
    else if (prev !== s) { ins(T.mouth, {t: a, img: M.half}); if (lv === 'full') ins(T.mouth, {t: a + Math.min(half, (b - a) / 2), img: M.full}); }
    else ins(T.mouth, {t: a, img: M[lv]});
    prev = s;
  }
  EG.mouthPrev = prev;
  if (close && r.length && prev !== 'closed') { EG.mouthPrev = 'closed'; const e = r[r.length - 1][1]; ins(T.mouth, {t: e, img: hf(prev)}); ins(T.mouth, {t: e + half, img: null}); }
}
function egLetters(word, t0, dur) {                 // typed text: spelling -> visemes spread over the word
  const L = EG.VM.letters, keys = Object.keys(L).filter(k => k[0] !== '_').sort((a, b) => b.length - a.length);
  let w = word.toLowerCase().replace(/[^a-z']/g, ''); if (w.length > 3 && /[^aeiou]e$/.test(w)) w = w.slice(0, -1);
  const vs = []; for (let i = 0; i < w.length;) { if (w[i] === "'") { i++; continue; } const k = keys.find(k => w.startsWith(k, i)) || w[i]; vs.push(L[k] || 'hold'); i += k.length; }
  if (!vs.length) return [];
  const d = dur / vs.length; return vs.map((v, i) => [t0 + i * d, t0 + (i + 1) * d, v]);
}
/* v3 frame walk (silent demo): ease through full frames [amused, ..., cap] and back, sampled at 20 Hz with adjacent-frame crossfades */
function egWalk(t0, frames, easeS, holdS, face) {
  const n = frames.length - 1, dt = 0.05, D = easeS * 2 + holdS; let t = 0;
  for (; t <= D + 1e-6; t += dt) { const x = t < easeS ? ease(t / easeS) : t < easeS + holdS ? 1 : 1 - ease((t - easeS - holdS) / easeS);
    const p = x * n, i = Math.min(n - 1, Math.floor(p)), u = p - i, nxt = u > 0.002 ? frames[i + 1] : null;
    if (nxt && egTeethConflict(frames[i], nxt)) ins(T.base, {t: t0 + t, img: u < 0.5 ? frames[i] : nxt, mix: null, u: 0});
    else ins(T.base, {t: t0 + t, img: frames[i], mix: nxt, u}); }
  T.beats.push({t0, t1: t0 + D, solid: t0, peak: t0 + easeS, face, ambient: true}); return D; }
function egChain(t0, steps, face) {   // v3.2: [[img, easeIn_s, hold_s], ...] one-way eased crossfades; blinks use each frame's closed twin
  const dt = 0.05; let t = 0; ins(T.base, {t: t0, img: steps[0][0], mix: null, u: 0}); t += steps[0][2];
  for (let i = 1; i < steps.length; i++) { const [im, e, h] = steps[i], pv = steps[i - 1][0];
    if (e > 0 && egTeethConflict(pv, im)) {        // v3.2.8: never crossfade two teeth-showing faces (double jaw / two tooth rows)
      t += e; ins(T.base, {t: t0 + t, img: im, mix: null, u: 0}); }
    else { for (let s = 0; s < e; s += dt) ins(T.base, {t: t0 + t + s, img: pv, mix: im, u: ease(s / e)});
      t += e; ins(T.base, {t: t0 + t, img: im, mix: null, u: 0}); }
    t += h; }
  T.beats.push({t0, t1: t0 + t, solid: t0, peak: t0, face, ambient: true}); return t; }
function egPatchAt(t) {
  const i = last(T.patch, t); if (i < 0) return null; const e = T.patch[i];
  return {name: e.name, k: e.k, u: e.fade ? ease((t - e.t) / e.fade) : 1, prev: i > 0 ? {name: T.patch[i - 1].name, k: T.patch[i - 1].k == null ? 1 : T.patch[i - 1].k} : null};
}
/* ---------- renderer ---------- */
let CX = null, blinkUntil = 0, nextBlink = 0;
function egInit(canvas) { CX = canvas.getContext('2d'); }
function draw(n, a) { const im = EG.IM[n]; if (!im || !im.naturalWidth) return; CX.globalAlpha = a; CX.drawImage(im, 0, 0, EG.A.W, EG.A.H); CX.globalAlpha = 1; }
function mouthSetOf(p) {
  const of = EG.A.mouth_set_of || {};
  if (p && p.name && of[p.name]) return of[p.name];   // furious, including the determined-to-furious ramp
  if (p && !p.name && p.prev && p.prev.name && of[p.prev.name] && p.u < 1) return of[p.prev.name];
  return 'amused';
}
function mouthImg(n, set) {
  const S = EG.A.mouth_sets && EG.A.mouth_sets[set];
  if (!S || set === 'amused') return n;
  if (!n || n === EG.A.faces.amused) return S.closed || n;
  return S[n] || n;
}
function drawMouth(n, a) { const mp = EG.A.mouth_patch && EG.A.mouth_patch[n], im = mp && EG.IM[mp]; if (!im || !im.naturalWidth) { draw(n, a); return; }
  const [x0, y0, x1, y1] = EG.A.mouth_box; CX.globalAlpha = Math.min(1, a); CX.drawImage(im, x0, y0, x1 - x0, y1 - y0); CX.globalAlpha = 1; }
function drawPatch(name, a, closed) { if (!name || a <= 0.003) return; const n = EG.A.patches[name + (closed ? '-closed' : '')] || EG.A.patches[name]; const im = EG.IM[n];
  if (!im || !im.naturalWidth) return; const [x0, y0, x1, y1] = EG.A.patch_box; CX.globalAlpha = Math.min(1, a); CX.drawImage(im, x0, y0, x1 - x0, y1 - y0); CX.globalAlpha = 1; }
function egRender(t, wall) {
  const st = {t: +t.toFixed(3)}, bt = T.beats.find(b => t >= b.t0 && t < b.t1);
  if (bt && t >= bt.solid) {
    const e = T.base[last(T.base, t)]; draw(e.img, 1); if (e.mix) draw(e.mix, e.u);
    st.layer = 'beat'; st.base = e.img; st.mix = e.mix || null; st.u = e.u; st.beat = bt.face;
    if (bt.ambient && wall < blinkUntil) {   // silent demo holds are long: keep blinking with the frame's own closed twin; never blink-cut sad-tears
      const co = EG.A.closed_of || {}, cur = e.mix && e.u > 0.5 ? e.mix : e.img;
      if ((!e.mix || e.u < 0.04 || e.u > 0.96) && co[cur]) { draw(co[cur], 1); st.blink = 1; } }
    if (bt.ambient) st.ambient = 1;
  } else {
    const i = last(T.mouth, t), e = i >= 0 ? T.mouth[i] : null, cur = e && e.img ? e.img : EG.A.faces.amused;
    const pv = i > 0 && T.mouth[i - 1].img ? T.mouth[i - 1].img : EG.A.faces.amused, bl = EG.VM.timing.blend_ms / 1000;
    const u = e ? (t - e.t) / bl : 1;
    const p = egPatchAt(t), set = mouthSetOf(p), curM = mouthImg(cur, set), pvM = mouthImg(pv, set);
    draw(EG.A.faces.amused, 1);                                                 // v3: one base; the mouth is a registered patch on it
    if (u < 1 && pvM !== curM) { drawMouth(pvM, 1); drawMouth(curM, ease(u)); } else drawMouth(curM, 1);   // blend between visemes (set follows the talking face)
    st.layer = 'talk'; st.mouth = curM; st.mouthSet = set;
    const blink = wall < blinkUntil;
    if (p) { if (p.name && p.prev && p.prev.name && p.u < 1) drawPatch(p.prev.name, p.prev.k * (1 - p.u * (p.prev.name === p.name ? 1 : 0.35)), blink);   // v3: prev keeps its own strength
      if (p.name) drawPatch(p.name, p.u * p.k, blink); else if (p.prev && p.prev.name) drawPatch(p.prev.name, p.prev.k * (1 - p.u), blink);
      st.patch = p.name; st.patchA = +(p.name ? p.u * p.k : 0).toFixed(3); st.patchPrev = p.prev ? p.prev.name : null; }
    const pa = p ? (p.name ? p.u * p.k : (p.prev && p.prev.name ? p.prev.k * (1 - p.u) : 0)) : 0;
    if (!blink && pa < 0.35) { const g = egEyesAt(wall); if (g) { drawEyes(g.dir, g.a); st.eyes = g.dir; st.eyesA = +g.a.toFixed(3); } }   // v3 glances
    if (blink) { if (!p || (!p.name && !(p.prev && p.prev.name && p.u < 1))) drawPatch('amused', 1, true); st.blink = 1; }
  }
  egTears(st, wall);
  if (EG.rec) EG.rec.push(st);
  return st;
}
/* v3.2.7: each tear is a spawned object that keeps falling after the expression changes, then
   removes itself when it reaches the end of its path (or times out). While a tear face is
   showing we still draw the v3.2.5 sprite so pad / nico / still holds look the same; new
   beads are also spawned so they can outlive the face. Cap + cleanup prevent a pile-up. */
const TEAR_CAP = 12;
const TEAR_LIVE = EG.tearsLive = [];
const TEAR_SCH = {};
const TEAR_PATH = {
  noseL: [[350,406],[347,430],[343,460],[340,490],[337,516],[329,542],[316,564],[303,588],[297,616],[299,648],[306,700],[310,760],[314,810]],
  noseR: [[447,411],[452,436],[456,463],[458,495],[460,526],[458,560],[453,598],[446,636],[440,668],[436,710],[432,760],[428,810]],
  lidL:  [[318,418],[314,446],[308,480],[302,520],[298,560],[298,600],[304,640],[312,676],[316,720],[320,770],[324,810]],
  lidR:  [[478,428],[482,456],[485,490],[486,530],[482,570],[474,610],[466,648],[460,700],[454,750],[448,810]]
};
const TEAR_LID = {L:[[352,409],[342,413],[330,416],[318,417],[306,415]], R:[[446,411],[456,416],[467,420],[478,423],[488,423]]};
const TEAR_DROP = {
  'furious-hurt-tears': [
    {id:'nL1', path:'noseL', form:0.00, ts:0.40, te:2.60, r:8.4},
    {id:'nR1', path:'noseR', form:0.50, ts:0.90, te:3.10, r:8.4},
    {id:'lL1', path:'lidL',  form:1.20, ts:1.55, te:3.40, r:7.4},
    {id:'lR1', path:'lidR',  form:1.80, ts:2.15, te:3.80, r:7.4},
    {id:'nL2', path:'noseL', form:2.30, ts:2.55, te:4.40, r:7.0}
  ],
  'hurt-holding-back-tears': [
    {id:'nL1', path:'noseL', form:0.10, ts:0.55, te:2.90, r:7.8},
    {id:'nR1', path:'noseR', form:1.10, ts:1.55, te:3.60, r:7.4},
    {id:'lR1', path:'lidR',  form:2.00, ts:2.40, te:4.20, r:6.8}
  ]
};
const TEAR_WELL = {'furious-hurt-tears': 0.75, 'hurt-holding-back-tears': 1.0};
const TEAR_LOOP = 4.6;
function tearLerpPath(pts, u) {
  if (!pts || !pts.length) return [0, 0];
  u = Math.max(0, Math.min(1, u));
  const seg = [0]; for (let i = 1; i < pts.length; i++) seg[i] = seg[i-1] + Math.hypot(pts[i][0]-pts[i-1][0], pts[i][1]-pts[i-1][1]);
  const L = seg[seg.length-1] || 1, s = u * L;
  for (let i = 1; i < pts.length; i++) if (s <= seg[i]) { const f = (s - seg[i-1]) / Math.max(1e-6, seg[i]-seg[i-1]); return [pts[i-1][0] + (pts[i][0]-pts[i-1][0])*f, pts[i-1][1] + (pts[i][1]-pts[i-1][1])*f]; }
  return pts[pts.length-1].slice();
}
function tearProg(age, ts, te) {
  if (age <= ts) return 0;
  const u = Math.min(1, (age - ts) / Math.max(0.05, te - ts));
  return Math.min(1, u*u*1.05 + 0.02*Math.sin(2*Math.PI*3*u)*u*(1-u));
}
function tearWeight(st, n, d) {
  let w = 0;
  if (st.layer === 'beat') { if (st.base === d.full) w += st.mix ? 1 - st.u : 1; if (st.mix === d.full) w += st.u; }
  else if (st.patch === n) w = st.patchA || 0;
  else if (!st.patch && st.patchPrev === n) { const p = egPatchAt(st.t); w = p && p.u < 1 && p.prev ? p.prev.k * (1 - p.u) : 0; }
  return w;
}
function tearSpawn(name, spec, startWall) {
  if (TEAR_LIVE.length >= TEAR_CAP) {
    TEAR_LIVE.sort((a, b) => a.t0 - b.t0);
    TEAR_LIVE.shift();
  }
  const life = (spec.te - spec.form) + 0.35;
  TEAR_LIVE.push({name, id: spec.id, path: spec.path, t0: startWall, ts: spec.ts - spec.form, te: spec.te - spec.form, life, r: spec.r, x: 0, y: 0, p: 0});
}
function tearMaybeSpawn(name, wall, w) {
  if (w <= 0.02) { if (TEAR_SCH[name]) TEAR_SCH[name].active = false; return; }
  let sch = TEAR_SCH[name];
  if (!sch || !sch.active) { sch = TEAR_SCH[name] = {t0: wall, done: {}, active: true}; }
  let local = wall - sch.t0;
  while (local >= TEAR_LOOP) { sch.t0 += TEAR_LOOP; sch.done = {}; local = wall - sch.t0; }
  (TEAR_DROP[name] || []).forEach(spec => {
    const key = spec.id + '@' + sch.t0.toFixed(3);
    if (local + 0.001 >= spec.form && !sch.done[key]) {
      sch.done[key] = 1;
      tearSpawn(name, spec, sch.t0 + spec.form);
    }
  });
}
function tearDrawBead(x, y, r, a) {
  if (a <= 0.02 || r < 0.4) return;
  CX.save(); CX.globalAlpha = Math.min(1, a);
  CX.beginPath(); CX.ellipse(x, y, r*0.85, r*1.2, 0, 0, Math.PI*2);
  CX.fillStyle = 'rgba(8,12,22,0.55)'; CX.fill();
  CX.beginPath(); CX.ellipse(x, y + r*0.45, r*0.52, r*0.36, 0, 0, Math.PI*2);
  CX.fillStyle = 'rgba(210,230,255,0.45)'; CX.fill();
  CX.beginPath(); CX.arc(x - r*0.30, y - r*0.50, Math.max(0.8, r*0.24), 0, Math.PI*2);
  CX.fillStyle = 'rgba(255,255,255,0.9)'; CX.fill();
  CX.restore();
}
function tearDrawTrack(pts, u, a) {
  if (a <= 0.02 || u <= 0.02) return;
  const n = Math.max(2, Math.floor(pts.length * u));
  CX.save(); CX.globalAlpha = Math.min(1, a * 0.85);
  CX.beginPath(); CX.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < n; i++) CX.lineTo(pts[i][0], pts[i][1]);
  CX.strokeStyle = 'rgba(30,50,80,0.55)'; CX.lineWidth = 5; CX.lineCap = 'round'; CX.lineJoin = 'round'; CX.stroke();
  CX.beginPath(); CX.moveTo(pts[0][0]-1.2, pts[0][1]);
  for (let i = 1; i < n; i++) CX.lineTo(pts[i][0]-1.2, pts[i][1]);
  CX.strokeStyle = 'rgba(200,220,255,0.45)'; CX.lineWidth = 1.6; CX.stroke();
  CX.restore();
}
function tearDrawWell(name, w, wall) {
  const well = TEAR_WELL[name] || 1, a = Math.min(1, w) * well;
  if (a <= 0.02) return;
  ['L','R'].forEach((side, j) => {
    const pl = TEAR_LID[side], sh = a * (0.55 + 0.35*Math.sin(2*Math.PI*(wall/TEAR_LOOP*2 + j*0.37)));
    CX.save(); CX.globalAlpha = Math.min(1, sh);
    CX.beginPath(); CX.moveTo(pl[0][0], pl[0][1]);
    for (let i = 1; i < pl.length; i++) CX.lineTo(pl[i][0], pl[i][1]);
    CX.strokeStyle = 'rgba(200,225,255,0.8)'; CX.lineWidth = 2.2; CX.lineCap = 'round'; CX.stroke();
    CX.restore();
  });
}
function tearDrawSprite(d, w, wall) {
  const im = EG.IM[d.sprite]; if (!im || !im.naturalWidth || w <= 0.02) return 0;
  const f = Math.floor(wall * d.fps) % d.frames, sx = (f % d.cols) * d.w, sy = Math.floor(f / d.cols) * d.h, [x0, y0, x1, y1] = d.box;
  CX.globalAlpha = Math.min(1, w); CX.drawImage(im, sx, sy, d.w, d.h, x0, y0, x1 - x0, y1 - y0); CX.globalAlpha = 1;
  return f;
}
function egTears(st, wall) { const TR = EG.A.tears; if (!TR || !CX) return;
  const weights = {};
  for (const n in TR) {
    const d = TR[n], w = tearWeight(st, n, d);
    weights[n] = w;
    tearMaybeSpawn(n, wall, w);
    if (w > 0.02) { const f = tearDrawSprite(d, w, wall); tearDrawWell(n, w, wall); st.tears = n; st.tearW = +w.toFixed(3); st.tearF = f; }
  }
  for (let i = TEAR_LIVE.length - 1; i >= 0; i--) {
    const o = TEAR_LIVE[i], age = wall - o.t0, pts = TEAR_PATH[o.path];
    if (age >= o.life || !pts) { TEAR_LIVE.splice(i, 1); continue; }
    const falling = tearProg(age, o.ts, o.te);
    const xy = tearLerpPath(pts, falling);
    o.x = xy[0]; o.y = xy[1]; o.p = falling; o.age = age;
    const fade = age < 0.08 ? age/0.08 : (age > o.life - 0.35 ? Math.max(0, (o.life - age)/0.35) : 1);
    const showing = weights[o.name] > 0.02;
    if (!showing) {
      tearDrawTrack(pts, falling, fade * 0.85);
      const swell = age < o.ts ? (0.5 + 0.5*age/Math.max(0.05, o.ts)) : (1 - 0.3*falling);
      tearDrawBead(o.x, o.y, o.r * 1.15 * swell, fade);
    }
  }
  st.tearLive = TEAR_LIVE.length;
  st.tearObjs = TEAR_LIVE.map(o => ({name: o.name, x: +o.x.toFixed(1), y: +o.y.toFixed(1), p: +o.p.toFixed(3), age: +(o.age||0).toFixed(3), life: o.life}));
  EG.tearState = {count: TEAR_LIVE.length, objs: st.tearObjs, weights};
}
function egTearsClear() { TEAR_LIVE.length = 0; for (const k in TEAR_SCH) delete TEAR_SCH[k]; }
/* v3 eye movement: idle saccades/glances with TweakX's eyes-* frames (eye-only patches), back to the viewer after each */
const EY = {dir: null, t0: 0, t1: 0, fin: 0.08, fout: 0.1, next: 0, on: true};
function drawEyes(dir, a) { const n = EG.A.eyes && EG.A.eyes.dirs[dir], im = n && EG.IM[n]; if (!im || !im.naturalWidth || a <= 0.003) return;
  const [x0, y0, x1, y1] = EG.A.eyes.box; CX.globalAlpha = Math.min(1, a); CX.drawImage(im, x0, y0, x1 - x0, y1 - y0); CX.globalAlpha = 1; }
function egEyesAt(wall) { if (!EY.dir || wall < EY.t0) return null; const end = EY.t1 + EY.fout; if (wall >= end) return null;
  const a = wall < EY.t0 + EY.fin ? ease((wall - EY.t0) / EY.fin) : wall < EY.t1 ? 1 : 1 - ease((wall - EY.t1) / EY.fout); return {dir: EY.dir, a}; }
function egGlance(wall, dir, hold) { EY.dir = dir; EY.t0 = wall; EY.t1 = wall + EY.fin + hold; }
function egEyesTick(wall, allowed, talking, amt = 1) {
  if (!EY.next) EY.next = wall + 1.5 + Math.random() * 2;
  if (wall < EY.next || !EY.on || amt <= 0) return;
  const busy = EY.dir && wall < EY.t1 + EY.fout;
  if (!busy && allowed) { const r = Math.random(), d = r < 0.34 ? 'left' : r < 0.68 ? 'right' : r < 0.86 ? 'down' : 'up';
    egGlance(wall, d, 0.35 + Math.random() * (talking ? 0.7 : 1.4)); }
  const gap = (talking ? 4.5 : 2.6) + Math.random() * (talking ? 5 : 4.5);   // most of the time she looks at the viewer
  EY.next = wall + gap / Math.max(0.25, Math.min(2, amt));
}
function egBlinkTick(wall, allowed) { if (!nextBlink) nextBlink = wall + 2.2;
  if (wall >= nextBlink) { if (allowed) blinkUntil = wall + 0.13; nextBlink = wall + 2.8 + Math.random() * 1.8; } }
