/* v3.3.8x (Chappie D3 112026): the count shown is files only (d.files / d.filesDone from sw.js); the two page addresses ./ and seq/ are still saved but not counted. Shows the one-time "save for offline" progress in the existing status line, and asks the worker to finish the save. */
(function () {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const st = () => document.getElementById('statusLine'), fmt = n => Number(n).toLocaleString('en-US');
  let last = 0, shown = false;
  function show(msg) { const e = st(); if (!e) return; if (!e.hidden && !/^(Saving|Saved)/.test(e.textContent)) return; e.textContent = msg; e.hidden = false; shown = true; }
  navigator.serviceWorker.addEventListener('message', ev => { const d = ev.data; if (!d || d.type !== 'precache') return; window.OFFLINE = d;
    if (d.done >= d.total) { if (shown) { show('Saved for offline (' + fmt(d.files != null ? d.files : d.total) + ' files)'); setTimeout(() => { const e = st(); if (e && /^Saved/.test(e.textContent)) e.hidden = true; shown = false; }, 4000); } }
    else { const n = Date.now(); if (n - last < 250) return; last = n; show('Saving for offline… ' + fmt(d.filesDone != null ? d.filesDone : d.done) + ' / ' + fmt(d.files != null ? d.files : d.total)); } });
  // v3.3.8x 1422: the save waits for the opening (bed playing + greeting started, event 'emote-open' from app.js), then runs in the background.
  // Fallback: 45 s after load (no tap, or the bed muted and no greeting). A worker takeover re-asks only after the first ask.
  let asked = false;
  const kick = () => { asked = true; if (!window.PRECACHE_ASKED_AT) window.PRECACHE_ASKED_AT = +(performance.now() / 1000).toFixed(2);
    navigator.serviceWorker.ready.then(r => { if (r.active) r.active.postMessage({type: 'precache'}); }).catch(() => {}); };
  window.addEventListener('emote-open', () => setTimeout(kick, 1500));
  if (window.EMOTE_OPEN_AT) setTimeout(kick, 1500);
  window.addEventListener('load', () => setTimeout(() => { if (!asked) kick(); }, 45000));
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (asked) setTimeout(kick, 800); });
})();
