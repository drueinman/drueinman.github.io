/* Aloy emote v3 app wiring (Jarvis 111326). Voice = the bot's server voice (bots/<bot>.json); no phone voice. */
'use strict';
const $ = id => document.getElementById(id);
const au = $('voice'), cv = $('face');
const P = window.P = {mode: 'idle', clock: () => performance.now() / 1000, demo: null, script: null, run: 0, idleNext: 0};
const MSG = window.EMOTE_MSG || null;        // v3.1: set by a texted-link page (make_textlink.py); null in the full app
const BOT = (MSG && MSG.bot) || new URLSearchParams(location.search).get('bot') || 'aloy';
const audioVoice = new AudioCuesVoice(au); let serverVoice = null;
const EMO = {sad: 'blue', 'sad-tears': 'blue', 'phone-down': 'blue', 'guilty-down': 'amber', 'skeptical-up': 'amber', 'thinking-up': 'blue', amused: 'pink', laughing: 'rose', excited: 'rose', proud: 'pink', relieved: 'pink', surprised: 'teal', listening: 'blue', focused: 'blue', thinking: 'blue', determined: 'orange', alert: 'orange', worried: 'amber', apologetic: 'amber', confused: 'amber', skeptical: 'amber', sleepy: 'blue'};
let toastT; function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }
function setCaption(text) { $('caption').innerHTML = text ? text.split(/(\s+)/).map(w => /\S/.test(w) ? '<span>' + w.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])) + '</span>' : w).join('') : ''; }
function showCaptions(caps) { $('caption').innerHTML = caps.map(c => '<span>' + c[2].replace(/[&<>]/g, x => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[x])) + '</span>').join(' '); }
function setPb(replay) { $('pbLbl').textContent = replay ? 'Replay' : 'Playback'; $('pbIcon').setAttribute('d', replay ? 'M5 12a7 7 0 1 0 2.1-5M5 4.5V9h4.5' : 'M8 5.5v13l10.5-6.5z'); }
/* ---------- render loop: always running, so the face stays full color and alive ---------- */
function loop() {
  const t = P.clock(), wall = performance.now() / 1000;
  const inBeat = T.beats.some(b => t >= b.t0 && t < b.t1 && !b.ambient);
  egBlinkTick(wall, !inBeat); lifeTick(wall); EY.on = LIFE.eyes; egEyesTick(wall, !inBeat && !(P.amb && ['phone', 'lookup'].includes(P.amb.cur)), P.mode === 'demo' || P.mode === 'live', LIFE.amt);
  if (P.amb && (P.mode === 'ambient' || P.mode === 'idle')) ambientTick(t, wall); else if (P.mode === 'idle' && wall > P.idleNext) idleLook(t, wall);
  const st = egRender(t, wall); drawFocus(wall);
  const face = st.beat || st.patch || 'amused'; $('statusBar').className = 'emo-' + (EMO[face] || 'pink');
  if (P.mode === 'demo' && P.script) { const sp = [...$('caption').children]; P.script.captions.forEach((c, k) => sp[k] && sp[k].classList.toggle('on', t >= c[0] - 0.1 && t < c[1] + 0.15)); }
  requestAnimationFrame(loop);
}
/* ---------- v3.1.1 Focus switch (Drue 111326 2345): Aloy's cybernetic earpiece. Off = the faces as drawn (normal ear, today's look);
   On = the earpiece overlay drawn on the same canvas after the face, so it shares every transform (drift, breathing). Art + box in focus.json. ---------- */
const FOC = {cfg: null, im: null, on: false, a: 0, last: 0};
function drawFocus(wall) { const c = FOC.cfg; if (!c) return; const dt = Math.min(0.1, FOC.last ? wall - FOC.last : 0); FOC.last = wall;
  FOC.a = Math.max(0, Math.min(1, FOC.a + (FOC.on ? 1 : -1) * dt / (c.fade_s || 0.5)));
  if (FOC.a > 0.001 && FOC.im && FOC.im.naturalWidth) { const [x, y, w, h] = c.box; CX.globalAlpha = FOC.a; CX.drawImage(FOC.im, x, y, w, h); CX.globalAlpha = 1; } }
function setFocus(on, save) { FOC.on = on; if (save) { localStorage.setItem('aloyFocus', on ? 'on' : 'off'); localStorage.setItem('aloyFocusSeen', '1'); $('focusBtn').classList.remove('first'); }
  $('focusBtn').classList.toggle('on', on); $('focusBtn').setAttribute('aria-checked', String(on)); $('focusSet').checked = on; }
async function loadFocus() { try { const c = await fetch('focus.json').then(r => r.json()); const im = new Image(); im.src = c.on; await im.decode().catch(() => {}); FOC.cfg = c; FOC.im = im;
    const v = localStorage.getItem('aloyFocus'); setFocus(v ? v === 'on' : c.default === 'on', false); FOC.a = FOC.on ? 1 : 0;
    if (localStorage.getItem('aloyFocusSeen')) $('focusBtn').classList.remove('first'); } catch (e) { $('focusBtn').hidden = true; } }
$('focusBtn').onclick = () => setFocus(!FOC.on, true);
$('focusSet').onchange = () => setFocus($('focusSet').checked, true);
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
  cv.style.transform = `translate(${dx.toFixed(3)}%, ${dy.toFixed(3)}%) rotate(${rot.toFixed(3)}deg) scale(${(1 + (sy - 1) * 0.3).toFixed(5)}, ${sy.toFixed(5)})`;
  P.lifeState = {dx, dy, rot, sy};
}
function idleLook(t, wall) {                 // micro-expressions: a faint eased look (listening / thinking / relieved), then back
  P.idleNext = wall + 6 + Math.random() * 9; if (!LIFE.micro || LIFE.amt <= 0) return; const p = egPatchAt(t); if (p && p.name) return;
  const r = Math.random(), f = r < 0.5 ? 'listening' : r < 0.8 ? 'thinking' : 'relieved', k = Math.min(0.6, (0.12 + Math.random() * 0.16) * LIFE.amt);
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
  ['amused', 3, 5], ['wistful', 3, 2.5], ['thoughtful', 2.5, 2], ['sad', 2, 1], ['deepsad', 0.8, 0], ['almostlaugh', 1.3, 0],
  ['phone', 2.2, 1.5], ['lookup', 1, 0.8], ['other', 1.6, 0.6], ['extreme', 0.5, 0]];
const OTHER = ['skeptical', 'confused', 'worried', 'apologetic', 'proud', 'determined', 'focused', 'sleepy', 'relieved', 'listening', 'guilty-down', 'skeptical-up'];
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
    case 'wistful': ambPatch(t, pick(['relieved', 'listening', 'thinking']), rnd(0.4, 0.6) * amp, E); break;
    case 'thoughtful': ambPatch(t, 'thinking', rnd(0.6, 0.85) * amp, E); break;
    case 'sad': ambPatch(t, 'sad', rnd(0.4, 0.6) * amp, E); break;
    case 'deepsad': {                                                        // negative goes further: sad -> a real tear (TweakX sad-tears), eased in and out
      const F = EG.A.faces, fr = [F.amused, F['amused-sadtop'], F.sad, F['sad-tears']]; let t0 = t; if (hadPatch) { ambPatch(t, null, 1, 1.2); t0 += 1.3; }
      dur = (t0 - t) + egWalk(t0, fr, rnd(4.5, 7), rnd(4, 7), 'sad') + 0.3; break; }
    case 'phone': ambPatch(t, EG.A.patches['phone-down'] ? 'phone-down' : 'lookdown', lo ? 0.6 : 1, Math.min(E, 2)); break;   // lids and eyes drop to her phone
    case 'lookup': ambPatch(t, Math.random() < 0.7 ? 'thinking-up' : 'skeptical-up', lo ? 0.55 : 0.9, Math.min(E, 2)); H > 5 && (dur = E + 5); break;
    case 'other': ambPatch(t, pick(OTHER), rnd(0.45, 0.75) * amp, E); break;
    case 'almostlaugh': {                                                    // amused -> toward laughing, capped mid-way
      const pr = EG.A.pairs['laughing-to-amused'], cap = Math.random() < 0.25 ? 3 : 4;   // frame 03/04 of 10: never the full laugh
      const fr = [EG.A.faces.amused, ...pr.slice(cap - 1).reverse()]; let t0 = t; if (hadPatch) { ambPatch(t, null, 1, 1.2); t0 += 1.3; }
      dur = (t0 - t) + egWalk(t0, fr, E, Math.min(H, 5), 'laughing') + 0.3; A.cap = cap; break; }
    case 'extreme': {
      const f = pick(['excited', 'surprised', 'alert']); let t0 = t; if (hadPatch) { ambPatch(t, null, 1, 1.2); t0 += 1.3; }
      dur = (t0 - t) + egBeat(t0, f) + 0.5; A.lastExtreme = t; A.extreme = f; break; }
  }
  A.cur = st; A.next = t + dur; A.log.push([+(t - A.t0).toFixed(2), st, +E.toFixed(2), +dur.toFixed(2)]);
}
function playAmbient() { stopAll(); ++P.run; P.mode = 'ambient'; P.clock = () => performance.now() / 1000; egReset(false);
  setCaption('Thinking to herself · no sound'); startAmbient(false); setPb(false); $('pbLbl').textContent = 'Stop'; }
function toNeutral(t) {                      // every demo ends by easing back to neutral, then the low thinking life takes over
  ambPatch(t, null, 1, 1.4); startAmbient(true, t + 1.4 + 2.5); }
/* ---------- driver 1: prerendered demo (AudioCuesVoice) ---------- */
async function pickDemo(id) {
  const d = EG.demos.find(x => x.id === id) || EG.demos[0]; P.demo = d;
  P.script = d.silent ? {id: d.id, silent: true, captions: [[0, 0, 'Thinking to herself · no sound']]} : await fetch('demos/' + d.id + '/script.json').then(r => r.json());
  [...document.querySelectorAll('#demoList .demo')].forEach(b => b.classList.toggle('cur', b.dataset.id === d.id));
  if (P.mode !== 'live') { showCaptions(P.script.captions); setPb(false); }
}
function playDemo() {
  stopAll(); const S = P.script, run = ++P.run; P.mode = 'demo'; P.clock = () => au.currentTime; egReset(false);
  const cues = {mouthCues: S.mouthCues || []};                                 // v3: Eve demos only, lips from Rhubarb JSON
  S.beats.forEach(([t, f]) => egBeat(t, f)); S.cues.forEach(([t, f, k]) => egCue(t, f, k));
  showCaptions(S.captions); setPb(false);
  const p = audioVoice.playTrack(S.audio_src || ('demos/' + S.id + '/voice.mp3'), cues, {mouth: (s, c) => egMouth(s, c), word: () => {}});
  if (p && p.catch) p.catch(e => { if (run === P.run) { P.mode = 'idle'; toast('Tap Playback again to play'); } });
  au.onended = () => { if (run !== P.run) return; endToLive(); setPb(true); };
}
function endToLive() { const t = P.clock(); P.mode = 'idle'; P.clock = () => performance.now() / 1000; const now = P.clock();
  const p = egPatchAt(t); egReset(false); if (p && p.name && p.u > 0.05) ins(T.patch, {t: -1, name: p.name, fade: 0, k: p.k * p.u});
  toNeutral(now); }
/* ---------- driver 2: type-and-play with the bot's server voice (Drue 111326 2148 / 2150) ----------
   Go: start every /speak fetch at once, close the sheet, wait for it to finish closing + ~700 ms, and only talk
   when both the screen is clear and the audio is ready. */
function voiceState(s, cls) { const el = $('voiceState'); el.textContent = s || ''; el.className = cls || ''; el.hidden = !s; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function playTyped(text, opts = {}) {
  stopAll(); const run = ++P.run; P.liveLog = []; const L0 = performance.now() / 1000, lg = (...x) => P.liveLog.push([...x, +(performance.now() / 1000 - L0).toFixed(3)]);
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
  P.mode = 'live'; P.clock = () => performance.now() / 1000; egReset(false);
  setCaption(items.filter(i => i.say).map(i => i.say).join(' ')); lg('talk');
  let wordBase = 0;
  for (let n = 0; n < items.length; n++) { const it = items[n];
    if (run !== P.run) return;
    if (it.beat) { const t = P.clock(); lg('beat', it.beat); const d = egBeat(t, it.beat); await sleep(d * 1000); continue; }
    if (!it.say) { it.cues.forEach(([, f, k]) => egCue(P.clock(), f, k)); continue; }
    const r = ready[n], spans = [...$('caption').children], words = [...it.say.matchAll(/\S+/g)], base = wordBase;
    lg('say', it.say);
    const res = await audioVoice.playPrepared(r, {start: t0 => {
      egMouth(r.mouthCues.map(c => [t0 + c.start, t0 + c.end, toVis(c.value)]), true);
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
function stopAll() { P.run++; P.amb = null; audioVoice.stop(); if ($('statusLine')) $('statusLine').hidden = true; if (P.mode === 'demo') endToLive(); P.mode = 'idle'; P.clock = () => performance.now() / 1000; }
/* ---------- UI ---------- */
function openSettings(on) { $('setupTabs').hidden = !on; $('setup').hidden = !on; $('settingsBtn').classList.toggle('on', on); if (on) $('compose').hidden = true; }
function tab(name) { document.querySelectorAll('.setupTab[data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); ['demos', 'emotes', 'life', 'info'].forEach(n => $('panel-' + n).hidden = n !== name); }
async function boot() {
  await egLoad(); egInit(cv); await loadFocus();
  try { const cfg = await fetch('bots/' + BOT + '.json').then(r => r.json()); serverVoice = new ServerVoice(cfg); P.voiceCfg = cfg; if (!MSG) serverVoice.endpoints();   // a texted link never types, so it never needs the voice host
    $('voiceName').textContent = serverVoice.name; } catch (e) { $('voiceName').textContent = 'none set'; }
  $('demoList').innerHTML = EG.demos.map(d => `<button class="demo" data-id="${d.id}" type="button">${d.title}<small>${d.text.replace(/</g, '&lt;')}</small></button>`).join('');
  $('emoteTable').innerHTML = EG.EM.markers.map(m => `<tr class="${m.kind}"><td>${m.emoji.join(' ')}</td><td>${m.tags.map(t => '[' + t + ']').join(' ')}</td><td class="${m.kind === 'peak' ? 'peak' : ''}">${m.label}</td></tr>`).join('');
  $('palette').innerHTML = EG.EM.markers.map(m => `<button type="button" data-ins="${m.emoji[0]}" class="${m.kind}" title="${m.label} ${m.tags.map(t => '[' + t + ']').join(' ')}"><b>${m.emoji[0]}</b>${m.tags[0]}</button>`).join('');
  renderChart();
  if (MSG) await loadMessage(); else await pickDemo('sample1');
  egReset(false); requestAnimationFrame(loop);
  document.body.dataset.ready = '1';
}
$('playbackBtn').onclick = () => { if (!P.script) return; openSettings(false); $('compose').hidden = true;
  if (P.script.silent) { if (P.mode === 'ambient') { stopAll(); toNeutral(P.clock()); setPb(true); } else playAmbient(); return; } playDemo(); };
$('composeBtn').onclick = () => { openSettings(false); $('compose').hidden = !$('compose').hidden; };
$('composePlay').onclick = () => playTyped($('composeText').value);   // Go
$('composeStop').onclick = () => stopAll();
/* ---------- compose: palette (all expressions), caret-safe insert + face preview, chord chart, autocomplete ---------- */
const ta = $('composeText'); let sel = [ta.value.length, ta.value.length];
const keepSel = () => { if (document.activeElement === ta) sel = [ta.selectionStart, ta.selectionEnd]; };
['select', 'keyup', 'input', 'click', 'touchend'].forEach(ev => ta.addEventListener(ev, keepSel));
document.addEventListener('selectionchange', keepSel);
function insertAtCaret(txt, from) {              // keeps the caret; inside a word the mark goes in tight (chord style)
  const [s0, s1] = from || sel, v = ta.value; ta.value = v.slice(0, s0) + txt + v.slice(s1);
  const p = s0 + txt.length; sel = [p, p]; ta.setSelectionRange(p, p); renderChart(); }
function previewFace(m) {                        // play the picked expression on the face right away
  if (P.mode !== 'idle') return; const t = P.clock(); P.amb = null;
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
// v3 (Drue 111326 2232): the round top-right button opens Compose with the Expressions pull-down open (tap again to close it)
function setPalette(on) { const pl = $('palette'); pl.hidden = !on; $('palBtn').setAttribute('aria-expanded', String(on)); $('palBtn').classList.toggle('open', on); }
function syncPdRound() { const on = !$('compose').hidden && !$('palette').hidden; $('pdRoundBtn').classList.toggle('on', on); $('pdRoundBtn').setAttribute('aria-expanded', String(on)); }
$('pdRoundBtn').onclick = () => { const open = !$('compose').hidden && !$('palette').hidden;
  if (open) { $('compose').hidden = true; } else { openSettings(false); $('compose').hidden = false; setPalette(true);
    requestAnimationFrame(() => $('palBtn').scrollIntoView({ block: 'start', behavior: 'smooth' })); }   // bring the pull-down into view
  syncPdRound(); };
new MutationObserver(syncPdRound).observe($('compose'), { attributes: true, attributeFilter: ['hidden'] });
new MutationObserver(syncPdRound).observe($('palette'), { attributes: true, attributeFilter: ['hidden'] });
$('setupChev').onclick = () => openSettings(false);
document.querySelectorAll('.setupTab[data-tab]').forEach(b => b.onclick = () => tab(b.dataset.tab));
$('demoList').onclick = e => { const b = e.target.closest('.demo'); if (b) { stopAll(); pickDemo(b.dataset.id); } };
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
boot();
