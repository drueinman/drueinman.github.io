/* v3.3.8s expression sequencer (Jarvis 111926; Drue 10:51 PM CT): type or tap expression emojis and ⌚ delays, press Play, and the face
   SNAPS (hard cut, no fades) from one expression to the next. One ⌚ = the minimum delay (default 1.0 s per Drue 10:54 PM CT, set in the sheet, remembered on
   this device); several ⌚ stack; an expression with no ⌚ after it holds one step; the last one holds until Stop. No words, no voice. */
(function () {
  'use strict';
  const HERE = document.currentScript.src.replace(/[^/]*$/, '');
  const DELAY = '⌚', norm = s => String(s).replace(/\uFE0F/g, '');
  const SQ = window.SQ = {map: null, by: {}, delay: Math.min(10, Math.max(0.05, +(localStorage.getItem('seqDelay') || 1) || 1)), on: false, run: 0, plan: null, cur: -1, log: []};
  const el = id => document.getElementById(id);
  function graphemes(text) {
    try { return [...new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(text)].map(s => s.segment); } catch (e) { return Array.from(text); } }
  function tokens(text) {
    return graphemes(text).map(g => { if (/^\s+$/.test(g)) return null; const n = norm(g);
      if (n === DELAY) return {k: 'wait', g}; const x = SQ.by[n]; return x ? {k: 'face', g, x} : {k: 'bad', g}; }).filter(Boolean); }
  function plan(text, D) {
    const tk = tokens(text), items = []; let lead = 0;
    tk.forEach((t, i) => { t.i = i; if (t.k === 'face') items.push({face: t.x.face, name: t.x.name, steps: 0, tok: i});
      else if (t.k === 'wait') { if (items.length) items[items.length - 1].steps++; else lead++; } });
    let at = lead * D; items.forEach(it => { it.t = +at.toFixed(4); it.hold = Math.max(1, it.steps) * D; at += it.hold; });
    return {tk, items, lead: lead * D, D}; }
  SQ.plan_ = plan;
  function preview() {
    const box = el('seqPreview'); if (!box || !SQ.map) return; const p = plan(el('seqText').value, SQ.delay); SQ.preview = p;
    const tip = t => t.k === 'face' ? t.x.name : t.k === 'wait' ? 'delay ' + SQ.delay + ' s' : 'not an expression: ignored';
    box.innerHTML = p.tk.map(t => '<span class="' + t.k + '" data-i="' + t.i + '" title="' + tip(t) + '">' + t.g + '</span>').join('');
    const bad = p.tk.filter(t => t.k === 'bad').length, total = p.items.length ? (p.items[p.items.length - 1].t) : 0;
    el('seqNote').textContent = (p.items.length ? p.items.length + ' expressions, last one starts at ' + total.toFixed(2) + ' s and holds. ' : 'Add expression emojis. ') +
      (bad ? bad + ' unknown character' + (bad > 1 ? 's' : '') + ' (red) will be skipped.' : ''); }
  function insert(txt) {
    const ta = el('seqText'), a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, b = ta.selectionEnd == null ? a : ta.selectionEnd;
    ta.value = ta.value.slice(0, a) + txt + ta.value.slice(b); const c = a + txt.length; try { ta.setSelectionRange(c, c); } catch (e) {} preview(); }
  function renderLegend() {
    const L = el('seqLegend'); if (!L || !SQ.map) return;
    L.innerHTML = '<button type="button" class="delay" data-ins="' + DELAY + '"><b>' + DELAY + '</b><span>Delay (one step)</span></button>' +
      SQ.map.expressions.map(x => '<button type="button" data-ins="' + x.emoji + '" title="' + x.face + (x.aliases.length ? ' · also ' + x.aliases.join(' ') : '') + '"><b>' + x.emoji + '</b><span>' + x.name + '</span></button>').join('');
    L.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });   // keep the caret in the box
    L.addEventListener('click', e => { const b = e.target.closest('button[data-ins]'); if (b) insert(b.dataset.ins); }); }
  function openSeq() { if (typeof takeOver === 'function') takeOver(); if (typeof openSettings === 'function') openSettings(false);
    el('compose').hidden = true; if (el('m8sheet')) el('m8sheet').hidden = true; el('seqSheet').hidden = false; preview(); }
  function closeSeq() { const s = el('seqSheet'); if (s.hidden) return Promise.resolve();
    return new Promise(res => { s.classList.add('closing'); const done = () => { s.classList.remove('closing'); s.hidden = true; res(); };
      s.addEventListener('animationend', done, {once: true}); setTimeout(done, 450); }); }
  async function play() {
    const p = plan(el('seqText').value, SQ.delay);
    if (!p.items.length) { toast('Add at least one expression emoji'); return; }
    if (typeof BOT !== 'undefined' && BOT !== 'aloy') await selectBot('aloy');
    stopAll(); const run = ++P.run; SQ.run = run; SQ.on = false;
    const F = EG.A.faces, co = EG.A.closed_of || {}, names = p.items.flatMap(it => [F[it.face], co[F[it.face]]]).filter(Boolean);
    await closeSeq();
    const miss = names.filter(n => !(EG.IM[n] && EG.IM[n].naturalWidth));
    if (miss.length) { toast('Loading her faces…'); await egNeed(miss, 20000); }
    if (run !== P.run) return;
    egReset(false); P.amb = null; P.mode = 'ambient'; const t0 = performance.now() / 1000; P.clock = () => performance.now() / 1000 - t0; P.playT0 = 0;
    if (p.lead > 0) egChain(0, [[F.amused, 0, p.lead]], 'amused');
    p.items.forEach((it, i) => egChain(it.t, [[F[it.face], 0, i === p.items.length - 1 ? 36000 : it.hold]], it.face));   // e = 0: hard cut, no blend
    SQ.plan = p; SQ.on = true; SQ.cur = -1; SQ.log = []; setPb(false); el('pbLbl').textContent = 'Stop';
    requestAnimationFrame(tick); }
  function tick() {
    if (!SQ.on) return; if (P.run !== SQ.run) { SQ.on = false; paintCur(-1); return; }
    const t = P.clock(), it = SQ.plan.items; let k = -1; for (let i = 0; i < it.length; i++) if (t >= it[i].t) k = i;
    if (k !== SQ.cur) { SQ.cur = k; SQ.log.push([k, +t.toFixed(3), k >= 0 ? it[k].face : null]); paintCur(k); }
    requestAnimationFrame(tick); }
  function paintCur(k) { const box = el('seqPreview'); if (!box) return; box.querySelectorAll('span.on').forEach(s => s.classList.remove('on'));
    if (k >= 0 && SQ.plan) { const s = box.querySelector('span[data-i="' + SQ.plan.items[k].tok + '"]'); if (s) s.classList.add('on'); } }
  function stop() { if (!SQ.on && P.run !== SQ.run) return; SQ.on = false; stopAll(); egReset(false); setPb(true); paintCur(-1); }
  SQ.play = play; SQ.stop = stop; SQ.tokens = tokens;
  // Playback (shows Stop while a sequence runs) stops the sequence first
  el('playbackBtn').addEventListener('click', e => { if (SQ.on && P.run === SQ.run) { e.stopImmediatePropagation(); e.preventDefault(); stop(); } }, true);
  tapHandler(el('seqBtn'), () => { if (el('seqSheet').hidden) openSeq(); else closeSeq(); });
  el('seqSheet').querySelector('.sheetX').onclick = () => closeSeq();
  el('seqPlay').onclick = () => play(); el('seqStop').onclick = () => stop();
  el('seqText').addEventListener('input', preview);
  const d = el('seqDelay'); d.value = SQ.delay;
  d.addEventListener('change', () => { const v = Math.min(10, Math.max(0.05, +d.value || 1)); SQ.delay = v; d.value = v; localStorage.setItem('seqDelay', String(v)); preview(); });
  fetch(HERE + 'seq-map-v338s.json', {cache: 'no-cache'}).then(r => r.json()).then(j => { SQ.map = j;
    j.expressions.forEach(x => [x.emoji, ...x.aliases].forEach(e => { SQ.by[norm(e)] = x; })); renderLegend(); preview(); }).catch(() => {});
})();
