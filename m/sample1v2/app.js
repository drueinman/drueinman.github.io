/* Aloy emote v2 app wiring (Jarvis 111326). */
'use strict';
const $ = id => document.getElementById(id);
const au = $('voice'), cv = $('face');
const P = window.P = {mode: 'idle', clock: () => performance.now() / 1000, demo: null, script: null, run: 0, idleNext: 0};
const webVoice = new WebSpeechVoice(), audioVoice = new AudioCuesVoice(au, null);
const EMO = {amused: 'pink', laughing: 'rose', excited: 'rose', proud: 'pink', relieved: 'pink', surprised: 'teal', listening: 'blue', focused: 'blue', thinking: 'blue', determined: 'orange', alert: 'orange', worried: 'amber', apologetic: 'amber', confused: 'amber', skeptical: 'amber', sleepy: 'blue'};
let toastT; function toast(m) { const t = $('toast'); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => t.hidden = true, 2600); }
function setCaption(text) { $('caption').innerHTML = text ? text.split(/(\s+)/).map(w => /\S/.test(w) ? '<span>' + w.replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])) + '</span>' : w).join('') : ''; }
function showCaptions(caps) { $('caption').innerHTML = caps.map(c => '<span>' + c[2].replace(/[&<>]/g, x => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[x])) + '</span>').join(' '); }
function setPb(replay) { $('pbLbl').textContent = replay ? 'Replay' : 'Playback'; $('pbIcon').setAttribute('d', replay ? 'M5 12a7 7 0 1 0 2.1-5M5 4.5V9h4.5' : 'M8 5.5v13l10.5-6.5z'); }
/* ---------- render loop: always running, so the face stays full color and alive ---------- */
function loop() {
  const t = P.clock(), wall = performance.now() / 1000;
  const inBeat = T.beats.some(b => t >= b.t0 && t < b.t1);
  egBlinkTick(wall, !inBeat); lifeTick(wall);
  if (P.mode === 'idle' && wall > P.idleNext) idleLook(t, wall);
  const st = egRender(t, wall);
  const face = st.beat || st.patch || 'amused'; $('statusBar').className = 'emo-' + (EMO[face] || 'pink');
  if (P.mode === 'demo' && P.script) { const sp = [...$('caption').children]; P.script.captions.forEach((c, k) => sp[k] && sp[k].classList.toggle('on', t >= c[0] - 0.1 && t < c[1] + 0.15)); }
  requestAnimationFrame(loop);
}
/* ---------- idle life (Drue 111326 2112): all subtle, randomized, smoothly eased, never periodic jerks ---------- */
const LIFE = P.life = Object.assign({amt: 1, drift: true, breath: true, micro: true}, JSON.parse(localStorage.getItem('aloyLife') || '{}'));
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
['drift', 'breath', 'micro'].forEach(n => { const el = $('life' + n[0].toUpperCase() + n.slice(1)); el.checked = LIFE[n]; el.onchange = () => { LIFE[n] = el.checked; saveLife(); }; });
$('lifeAmt').oninput = () => { LIFE.amt = $('lifeAmt').value / 100; $('lifeVal').textContent = $('lifeAmt').value + '%'; saveLife(); };
/* ---------- driver 1: prerendered demo (AudioCuesVoice) ---------- */
async function pickDemo(id) {
  const d = EG.demos.find(x => x.id === id) || EG.demos[0]; P.demo = d;
  P.script = await fetch('demos/' + d.id + '/script.json').then(r => r.json());
  [...document.querySelectorAll('#demoList .demo')].forEach(b => b.classList.toggle('cur', b.dataset.id === d.id));
  if (P.mode !== 'live') { showCaptions(P.script.captions); setPb(false); }
}
function playDemo() {
  stopAll(); const S = P.script, run = ++P.run; P.mode = 'demo'; P.clock = () => au.currentTime; egReset(false);
  const ph = S.phonemes.slice(); S.captions.forEach(c => ph.push([c[1], c[1] + 0.06, '.'])); ph.sort((a, b) => a[0] - b[0]);
  const cues = S.mouthCues ? {mouthCues: S.mouthCues} : phonemesToCues(ph);   // Eve demos: Rhubarb JSON; Kokoro demos: timed phonemes
  S.beats.forEach(([t, f]) => egBeat(t, f)); S.cues.forEach(([t, f, k]) => egCue(t, f, k));
  showCaptions(S.captions); setPb(false);
  const p = audioVoice.playTrack('demos/' + S.id + '/voice.mp3', cues, {mouth: (s, c) => egMouth(s, c), word: () => {}});
  if (p && p.catch) p.catch(e => { if (run === P.run) { P.mode = 'idle'; toast('Tap Playback again to play'); } });
  au.onended = () => { if (run !== P.run) return; endToLive(); setPb(true); };
}
function endToLive() { const t = P.clock(); P.mode = 'idle'; P.clock = () => performance.now() / 1000;
  const p = egPatchAt(t); egReset(false); if (p && p.name && p.u > 0.5) ins(T.patch, {t: -1, name: p.name, fade: 0, k: p.k}); }
/* ---------- driver 2: type-and-play (WebSpeechVoice, or a server voice later) ---------- */
async function playTyped(text) {
  stopAll(); const run = ++P.run, V = webVoice; P.mode = 'live'; P.clock = () => V.clock(); egReset(false);
  if (!V.ok) { toast('This browser has no built-in speech voice'); P.mode = 'idle'; return; }
  V.unlock();                                   // iPhone: speech must start from the tap
  const items = egParse(text); P.lastItems = items; P.liveLog = [];
  setCaption(items.filter(i => i.say).map(i => i.say).join(' '));
  let wordBase = 0;
  for (const it of items) {
    if (run !== P.run) return;
    if (it.beat) { const t = V.clock(); P.liveLog.push(['beat', it.beat, +t.toFixed(3)]); const d = egBeat(t, it.beat); await new Promise(r => setTimeout(r, d * 1000)); continue; }
    if (!it.say) { it.cues.forEach(([, f, k]) => egCue(V.clock(), f, k)); continue; }
    const pend = it.cues.slice(), spans = [...$('caption').children], nW = it.say.split(/\s+/).length, base = wordBase;
    P.liveLog.push(['say', it.say, +V.clock().toFixed(3)]);
    const r = await V.speak(it.say, {
      mouth: (segs, close) => egMouth(segs, close),
      word: (ci, t, d, len) => { while (pend.length && pend[0][0] < ci + (len || 1)) {          // chord-chart timing: interpolate inside the word
          const [pos, f, k] = pend.shift(), tc = t + (pos > ci && len ? d * (pos - ci) / len : 0) - 0.04; egCue(tc, f, k); P.liveLog.push(['cue', f, +tc.toFixed(3), pos, ci, len]); }
        const wi = it.say.slice(0, ci).split(/\s+/).filter(Boolean).length; const sp = spans[base + wi];
        setTimeout(() => { spans.forEach(s => s.classList.remove('on')); if (sp) sp.classList.add('on'); }, Math.max(0, (t - V.clock()) * 1000)); }
    });
    pend.forEach(([, f, k]) => egCue(V.clock(), f, k)); wordBase += nW;
    P.liveLog.push(['end', r && r.timing, +V.clock().toFixed(3)]);
    await new Promise(r => setTimeout(r, 150));
  }
  if (run === P.run) { P.mode = 'idle'; [...$('caption').children].forEach(s => s.classList.remove('on')); }
}
function stopAll() { P.run++; webVoice.stop(); audioVoice.stop(); if (P.mode === 'demo') endToLive(); P.mode = 'idle'; P.clock = () => performance.now() / 1000; }
/* ---------- UI ---------- */
function openSettings(on) { $('setupTabs').hidden = !on; $('setup').hidden = !on; $('settingsBtn').classList.toggle('on', on); if (on) $('compose').hidden = true; }
function tab(name) { document.querySelectorAll('.setupTab').forEach(b => b.classList.toggle('on', b.dataset.tab === name)); ['demos', 'emotes', 'life', 'info'].forEach(n => $('panel-' + n).hidden = n !== name); }
async function boot() {
  await egLoad(); egInit(cv);
  $('demoList').innerHTML = EG.demos.map(d => `<button class="demo" data-id="${d.id}" type="button">${d.title}<small>${d.text.replace(/</g, '&lt;')}</small></button>`).join('');
  $('emoteTable').innerHTML = EG.EM.markers.map(m => `<tr class="${m.kind}"><td>${m.emoji.join(' ')}</td><td>${m.tags.map(t => '[' + t + ']').join(' ')}</td><td class="${m.kind === 'peak' ? 'peak' : ''}">${m.label}</td></tr>`).join('');
  $('palette').innerHTML = EG.EM.markers.map(m => `<button type="button" data-ins="${m.emoji[0]}" class="${m.kind}" title="${m.label} ${m.tags.map(t => '[' + t + ']').join(' ')}"><b>${m.emoji[0]}</b>${m.tags[0]}</button>`).join('');
  renderChart();
  await pickDemo('sample1-eve'); egReset(false); requestAnimationFrame(loop);
  document.body.dataset.ready = '1';
}
$('playbackBtn').onclick = () => { if (!P.script) return; openSettings(false); $('compose').hidden = true; playDemo(); };
$('composeBtn').onclick = () => { openSettings(false); $('compose').hidden = !$('compose').hidden; };
$('composePlay').onclick = () => playTyped($('composeText').value);
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
  if (P.mode !== 'idle') return; const t = P.clock();
  if (m.kind === 'peak') { if (!T.beats.some(b => t < b.t1)) egBeat(t, m.face); }
  else { const p = egPatchAt(t), back = p && p.name; egCue(t, m.face, m.kind); if (m.kind !== 'smile') ins(T.patch, {t: t + 2.2, name: back || null, fade: EG.EM.talk_fade, k: 1}); }
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
tapHandler($('palBtn'), () => { const pl = $('palette'); pl.hidden = !pl.hidden; $('palBtn').setAttribute('aria-expanded', String(!pl.hidden)); });
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
document.querySelectorAll('.sheetX').forEach(b => b.onclick = () => $(b.dataset.close).hidden = true);
$('settingsBtn').onclick = () => openSettings($('setup').hidden);
$('setupChev').onclick = () => openSettings(false);
document.querySelectorAll('.setupTab').forEach(b => b.onclick = () => tab(b.dataset.tab));
$('demoList').onclick = e => { const b = e.target.closest('.demo'); if (b) { stopAll(); pickDemo(b.dataset.id); } };
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
