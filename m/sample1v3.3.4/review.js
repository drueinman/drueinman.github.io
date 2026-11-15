/* v3.2.8 review timeline (same pin store as v3.2.7) + numbered pins (Jarvis 111426). YouTube-style scrub bar on spoken
   and silent demos and the rapid-cycle screen. Mark and Heart drop pins; each pin keeps a
   permanent number per demo/screen. Pins live in localStorage and can be exported. */
'use strict';
const BUILD_VER = 'v3.3';
const PIN_KEY = 'aloyPins.v33';
const PIN_MARK_KEY_LEGACY = 'aloyMarks';

function pinEsc(s) { return String(s == null ? '' : s).replace(/[&<>]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c])); }
function pinFmt(sec) {
  sec = Math.max(0, +sec || 0);
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return m + ':' + s.toFixed(1).padStart(4, '0');
}
function pinScope() {
  if (P.demo && P.demo.id) return 'demo:' + P.demo.id;
  if (P.script && P.script.id) return 'demo:' + P.script.id;
  if (P.script && P.script.kind) return 'screen:' + (P.script.kind) + ':' + (P.script.title || P.script.kind);
  return 'screen:idle';
}
function pinDemoTitle() {
  if (P.demo && P.demo.title) return P.demo.title;
  if (P.script && P.script.title) return P.script.title;
  if (P.script && P.script.kind === 'cycle') return 'Rapid Cycle';
  return markDemoName();
}
function pinStore() {
  try { const o = JSON.parse(localStorage.getItem(PIN_KEY) || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; }
  catch (e) { return {}; }
}
function pinSaveStore(st) { try { localStorage.setItem(PIN_KEY, JSON.stringify(st)); } catch (e) {} }
function pinBucket(scope) {
  const st = pinStore();
  if (!st[scope]) st[scope] = {next: 1, pins: []};
  if (!Array.isArray(st[scope].pins)) st[scope].pins = [];
  if (!(st[scope].next >= 1)) {
    const maxN = st[scope].pins.reduce((m, p) => Math.max(m, +p.n || 0), 0);
    st[scope].next = maxN + 1;
  }
  return st;
}
function pinList(scope) {
  const st = pinBucket(scope || pinScope());
  return (st[scope || pinScope()].pins || []).slice().sort((a, b) => a.t - b.t || a.n - b.n);
}
function pinAll() {
  const st = pinStore(), out = [];
  Object.keys(st).forEach(scope => (st[scope].pins || []).forEach(p => out.push(Object.assign({scope}, p))));
  out.sort((a, b) => (a.ts || 0) - (b.ts || 0) || a.n - b.n);
  return out;
}
/* v3.2.9: each build has its own key and starts empty. Older aloyPins.* keys are read-only, never merged. */
function pinKeyLabel(key) {
  const m = String(key || '').match(/^aloyPins\.(v\d+)$/);
  if (!m) return key;
  const tag = m[1];
  if (/^v\d+\.\d+/.test(tag)) return tag;
  const n = tag.match(/^v32(\d)$/);
  if (n) return 'v3.2.' + n[1];
  return tag;
}
function pinOlderKeys() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf('aloyPins.') === 0 && k !== PIN_KEY) out.push(k);
    }
  } catch (e) {}
  out.sort();
  return out;
}
function pinReadStore(key) {
  try { const o = JSON.parse(localStorage.getItem(key) || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; }
  catch (e) { return {}; }
}
function pinListFromStore(st) {
  const out = [];
  Object.keys(st || {}).forEach(scope => (st[scope].pins || []).forEach(p => out.push(Object.assign({scope}, p))));
  out.sort((a, b) => a.n - b.n || a.t - b.t);
  return out;
}
function pinExportTextFromStore(st, verLabel) {
  const lines = ['Aloy Emote ' + (verLabel || BUILD_VER)];
  const groups = {};
  pinListFromStore(st).forEach(p => { (groups[p.scope] = groups[p.scope] || []).push(p); });
  Object.keys(groups).forEach(sc => {
    const title = (groups[sc][0] && groups[sc][0].demo) || sc;
    lines.push('', 'Demo: ' + title);
    groups[sc].sort((a, b) => a.n - b.n).forEach(p => lines.push(pinLine(p)));
  });
  return lines.join('\n');
}
async function exportOlderPins(key) {
  const st = pinReadStore(key), ver = pinKeyLabel(key);
  const text = pinExportTextFromStore(st, ver);
  const fileName = 'aloy-emote-' + ver + '-pins.txt';
  const done = () => toast(text.includes('#') ? ('Exported ' + ver + ' pins') : ('No pins in ' + ver));
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  else fallbackCopy(text, done);
  try {
    const blob = new Blob([text], {type: 'text/plain'});
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName;
    a.style.display = 'none'; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
  } catch (e) {}
  return text;
}
function renderOlderPins() {
  const box = $('olderPins'); if (!box) return;
  const keys = pinOlderKeys();
  if (!keys.length) { box.hidden = true; box.innerHTML = ''; return; }
  box.hidden = false;
  box.innerHTML = '<h3 class="marksHead">Older versions</h3><p class="hint">Pins from earlier builds. View only; they are not shown on the timeline. Export uses the same text as current pins.</p>' +
    keys.map(k => {
      const st = pinReadStore(k), pins = pinListFromStore(st), ver = pinKeyLabel(k);
      const open = P.review && P.review.olderView === k;
      const head = '<div class="olderPinSet" data-key="' + pinEsc(k) + '"><div class="olderPinHead"><b>' + pinEsc(ver) + '</b><span class="hint"> ' + pins.length + ' pin' + (pins.length === 1 ? '' : 's') + '</span>' +
        '<button type="button" class="btn stadium olderView" data-key="' + pinEsc(k) + '"><span>' + (open ? 'Hide' : 'View') + '</span></button>' +
        '<button type="button" class="btn stadium olderExport" data-key="' + pinEsc(k) + '"><span>Export</span></button></div>';
      const list = open ? ('<ul class="olderPinList">' + (pins.length ? pins.map(p => '<li>' + pinEsc(pinLine(p) + '  ' + (p.demo || '') + (p.bot ? '  ' + p.bot : '')) + '</li>').join('') : '<li class="hint">No pins.</li>') + '</ul>') : '';
      return head + list + '</div>';
    }).join('');
}

function reviewDuration() {
  if (window.MC && MC.on && MC.dur) return MC.dur;
  if (P.script && !P.script.silent && au && isFinite(au.duration) && au.duration > 0) return au.duration;
  if (P.script && P.script.duration) return +P.script.duration;
  return 0;
}
function reviewTime() {
  if (P.mode === 'demo') return Math.max(0, au.currentTime || 0);
  if (window.MC && MC.on) return Math.max(0, mediaNow());
  return Math.max(0, markTimeSec());
}
function reviewHasBar() {
  const S = P.script;
  if (!S) return false;
  if (window.PAD && PAD.on) return false;
  if (S.silent && S.kind) return true;
  if (!S.silent) return true;
  return false;
}

function reviewSeek(t) {
  const dur = reviewDuration();
  if (!(dur > 0)) return;
  t = Math.max(0, Math.min(dur, +t || 0));
  if (typeof mediaSeek === 'function') mediaSeek(t);
  else if (P.mode === 'demo' && au) { try { au.currentTime = t; } catch (e) {} }
  reviewTick();
  P.review = P.review || {}; P.review.t = t; P.review.dur = dur;
}

function pinExportText(scope, all) {
  const lines = ['Aloy Emote ' + BUILD_VER];
  if (all) {
    const groups = {};
    pinAll().forEach(p => { (groups[p.scope] = groups[p.scope] || []).push(p); });
    Object.keys(groups).forEach(sc => {
      const title = (groups[sc][0] && groups[sc][0].demo) || sc;
      lines.push('', 'Demo: ' + title);
      groups[sc].sort((a, b) => a.n - b.n).forEach(p => lines.push(pinLine(p)));
    });
  } else {
    const sc = scope || pinScope();
    lines.push('Demo: ' + pinDemoTitle());
    pinList(sc).slice().sort((a, b) => a.n - b.n).forEach(p => lines.push(pinLine(p)));
  }
  return lines.join('\n');
}
function pinLine(p) {
  const note = (p.note || '').trim();
  return '#' + p.n + ' ' + (p.type || 'mark') + ' ' + pinFmt(p.t) + (note ? ' ' + note : '');
}

function renderPinList() {
  const ul = $('marksList'), empty = $('marksEmpty');
  if (!ul) return;
  const all = pinAll();
  ul.innerHTML = all.map(p => '<li data-n="' + p.n + '" data-scope="' + pinEsc(p.scope) + '">' + pinEsc(pinLine(p) + '  ' + (p.demo || '') + (p.bot ? '  ' + p.bot : '')) + '</li>').join('');
  if (empty) empty.hidden = all.length > 0;
  renderOlderPins();
}

function renderPins() {
  const box = $('reviewPins'); if (!box) return;
  const dur = reviewDuration() || 1;
  const pins = reviewHasBar() ? pinList() : [];
  box.innerHTML = pins.map(p => {
    const left = Math.max(0, Math.min(100, (p.t / dur) * 100));
    const cls = 'revPin' + (p.type === 'heart' ? ' heart' : ' mark') + (P.review && P.review.edit === p.n ? ' on' : '');
    const label = p.type === 'heart' ? '♥' + p.n : String(p.n);
    return '<button type="button" class="' + cls + '" data-n="' + p.n + '" style="left:' + left + '%" aria-label="Pin #' + p.n + ' ' + (p.type || 'mark') + ' at ' + pinFmt(p.t) + '"><span class="revPinNum">' + pinEsc(label) + '</span></button>';
  }).join('');
  renderPinList();
}

function reviewTick() {
  const bar = $('reviewBar'), dock = $('reviewDock');
  const show = reviewHasBar();
  if (dock) dock.classList.toggle('off', !show);
  if (bar) bar.hidden = false;                    // v3.3: the emotion color bar always shows; the seek bar and pins are gone (Drue 8:46/8:56 PM CT)
  const sc = $('sceneCount');
  if (!show) { if (sc) sc.textContent = ''; if ($('pinEditor')) $('pinEditor').hidden = true; return; }
  const dur = reviewDuration(), t = reviewTime();
  const u = dur > 0 ? Math.max(0, Math.min(1, t / dur)) : 0;
  if (sc) sc.textContent = String(Math.round(u * 100));   // v3.3: 0-100 scene counter laid on the emotion bar
  const fill = $('reviewFill'), head = $('reviewPlayhead'), now = $('reviewNow'), dn = $('reviewDur');
  if (fill) fill.style.width = (u * 100).toFixed(3) + '%';
  if (head) head.style.left = (u * 100).toFixed(3) + '%';
  if (now) now.textContent = pinFmt(t);
  if (dn) dn.textContent = pinFmt(dur);
  P.review = Object.assign(P.review || {}, {t, dur, u, scope: pinScope()});
  const track = $('reviewTrack');
  if (track) {
    track.setAttribute('aria-valuemin', '0');
    track.setAttribute('aria-valuemax', String(dur.toFixed(1)));
    track.setAttribute('aria-valuenow', String(t.toFixed(1)));
  }
}

function dropPin(type) {
  const t = reviewTime();
  const scope = pinScope();
  const st = pinBucket(scope);
  const b = st[scope];
  const rec = {
    n: b.next++,
    type: type === 'heart' ? 'heart' : 'mark',
    t: +t.toFixed(3),
    note: '',
    ts: Date.now(),
    demo: pinDemoTitle(),
    bot: markBotName(),
    mode: P.mode,
    at: pinFmt(t)
  };
  b.pins.push(rec);
  pinSaveStore(st);
  renderPins();
  const btn = $(type === 'heart' ? 'heartBtn' : 'markBtn');
  if (btn) { btn.classList.add('flash'); setTimeout(() => btn.classList.remove('flash'), 280); }
  toast('#' + rec.n + ' ' + rec.type + ' ' + rec.at, {undo: () => deletePin(scope, rec.n), hold: 3200});
  return rec;
}

function deletePin(scope, n) {
  const st = pinBucket(scope);
  const b = st[scope];
  const before = b.pins.length;
  b.pins = b.pins.filter(p => p.n !== n);
  // never renumber: next stays as-is
  if (b.pins.length !== before) pinSaveStore(st);
  if (P.review && P.review.edit === n && P.review.editScope === scope) closePinEditor();
  renderPins();
  return before !== b.pins.length;
}

function editPinNote(scope, n, note) {
  const st = pinBucket(scope);
  const p = st[scope].pins.find(x => x.n === n);
  if (!p) return false;
  p.note = String(note || '');
  pinSaveStore(st);
  renderPins();
  return true;
}

function openPinEditor(n) {
  const scope = pinScope();
  const p = pinList(scope).find(x => x.n === n) || pinStore()[scope] && pinStore()[scope].pins.find(x => x.n === n);
  const ed = $('pinEditor'); if (!ed || !p) return;
  P.review = Object.assign(P.review || {}, {edit: n, editScope: scope});
  $('pinEdTitle').textContent = '#' + p.n + ' ' + (p.type || 'mark') + ' · ' + pinFmt(p.t);
  $('pinEdNote').value = p.note || '';
  ed.hidden = false;
  renderPins();
  setTimeout(() => { try { $('pinEdNote').focus(); } catch (e) {} }, 50);
}
function closePinEditor() {
  const ed = $('pinEditor'); if (ed) ed.hidden = true;
  if (P.review) { P.review.edit = null; P.review.editScope = null; }
  renderPins();
}
function savePinEditor() {
  if (!P.review || P.review.edit == null) return;
  editPinNote(P.review.editScope || pinScope(), P.review.edit, $('pinEdNote').value);
  closePinEditor();
  toast('Pin #' + (P.review && P.review._saved || '') + ' saved');
}

async function exportPins() {
  const text = pinExportText(pinScope(), false);
  if ($('pinsExport')) $('pinsExport').dataset.copied = text;
  if ($('marksCopy')) $('marksCopy').dataset.copied = text;
  const name = (pinDemoTitle() || 'pins').replace(/[^\w.-]+/g, '-').slice(0, 40);
  const fileName = 'aloy-emote-' + BUILD_VER + '-' + name + '-pins.txt';
  let shared = false;
  if (navigator.share) {
    try { await navigator.share({title: 'Aloy Emote pins', text: text}); shared = true; } catch (e) { if (e && e.name === 'AbortError') return; }
  }
  if (!shared) {
    const done = () => toast(text.trim() ? 'Pins copied' : 'No pins yet');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
    try {
      const blob = new Blob([text], {type: 'text/plain'});
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName;
      a.style.display = 'none'; document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800);
    } catch (e) {}
  }
  return text;
}

function reviewOnScrub(ev, start) {
  const track = $('reviewTrack'); if (!track || !reviewHasBar()) return;
  const go = ev => {
    const r = track.getBoundingClientRect();
    const x = (ev.touches && ev.touches[0] ? ev.touches[0].clientX : ev.clientX);
    const u = Math.max(0, Math.min(1, (x - r.left) / Math.max(1, r.width)));
    reviewSeek(u * reviewDuration());
  };
  ev.preventDefault();
  go(ev);
  const move = e => { e.preventDefault(); go(e); };
  const up = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', up);
    window.removeEventListener('touchmove', move);
    window.removeEventListener('touchend', up);
    P.review && (P.review.scrubbing = false);
  };
  P.review = Object.assign(P.review || {}, {scrubbing: true});
  window.addEventListener('pointermove', move, {passive: false});
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', up);
  window.addEventListener('touchmove', move, {passive: false});
  window.addEventListener('touchend', up);
}

function initReview() {
  P.review = {t: 0, dur: 0};
  if ($('markBtn')) $('markBtn').onclick = e => { e.stopPropagation(); dropPin('mark'); };
  if ($('heartBtn')) $('heartBtn').onclick = e => { e.stopPropagation(); dropPin('heart'); };
  if ($('pinsExport')) $('pinsExport').onclick = e => { e.stopPropagation(); exportPins(); };
  if ($('marksCopy')) $('marksCopy').onclick = () => {
    const text = pinExportText(null, true);
    $('marksCopy').dataset.copied = text;
    const done = () => toast(text.trim() && text.includes('#') ? 'Pins copied' : 'No pins yet');
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
    else fallbackCopy(text, done);
  };
  if ($('marksClear')) $('marksClear').onclick = () => {
    pinSaveStore({}); renderPins(); toast('Pins cleared');
  };
  const older = $('olderPins');
  if (older) older.addEventListener('click', ev => {
    const exp = ev.target.closest && ev.target.closest('.olderExport');
    const view = ev.target.closest && ev.target.closest('.olderView');
    if (exp) { ev.preventDefault(); exportOlderPins(exp.dataset.key); }
    if (view) {
      ev.preventDefault();
      P.review = P.review || {};
      P.review.olderView = P.review.olderView === view.dataset.key ? null : view.dataset.key;
      renderOlderPins();
    }
  });
  const track = $('reviewTrack');
  if (track) {
    track.addEventListener('pointerdown', e => {
      if (e.target && e.target.closest && e.target.closest('.revPin')) return;
      reviewOnScrub(e, true);
    });
    track.addEventListener('keydown', e => {
      const d = reviewDuration(), step = e.shiftKey ? 2 : 0.5;
      if (e.key === 'ArrowRight' || e.key === 'Right') { e.preventDefault(); reviewSeek(reviewTime() + step); }
      if (e.key === 'ArrowLeft' || e.key === 'Left') { e.preventDefault(); reviewSeek(reviewTime() - step); }
      if (e.key === 'Home') { e.preventDefault(); reviewSeek(0); }
      if (e.key === 'End') { e.preventDefault(); reviewSeek(d); }
    });
  }
  if ($('reviewPins')) $('reviewPins').addEventListener('click', e => {
    const b = e.target.closest('.revPin'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    openPinEditor(+b.dataset.n);
  });
  if ($('pinEdSave')) $('pinEdSave').onclick = () => {
    const n = P.review && P.review.edit; savePinEditor(); if (n) toast('Pin #' + n + ' saved');
  };
  if ($('pinEdDelete')) $('pinEdDelete').onclick = () => {
    const n = P.review && P.review.edit, sc = P.review && P.review.editScope || pinScope();
    closePinEditor(); if (n != null) { deletePin(sc, n); toast('Pin #' + n + ' deleted'); }
  };
  if ($('pinEdClose')) $('pinEdClose').onclick = () => closePinEditor();
  renderPins();
  reviewTick();
}

/* Keep the old stampMark name so existing hooks still work: a Mark tap drops a numbered pin. */
function stampMark() { return dropPin('mark'); }
