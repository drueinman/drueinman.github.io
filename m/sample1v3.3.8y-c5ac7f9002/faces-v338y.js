/* v3.3.8y one page, all functions (Jarvis 112026; Drue 112026 2342 t7380u: "pull up each individual expression and then set up sequences ... all on one app").
   Code only, no new art: every picture shown here is an existing face of the build. The Faces sheet on the main page has
   1) Expressions: every face of the current bot. Tap one: she shows it and HOLDS it (sticky) until another is picked or Release is tapped.
   2) Sequence: the seq/ sequencer rules, unchanged (expression emojis + ⌚ delays, Play/Stop, snap cuts, last face holds until Stop; legend from
      seq/seq-map-v338x.json), plus named saves on this device (localStorage), load / rename / delete, and export / import as JSON text.
   Chappie D2 (112126): this file and its CSS load AFTER the opening (index.html loader), so they no longer delay the first touch -> greeting path.
   seq/ keeps working on its own (seq/seq-v338x.js is untouched). Sequences play on Aloy (the legend is her faces), as on seq/. */
(function () {
  'use strict';
  const DELAY = '⌚', KEY = 'emoteSeqSaved.v1', norm = s => String(s).replace(/\uFE0F/g, '');
  const FX = window.FX = {map: null, by: {}, delay: Math.min(10, Math.max(0.05, +(localStorage.getItem('seqDelay') || 1) || 1)), on: false, run: 0, plan: null, cur: -1, log: [], hold: null, holdLog: []};
  const el = id => document.getElementById(id), esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const nice = f => f.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase());
  /* ---------- sequence text: same rules as seq/seq-v338x.js ---------- */
  function graphemes(text) { try { return [...new Intl.Segmenter(undefined, {granularity: 'grapheme'}).segment(text)].map(s => s.segment); } catch (e) { return Array.from(text); } }
  function tokens(text) { return graphemes(text).map(g => { if (/^\s+$/.test(g)) return null; const n = norm(g);
    if (n === DELAY) return {k: 'wait', g}; const x = FX.by[n]; return x ? {k: 'face', g, x} : {k: 'bad', g}; }).filter(Boolean); }
  function plan(text, D) { const tk = tokens(text), items = []; let lead = 0;
    tk.forEach((t, i) => { t.i = i; if (t.k === 'face') items.push({face: t.x.face, name: t.x.name, steps: 0, tok: i}); else if (t.k === 'wait') { if (items.length) items[items.length - 1].steps++; else lead++; } });
    let at = lead * D; items.forEach(it => { it.t = +at.toFixed(4); it.hold = Math.max(1, it.steps) * D; at += it.hold; });
    return {tk, items, lead: lead * D, D}; }
  FX.plan_ = plan; FX.tokens = tokens;
  function preview() { const box = el('seqPreview'); if (!box || !FX.map) return; const p = plan(el('seqText').value, FX.delay);
    const tip = t => t.k === 'face' ? t.x.name : t.k === 'wait' ? 'delay ' + FX.delay + ' s' : 'not an expression: ignored';
    box.innerHTML = p.tk.map(t => '<span class="' + t.k + '" data-i="' + t.i + '" title="' + esc(tip(t)) + '">' + esc(t.g) + '</span>').join('');
    const bad = p.tk.filter(t => t.k === 'bad').length, total = p.items.length ? p.items[p.items.length - 1].t : 0;
    el('seqNote').textContent = (p.items.length ? p.items.length + ' expressions, last one starts at ' + total.toFixed(2) + ' s and holds. ' : 'Add expression emojis. ') + (bad ? bad + ' unknown character' + (bad > 1 ? 's' : '') + ' (red) will be skipped.' : ''); }
  function insert(txt) { const ta = el('seqText'), a = ta.selectionStart == null ? ta.value.length : ta.selectionStart, b = ta.selectionEnd == null ? a : ta.selectionEnd;
    ta.value = ta.value.slice(0, a) + txt + ta.value.slice(b); const c = a + txt.length; try { ta.setSelectionRange(c, c); } catch (e) {} preview(); }
  function renderLegend() { const L = el('seqLegend'); if (!L || !FX.map) return;
    L.innerHTML = '<button type="button" class="delay" data-ins="' + DELAY + '"><b>' + DELAY + '</b><span>Delay (one step)</span></button>' +
      FX.map.expressions.map(x => '<button type="button" data-ins="' + esc(x.emoji) + '" title="' + esc(x.face) + '"><b>' + esc(x.emoji) + '</b><span>' + esc(x.name) + '</span></button>').join(''); }
  /* ---------- expressions: every face of the current bot, sticky hold ---------- */
  function exprList() {
    if (typeof BOT !== 'undefined' && BOT !== 'aloy') { const set = (typeof BOTFACES !== 'undefined' && BOTFACES[BOT]) || {}, fs = set.faces || {};
      const nm = {}; (FX.map ? FX.map.expressions : []).forEach(x => { nm[x.face] = x; });
      return Object.keys(fs).filter(k => !k.endsWith('-closed')).sort().map(f => ({face: f, name: nm[f] ? nm[f].name : nice(f), emoji: nm[f] ? nm[f].emoji : ''})); }
    const F = (window.EG && EG.A && EG.A.faces) || {}, seen = new Set(), out = [];
    (FX.map ? FX.map.expressions : []).forEach(x => { if (F[x.face] && !seen.has(x.face)) { seen.add(x.face); out.push({face: x.face, name: x.name, emoji: x.emoji}); } });
    ((window.EG && EG.EM && EG.EM.markers) || []).forEach(m => { if (m.face && F[m.face] && !seen.has(m.face)) { seen.add(m.face); out.push({face: m.face, name: m.label || nice(m.face), emoji: (m.emoji || [])[0] || ''}); } });
    return out; }
  FX.exprList = exprList;
  function renderExpr() { const E = el('fxExpr'); if (!E) return; const L = exprList(), h = holding();
    E.innerHTML = L.map(x => '<button type="button" data-face="' + esc(x.face) + '"' + (h && h.face === x.face ? ' class="on"' : '') + ' title="' + esc(x.face) + '"><b>' + esc(x.emoji || '•') + '</b><span>' + esc(x.name) + '</span></button>').join('');
    el('fxExprNote').textContent = L.length + ' expressions for ' + ((el('botName') || {}).textContent || 'this bot') + '. ' + (h ? 'Holding: ' + h.face + '.' : 'Tap one: it shows and holds until you pick another or tap Release.'); }
  function holding() { const h = FX.hold; if (!h) return null;
    if (h.bot !== (typeof BOT !== 'undefined' ? BOT : 'aloy')) return null;
    if (h.bot === 'aloy' ? P.run !== h.run : botExpr !== h.face) return null; return h; }
  FX.holding = holding;
  async function holdFace(face) {
    if (FX.on) { FX.on = false; paintCur(-1); }
    const bot = typeof BOT !== 'undefined' ? BOT : 'aloy';
    if (bot !== 'aloy') { stopAll(); const set = BOTFACES[bot]; if (!set || !set.faces || !set.faces[face]) return;
      botExpr = face; FX.hold = {bot, face, at: Date.now()}; FX.holdLog.push([bot, face]); setPb(false); el('pbLbl').textContent = 'Release'; renderExpr(); return; }
    stopAll(); const run = ++P.run;
    const F = EG.A.faces, co = EG.A.closed_of || {}, names = [F[face], co[F[face]]].filter(Boolean); if (!F[face]) return;
    FX.hold = {bot, face, run, at: Date.now()}; FX.holdLog.push([bot, face]); renderExpr();
    const miss = names.filter(n => !(EG.IM[n] && EG.IM[n].naturalWidth)); if (miss.length) { toast('Loading her face…'); await egNeed(miss, 20000); }
    if (run !== P.run) return;
    egReset(false); P.amb = null; P.mode = 'ambient'; const t0 = performance.now() / 1000; P.clock = () => performance.now() / 1000 - t0; P.playT0 = 0;
    egChain(0, [[F[face], 0, 36000]], face);   // e = 0: hard cut; held (blinks use its own closed twin) until another pick or Release
    setPb(false); el('pbLbl').textContent = 'Release'; }
  /* Chappie D1 (112126): after Release / Stop, Aloy goes back to her random faces exactly as after a demo ends (endToLive -> toShowOff), never twice */
  function resumeLife() { if ((typeof BOT !== 'undefined' && BOT !== 'aloy') || P.amb || P.mode !== 'idle') return; toShowOff(P.clock()); }
  FX.resumeLife = resumeLife;
  function release() { const h = FX.hold; FX.hold = null; if (!h) return;
    if (h.bot !== 'aloy') { const b = (typeof BOTS !== 'undefined' ? BOTS : []).find(x => x.id === h.bot) || {}, set = BOTFACES[h.bot] || {};
      if (botExpr === h.face) botExpr = (set.faces && set.faces[b.default_face] ? b.default_face : null) || set.default || botExpr; setPb(true); }
    else if (P.run === h.run) { stopAll(); egReset(false); setPb(true); resumeLife(); }
    renderExpr(); }
  FX.holdFace = holdFace; FX.release = release;
  /* ---------- sequence playback (as seq/seq-v338x.js) ---------- */
  function openFx() { if (typeof takeOver === 'function') takeOver(); if (typeof openSettings === 'function') openSettings(false);
    el('compose').hidden = true; if (el('m8sheet')) el('m8sheet').hidden = true; el('seqSheet').hidden = false; renderExpr(); preview(); renderSaved(); }
  function closeFx() { const s = el('seqSheet'); if (s.hidden) return Promise.resolve();
    return new Promise(res => { s.classList.add('closing'); const done = () => { s.classList.remove('closing'); s.hidden = true; res(); };
      s.addEventListener('animationend', done, {once: true}); setTimeout(done, 450); }); }
  async function play() { const p = plan(el('seqText').value, FX.delay);
    if (!p.items.length) { toast('Add at least one expression emoji'); return; }
    FX.hold = null; if (typeof BOT !== 'undefined' && BOT !== 'aloy') await selectBot('aloy');
    stopAll(); const run = ++P.run; FX.run = run; FX.on = false;
    const F = EG.A.faces, co = EG.A.closed_of || {}, names = p.items.flatMap(it => [F[it.face], co[F[it.face]]]).filter(Boolean);
    await closeFx();
    const miss = names.filter(n => !(EG.IM[n] && EG.IM[n].naturalWidth)); if (miss.length) { toast('Loading her faces…'); await egNeed(miss, 20000); }
    if (run !== P.run) return;
    egReset(false); P.amb = null; P.mode = 'ambient'; const t0 = performance.now() / 1000; P.clock = () => performance.now() / 1000 - t0; P.playT0 = 0;
    if (p.lead > 0) egChain(0, [[F.amused, 0, p.lead]], 'amused');
    p.items.forEach((it, i) => egChain(it.t, [[F[it.face], 0, i === p.items.length - 1 ? 36000 : it.hold]], it.face));
    FX.plan = p; FX.on = true; FX.cur = -1; FX.log = []; setPb(false); el('pbLbl').textContent = 'Stop'; requestAnimationFrame(tick); }
  function tick() { if (!FX.on) return; if (P.run !== FX.run) { FX.on = false; paintCur(-1); return; }
    const t = P.clock(), it = FX.plan.items; let k = -1; for (let i = 0; i < it.length; i++) if (t >= it[i].t) k = i;
    if (k !== FX.cur) { FX.cur = k; FX.log.push([k, +t.toFixed(3), k >= 0 ? it[k].face : null]); paintCur(k); }
    requestAnimationFrame(tick); }
  function paintCur(k) { const box = el('seqPreview'); if (!box) return; box.querySelectorAll('span.on').forEach(s => s.classList.remove('on'));
    if (k >= 0 && FX.plan) { const s = box.querySelector('span[data-i="' + FX.plan.items[k].tok + '"]'); if (s) s.classList.add('on'); } }
  function stop() { if (!FX.on && P.run !== FX.run) return; FX.on = false; stopAll(); egReset(false); setPb(true); paintCur(-1); resumeLife(); }
  FX.play = play; FX.stop = stop;
  /* ---------- named saves (this device) + export / import ---------- */
  function loadAll() { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a.filter(x => x && typeof x.name === 'string' && typeof x.text === 'string') : []; } catch (e) { return []; } }
  function saveAll(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); return true; } catch (e) { toast('Could not save on this device'); return false; } }
  function renderSaved(sel) { const s = el('fxList'); if (!s) return; const a = loadAll(), cur = sel != null ? sel : s.value;
    s.innerHTML = a.length ? a.map(x => '<option value="' + esc(x.name) + '">' + esc(x.name) + '</option>').join('') : '<option value="">(no saved sequences)</option>';
    if (a.some(x => x.name === cur)) s.value = cur; el('fxSavedNote').textContent = a.length + ' saved on this device.'; }
  const nameIn = () => (el('fxName').value || '').trim().slice(0, 60);
  FX.saved = loadAll;
  FX.save = name => { name = (name || nameIn()).trim(); if (!name) { toast('Type a name first'); return false; }
    const a = loadAll().filter(x => x.name !== name); a.push({name, text: el('seqText').value, delay: FX.delay, saved: new Date().toISOString()});
    if (!saveAll(a)) return false; renderSaved(name); toast('Saved “' + name + '”'); return true; };
  FX.load = name => { name = name || el('fxList').value; const x = loadAll().find(y => y.name === name); if (!x) return false;
    el('seqText').value = x.text; if (x.delay) { FX.delay = Math.min(10, Math.max(0.05, +x.delay || 1)); el('seqDelay').value = FX.delay; localStorage.setItem('seqDelay', String(FX.delay)); }
    el('fxName').value = x.name; preview(); return true; };
  FX.rename = (from, to) => { from = from || el('fxList').value; to = (to || nameIn()).trim(); const a = loadAll(), x = a.find(y => y.name === from);
    if (!x || !to) { toast(x ? 'Type the new name first' : 'Pick a saved sequence'); return false; }
    if (to === from) return true; const b = a.filter(y => y.name !== to); x.name = to; if (!saveAll(b)) return false; renderSaved(to); return true; };
  FX.del = name => { name = name || el('fxList').value; const a = loadAll(); if (!a.some(y => y.name === name)) return false;
    if (!saveAll(a.filter(y => y.name !== name))) return false; renderSaved(); toast('Deleted “' + name + '”'); return true; };
  FX.exportText = () => { const t = JSON.stringify({emoteSequences: 1, sequences: loadAll()}, null, 1); el('fxJson').value = t; try { el('fxJson').select(); } catch (e) {} return t; };
  FX.importText = t => { t = t != null ? t : el('fxJson').value; let j; try { j = JSON.parse(t); } catch (e) { toast('That is not sequence JSON'); return 0; }
    const list = Array.isArray(j) ? j : (j && Array.isArray(j.sequences) ? j.sequences : []), ok = list.filter(x => x && typeof x.name === 'string' && x.name.trim() && typeof x.text === 'string');
    if (!ok.length) { toast('No sequences found in that text'); return 0; }
    const a = loadAll(), names = new Set(ok.map(x => x.name.trim()));
    const b = a.filter(x => !names.has(x.name)).concat(ok.map(x => ({name: x.name.trim().slice(0, 60), text: x.text, delay: +x.delay || 1, saved: x.saved || new Date().toISOString()})));
    if (!saveAll(b)) return 0; renderSaved(); toast('Imported ' + ok.length); return ok.length; };
  /* ---------- wiring ---------- */
  el('playbackBtn').addEventListener('click', e => {   // Playback shows Stop / Release while a sequence or a held face runs: it ends that first
    if (FX.on && P.run === FX.run) { e.stopImmediatePropagation(); e.preventDefault(); stop(); return; }
    if (holding()) { e.stopImmediatePropagation(); e.preventDefault(); release(); } }, true);
  tapHandler(el('seqBtn'), () => { if (el('seqSheet').hidden) openFx(); else closeFx(); });
  ['composeBtn', 'msgBtn', 'settingsBtn'].forEach(id => { const b = el(id); if (b) b.addEventListener('click', () => { if (!el('seqSheet').hidden) el('seqSheet').hidden = true; }); });
  el('seqSheet').querySelector('.sheetX').onclick = () => closeFx();
  el('seqPlay').onclick = () => play(); el('seqStop').onclick = () => stop();
  el('seqText').addEventListener('input', preview);
  const L = el('seqLegend'); L.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });
  L.addEventListener('click', e => { const b = e.target.closest('button[data-ins]'); if (b) insert(b.dataset.ins); });
  el('fxExpr').addEventListener('click', e => { const b = e.target.closest('button[data-face]'); if (b) holdFace(b.dataset.face); });
  el('fxRelease').onclick = () => release();
  el('fxSave').onclick = () => FX.save(); el('fxLoad').onclick = () => FX.load(); el('fxRename').onclick = () => FX.rename(); el('fxDel').onclick = () => FX.del();
  el('fxExport').onclick = () => FX.exportText(); el('fxImport').onclick = () => FX.importText();
  el('fxList').addEventListener('change', () => { if (el('fxList').value) el('fxName').value = el('fxList').value; });
  const d = el('seqDelay'); d.value = FX.delay;
  d.addEventListener('change', () => { const v = Math.min(10, Math.max(0.05, +d.value || 1)); FX.delay = v; d.value = v; localStorage.setItem('seqDelay', String(v)); preview(); });
  setInterval(() => { if (!el('seqSheet').hidden) { const h = holding(), on = el('fxExpr').querySelector('button.on'); if ((h ? h.face : null) !== (on ? on.dataset.face : null) || el('fxExpr').dataset.bot !== String(typeof BOT !== 'undefined' ? BOT : '')) { el('fxExpr').dataset.bot = String(typeof BOT !== 'undefined' ? BOT : ''); renderExpr(); } } }, 700);
  fetch('seq/seq-map-v338x.json', {cache: 'no-cache'}).then(r => r.json()).then(j => { FX.map = j;
    j.expressions.forEach(x => [x.emoji, ...x.aliases].forEach(e => { FX.by[norm(e)] = x; })); renderLegend(); renderExpr(); preview(); }).catch(() => {});
  renderSaved();
  if (window.FX_OPEN) { window.FX_OPEN = 0; openFx(); }   // Faces was tapped before this file loaded (index.html loader, Chappie D2)
})();
