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
  const names = new Set([...Object.values(EG.A.faces), ...Object.values(EG.A.patches), ...Object.values(EG.A.pairs).flat(), ...Object.values((EG.A.eyes || {}).dirs || {}), ...Object.values(EG.A.mouth_patch || {})]);
  await Promise.all([...names].map(n => new Promise(res => { const i = new Image(); i.onload = i.onerror = () => res(); i.src = 'img/' + n; EG.IM[n] = i; })));
  if (/[?&]rec/.test(location.search)) EG.rec = [];
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
  T.base = []; T.beats = []; T.mouth = []; T.patch = p ? [{t: -1, name: p.name, fade: 0, k: 1}] : []; T.caps = []; EG.mouthPrev = 'closed'; }
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
    const p = x * n, i = Math.min(n - 1, Math.floor(p)), u = p - i; ins(T.base, {t: t0 + t, img: frames[i], mix: u > 0.002 ? frames[i + 1] : null, u}); }
  T.beats.push({t0, t1: t0 + D, solid: t0, peak: t0 + easeS, face, ambient: true}); return D; }
function egPatchAt(t) {
  const i = last(T.patch, t); if (i < 0) return null; const e = T.patch[i];
  return {name: e.name, k: e.k, u: e.fade ? ease((t - e.t) / e.fade) : 1, prev: i > 0 ? {name: T.patch[i - 1].name, k: T.patch[i - 1].k == null ? 1 : T.patch[i - 1].k} : null};
}
/* ---------- renderer ---------- */
let CX = null, blinkUntil = 0, nextBlink = 0;
function egInit(canvas) { CX = canvas.getContext('2d'); }
function draw(n, a) { const im = EG.IM[n]; if (!im || !im.naturalWidth) return; CX.globalAlpha = a; CX.drawImage(im, 0, 0, EG.A.W, EG.A.H); CX.globalAlpha = 1; }
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
    draw(EG.A.faces.amused, 1);                                                 // v3: one base; the mouth is a registered patch on it
    if (u < 1 && pv !== cur) { drawMouth(pv, 1); drawMouth(cur, ease(u)); } else drawMouth(cur, 1);   // blend between visemes
    st.layer = 'talk'; st.mouth = cur;
    const p = egPatchAt(t), blink = wall < blinkUntil;
    if (p) { if (p.name && p.prev && p.prev.name && p.u < 1) drawPatch(p.prev.name, p.prev.k * (1 - p.u * (p.prev.name === p.name ? 1 : 0.35)), blink);   // v3: prev keeps its own strength
      if (p.name) drawPatch(p.name, p.u * p.k, blink); else if (p.prev && p.prev.name) drawPatch(p.prev.name, p.prev.k * (1 - p.u), blink);
      st.patch = p.name; st.patchA = +(p.name ? p.u * p.k : 0).toFixed(3); st.patchPrev = p.prev ? p.prev.name : null; }
    const pa = p ? (p.name ? p.u * p.k : (p.prev && p.prev.name ? p.prev.k * (1 - p.u) : 0)) : 0;
    if (!blink && pa < 0.35) { const g = egEyesAt(wall); if (g) { drawEyes(g.dir, g.a); st.eyes = g.dir; st.eyesA = +g.a.toFixed(3); } }   // v3 glances
    if (blink) { if (!p || (!p.name && !(p.prev && p.prev.name && p.u < 1))) drawPatch('amused', 1, true); st.blink = 1; }
  }
  if (EG.rec) EG.rec.push(st);
  return st;
}
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
