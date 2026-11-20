var MUS = {clipStart() {}, clipStop() {}};   // v3.3.7p: replaced by the real music wiring at the end of this file (stub so early stopAll() calls are safe)
/* Aloy emote v3 app wiring (Jarvis 111326). Voice = the bot's server voice (bots/<bot>.json); no phone voice. */
'use strict';
const $ = id => document.getElementById(id);
const au = $('voice'), cv = $('face');
const P = window.P = {mode: 'idle', clock: () => performance.now() / 1000, demo: null, script: null, run: 0, idleNext: 0};
const MSG = window.EMOTE_MSG || null;        // v3.1: set by a texted-link page (make_textlink.py); null in the full app
let BOTS = []; let BOTFACES = {}; let botExpr = '';
let BOT = (MSG && MSG.bot) || new URLSearchParams(location.search).get('bot') || (function(){ try { return localStorage.getItem('gx.bot'); } catch(e) { return null; } })() || 'aloy';
P.bot = BOT;
const audioVoice = new AudioCuesVoice(au); let serverVoice = null;
const EMO = {crosseyed: 'rose', sad: 'blue', 'hurt-holding-back-tears': 'blue', 'furious-hurt-tears': 'orange', 'phone-down': 'blue', 'guilty-down': 'amber', 'skeptical-up': 'amber', 'thinking-up': 'blue', amused: 'pink', laughing: 'rose', excited: 'rose', proud: 'pink', relieved: 'pink', surprised: 'teal', listening: 'blue', focused: 'blue', thinking: 'blue', determined: 'orange', alert: 'orange', worried: 'amber', apologetic: 'amber', confused: 'amber', skeptical: 'amber', sleepy: 'blue', drowsy: 'blue', justwoke: 'blue', furious: 'orange'};
let toastT; function toast(m, opts) { const t = $('toast'); t.textContent = ''; t.appendChild(document.createTextNode(m || ''));
  if (opts && opts.undo) { const b = document.createElement('button'); b.type = 'button'; b.className = 'toastUndo'; b.textContent = 'Undo';
    b.addEventListener('click', ev => { ev.preventDefault(); ev.stopPropagation(); opts.undo(); t.hidden = true; }); t.appendChild(b); }
  t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, (opts && opts.hold) || 2600); }
function setCaption(text) { $('caption').innerHTML = text ? text.split(/(\s+)/).map(w => /\S/.test(w) ? '<span>' + w.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])) + '</span>' : w).join('') : ''; }
function showCaptions(caps) { const el = $('caption'); el.innerHTML = caps.map(c => '<span>' + c[2].replace(/[&<>]/g, x => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[x])) + '</span>').join(' '); el.scrollTop = 0; }
function syncDemoCaptions(t) {                  // keep the active demo line fully in the 3.6em box (scroll, don't grow)
  if (!(P.mode === 'demo' && P.script && P.script.captions)) return;
  const box = $('caption'); if (!box) return;
  const sp = [...box.children];
  let on = null;
  P.script.captions.forEach((c, k) => { if (!sp[k]) return; const a = t >= c[0] - 0.1 && t < c[1] + 0.15; sp[k].classList.toggle('on', a); if (a) on = sp[k]; });
  if (!on) return;
  const br = on.getBoundingClientRect(), cr = box.getBoundingClientRect();
  if (br.top < cr.top) box.scrollTop += br.top - cr.top;
  else if (br.bottom > cr.bottom) box.scrollTop += br.bottom - cr.bottom;
}
function setPb(replay) { $('pbLbl').textContent = replay ? 'Replay' : 'Playback'; $('pbIcon').setAttribute('d', replay ? 'M5 12a7 7 0 1 0 2.1-5M5 4.5V9h4.5' : 'M8 5.5v13l10.5-6.5z'); }
/* ---------- render loop: always running, so the face stays full color and alive ---------- */
function loop() {
  const t = P.clock(), wall = performance.now() / 1000;
  if (window.PAD && PAD.on && BOT === 'aloy') {
    egBlinkTick(wall, true); lifeTick(wall);
    const face = PAD.tick(t, wall) || 'amused';
    drawFocus(wall, face);
    $('statusBar').className = 'emo-' + (EMO[face] || 'pink');
    sceneTick();
    requestAnimationFrame(loop); return;
  }
  if (BOT !== 'aloy') {
    egBlinkTick(wall, true); lifeTick(wall); botRender(wall);
    $('statusBar').className = 'emo-' + (EMO[botExpr] || 'blue');
    syncDemoCaptions(t);
    sceneTick();
    requestAnimationFrame(loop); return;
  }
  const inBeat = T.beats.some(b => t >= b.t0 && t < b.t1 && !b.ambient);
  egBlinkTick(wall, !inBeat && !(P.mode === 'demo' && (P.demo && P.demo.id === 'rage') && t >= 37.3 && t <= 40.6)); lifeTick(wall); dzTick(wall); EY.on = LIFE.eyes; egEyesTick(wall, !inBeat && !(P.amb && ['phone', 'lookup'].includes(P.amb.cur)), P.mode === 'demo' || P.mode === 'live', LIFE.amt);
  if (P.amb && (P.mode === 'ambient' || P.mode === 'idle')) ambientTick(t, wall); else if (P.mode === 'idle' && wall > P.idleNext) idleLook(t, wall);
  const st = egRender(t, wall);
  const face = st.beat || (st.patch && (st.patchA == null || st.patchA > 0.4) ? st.patch : null) || 'amused';
  drawFocus(wall, face);
  $('statusBar').className = 'emo-' + (EMO[face] || 'pink');
  syncDemoCaptions(t);
  if (P.mode === 'ambient' && window.MC && MC.on) mediaTickCaptions(t);
  sceneTick();
  requestAnimationFrame(loop);
}
/* ---------- v3.2.4 (Drue 111426 0257): Focus defaults to On for anyone with no saved choice. New keys aloyFocus2 / aloyFaceFx2 so an
   old saved 'off' (v3.2.3 defaulted Off) or a stale face-effect choice no longer hides the traces. v3.2.3 Focus: three-way mode off / on (light show) / earpiece only.
   Mood still drives color, spin and traces when mode is "on". Art + box in focus.json. ---------- */
const FOC = window.FOC = {cfg: null, on: false, mode: 'off', a: 0, last: 0, ringOn: true, glowOn: true};
const FOCUS_MODES = ['off', 'on', 'ear'];
const FOCUS_LABEL = {off: 'Focus off', on: 'Focus on', ear: 'Earpiece only'};
function parseFocusMode(v, fallback) {
  if (v === 'ear' || v === 'earpiece') return 'ear';
  if (v === 'on' || v === '1' || v === 'true') return 'on';
  if (v === 'off' || v === '0' || v === 'false') return 'off';
  return fallback || 'off';
}
function syncFocusUi() {
  const m = FOC.mode, btn = $('focusBtn'), lbl = $('focusLbl');
  if (btn) {
    btn.classList.toggle('on', m === 'on');
    btn.classList.toggle('ear', m === 'ear');
    btn.setAttribute('aria-pressed', String(m !== 'off'));
    btn.setAttribute('aria-label', 'Focus: ' + (FOCUS_LABEL[m] || m) + '. Tap to cycle Focus on, earpiece only, and off.');
  }
  if (lbl) lbl.textContent = m === 'ear' ? 'Earpiece' : m === 'on' ? 'Focus' : 'Focus';
  document.querySelectorAll('#focusModeSeg [data-focusmode]').forEach(b => {
    b.classList.toggle('on', b.dataset.focusmode === m);
    b.setAttribute('aria-checked', String(b.dataset.focusmode === m));
  });
}
function setFocusMode(mode, save) {
  const m = parseFocusMode(mode, 'off');
  FOC.mode = m;
  FOC.on = m !== 'off';
  if (save) {
    localStorage.setItem('aloyFocus2', m);
    localStorage.setItem('aloyFocusSeen', '1');
    const btn = $('focusBtn');
    if (btn) { btn.classList.remove('first'); btn.classList.add('showMode'); clearTimeout(setFocusMode._t); setFocusMode._t = setTimeout(() => btn.classList.remove('showMode'), 1400); }
    if (m !== 'off') toast(FOCUS_LABEL[m]);
  }
  syncFocusUi();
}
function cycleFocus() {
  const i = FOCUS_MODES.indexOf(FOC.mode);
  setFocusMode(FOCUS_MODES[(i < 0 ? 0 : i + 1) % FOCUS_MODES.length], true);
}
function drawFocus(wall, face) { const c = FOC.cfg; if (!c) return; const dt = Math.min(0.1, FOC.last ? wall - FOC.last : 0); FOC.last = wall;
  FOC.a = Math.max(0, Math.min(1, FOC.a + (FOC.on ? 1 : -1) * dt / (c.fade_s || 0.5)));
  if (FOC.a <= 0.001) return;
  if (window.FocusLayers && FocusLayers.ready) {           // v3.3: separate Focus layers (mover pieces) replace the one-unit Focus
    FocusLayers.setMode(FOC.mode); FocusLayers.setRingOn(FOC.ringOn !== false); FocusLayers.setGlowOn(FOC.glowOn !== false);
    FocusLayers.draw(CX, wall, FOC.a); return;
  }
}
async function loadFocus() { try { const c = await fetch('focus.json').then(r => r.json()); FOC.cfg = c;
    if (window.FocusLayers) { try { await FocusLayers.load(c.layers_base || 'focus-layers/'); } catch (err) { console.warn('FocusLayers', err); } }
    const fallback = c.default === 'on' ? 'on' : 'off';
    setFocusMode(parseFocusMode(localStorage.getItem('aloyFocus2'), fallback), false);
    FOC.a = FOC.on ? 1 : 0;
    setFocusRing(parseOnOff(localStorage.getItem('aloyFocusRing'), true), false);
    setFocusGlow(parseOnOff(localStorage.getItem('aloyFocusGlow'), true), false);
    if (localStorage.getItem('aloyFocusSeen')) $('focusBtn').classList.remove('first'); } catch (e) { $('focusBtn').hidden = true; } }
$('focusBtn').onclick = ev => { ev.preventDefault(); ev.stopPropagation(); cycleFocus(); };   // v3.3: never touches playback
['pointerdown', 'pointerup', 'touchstart'].forEach(k => $('focusBtn').addEventListener(k, ev => ev.stopPropagation()));
document.querySelectorAll('#focusModeSeg [data-focusmode]').forEach(b => b.onclick = () => setFocusMode(b.dataset.focusmode, true));
function parseOnOff(v, fallback) {
  if (v === 'off' || v === '0' || v === 'false') return false;
  if (v === 'on' || v === '1' || v === 'true') return true;
  return fallback !== false;
}
function setFocusRing(on, save) {
  FOC.ringOn = !!on;
  if (save) localStorage.setItem('aloyFocusRing', FOC.ringOn ? 'on' : 'off');
  const el = $('focusRing'); if (el) el.checked = FOC.ringOn;
}
function setFocusGlow(on, save) {
  FOC.glowOn = !!on;
  if (save) localStorage.setItem('aloyFocusGlow', FOC.glowOn ? 'on' : 'off');
  const el = $('focusGlow'); if (el) el.checked = FOC.glowOn;
}
if ($('focusRing')) $('focusRing').onchange = ev => setFocusRing(ev.target.checked, true);
if ($('focusGlow')) $('focusGlow').onchange = ev => setFocusGlow(ev.target.checked, true);
/* ---------- idle life (Drue 111326 2112): all subtle, randomized, smoothly eased, never periodic jerks ---------- */
const LIFE = P.life = Object.assign({amt: 1, drift: true, breath: true, micro: true, eyes: true}, JSON.parse(localStorage.getItem('aloyLife') || '{}'));
const L = {x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0, ph: Math.random() * 6.28, f: 1 / 4.5, fT: 0, last: 0};
function lifeTick(wall) {
  const dt = Math.min(0.05, L.last ? wall - L.last : 0.016); L.last = wall; const k = LIFE.amt;
  // drift: damped random walk (Ornstein-Uhlenbeck) on velocity, so position wanders smoothly; ~0.7% translate, ~0.3 deg rotate
  const ou = (p, v, sd, tau) => { v += (-p / (tau * tau) - 2 * v / tau) * dt + sd * Math.sqrt(dt) * (Math.random() * 2 - 1) * 1.7; return [p + v * dt, v]; };
  [L.x, L.vx] = ou(L.x, L.vx, 0.32, 3.6); [L.y, L.vy] = ou(L.y, L.vy, 0.24, 4.0); [L.r, L.vr] = ou(L.r, L.vr, 0.14, 4.2);
  // breathing: ~0.5% rise and fall, cycle drifts between about 4 and 5 s
  if (wall > L.fT) { L.f = 1 / (4 + Math.random()); L.fT = wall + 4 + Math.random() * 3; }
  L.ph += 2 * Math.PI * L.f * dt; const br = (1 - Math.cos(L.ph)) / 2;
  const th = Math.tanh, dx = LIFE.drift ? th(L.x) * 0.75 * k : 0, dy = (LIFE.drift ? th(L.y) * 0.6 * k : 0) - (LIFE.breath ? br * 0.45 * k : 0), rot = LIFE.drift ? th(L.r / 0.3) * 0.3 * k : 0, sy = 1 + (LIFE.breath ? br * 0.005 * k : 0);
  fitFaceCover();
  cv.style.transform = `translate(-50%, 0) translate(${dx.toFixed(3)}%, 0) rotate(${rot.toFixed(3)}deg) scale(${(1 + (sy - 1) * 0.3).toFixed(5)}, ${sy.toFixed(5)})`;   // v3.3: top-anchored, no vertical drift so the head is never cut
  P.lifeState = {dx, dy, rot, sy};
}
function fitFaceCover() {                                    // v3.3: whole picture, top-anchored: width = stage width +2% (drift margin), never cropped at the top
  const st = $('stage'); if (!st || !cv) return;
  const sw = st.clientWidth, sh = st.clientHeight; if (!(sw > 0 && sh > 0)) return;
  const ar = 720 / 1168;
  let w = sw * 1.02, h = w / ar;
  if (h > sh) { h = sh; w = h * ar; }                        // short screens: shrink to fit (no crop) rather than cut the head
  cv.style.width = Math.round(w) + 'px';
  cv.style.height = Math.round(h) + 'px';
  const fb = $('focusBtn');                                  // invisible tap spot over the Focus (ring centre ~ (122, 367) in face px)
  if (fb) { const k = w / 720, left = (sw - w) / 2; fb.style.left = Math.round(left + 62 * k) + 'px'; fb.style.top = Math.round(282 * k) + 'px';
    fb.style.width = Math.round(122 * k) + 'px'; fb.style.height = Math.round(170 * k) + 'px'; fb.style.right = 'auto'; }
}
function idleLook(t, wall) {                 // micro-expressions: a faint eased look (listening / thinking / relieved), then back
  P.idleNext = wall + 6 + Math.random() * 9; if (!LIFE.micro || LIFE.amt <= 0) return; const p = egPatchAt(t); if (p && p.name) return;
  const r = Math.random(), f = r < 0.6 ? 'listening' : 'thinking', k = Math.min(0.6, (0.12 + Math.random() * 0.16) * LIFE.amt);
  const up = 1.1 + Math.random() * 0.8; ins(T.patch, {t, name: f, fade: up, k}); ins(T.patch, {t: t + up + 0.8 + Math.random() * 1.5, name: null, fade: 1.2 + Math.random() * 0.6, k: 1});
}
const saveLife = () => localStorage.setItem('aloyLife', JSON.stringify(LIFE));
$('lifeAmt').value = Math.round(LIFE.amt * 100); $('lifeVal').textContent = $('lifeAmt').value + '%';
['drift', 'breath', 'micro', 'eyes'].forEach(n => { const el = $('life' + n[0].toUpperCase() + n.slice(1)); el.checked = LIFE[n]; el.onchange = () => { LIFE[n] = el.checked; saveLife(); }; });
$('lifeAmt').oninput = () => { LIFE.amt = $('lifeAmt').value / 100; $('lifeVal').textContent = $('lifeAmt').value + '%'; saveLife(); };
/* ---------- silent 'Thinking to herself' engine (Drue 111326 2152-2155) ----------
   Bored and alone, flipping through her phone: slow 2-4 s eases, 4-8 s holds, random order and timing, eye looks down
   (phone) and away. Every expression may appear; extremes are spice (eased, at most ~1 per 90 s); positive stays short
   of a full laugh (capped walk), negative may go further (full sad; tears wait for TweakX frames that match this face).
   low = the same engine at low intensity: the idle life after any demo or typed line ends. */
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const AMB_STATES = [   // [id, weight, weightLow, apply(t, amp) -> nothing]
  ['amused', 3, 5], ['wistful', 3, 2.5], ['thoughtful', 2.5, 2], ['sad', 2, 1], ['deepsad', 0, 0], ['almostlaugh', 1.3, 0],
  ['phone', 2.2, 1.5], ['lookup', 1, 0.8], ['other', 1.6, 0.6], ['extreme', 0, 0]];   // v3.2: tears and flash beats off until Drue OKs them
const OTHER = ['skeptical', 'confused', 'proud', 'determined', 'focused', 'sleepy', 'listening'];   // v3.2: no brow patches that fight the smile (sad/worried/apologetic/guilty), no skeptical-up
function startAmbient(low, t) { P.amb = {low, next: t == null ? P.clock() : t, cur: 'amused', lastExtreme: -1e9, log: [], t0: P.clock()}; }
function ambPatch(t, name, k, fade) { ins(T.patch, {t, name, fade, k}); }
function ambientTick(t, wall) {
  const A = P.amb; if (!A || t < A.next) return;
  const lo = A.low, amp = lo ? 0.5 : 1, E = lo ? rnd(2.5, 4) : rnd(2, 4), H = lo ? rnd(6, 12) : rnd(4, 8), sl = 0;
  const pool = AMB_STATES.filter(s => s[0] !== A.cur && (lo ? s[2] : s[1]) > 0 && !(s[0] === 'extreme' && t - A.lastExtreme < 90));
  let r = Math.random() * pool.reduce((s, x) => s + (lo ? x[2] : x[1]), 0), st = pool[0][0];
  for (const s of pool) { r -= lo ? s[2] : s[1]; if (r <= 0) { st = s[0]; break; } }
  let dur = E + H;
  const patchNow = egPatchAt(t), hadPatch = patchNow && patchNow.name;
  switch (st) {
    case 'amused': ambPatch(t, null, 1, E); if (Math.random() < 0.6) setTimeout(() => P.amb === A && egGlance(performance.now() / 1000, pick(['left', 'right', 'down']), rnd(0.8, 2)), (E + rnd(0.5, H - 1)) * 1000); break;
    case 'wistful': ambPatch(t, pick(['listening', 'thinking']), rnd(0.4, 0.6) * amp, E); break;   // v3.2: no drift into relieved
    case 'thoughtful': ambPatch(t, 'thinking', rnd(0.6, 0.85) * amp, E); break;
    case 'sad': { const F = EG.A.faces; let t0 = t; if (hadPatch) { ambPatch(t, null, 1, 1.2); t0 += 1.3; }   // v3.2: the real sad face (sad mouth), not sad brows over a smile
      dur = (t0 - t) + egWalk(t0, [F.amused, F['amused-sadtop'], F.sad], E, H, 'sad') + 0.3; break; }
    case 'deepsad': {                                                        // negative goes further: sad -> a real tear (TweakX sad-tears), eased in and out
      const F = EG.A.faces, fr = [F.amused, F['amused-sadtop'], F.sad, F['hurt-holding-back-tears']]; let t0 = t; if (hadPatch) { ambPatch(t, null, 1, 1.2); t0 += 1.3; }
      dur = (t0 - t) + egWalk(t0, fr, rnd(4.5, 7), rnd(4, 7), 'sad') + 0.3; break; }
    case 'phone': ambPatch(t, EG.A.patches['phone-down'] ? 'phone-down' : 'lookdown', lo ? 0.6 : 1, Math.min(E, 2)); break;   // lids and eyes drop to her phone
    case 'lookup': ambPatch(t, 'thinking-up', lo ? 0.55 : 0.9, Math.min(E, 2)); H > 5 && (dur = E + 5); break;
    case 'other': ambPatch(t, pick(OTHER), rnd(0.45, 0.75) * amp, E); break;
    case 'almostlaugh': {                                                    // amused -> toward laughing, capped mid-way
      const pr = EG.A.pairs['laughing-to-amused'], cap = 3;   // v3.2.5: soft-laugh pair has 6 frames; walk only frames 03..06 (closed-ish smiles), never toward the laugh
      const fr = [EG.A.faces.amused, ...pr.slice(cap - 1).reverse()]; let t0 = t; if (hadPatch) { ambPatch(t, null, 1, 1.2); t0 += 1.3; }
      dur = (t0 - t) + egWalk(t0, fr, E, Math.min(H, 5), 'laughing') + 0.3; A.cap = cap; break; }
    case 'extreme': {
      const f = pick(['excited', 'surprised', 'alert']); let t0 = t; if (hadPatch) { ambPatch(t, null, 1, 1.2); t0 += 1.3; }
      dur = (t0 - t) + egBeat(t0, f) + 0.5; A.lastExtreme = t; A.extreme = f; break; }
  }
  A.cur = st; A.next = t + dur; A.log.push([+(t - A.t0).toFixed(2), st, +E.toFixed(2), +dur.toFixed(2)]);
}
/* v3.2.7 seekable media clock for silent / rapid-cycle demos (spoken demos use audio.currentTime). */
const MC = P.mc = {on: false, playing: false, t0: 0, media0: 0, dur: 0, loop: false, run: 0};
function mediaNow() {
  if (!MC.on) return 0;
  if (!MC.playing) return MC.media0;
  const t = MC.media0 + (performance.now() / 1000 - MC.t0);
  return MC.dur > 0 ? Math.min(MC.dur, Math.max(0, t)) : Math.max(0, t);
}
function mediaStart(dur, loop, at) {
  MC.on = true; MC.playing = true; MC.dur = +dur || 0; MC.loop = !!loop;
  MC.media0 = Math.max(0, +at || 0); MC.t0 = performance.now() / 1000;
  P.clock = mediaNow; P.playT0 = 0; mediaArmEnd();
}
function mediaPause() {
  if (!MC.on || !MC.playing) return;
  MC.media0 = mediaNow(); MC.playing = false; clearTimeout(MC.endT);
  if (P.mode === 'demo') try { au.pause(); } catch (e) {}
}
function mediaResume() {
  if (!MC.on || MC.playing) return;
  MC.t0 = performance.now() / 1000; MC.playing = true; mediaArmEnd();
  if (P.mode === 'demo') try { au.play(); } catch (e) {}
}
function mediaStop() { MC.on = false; MC.playing = false; MC.dur = 0; MC.loop = false; clearTimeout(MC.endT); }
function mediaSeek(t) {
  const dur = (MC.on && MC.dur) ? MC.dur : (P.script && P.script.duration) || (au && isFinite(au.duration) && au.duration) || 0;
  t = Math.max(0, Math.min(dur || 0, +t || 0));
  if (P.script && !P.script.silent) {
    try { au.currentTime = t; } catch (e) {}
    if (MC.on) { MC.media0 = t; MC.t0 = performance.now() / 1000; }
    return t;
  }
  if (!MC.on) {
    // show this frame of a silent demo even if it isn't playing yet
    ensureSilentTracks();
    mediaStart(P._silentDur || (P.script && P.script.duration) || dur, !!(P.script && P.script.loop), t);
    MC.playing = false; MC.media0 = t;
    P.mode = 'ambient';
  } else { MC.media0 = t; MC.t0 = performance.now() / 1000; }
  if (MC.playing) mediaArmEnd();
  return t;
}
function mediaArmEnd() {
  clearTimeout(MC.endT);
  if (!MC.on || !MC.playing || !MC.dur) return;
  const left = Math.max(0.02, MC.dur - mediaNow() + 0.04);
  MC.endT = setTimeout(() => { if (MC.on && MC.playing) mediaTickCaptions(mediaNow()); }, left * 1000);
}
P.seek = mediaSeek; P.pause = mediaPause; P.resume = mediaResume;
function mediaTickCaptions(t) {
  const S = P.script; if (!S || !S.silent) return;
  if (P.silentLog && P.silentLog.length) {
    let cur = P.silentLog[0];
    for (let i = 0; i < P.silentLog.length; i++) if (t + 1e-3 >= P.silentLog[i][0]) cur = P.silentLog[i];
    const lbl = (S.labels && S.labels[cur[1]]) || cur[1];
    const want = S.kind === 'cycle' ? ('Rapid Cycle · ' + lbl) : ((S.title || '') + ' · no sound');
    if (P._cap !== want) { P._cap = want; setCaption(want); }
  }
  if (MC.playing && MC.dur && t >= MC.dur - 1e-3) {
    if (MC.loop && S.loop && P.script === S) { P.loops = (P.loops || 0) + 1; mediaSeek(0); return; }
    mediaStop(); P.mode = 'idle'; P.clock = () => performance.now() / 1000;
    setCaption((S.kind === 'cycle' ? 'Rapid Cycle' : S.title) + ' · done'); setPb(true); toNeutral(P.clock());
  }
}
function cycleFaceSteps(f, e, h, prev) {         // v3.2.8: use in-between pairs when we have them; otherwise don't crossfade two teeth faces
  const F = EG.A.faces;
  if (f === 'laughing' && prev === 'amused' && (EG.A.pairs['amused-to-laughing'] || []).length) { const al = EG.A.pairs['amused-to-laughing'], st = e / (al.length + 1);   // v3.3.7p skin/teeth fix: mouth closes/opens through its own in-betweens
    return [...al.map(im => [im, st, 0]), [F[f], st, h]]; }
  if (f === 'laughing') { const pr = (EG.A.pairs['laughing-to-amused'] || []).slice(0, 5).reverse();
    const step = e / (pr.length + 1); return [...pr.map(im => [im, step, 0]), [F[f], step, h]]; }
  const pair = EG.A.pairs && EG.A.pairs[prev + '-to-' + f];
  if (pair && pair.length) { const step = e / (pair.length + 1); return [...pair.map(im => [im, step, 0]), [F[f], step, h]]; }
  // closed_of twins only close the eyes; they still show the same teeth, so they are not a mouth bridge.
  // proud→surprised (Drue #7 at 0:08.2): one extra frame through listening (surprised's rest, lips together).
  if (prev === 'proud' && f === 'surprised' && F.listening)
    return [[F.listening, e * 0.45, 0], [F[f], e * 0.55, h]];
  return [[F[f], e, h]];
}
function ensureSilentTracks() {
  const S = P.script; if (!S || !S.silent || !S.kind) return 0;
  if (P._silentBuilt === S && T.beats.length) return P._silentDur || 0;
  egReset(false); const F = EG.A.faces, t = 0; P.silentLog = []; let D;
  if (S.kind === 'stasis' && S.patch) {
    ambPatch(t + 0.2, S.patch, S.k, S.ease); ambPatch(t + 0.2 + S.ease + S.hold, null, 1, S.ease);
    D = 0.2 + S.ease * 2 + S.hold; P.silentLog.push([0.2, S.patch || S.mood]); }
  else if (S.kind === 'stasis') {
    let pf = null; const st = S.steps.flatMap(([f, e, h]) => { const r = pf && e > 0 && EG.A.pairs && EG.A.pairs[pf + '-to-' + f] ? cycleFaceSteps(f, e, h, pf) : [[F[f], e, h]]; pf = f; return r; });   // v3.3.7p skin fix: stasis uses the in-betweens too (same total time)
    D = egChain(t, st, S.mood);
    let tt = 0; S.steps.forEach(([f, e, h]) => { tt += e; P.silentLog.push([+tt.toFixed(2), f]); tt += h; }); }
  else {
    const faceEase = f => f === 'laughing' ? Math.max(1.8, S.ease) : S.ease;
    let prev = 'amused';
    const st = [[F.amused, 0, 0.4], ...S.seq.flatMap(f => {
      const e = faceEase(f), h = (S.holds || {})[f] || S.hold, steps = cycleFaceSteps(f, e, h, prev);
      prev = f; return steps; }), ...cycleFaceSteps('amused', S.ease, 0.3, prev)]; D = egChain(t, st, 'cycle');
    let tt = 0.4; S.seq.forEach(f => { tt += faceEase(f); P.silentLog.push([+tt.toFixed(2), f]); tt += (S.holds || {})[f] || S.hold; }); }
  P._silentBuilt = S; P._silentDur = D; return D;
}
function playAmbient() { stopAll(); ++P.run; P.mode = 'ambient'; P.clock = () => performance.now() / 1000; P.playT0 = P.clock(); egReset(false);
  setCaption('Thinking to herself · no sound'); startAmbient(false); setPb(false); $('pbLbl').textContent = 'Stop'; }
/* v3.2 (Drue 111326 2339): 'Mood Stasis' (one mood held, blinks + drift + breathing only) and 'Rapid Cycle' (every non-extreme mood, eased) */
function playSilent() { const S = P.script; stopAll(); const run = ++P.run; P.mode = 'ambient';
  P._silentBuilt = null; const D = ensureSilentTracks();
  mediaStart(D, !!S.loop, 0); MC.run = run; P._cap = '';
  setPb(false); $('pbLbl').textContent = 'Stop';
  setCaption(S.kind === 'cycle' ? 'Rapid Cycle' : (S.title + ' · no sound'));
  sceneTick(); }
function toNeutral(t) {                      // every demo ends by easing back to neutral, then the low thinking life takes over
  ambPatch(t, null, 1, 1.4); startAmbient(true, t + 1.4 + 2.5); }
/* ---------- driver 1: prerendered demo (AudioCuesVoice) ---------- */
/* ---------- v3.3 (Drue 111426 2129 t6249u-t6251u): the demo list is bot specific. Aloy's demos only for Aloy, TweakX's three
   looping GIF demos only for TweakX, every other bot shows an empty list. ---------- */
const demoBot = d => d.bot || 'aloy';
const botDemos = () => (EG.demos || []).filter(d => demoBot(d) === BOT);
function renderDemoList() {
  const L = botDemos(); let grp = null;
  $('demoList').innerHTML = L.length ? L.map(d => { const h = (d.group || 'Demos') !== grp ? `<h3 class="demoGroup">${(grp = d.group || 'Demos')}</h3>` : '';
    return h + `<button class="demo${d.kind === 'stasis' ? ' mini' : ''}" data-id="${d.id}" type="button">${d.title}<small>${d.text.replace(/</g, '&lt;')}</small></button>`; }).join('')
    : '<p class="hint demoEmpty">No demos for this bot yet.</p>';
}
async function pickFirstBotDemo() { const L = botDemos(); if (L.length) await pickDemo(L[0].id); else { P.demo = null; P.script = null; setCaption(''); } }
const GIF = {run: 0, urls: [], blobs: {}};
async function gifBlobs(seq) { await Promise.all([...new Set(seq.map(s => s[0]))].map(async f => { if (!GIF.blobs[f]) GIF.blobs[f] = await fetch(f).then(r => r.blob()); })); }
function gifStop() { GIF.run++; const im = $('gifFace'); if (im) { im.hidden = true; im.removeAttribute('src'); } GIF.urls.forEach(u => URL.revokeObjectURL(u)); GIF.urls = []; }
async function playGifSeq() {
  const S = P.script; if (!S || !S.seq) return; stopAll(); const run = ++GIF.run, im = $('gifFace');
  if (S.sfx) audioVoice.unlock();                // private v3.3.5p (Drue 111626 0207): unlock the voice element inside the tap, same element/rules as the rage clip
  await gifBlobs(S.seq); if (run !== GIF.run) return;
  P.mode = 'gif'; setPb(false); $('pbLbl').textContent = 'Stop'; setCaption(S.title + (S.sfx ? '' : ' · no sound'));
  MUS.clipStart(S.id);                                           // v3.3.7p (Drue 111826 0009): bed off during TweakX head blow-up (QUIET list); other gif demos keep the bed
  MC.on = true; MC.playing = true; MC.dur = +S.duration || 0; MC.loop = true; MC.media0 = 0; MC.t0 = performance.now() / 1000;
  P.clock = () => (performance.now() / 1000 - MC.t0) % (MC.dur || 1);
  let i = 0;
  const step = () => { if (run !== GIF.run) return; const [f, sec] = S.seq[i];
    const u = URL.createObjectURL(GIF.blobs[f]); const old = GIF.urls.splice(0); GIF.urls.push(u);   // a fresh URL restarts the GIF at frame 1
    im.src = u; im.hidden = false; old.forEach(x => setTimeout(() => URL.revokeObjectURL(x), 500));
    if (i === 0) MC.t0 = performance.now() / 1000;
    if (S.sfx) { const t0 = S.seq.slice(0, i).reduce((a, x) => a + x[1], 0), at = S.sfx.at - t0;   // head pop sync: start the bite so its hit lands on the pop
      if (at >= 0 && at < sec) setTimeout(() => { if (run !== GIF.run) return; try { au.onplaying = au.onended = au.onerror = null; au.src = S.sfx.src; au.currentTime = 0; const q = au.play(); if (q && q.catch) q.catch(() => {}); } catch (e) {} }, at * 1000); }
    i = (i + 1) % S.seq.length; setTimeout(step, sec * 1000); };
  step();
}
async function pickDemo(id) {
  const d = EG.demos.find(x => x.id === id) || botDemos()[0] || EG.demos[0]; P.demo = d;
  if (d.kind === 'gifseq') { gifStop(); P.script = Object.assign({captions: [[0, 0, d.title + (d.sfx ? '' : ' · no sound')]]}, d);
    [...document.querySelectorAll('#demoList .demo')].forEach(b => b.classList.toggle('cur', b.dataset.id === d.id));
    showCaptions(P.script.captions); setPb(false); gifBlobs(d.seq).catch(() => {}); return; }
  P.script = d.silent ? Object.assign({captions: [[0, 0, d.kind ? d.title + (d.kind === 'stasis' ? ' · holding' : '') + ' · no sound' : 'Thinking to herself · no sound']]}, d, {silent: true}) : await fetch('demos/' + d.id + '/script.json').then(r => r.json());
  if (!d.silent) { const src = (P.script.audio_src || ('demos/' + d.id + '/voice.mp3')); try { if (!au.src || au.src.indexOf(src) < 0) { au.src = src; au.load(); } } catch (e) {} }
  [...document.querySelectorAll('#demoList .demo')].forEach(b => b.classList.toggle('cur', b.dataset.id === d.id));
  if (P.mode !== 'live') { showCaptions(P.script.captions); setPb(false); }
  sceneTick();
}
/* v3.3.8w: every picture a built scene can draw (its full frames, blink twins, face patches, all mouth pieces, gaze patches, tears) */
function egSceneNames() { const A = EG.A, out = new Set(), add = n => { if (n && typeof n === 'string') out.add(n); };
  T.base.forEach(e => { [e.img, e.mix].forEach(n => { add(n); add((A.closed_of || {})[n]); add((A.face_mouth || {})[n]); }); });
  T.patch.forEach(e => { if (e.name) { add(A.patches[e.name]); add(A.patches[e.name + '-closed']); } });
  add(A.faces.amused); add((A.closed_of || {})[A.faces.amused]); add(A.patches.amused); add(A.patches['amused-closed']);
  const mp = A.mouth_patch || {}; Object.values(mp).forEach(add);
  Object.values(A.mouth_sets || {}).forEach(S => Object.values(S).forEach(n => add(mp[n] || n)));
  Object.values((A.eyes || {}).dirs || {}).forEach(add); Object.values(A.tears || {}).forEach(t => add(t && t.sprite));
  return [...out].filter(n => /\.(jpg|jpeg|webp|png)$/i.test(n)); }   // T.base is time-ordered, so the list starts with what plays first
function egSceneMissing() { return egSceneNames().filter(n => !(EG.IM[n] && EG.IM[n].naturalWidth) && !EGQ.dead[n]); }
function playDemo() {
  stopAll(); const S = P.script, run = ++P.run; egReset(false);
  S.beats.forEach(([t, f]) => egBeat(t, f)); S.cues.forEach(([t, f, k, o]) => egCue(t, f, k, o));
  const miss = egSceneMissing();
  if (!miss.length) return playDemo1(S, run);
  try { au.muted = true; const q = au.play(); P._bless = run; if (q && q.then) q.then(() => { if (P._blessFor !== run) au.pause(); au.muted = false; }, () => { au.muted = false; }); else au.muted = false; } catch (e) { au.muted = false; }   // keep the tap's permission to play sound
  P.mode = 'loading'; setPb(false); $('statusLine').textContent = 'Loading her pictures… (' + miss.length + ')'; $('statusLine').hidden = false;
  egNeed(miss, 30000).then(() => { if (run !== P.run) return; $('statusLine').hidden = true; P._blessFor = run; au.muted = false; playDemo1(S, run); }); }
function playDemo1(S, run) {
  P.mode = 'demo'; P.clock = () => au.currentTime; P.playT0 = 0; egReset(false);
  MC.on = true; MC.playing = true; MC.dur = +S.duration || 0; MC.loop = false; MC.media0 = 0; MC.t0 = performance.now() / 1000;
  const mc = (typeof rewriteDrueMouthCues === 'function') ? rewriteDrueMouthCues(S.mouthCues || [], ((S.captions || []).map(c => c[2]).join(' ') || S.text), S.duration) : (S.mouthCues || []);
  const cues = {mouthCues: mc};                                 // v3: Eve demos only, lips from Rhubarb JSON; v3.2.6: soft OO on "Drue"
  S.beats.forEach(([t, f]) => egBeat(t, f)); S.cues.forEach(([t, f, k, o]) => egCue(t, f, k, o));
  showCaptions(S.captions); setPb(false);
  const p = audioVoice.playTrack(S.audio_src || ('demos/' + S.id + '/voice.mp3'), cues, {mouth: (s, c) => egMouth(s, c), word: () => {}});
  if (S.id === 'rage') { try { egWideSteps(); } catch (e) {} }   // v3.3.8w: in-betweens around the widest mouth (angry scene)
  if (p && p.catch) p.catch(e => { if (run === P.run) { P.mode = 'idle'; mediaStop(); toast('Tap Playback again to play'); } });
  const syncDur = () => { if (isFinite(au.duration) && au.duration > 0) MC.dur = au.duration; };
  au.onloadedmetadata = syncDur; syncDur();
  au.onended = () => { if (run !== P.run) return; MUS.clipStop(); mediaStop(); endToLive(); setPb(true); };
  MUS.clipStart(S.id, true);                                     // v3.3.7p: NIN behind rage, PETA behind Nico, from 0, looping until the clip ends
  sceneTick();
}
function endToLive() { MUS.clipStop(); const t = P.clock(); P.mode = 'idle'; P.clock = () => performance.now() / 1000; const now = P.clock();
  const p = egPatchAt(t); egReset(false); if (p && p.name && p.u > 0.05) ins(T.patch, {t: -1, name: p.name, fade: 0, k: p.k * p.u});
  toNeutral(now); }
/* ---------- driver 2: type-and-play with the bot's server voice (Drue 111326 2148 / 2150) ----------
   Go: start every /speak fetch at once, close the sheet, wait for it to finish closing + ~700 ms, and only talk
   when both the screen is clear and the audio is ready. */
function voiceState(s, cls) { const el = $('voiceState'); el.textContent = s || ''; el.className = cls || ''; el.hidden = !s; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function playTyped(text, opts = {}) {
  stopAll(); document.body.classList.add('typed');   // v3.3.8w: words show only for her typed (custom words) speech, never for demos const run = ++P.run; P.liveLog = []; const L0 = performance.now() / 1000, lg = (...x) => P.liveLog.push([...x, +(performance.now() / 1000 - L0).toFixed(3)]);
  audioVoice.unlock();                                            // inside the tap (iPhone)
  const items = egParse(text); P.lastItems = items;
  if (!serverVoice) { voiceState('No voice is set for this bot (bots/' + BOT + '.json)', 'err'); toast('No voice set for this bot'); return; }
  const preps = items.map(it => it.say ? serverVoice.prepare(it.say).then(r => (lg('ready', it.say.slice(0, 20), r.from, r.cached), r)) : null);
  preps.forEach(p => p && p.catch(() => {}));
  setCaption(items.filter(i => i.say).map(i => i.say).join(' '));
  lg('go'); voiceState('Preparing voice…', 'wait'); $('statusLine').textContent = 'Preparing voice…'; $('statusLine').hidden = false;
  await closeSheets(); lg('closed'); await sleep(opts.pause == null ? 700 : opts.pause); lg('paused');
  let ready; try { ready = await Promise.all(preps); } catch (e) {
    if (run !== P.run) return; const d = (e.detail || []).join('; ');
    const msg = e.message === 'empty_text' ? 'Nothing to say (only emoji?)' : e.message === 'daily_budget_exhausted' ? 'Voice is resting until midnight' :
      e.message === 'too_long' ? 'That line is too long for the voice (300 characters per phrase)' : e.fatal ? 'Voice refused: ' + e.message : 'Voice offline: no voice host answered';
    voiceState(msg + (d ? ' (' + d + ')' : ''), 'err'); $('statusLine').textContent = msg; $('statusLine').hidden = false;
    toast(msg); lg('error', e.message, d); P.mode = 'idle'; toNeutral(P.clock()); return; }
  if (run !== P.run) return;
  $('statusLine').hidden = true; voiceState('');
  P.mode = 'live'; P.clock = () => performance.now() / 1000; P.playT0 = P.clock(); egReset(false);
  setCaption(items.filter(i => i.say).map(i => i.say).join(' ')); lg('talk');
  let wordBase = 0;
  for (let n = 0; n < items.length; n++) { const it = items[n];
    if (run !== P.run) return;
    if (it.beat) { const t = P.clock(); lg('beat', it.beat); const d = egBeat(t, it.beat); await sleep(d * 1000); continue; }
    if (!it.say) { it.cues.forEach(([, f, k]) => egCue(P.clock(), f, k)); continue; }
    const r = ready[n], spans = [...$('caption').children], words = [...it.say.matchAll(/\S+/g)], base = wordBase;
    lg('say', it.say);
    const res = await audioVoice.playPrepared(r, {start: t0 => {
      const mc = (typeof rewriteDrueMouthCues === 'function') ? rewriteDrueMouthCues(r.mouthCues, it.say, r.duration, r.words) : r.mouthCues;
      egMouth(mc.map(c => [t0 + c.start, t0 + c.end, toVis(c.value)]), true);
      for (const [pos, f, k] of it.cues) { const tc = t0 + Math.max(0, cueTimeWords(it.say, pos, r) - 0.04); egCue(tc, f, k); lg('cue', f, +(tc - t0).toFixed(3), pos, r.words && r.words.length === words.length ? 'words' : 'spread'); }
      words.forEach((w, wi) => { const tw = t0 + cueTimeWords(it.say, w.index, r); setTimeout(() => { if (run !== P.run) return; spans.forEach(s => s.classList.remove('on')); const sp = spans[base + wi]; if (sp) sp.classList.add('on'); }, Math.max(0, (tw - P.clock()) * 1000)); });
    }});
    wordBase += words.length; lg('end', res.why);
    await sleep(150);
  }
  if (run === P.run) { P.mode = 'idle'; [...$('caption').children].forEach(s => s.classList.remove('on')); toNeutral(P.clock()); }
}
function closeSheets() {                         // slide the compose sheet / setup drawer away; resolves once fully closed
  const open = [$('compose'), $('setup')].filter(el => !el.hidden); $('setupTabs').hidden = true; $('settingsBtn').classList.remove('on');
  return Promise.all(open.map(el => new Promise(res => { el.classList.add('closing');
    const done = () => { el.classList.remove('closing'); el.hidden = true; res(); };
    el.addEventListener('animationend', done, {once: true}); setTimeout(done, 600); })));
}
function stopAll() { document.body.classList.remove('typed'); MUS.clipStop(); if (typeof gifStop === 'function' && P.mode === 'gif') { gifStop(); mediaStop(); setPb(true); } P.run++; P.amb = null; audioVoice.stop(); if ($('statusLine')) $('statusLine').hidden = true; if (P.mode === 'demo') endToLive(); mediaStop(); P._silentBuilt = null; P.mode = 'idle'; P.clock = () => performance.now() / 1000; }


/* ---------- scene counter 0-100 on the emotion bar (the old review pins / seek bar are gone, Drue checklist 2.06) ---------- */
function sceneTime() {
  if (P.mode === 'demo') return Math.max(0, au.currentTime || 0);
  if (window.MC && MC.on) return Math.max(0, mediaNow());
  if ((P.mode === 'live' || P.mode === 'ambient') && P.playT0 != null) return Math.max(0, P.clock() - P.playT0);
  if (P.script && !P.script.silent && au && isFinite(au.currentTime) && au.currentTime > 0) return au.currentTime;
  return 0;
}
function sceneDur() {
  if (window.MC && MC.on && MC.dur) return MC.dur;
  if (P.script && !P.script.silent && au && isFinite(au.duration) && au.duration > 0) return au.duration;
  if (P.script && P.script.duration) return +P.script.duration;
  return 0;
}
function sceneTick() {
  const sc = $('sceneCount'), S = P.script; if (!sc) return;
  const show = !!S && !(window.PAD && PAD.on) && (S.silent ? !!S.kind : true);
  if (!show) { sc.textContent = ''; return; }
  const dur = sceneDur(), u = dur > 0 ? Math.max(0, Math.min(1, sceneTime() / dur)) : 0;
  sc.textContent = String(Math.round(u * 100));
}

/* ---------- v3.2.2 bot pull-down: same openMenu/selectBot behavior as the desktop Emote App.
   Focus-rotate and face effects stay Aloy-only. Other bots swap in their packaged face set. ---------- */
function closeMenu() {
  const pull = $('pull'); if (!pull) return;
  pull.classList.remove('open'); pull.style.height = '';
  $('botPick').setAttribute('aria-expanded', 'false');
  $('pullChev').setAttribute('aria-label', 'Open bot list');
}
function openMenu() {
  if (MSG) return;
  const m = $('menu'), pull = $('pull');
  if (pull.classList.contains('open')) { closeMenu(); return; }
  openSettings(false); $('compose').hidden = true;
  m.innerHTML = '';
  BOTS.forEach(b => {
    const d = document.createElement('button'); d.type = 'button';
    d.className = 'item' + (b.id === BOT ? ' cur' : '');
    d.setAttribute('role', 'option'); d.setAttribute('aria-selected', String(b.id === BOT));
    d.textContent = b.name;
    d.onclick = ev => { ev.stopPropagation(); closeMenu(); selectBot(b.id); };
    m.appendChild(d);
  });
  { const c = document.createElement('a'); c.className = 'item credits'; c.href = 'credits.html'; c.textContent = 'Music credits'; c.setAttribute('role', 'option');   // v3.3.8w (Drue 10:06 PM CT: credits line)
    c.style.cssText = 'font-weight:400;font-size:13px;color:#9aa;text-decoration:none'; c.onclick = ev => ev.stopPropagation(); m.appendChild(c); }
  const app = $('app'), cs = getComputedStyle(pull);
  const bt = parseFloat(cs.borderTopWidth) || 0, bb = parseFloat(cs.borderBottomWidth) || 0;
  const head = $('botPick').offsetHeight + (parseFloat(getComputedStyle($('botPick')).marginBottom) || 0);
  const listH = m.scrollHeight + 6;
  const h = Math.min(app.clientHeight * 0.72, bt + head + listH + bb);
  pull.style.height = Math.round(h) + 'px';
  pull.classList.add('open');
  $('botPick').setAttribute('aria-expanded', 'true');
  $('pullChev').setAttribute('aria-label', 'Close bot list');
}
function botRender(wall) {
  const set = BOTFACES[BOT]; if (!set || !CX) return;
  const expr = botExpr || set.default || Object.keys(set.faces || {})[0];
  const open = set.faces[expr], closed = set.faces[expr + '-closed'];
  const n = (wall < blinkUntil && closed) ? closed : open, im = n && EG.IM[n];
  if (!(im && im.naturalWidth)) { if (n) egFetchImg(n, {key: n, front: true}); return; }   // v3.3.8w: keep the last good frame, never a black one
  CX.clearRect(0, 0, EG.A.W, EG.A.H); CX.drawImage(im, 0, 0, EG.A.W, EG.A.H);
}
async function loadBotFaces(id) {
  if (id === 'aloy') return;
  if (!window._FACEIDX) {
    try { window._FACEIDX = await fetch('faces/index.json', {cache: 'no-cache'}).then(r => r.json()); }
    catch (e) { window._FACEIDX = {}; }
  }
  const set = window._FACEIDX[id]; if (!set) return;
  BOTFACES[id] = set;
  const names = Object.values(set.faces || {});
  await Promise.all(names.map(n => egFetchImg(n, {key: n})));   // v3.3.8w: shared queue with retries
}
async function selectBot(id, first) {
  const b = BOTS.find(x => x.id === id); if (!b) return;
  if (!first) { stopAll(); if (typeof gifStop === 'function') gifStop(); }
  BOT = id; P.bot = id;
  try { localStorage.setItem('gx.bot', id); } catch (e) {}
  $('botName').textContent = b.name;
  document.body.dataset.bot = id;
  document.body.classList.toggle('not-aloy', id !== 'aloy');
  if (id === 'aloy') {
    $('focusBtn').hidden = false;
    if (FOC.cfg) {
      const fallback = FOC.cfg.default === 'on' ? 'on' : 'off';
      setFocusMode(parseFocusMode(localStorage.getItem('aloyFocus2'), fallback), false);
    }
    botExpr = 'amused';
    egReset(false);
  } else {
    setFocusMode('off', false);
    $('focusBtn').hidden = true;
    await loadBotFaces(id);
    const set = BOTFACES[id] || {};
    botExpr = (set.faces && set.faces[b.default_face] ? b.default_face : null) || set.default || (set.faces ? Object.keys(set.faces).filter(k => !k.endsWith('-closed'))[0] : '');
    egReset(false);
  }
  try {
    const cfg = await fetch('bots/' + id + '.json').then(r => r.json());
    serverVoice = new ServerVoice(cfg); P.voiceCfg = cfg;
    if ($('voiceName')) $('voiceName').textContent = serverVoice.name;
  } catch (e) { if ($('voiceName')) $('voiceName').textContent = 'none set'; }
  if (!first && EG.demos) { renderDemoList(); await pickFirstBotDemo(); }   // v3.3: bot-specific demo list
  if (typeof paintLeds === 'function') paintLeds();
}

/* ---------- drowsy state (Drue 111426 0410 via Aloy, approved 0411; drowsy-work/README.md) ----------
   Off his usual hours, idle Aloy eases sleepy -> drowsy (in-between frames, never a snap). When he shows up (open off-hours,
   or the first tap / return after a 2 h gap) she plays just-woke (~1.7 s) and eases out through the in-betweens to listening,
   then amused. Usual hours: learned on this device (opens, taps, plays; rolling 14 days) on top of a seed learned from when
   he messages the bots (drowsy-seed.json, from update_seed.py); Settings > Life > "Usual hours" overrides (blank = learned). */
const DZ = window.DZ = {
  SEED: {hist: [3.176, 5.061, 4.061, 4.372, 2.0, 1.353, 0, 0, 0, 1.389, 1.76, 3.862, 4.224, 3.814, 4.068, 3.658, 4.21, 4.819, 5.229, 5.229, 5.893, 4.819, 5.539, 3.417], start: 10, end: 5, src: 'built-in 111426'},
  LOG_KEY: 'aloyActLog', HOURS_KEY: 'aloyUsualHours', ON_KEY: 'aloyDrowsy', WIN_DAYS: 14, HALF_LIFE: 7, CORE: 4, QUIET: 0.25,
  GAP_MS: 2 * 3600e3, IDLE_S: 40, JW_HOLD: 1.7, state: 'awake', waking: false, wakeUntil: 0, idleSince: 0, nextNod: 0, lastLog: 0,
  force: new URLSearchParams(location.search).get('dz')   // test hook: dz=off (never), dz=offhours (pretend off-hours), dz=onhours
};
DZ.on = localStorage.getItem(DZ.ON_KEY) !== '0' && DZ.force !== 'off';
function dzLoad() { try { const a = JSON.parse(localStorage.getItem(DZ.LOG_KEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
DZ.prevAct = (() => { const a = dzLoad(); return a.length ? a[a.length - 1] * 60e3 : 0; })();   // last activity before this open (epoch ms)
function dzLog(kind) {                       // one entry per minute is plenty: epoch minutes, rolling 14-day window
  const now = Date.now(), m = Math.floor(now / 60e3); if (m === DZ.lastLog) return; DZ.lastLog = m;
  const cut = m - DZ.WIN_DAYS * 1440, a = dzLoad().filter(x => x > cut && x !== m); a.push(m); if (a.length > 6000) a.splice(0, a.length - 6000);
  try { localStorage.setItem(DZ.LOG_KEY, JSON.stringify(a)); } catch (e) {} }
function dzHist() {                          // per hour: distinct days with activity, recency-weighted (half-life 7 d)
  const now = Date.now(), days = Array.from({length: 24}, () => new Set());
  dzLoad().forEach(m => { const d = new Date(m * 60e3); days[d.getHours()].add(d.toDateString() + '|' + Math.floor((now - m * 60e3) / 864e5)); });
  const h = Array(24).fill(0); let devDays = new Set();
  days.forEach((s, hr) => s.forEach(k => { const [ds, age] = k.split('|'); devDays.add(ds); h[hr] += Math.pow(0.5, +age / DZ.HALF_LIFE); }));
  return {h, devDays: devDays.size}; }
function dzUsualFromHist(h) {                // twin of update_seed.py usual_from_hist(): active = 24 h minus the quiet block
  const mx = Math.max(...h); if (!(mx > 0)) return null;
  let best = 0, bs = Infinity; for (let s = 0; s < 24; s++) { let v = 0; for (let k = 0; k < DZ.CORE; k++) v += h[(s + k) % 24]; if (v < bs) { bs = v; best = s; } }
  const q = i => h[((i % 24) + 24) % 24] < DZ.QUIET * mx; let a = best, b = best + DZ.CORE;
  while (q(a - 1) && b - a < 20) a--; while (q(b) && b - a < 20) b++;
  return {start: ((b % 24) + 24) % 24, end: ((a % 24) + 24) % 24}; }
function dzParseHours(s) {                   // "9 AM to 3 AM", "9am-3am", "21:00-03:00", "9 to 3" (no am/pm = 24 h clock)
  s = (s || '').trim().toLowerCase(); if (!s) return null;
  const re = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|a|p)?/g, t = []; let m;
  while ((m = re.exec(s)) && t.length < 2) { let h = +m[1], mi = +(m[2] || 0); if (h > 24 || mi > 59) return null;
    const ap = m[3] ? m[3][0] : ''; if (ap === 'a' && h === 12) h = 0; if (ap === 'p' && h < 12) h += 12; t.push((h % 24) + mi / 60); }
  return t.length === 2 && t[0] !== t[1] ? {start: t[0], end: t[1]} : null; }
function dzFmt(x) { const h = Math.floor(x), mi = Math.round((x - h) * 60), ap = h < 12 ? 'AM' : 'PM', hh = h % 12 || 12; return hh + (mi ? ':' + String(mi).padStart(2, '0') : '') + ' ' + ap; }
function dzUsual() {                          // {start, end, src}: override, else device-learned blended with the seed (cached 1 min)
  if (DZ._u && Date.now() - DZ._uT < 60e3) return DZ._u; DZ._uT = Date.now(); return (DZ._u = dzUsualNow()); }
function dzUsualNow() {
  const o = dzParseHours(localStorage.getItem(DZ.HOURS_KEY)); if (o) return Object.assign(o, {src: 'yours'});
  const {h, devDays} = dzHist(), sm = Math.max(...DZ.SEED.hist) || 1, w = Math.max(1, 5 - devDays);   // seed counts as ~5 days, fading to 1 as this phone learns
  const mix = h.map((v, i) => v + w * DZ.SEED.hist[i] / sm), u = dzUsualFromHist(mix) || {start: DZ.SEED.start, end: DZ.SEED.end};
  return Object.assign(u, {src: devDays ? 'learned (' + devDays + ' day' + (devDays > 1 ? 's' : '') + ' on this phone + bot messages)' : 'learned from bot messages'}); }
function dzOffHours(ms) {
  if (DZ.force === 'offhours') return true; if (DZ.force === 'onhours') return false;
  const u = dzUsual(), d = new Date(ms || Date.now()), x = d.getHours() + d.getMinutes() / 60;
  return u.start < u.end ? !(x >= u.start && x < u.end) : !(x >= u.start || x < u.end); }
const dzF = () => EG.A.faces, dzPair = n => (EG.A.pairs && EG.A.pairs[n]) || [];
const dzReady = () => BOT === 'aloy' && !MSG && DZ.on && dzF().drowsy && dzF().justwoke && dzF().sleepy;
function dzEnter() {                          // idle off-hours: amused/low life -> sleepy -> in-betweens -> drowsy, then hold
  if (!dzReady()) return; const t = P.clock(), F = dzF(); P.amb = null; ++P.run; P.mode = 'drowsy'; DZ.state = 'drowsy';
  T.patch = T.patch.filter(e => e.t <= t); ins(T.patch, {t, name: null, fade: 1.2, k: 1});
  const st = [[F.amused, 0, 1.2], [F.sleepy, 2.6, 5], ...dzPair('sleepy-to-drowsy').map(im => [im, 0.55, 0]), [F.drowsy, 0.6, 36000]];
  egChain(t + 0.1, st, 'sleepy'); DZ.nextNod = performance.now() / 1000 + 20; P.idleNext = Infinity; dzStatus(); }
function dzWake(fromOpen) {                   // just-woke for ~1.7 s, then ease out: justwoke -> mid frames -> listening -> amused
  if (!dzReady()) return 0; const F = dzF(); const was = DZ.state; P.amb = null; const run = ++P.run; P.mode = 'drowsy';
  egReset(false); const t = P.clock(), ein = 0.2, eout = 0.15;
  const lead = was === 'drowsy' || fromOpen ? [[F.drowsy, 0, fromOpen ? 0.9 : 0.15]]
    : [[F.amused, 0, 0], [F.sleepy, 0.5, 0], ...dzPair('sleepy-to-drowsy').map(im => [im, 0.1, 0]), [F.drowsy, 0.15, 0.25]];   // a quick dip: she'd dozed off
  const st = [...lead, ...dzPair('drowsy-to-justwoke').map(im => [im, ein, 0]), [F.justwoke, ein, DZ.JW_HOLD],
    ...dzPair('justwoke-to-listening').map(im => [im, eout, 0]), [F.listening, eout, 0.5],
    ...dzPair('listening-to-amused').map(im => [im, 0.09, 0]), [F.amused, 0.12, 0.05]];
  const D = egChain(t, st, 'sleepy'); DZ.state = 'waking'; DZ.waking = true; DZ.wakeUntil = performance.now() + D * 1000; dzStatus();
  setTimeout(() => { DZ.waking = false; DZ.state = 'awake'; DZ.idleSince = performance.now() / 1000; dzStatus();
    if (run === P.run) { P.mode = 'idle'; toNeutral(P.clock()); } }, D * 1000);
  return D; }
function dzActivity(kind) {                   // every open / tap / play: log it, and wake her if it's due
  const now = Date.now(), gap = DZ.prevAct ? now - DZ.prevAct : Infinity; dzLog(kind); DZ.prevAct = now; DZ.idleSince = performance.now() / 1000;
  if (!dzReady() || DZ.waking) return false;
  if (DZ.state === 'drowsy' || (kind !== 'open' && gap >= DZ.GAP_MS)) { dzWake(false); return true; }
  return false; }
function dzDefer(fn) {                        // a Playback / Go tap that woke her starts right after the wake, not over it
  return (...a) => { const left = DZ.waking ? DZ.wakeUntil - performance.now() : 0;
    if (left > 30) { setTimeout(() => { DZ.waking = false; fn(...a); }, left); return; } return fn(...a); }; }
function dzTick(wall) {                       // from loop(): idle long enough off-hours -> drowsy; while drowsy, slow long blinks
  if (!dzReady()) return;
  if (DZ.state === 'drowsy') { if (wall > DZ.nextNod) { blinkUntil = wall + 0.9 + Math.random() * 1.4; DZ.nextNod = wall + 14 + Math.random() * 22; } return; }
  if (DZ.waking || !(P.mode === 'idle' || (P.mode === 'ambient' && P.amb && P.amb.low))) { if (P.mode !== 'idle' && !(P.amb && P.amb.low)) DZ.idleSince = wall; return; }
  if (wall - DZ.idleSince > DZ.IDLE_S && dzOffHours()) dzEnter(); }
function dzStatus() { const u = dzUsual(), el = $('usualNote'); if (!el) return;
  el.textContent = (u.src === 'yours' ? 'Using your hours: ' : 'Learned: ') + dzFmt(u.start) + ' to ' + dzFmt(u.end) + (u.src === 'yours' ? '' : ' (' + u.src + ')') +
    '. Off those hours, idle Aloy gets drowsy.' + (DZ.state !== 'awake' ? ' Now: ' + DZ.state + '.' : ''); }
function dzInitUi() {
  const inp = $('usualHours'); if (inp) { inp.value = localStorage.getItem(DZ.HOURS_KEY) || '';
    const u = dzUsual(); inp.placeholder = 'Learned: ' + dzFmt(u.start) + ' to ' + dzFmt(u.end);
    inp.onchange = () => { const v = inp.value.trim();
      if (!v) { localStorage.removeItem(DZ.HOURS_KEY); DZ._u = null; toast('Usual hours: learned'); }
      else if (dzParseHours(v)) { localStorage.setItem(DZ.HOURS_KEY, v); DZ._u = null; const o = dzParseHours(v); toast('Usual hours: ' + dzFmt(o.start) + ' to ' + dzFmt(o.end)); }
      else { toast('Try something like 9 AM to 3 AM'); return; } dzStatus(); }; }
  const cb = $('lifeDrowsy'); if (cb) { cb.checked = DZ.on; cb.onchange = () => { DZ.on = cb.checked; localStorage.setItem(DZ.ON_KEY, DZ.on ? '1' : '0'); dzStatus(); }; }
  dzStatus(); }
async function dzLoadSeed() { try { const s = await fetch('drowsy-seed.json', {cache: 'no-cache'}).then(r => r.json());
  if (Array.isArray(s.window && s.window.hist_weighted_active_days) && s.window.hist_weighted_active_days.length === 24)
    DZ.SEED = {hist: s.window.hist_weighted_active_days, start: s.usual_start_hour, end: s.usual_end_hour, src: s.generated_ct}; DZ._u = null; } catch (e) {} }
function dzBoot(normalStart) {                // on open: off-hours (or 2 h since he last used it) -> wake first, then the normal start
  const gap = DZ.prevAct ? Date.now() - DZ.prevAct : Infinity, due = dzReady() && (dzOffHours() || gap >= DZ.GAP_MS);
  dzActivity('open'); dzInitUi();
  if (!due) { normalStart(); return; }
  const D = dzWake(true), run = P.run; setTimeout(() => { if (run === P.run) normalStart(); }, D * 1000 + 50); }
document.addEventListener('pointerdown', () => dzActivity('tap'), true);   // capture: logs every tap, wakes her before the control acts
document.addEventListener('keydown', () => dzActivity('key'), true);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && document.body.dataset.ready) dzActivity('return'); });

/* UI */

function openSettings(on) { $('setupTabs').hidden = !on; $('setup').hidden = !on; $('settingsBtn').classList.toggle('on', on); if (on) { $('compose').hidden = true; if ($('toast')) $('toast').hidden = true; } }
function tab(name) { document.querySelectorAll('.setupTab[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); ['demos', 'emotes', 'life', 'info'].forEach(n => $('panel-' + n).hidden = n !== name); }
async function boot() {
  try { fitFaceCover(); } catch (e) {}                    // v3.3.8w: whole face (top of head included) from the very first frame
  try { new ResizeObserver(() => { try { fitFaceCover(); } catch (e) {} }).observe($('stage')); } catch (e) {}
  egInit(cv); await egLoad();
  (function () {                                         // v3.2.8: paint amused as soon as the first images are in, before focus / seed / the rest
    const n = EG.A && EG.A.faces && EG.A.faces.amused, im = n && EG.IM[n];
    if (CX && im && im.naturalWidth) { CX.drawImage(im, 0, 0, EG.A.W, EG.A.H); EGB.b.drawImage(im, 0, 0, EG.A.W, EG.A.H); EGB.has = true; }
  })();
  await loadFocus(); try { fitFaceCover(); } catch (e) {} checkLatestUpdate();
  try { const reg = await fetch('bots.json', {cache: 'no-cache'}).then(r => r.json()); BOTS = reg.bots || [];
    if (!BOTS.some(b => b.id === BOT)) BOT = reg.default || 'aloy'; }
  catch (e) { BOTS = [{id:'aloy', name:'Aloy', default_face:'amused', focus:true}]; BOT = 'aloy'; }
  await selectBot(BOT, true);
  if (typeof paintLeds === 'function') paintLeds();
  try { if (serverVoice && !MSG && !window.EMOTE_STATIC) serverVoice.endpoints();   // a texted link never types, so it never needs the voice host
  } catch (e) {}
  renderDemoList();
  $('emoteTable').innerHTML = EG.EM.markers.map(m => `<tr class="${m.kind}"><td>${m.emoji.join(' ')}</td><td>${m.tags.map(t => '[' + t + ']').join(' ')}</td><td class="${m.kind === 'peak' ? 'peak' : ''}">${m.label}</td></tr>`).join('');
  $('palette').innerHTML = EG.EM.markers.map(m => `<button type="button" data-ins="${m.emoji[0]}" class="${m.kind}" title="${m.label} ${m.tags.map(t => '[' + t + ']').join(' ')}"><b>${m.emoji[0]}</b>${m.tags[0]}</button>`).join('');
  renderChart();
  if (MSG) await loadMessage(); else if (BOT === 'aloy') await pickDemo(EG.demos.some(d => d.id === 'all-expressions') ? 'all-expressions' : 'sample2'); else await pickFirstBotDemo();
  egReset(false); sceneTick(); requestAnimationFrame(loop);
  if (window.PAD && PAD.boot()) { document.body.dataset.ready = '1'; if (typeof egStartLoadRest === 'function') egStartLoadRest(); return; }   // emotion pad: restore and skip the opening demo and just-woke
  if (!MSG && P.script && P.script.silent && P.script.kind && BOT === 'aloy') { try { P._silentBuilt = null; ensureSilentTracks(); const m = egSceneMissing(); P._openMiss = m.length; egNeed(m, 60000); await egNeed(m.slice(0, Math.ceil(m.length * 0.25)), 15000); } catch (e) {} P._silentBuilt = null; egReset(false); }   // v3.3.8w
  const normalStart = () => { if (!MSG && P.script && P.script.silent && P.script.kind && BOT === 'aloy') playSilent(); };   // v3.2.5: opens on the looping all-expressions demo
  await dzLoadSeed(); if (MSG) normalStart(); else dzBoot(normalStart);   // drowsy: off-hours / 2 h gap -> just-woke first
  document.body.dataset.ready = '1';
  if (typeof egStartLoadRest === 'function') egStartLoadRest();            // v3.2.8: remainder of the pack, now that boot is ready
}
function startPicked() {                         // v3.3.2 (Drue 111426 2351): a demo plays as soon as it's picked
  if (!P.script) return; openSettings(false); $('compose').hidden = true;
  if (P.script.kind === 'gifseq') { playGifSeq(); return; }
  if (P.script.silent) { if (P.script.kind) playSilent(); else playAmbient(); return; }
  playDemo(); }
$('playbackBtn').onclick = dzDefer(() => { if (!P.script) return; openSettings(false); $('compose').hidden = true;
  if (P.script.kind === 'gifseq') { if (P.mode === 'gif') { stopAll(); setCaption(P.script.title + ' · stopped'); } else playGifSeq(); return; }
  if (P.script.silent) { if (P.mode === 'ambient') { stopAll(); egReset(false); toNeutral(P.clock()); setPb(true); setCaption(P.script.title + ' · stopped'); }
    else if (P.script.kind) playSilent(); else playAmbient(); return; } playDemo(); });
$('composeBtn').onclick = () => { takeOver(); openSettings(false); $('compose').hidden = !$('compose').hidden; };
$('composePlay').onclick = dzDefer(() => { takeOver(); return playTyped($('composeText').value); });   // Go (after a wake, if one is playing)
$('composeStop').onclick = () => stopAll();
/* ---------- compose: palette (all expressions), caret-safe insert + face preview, chord chart, autocomplete ---------- */
const ta = $('composeText'); let sel = [ta.value.length, ta.value.length];
const keepSel = () => { if (document.activeElement === ta) sel = [ta.selectionStart, ta.selectionEnd]; };
['select', 'keyup', 'input', 'click', 'touchend'].forEach(ev => ta.addEventListener(ev, keepSel));
document.addEventListener('selectionchange', keepSel);
function insertAtCaret(txt, from) {              // keeps the caret; inside a word the mark goes in tight (chord style)
  const [s0, s1] = from || sel, v = ta.value; ta.value = v.slice(0, s0) + txt + v.slice(s1);
  const p = s0 + txt.length; sel = [p, p]; ta.setSelectionRange(p, p); renderChart(); }
function takeOver() {                            // v3.2.5: any control stops a running silent demo (it loops now) and clears its frames
  if (P.mode !== 'ambient') return false; stopAll(); egReset(false); setPb(true); setCaption(''); return true; }
function previewFace(m) {                        // play the picked expression on the face right away
  if (!m) return; takeOver();
  if (P.mode !== 'idle') return; const t = P.clock(); P.amb = null;
  if (EG.A.tears && EG.A.tears[m.face]) { const F = EG.A.faces; egReset(false);   // v3.2.5: tear faces play as full frames (their own mouth) with moving tears
    egChain(t, [[F.amused, 0, 0], [F[m.face], 0.6, 6.5], [F.amused, 0.9, 0.1]], m.face); P.idleNext = performance.now() / 1000 + 9; return; }
  T.patch = T.patch.filter(e => e.t <= t);   // v3: a quick second pick replaces the first one's pending return
  if (m.kind === 'peak') { if (!T.beats.some(b => t < b.t1)) egBeat(t, m.face); }
  else { const p = egPatchAt(t), back = p && p.name; egCue(t, m.face, m.kind); if (m.kind !== 'smile') ins(T.patch, {t: t + 2.2, name: null, fade: EG.EM.talk_fade, k: 1}); }
  P.idleNext = performance.now() / 1000 + 8; }
// Tapping the palette must not blur the textarea or drop the selection: swallow the press (mousedown / touchstart),
// then act on touchend (touch) or click (mouse). A touch tap also fires a click later, so ignore that one.
let lastTouch = 0;
function tapHandler(el, fn) {
  el.addEventListener('mousedown', e => e.preventDefault());
  el.addEventListener('touchstart', e => e.preventDefault(), {passive: false});
  el.addEventListener('touchend', e => { e.preventDefault(); lastTouch = Date.now(); fn(e); }, {passive: false});
  el.addEventListener('click', e => { if (Date.now() - lastTouch > 700) fn(e); });
}
tapHandler($('palette'), e => { const b = e.target.closest('button'); if (!b) return; const m = EG.emo[b.dataset.ins]; insertAtCaret(b.dataset.ins); previewFace(m); });
tapHandler($('palBtn'), () => { const pl = $('palette'); pl.hidden = !pl.hidden; $('palBtn').setAttribute('aria-expanded', String(!pl.hidden)); $('palBtn').classList.toggle('open', !pl.hidden); });
function renderChart() {                         // chord-chart view: marks ride above the letter they land on
  const items = egParse(ta.value); let html = '';
  const esc = s => s.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));
  const markOf = f => (EG.EM.markers.find(m => m.face === f && m.kind !== 'peak') || EG.EM.markers.find(m => m.face === f)).emoji[0];
  for (const it of items) {
    if (it.beat) { const m = EG.EM.markers.find(x => x.face === it.beat && x.kind === 'peak'); html += `<span class="beat" title="plays here, between phrases">${m.emoji[0]} beat</span>`; continue; }
    const at = {}; it.cues.forEach(([c, f, k]) => (at[c] = at[c] || []).push(k === 'smile' ? '🙂' : markOf(f)));
    let s = ''; for (let i = 0; i <= it.say.length; i++) { const ch = i < it.say.length ? esc(it.say[i]) : ''; s += at[i] ? `<ruby>${ch || '&nbsp;'}<rt>${at[i].join('')}</rt></ruby>` : ch; }
    html += s + ' ';
  }
  $('chart').innerHTML = html || '<span class="hint">Your cues show here, above the letters they land on.</span>';
}
function suggest() {                             // autocomplete: type [tag or :word for matching expressions
  const p = ta.selectionStart, m = /(?:\[|:)([a-z-]{1,})$/i.exec(ta.value.slice(0, p)), box = $('suggest');
  if (!m) { box.hidden = true; return; } const q = m[1].toLowerCase();
  const hits = EG.EM.markers.filter(x => x.tags.some(t => t.startsWith(q)) || x.label.toLowerCase().includes(q)).slice(0, 6);
  if (!hits.length) { box.hidden = true; return; }
  box.innerHTML = hits.map(x => `<button type="button" data-ins="${x.emoji[0]}" data-from="${p - m[0].length}">${x.emoji[0]} ${x.tags[0]}</button>`).join(''); box.hidden = false; }
ta.addEventListener('input', () => { renderChart(); suggest(); });
tapHandler($('suggest'), e => { const b = e.target.closest('button'); if (!b) return; insertAtCaret(b.dataset.ins, [+b.dataset.from, sel[1]]); previewFace(EG.emo[b.dataset.ins]); $('suggest').hidden = true; });
document.querySelectorAll('.future').forEach(b => b.onclick = () => toast(b.dataset.msg));
document.querySelectorAll('.sheetX').forEach(b => b.onclick = () => closeSheets());
$('settingsBtn').onclick = () => openSettings($('setup').hidden);
function setPalette(on) { const pl = $('palette'); pl.hidden = !on; $('palBtn').setAttribute('aria-expanded', String(on)); $('palBtn').classList.toggle('open', on); }
$('setupChev').onclick = () => openSettings(false);
document.querySelectorAll('.setupTab[data-tab]').forEach(b => b.onclick = () => tab(b.dataset.tab));
$('demoList').onclick = e => { const b = e.target.closest('.demo'); if (b) { takeOver(); stopAll(); try { audioVoice.unlock(); } catch (x) {} pickDemo(b.dataset.id).then(startPicked); } };   // v3.3.2: pick = play
/* ---------- v3.1 layout: Phone / PC (Drue 111326 2252). Default by screen; choice kept in localStorage. PC is a stub for now. ---------- */
const autoLayout = () => (matchMedia('(min-width: 900px) and (pointer: fine)').matches ? 'pc' : 'phone');
function setLayout(m, save) { P.layout = m; document.body.dataset.layout = m; if (save) localStorage.setItem('aloyLayout', m);
  document.querySelectorAll('button[data-layout]').forEach(b => { b.classList.toggle('on', b.dataset.layout === m); b.setAttribute('aria-checked', String(b.dataset.layout === m)); });
  $('pcNote').hidden = m !== 'pc' || !!MSG;
  $('layoutNote').textContent = (m === 'pc' ? 'PC mode: the desktop layout comes later; for now it shows the phone layout.' : 'Phone layout.') + (localStorage.getItem('aloyLayout') ? ' Your choice is saved on this device.' : ' Picked automatically for this screen.'); }
document.querySelectorAll('button[data-layout]').forEach(b => b.onclick = () => setLayout(b.dataset.layout, true));
setLayout(localStorage.getItem('aloyLayout') || autoLayout(), false);
/* ---------- v3.1 texted-link player: one message, one tap to start, Replay after ---------- */
async function loadMessage() {
  document.body.classList.add('msg'); document.title = MSG.title || document.title;
  const S = P.script = await fetch(MSG.script, {cache: 'no-cache'}).then(r => r.json()); P.demo = {id: S.id, title: S.title, text: S.text};
  try { const b = await fetch(MSG.audio).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }); S.audio_src = URL.createObjectURL(b); }   // in memory: replays + offline
  catch (e) { S.audio_src = MSG.audio; }
  showCaptions(S.captions); setPb(false); $('tapLbl').textContent = MSG.tap || 'Tap to hear Aloy'; $('tapGate').hidden = false;
}
$('tapGo').onclick = () => { $('tapGate').hidden = true; playDemo(); };
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register(MSG ? MSG.sw : 'sw.js', MSG ? {scope: MSG.scope} : undefined).catch(() => {});
// v3.2.2: open/close the bot list like the desktop app (tap name or chevron; tap outside or pick a bot to close)
$('botPick').onclick = e => { e.stopPropagation(); openMenu(); };
$('pullChev').onclick = e => { e.stopPropagation(); openMenu(); };
$('pull').addEventListener('click', e => e.stopPropagation());
document.addEventListener('click', () => { closeMenu(); if (typeof clearLedSel === 'function') clearLedSel(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

boot();

/* v3.2.9: one small version line. Fetches /m/latest no-store. Never auto-redirect. Offline stays plain. */
function parseVer(s) {
  const m = String(s || '').match(/v?(\d+)\.(\d+)(?:\.(\d+))?/);   // v3.3: two-part versions count as x.y.0
  return m ? [+m[1], +m[2], +(m[3] || 0)] : null;
}
function cmpVer(a, b) {
  const A = parseVer(a), B = parseVer(b);
  if (!A || !B) return 0;
  for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] - B[i];
  return 0;
}
async function checkLatestUpdate() {
  const el = $('verLine'); if (!el) return;
  const here = (location.pathname.match(/sample1v\d+(?:\.\d+)*[pwsx]?/) || [])[0] || 'sample1v3.3.8x';
  const running = here.replace(/^sample1/, '');
  const set = (text, cls, href) => {
    el.textContent = text;
    el.className = cls || '';
    if (href) { el.href = href; el.setAttribute('href', href); }
    else { el.removeAttribute('href'); el.href = '#'; }
  };
  set(running, 'plain');
  try {
    const r = await fetch('/m/latest/index.html', {cache: 'no-store'});
    if (!r.ok) return;
    const html = await r.text();
    const m = html.match(/\/m\/(sample1v[0-9.]+)\//);
    if (!m) return;
    const latest = m[1], target = latest.replace(/^sample1/, '');
    const c = cmpVer(here, latest);
    const q = (location.search || '') + (location.hash || '');
    if (c === 0) set(running + ' · latest', 'latest');
    else if (c < 0) set(running + ' · newer ' + target + ' available', 'newer', '/m/' + latest + '/' + q);
    else set(running + ' · preview', 'preview');
  } catch (e) {}
}
window.addEventListener('resize', () => { try { fitFaceCover(); } catch (e) {} });

/* ---------- v3.3.1 (Drue 111426 2151 t1459u): bottom status LEDs, same rules as the desktop Emote App.
   20 slots (lead + 19). Far-left fixtures stay put; remaining assigned lamps are spread among idle slots.
   GREEN = on schedule; YELLOW = fixing it without bothering you; RED = needs attention; STALE = no recent check;
   idle = unassigned. Lead also blinks red / flutters yellow from the feed signal. The public phone player has
   no live project feed, so the row sits in the no-feed state (stale lead, idle slots) until a feed is wired.
   Tap a lamp to read it in #ledDetail. Layout cost is only the existing black space under the buttons. */
const LED_MIN = 20, LED_CORE = 4;
let ledSnaps = {}, ledSel = null, ledMap = [];
function ledP(s) { const t = s ? Date.parse(s) : NaN; return isNaN(t) ? null : t; }
function ledHm(t) { return new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' }) + ' CT'; }
function ledLineColor(l, now) {
  const t = ledP(l.at);
  const r = String(l.r || l.status || l.color || '').toLowerCase();
  if (!r || t === null) return 's';
  if (t - now > 10 * 60000) return 'r';
  if (now - t > l.w * 3600000) return 's';
  if (r === 'fail' || r === 'r' || r === 'red' || r === 'error' || r === 'bad') return 'r';
  if (r === 'y' || r === 'yellow' || r === 'warn' || r === 'warning') return 'y';
  return 'g';
}
function ledBlurb(c, l) {
  const where = (l && l.s) ? String(l.s) : '';
  const who = (l && l.o) ? String(l.o) : '';
  const when = (l && l.at && ledP(l.at)) ? ' (last check ' + ledHm(ledP(l.at)) + ')' : (l && l.o && c !== 'r' ? ' (' + l.o + ')' : '');
  if (c === 'g') return 'GREEN: on schedule / in progress, no problems' + (where ? ' — ' + where : ' — all good') + when;
  if (c === 'y') return 'YELLOW: trying to fix this without bothering you' + (where ? ' — ' + where : '') + when;
  if (c === 'r') return 'RED: needs your attention' + (who ? ' — talk to ' + who : '') + (where ? ': ' + where : '') + when;
  if (c === 'idle') return 'UNASSIGNED: no project assigned';
  return 'STALE: no recent check' + (where ? ' — ' + where : '') + (who ? ' (' + who + ')' : '') + when;
}
function ledSpread(nItems, nSlots, nCore) {
  const map = []; let i;
  for (i = 0; i < nSlots; i++) map[i] = -1;
  if (nItems <= 0) return map;
  if (nItems >= nSlots) { for (i = 0; i < nSlots; i++) map[i] = i; return map; }
  const core = Math.max(0, Math.min(nCore || 0, nItems, nSlots));
  for (i = 0; i < core; i++) map[i] = i;
  const restItems = nItems - core, restSlots = nSlots - core, base = core;
  if (restItems <= 0) return map;
  if (restItems >= restSlots) { for (i = 0; i < restSlots; i++) map[base + i] = base + i; return map; }
  if (restItems === 1) { map[base + Math.floor(restSlots / 2)] = base; return map; }
  for (i = 0; i < restItems; i++) map[base + Math.round(i * (restSlots - 1) / (restItems - 1))] = base + i;
  return map;
}
function ledView(id, now) {
  const s = ledSnaps[id], quiet = !s || now - s.ts * 1000 > 45 * 60000;
  const lines = (s && s.lines) || [];
  const cols = lines.map(l => quiet ? 's' : ledLineColor(l, now));
  let sig = null;
  if (!quiet && s && s.act) {
    const a = s.act, au = ledP(a.attention_until);
    if (a.attention === true && au !== null && au > now && au <= now + 24 * 3600000) sig = 'b';
    else { const u = ledP(a.until); if (a.state === 'working' && u !== null && now < u) sig = 'y'; }
  }
  return { snap: s, quiet, lines, cols, sig };
}
function ledLead(v) {
  const nR = v.cols.filter(c => c === 'r').length, nY = v.cols.filter(c => c === 'y').length, nS = v.cols.filter(c => c === 's').length;
  const leadC = v.quiet ? 's' : v.lines.length ? (nR ? 'r' : nY ? 'y' : nS ? 's' : 'g') : 'g';
  return leadC;
}
function ledText(idx, v) {
  const b = (typeof BOTS !== 'undefined' && BOTS.find(x => x.id === BOT)) || {};
  const name = b.name || BOT || 'Bot';
  if (idx === 0) {
    const a = (v.snap && v.snap.act) || {};
    if (v.sig === 'b') return name + ' — RED: needs your attention — talk to ' + name + (a.attention_reason ? ': ' + a.attention_reason : '');
    if (v.sig === 'y') return name + ' — YELLOW: trying to fix this without bothering you' + (a.what ? ' — ' + a.what : '');
    if (v.quiet) return name + ' — STALE: feed quiet';
    if (!v.lines.length) return name + ' — GREEN: on schedule / in progress, no problems — feed live, no panel lines';
    return name + ' — ' + ledBlurb(ledLead(v), null);
  }
  const li = ledMap[idx - 1];
  if (li == null || li < 0) return 'Unassigned LED slot — no project assigned';
  return v.lines[li].t + ' — ' + ledBlurb(v.cols[li], v.lines[li]);
}
function paintLedDetail(v) {
  const el = $('ledDetail'), row = $('row'); if (!el) return;
  if (row) [].forEach.call(row.children, (d, i) => d.classList.toggle('sel', ledSel === i));
  el.textContent = (ledSel == null) ? '' : ledText(ledSel, v || ledView(BOT, Date.now()));
}
function clearLedSel() {
  if (ledSel == null) return;
  ledSel = null; paintLedDetail();
}
function paintLeds() {
  const row = $('row'); if (!row) return;
  const v = ledView(BOT, Date.now());
  const nSlots = Math.max(LED_MIN - 1, v.lines.length);
  const want = nSlots + 1;
  if (row.children.length !== want) {
    row.innerHTML = '';
    for (let i = 0; i < want; i++) {
      const d = document.createElement('div');
      d.className = 'lamp';
      d.setAttribute('role', 'button');
      d.tabIndex = 0;
      row.appendChild(d);
    }
    if (ledSel != null && ledSel >= want) ledSel = null;
  }
  row.className = (v.sig || '');
  ledMap = ledSpread(v.lines.length, nSlots, LED_CORE);
  const lead = row.children[0];
  lead.className = 'lamp lead ' + ledLead(v);
  lead.title = ledText(0, v);
  for (let si = 0; si < nSlots; si++) {
    const el = row.children[si + 1], li = ledMap[si];
    if (li < 0) { el.className = 'lamp idle'; el.title = 'Unassigned LED slot — no project assigned'; }
    else { el.className = 'lamp ' + v.cols[li]; el.title = ledText(si + 1, v); }
  }
  paintLedDetail(v);
}
(function bindLeds() {
  const row = $('row'); if (!row) return;
  row.addEventListener('click', e => {
    const el = e.target.closest ? e.target.closest('.lamp') : e.target;
    if (!el || !row.contains(el)) return;
    e.stopPropagation();
    const idx = Array.prototype.indexOf.call(row.children, el);
    if (idx < 0) return;
    ledSel = (ledSel === idx) ? null : idx;
    paintLedDetail();
  });
  row.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest ? e.target.closest('.lamp') : e.target;
    if (!el || !row.contains(el)) return;
    e.preventDefault(); e.stopPropagation(); el.click();
  });
})();


/* ---------- v3.3.7p (private): background music wiring. Drue 111726 12:31 + 12:46 PM CT: "they just launch from the beginning and then repeat".
   Rage clip -> NIN "In This Together", Nico clip -> ASPCA/PETA ad: each starts at 0 when its clip starts, loops, stops when the clip ends.
   The Clodyssey: starts at 0 whenever neither NIN nor PETA is playing, loops, stops while one of them plays (then restarts at 0 after).
   The manual 'Private audio' demos (music-*) still play their own track through the voice element, and the bed stays off while they run.
   No sync beyond that. The TweakX head blow-up timing (long-v3, sfx.at 16.769) is untouched: it uses the voice element, not these. ---------- */
var MUS = window.MUS = (() => {
  const SRC = {ninRage: 'audio/NIN-rage-v337p.m4a', peta: 'audio/ASPCA-v337p.m4a', bed: 'audio/THE-CLODYSSEY-bed-v338x.m4a', duck: 'audio/THE-CLODYSSEY-duck-v338x.m4a'};   // Drue 111826 0017 "You can record audio at different levels": levels baked in (v3.3.8x: bed -37.5 LUFS, duck -47.5 LUFS (10 LU under the NIN of the angry scene, -27.4)), so iPhone (which ignores .volume) gets them too
  const CLIP = {rage: 'ninRage', nico: 'peta'};   // v3.3.7p final (Aloy 111826 0112): rage plays its own one-shot copy of the approved r1 music track (offset, level, -5 dB scream duck, 42.6-46.5 s fade baked in), locked to the voice clock
  const SYNC = new Set(['ninRage']);               // one-shot tracks that follow au.currentTime (seek if they drift > 80 ms, pause/resume with the voice); NIN 'nin' (looping) is kept for anything else that maps to it
  const QUIET = new Set(['tweak-b', 'tweak-e']);   // + tweak-e (Drue 111826 0015: auto-mute when a clip plays its own music; E ends on zen music)   // Drue 111826 0009: "that shouldn't play with tweak's head blowing up"
  const mk = (src, vol, once) => { const a = new Audio(); a.preload = 'auto'; a.loop = !once; a.volume = vol; a.setAttribute('playsinline', ''); a.src = src; return a; };
  const el = {ninRage: mk(SRC.ninRage, 1, true), peta: mk(SRC.peta, 1), bed: mk(SRC.bed, 1), duck: mk(SRC.duck, 1)};   // v3.3.7p final: levels baked into the files, so no music element sets volume. NIN = the old 0.55 level (-5.2 dB, -16.4 -> -21.6 LUFS). ASPCA -16.2 dB (-24.4 -> -40.6 LUFS) so it sits under Eve's Nico voice like the approved r6 proof (median 18.5 dB under; at 0.55 it was only 7.5 dB under and louder than the voice in 10% of speech) - Drue 111826 0015 'make sure the volume is underneath the voice'
  el.duck.muted = true;
  const UNL = {};   // pending first-tap unlock per clip-music element (a promise that settles after the silent play settles)
  const M = {el, playing: null, bedOn: localStorage.getItem('aloyBgm') !== 'off', touched: false, manual: false, log: []};
  const say = m => { M.log.push([+(performance.now() / 1000).toFixed(2), m]); if (M.log.length > 60) M.log.shift(); };
  const go = (a, from0) => { try { if (from0) a.currentTime = 0; const q = a.play(); if (q && q.catch) q.catch(e => say('blocked ' + e.name)); } catch (e) { say('err ' + e); } };
  const stop = a => { try { a.pause(); } catch (e) {} };
  function bedUpdate() {
    const want = M.bedOn && M.touched && !M.playing && !M.manual;
    if (want && el.bed.paused) { el.duck.currentTime = 0; go(el.bed, true); go(el.duck, false); say('bed start'); }
    if (!want && !el.bed.paused) { stop(el.bed); stop(el.duck); say('bed stop'); }
    const d = !!(M.voiced || (au && !au.paused && !au.ended));   // under the voice / Tweak bites: switch to the quieter baked copy (mute swap, not volume)
    if (d !== M.ducked) { M.ducked = d; if (want && el.duck.paused) go(el.duck, false); say(d ? 'duck' : 'unduck'); }   // both copies start together at 0 and run side by side, so a swap needs no seek
    el.bed.muted = d; el.duck.muted = !d;
  }
  M.clipStart = (id, voiced) => {
    const k = CLIP[id]; M.manual = /^music-/.test(id || '') || QUIET.has(id); M.voiced = !!voiced;   // voiced: an Eve voice clip is running, keep the bed ducked for the whole clip (pauses too)
    if (M.playing && M.playing !== k) { stop(el[M.playing]); M.playing = null; }
    const begin = () => { if (M.playing !== k) return; ensure(el[k], k); go(el[k], true); if (SYNC.has(k)) { M.drift = []; syncTick(); } };
    if (k) { M.playing = k; say(k + ' start'); if (UNL[k]) UNL[k].then(begin); else begin(); }   // never swap src under a pending first-tap unlock play (that aborts it)
    bedUpdate(); };
  M.drift = [];   // [voice t, music t - voice t] samples, for the tests
  function syncTick() {   // keep a one-shot track on the clip clock: same start, no drift, pauses with the voice, never loops
    const k = M.playing; if (!k || !SYNC.has(k) || UNL[k]) return; const a = el[k];
    try { const vt = au.currentTime, d = a.duration;
      if (au.paused || au.ended) { if (!a.paused) stop(a); }
      else { if (isFinite(d) && vt >= d - 0.05) { if (!a.paused) stop(a); return; }
        const dr = a.currentTime - vt; M.drift.push([+vt.toFixed(2), +dr.toFixed(3)]); if (M.drift.length > 400) M.drift.shift();
        if (Math.abs(dr) > 0.08) { a.currentTime = vt; say('resync ' + dr.toFixed(3)); }
        if (a.paused) go(a, false); } } catch (e) {} }
  setInterval(syncTick, 250); ['playing', 'pause', 'seeked'].forEach(ev => au.addEventListener(ev, syncTick));
  M.clipStop = () => { if (M.playing) { if (!UNL[M.playing]) stop(el[M.playing]); say(M.playing + ' stop'); M.playing = null; } M.manual = false; M.voiced = false; bedUpdate(); };
  const mb = document.getElementById('bgmMute');
  const paintMute = () => { if (!mb) return; mb.classList.toggle('muted', !M.bedOn); mb.setAttribute('aria-pressed', String(!M.bedOn));
    mb.setAttribute('aria-label', M.bedOn ? 'Background music: on. Tap to mute.' : 'Background music: muted. Tap to turn on.'); };
  M.setBed = on => { M.bedOn = !!on; localStorage.setItem('aloyBgm', on ? 'on' : 'off'); const c = document.getElementById('bgmOn'); if (c) c.checked = M.bedOn; paintMute(); bedUpdate(); };   // mutes ONLY the bed (NIN, ASPCA, voices, Tweak bites untouched)
  if (mb) { mb.onclick = ev => { ev.stopPropagation(); M.setBed(!M.bedOn); }; paintMute(); }
  /* first tap anywhere: unlock the three elements inside the gesture (iPhone), then the bed can start/stop by itself */
  const real = k => SRC[k].split('/').pop(), ensure = (a, k) => { if (a.src.indexOf(real(k)) < 0) { a.src = SRC[k]; a.load(); } };
  document.addEventListener('pointerdown', () => { if (M.touched) return; M.touched = true;
    [...new Set(Object.values(CLIP))].forEach(k => { const a = el[k]; try {
      // v3.3.7p final3: unlock inside the gesture by playing the element's OWN preloaded track muted - no src swap, so no pending play is ever
      // aborted (the old silent-clip swap threw AbortError: Chromium can't decode the data-URI clip, its play() stays pending, the swap aborts it).
      // When that play settles: pause, rewind, unmute (or, if this clip already started meanwhile, just unmute and let begin() play it from 0).
      ensure(a, k); a.muted = true; const q = a.play();
      UNL[k] = Promise.race([Promise.resolve(q).then(() => 'ok', e => 'no ' + (e && e.name)), new Promise(r => setTimeout(() => r('timeout'), 3000))])
        .then(r => { UNL[k] = null; say('unlock ' + k + ' ' + r);
          if (M.playing !== k) { if (r !== 'timeout' || !a.paused) { try { a.pause(); a.currentTime = 0; } catch (e) {} } }
          a.muted = false; }); } catch (e) { UNL[k] = null; a.muted = false; } });
    bedUpdate(); }, true);
  ['play', 'pause', 'ended'].forEach(ev => au.addEventListener(ev, bedUpdate));
  const chk = document.getElementById('bgmOn'); if (chk) { chk.checked = M.bedOn; chk.onchange = () => M.setBed(chk.checked); }
  return M;
})();

/* ---------- v3.3.8w static web (Drue 111926 10:01 PM CT "Just put it on my website"): typed speech (Go) needs the 18's voice service,
   so on the website it is greyed with a short note and makes no network call. Expressions still preview on her face. ---------- */
if (window.EMOTE_STATIC) {
  const g = $('composePlay'); if (g) { g.classList.add('needs18'); g.setAttribute('aria-disabled', 'true'); g.title = 'Her voice for typed text needs the Alienware 18';
    g.onclick = () => toast('Her voice for typed text needs the Alienware 18. Not on the website version.'); }
  const c = $('callBtn'); if (c) c.dataset.msg = 'Call needs the Alienware 18. Not on the website version.';
}

/* v3.3.8w (Drue 111926 10:22 PM CT, angry scene only): the widest mouth (ah full, teeth) used to flash in for ~35 ms. Give it ONE in-between
   (the approved ah-half of the same mouth set) for WIDE_D on the way up and ONE on the way down. Existing art only; teeth frames hard-cut (no blend). */
const WIDE_D = 0.067;
function egWideSteps() { const M = T.mouth, W = EG.A.mouth.ah.full, H = EG.A.mouth.ah.half, log = [];
  for (let i = 0; i < M.length; i++) { if (M[i].img !== W || (i > 0 && M[i - 1].img === W)) continue;
    const ts = M[i].t; let j = i; while (j + 1 < M.length && M[j + 1].img === W) j++;
    const p = M[i - 1], pp = M[i - 2], floor = pp ? pp.t + 0.02 : -1e9;          // up: the half right before the full lasts WIDE_D
    if (p && p.img === H) p.t = Math.max(floor, Math.min(p.t, ts - WIDE_D));
    else { const t0 = Math.max(p ? p.t + 0.02 : -1e9, ts - WIDE_D); M.splice(i, 0, {t: t0, img: H}); i++; j++; }
    const n = M[j + 1]; if (n) { const te = n.t, nn = M[j + 2];                 // down: the half right after the full lasts WIDE_D
      if (n.img === H) { if (nn && nn.t < te + WIDE_D) {} else if (nn) {} }
      else { M.splice(j + 1, 0, {t: te, img: H}); const after = M[j + 2], lim = M[j + 3] ? M[j + 3].t - 0.02 : te + WIDE_D;
        if (after) after.t = Math.max(after.t, Math.min(te + WIDE_D, lim)); } }
    log.push([+ts.toFixed(3), +(M[i].t - (M[i - 1] ? M[i - 1].t : ts)).toFixed(3)]); }
  P.wideLog = log; return log; }
