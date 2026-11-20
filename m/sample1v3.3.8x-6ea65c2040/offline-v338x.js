/* v3.3.8x: shows the one-time "save for offline" progress in the existing status line, and asks the worker to finish the save. */
(function () {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const st = () => document.getElementById('statusLine'), fmt = n => Number(n).toLocaleString('en-US');
  let last = 0, shown = false;
  function show(msg) { const e = st(); if (!e) return; if (!e.hidden && !/^(Saving|Saved)/.test(e.textContent)) return; e.textContent = msg; e.hidden = false; shown = true; }
  navigator.serviceWorker.addEventListener('message', ev => { const d = ev.data; if (!d || d.type !== 'precache') return; window.OFFLINE = d;
    if (d.done >= d.total) { if (shown) { show('Saved for offline (' + fmt(d.total) + ' files)'); setTimeout(() => { const e = st(); if (e && /^Saved/.test(e.textContent)) e.hidden = true; shown = false; }, 4000); } }
    else { const n = Date.now(); if (n - last < 250) return; last = n; show('Saving for offline… ' + fmt(d.done) + ' / ' + fmt(d.total)); } });
  const kick = () => navigator.serviceWorker.ready.then(r => { if (r.active) r.active.postMessage({type: 'precache'}); }).catch(() => {});
  window.addEventListener('load', () => setTimeout(kick, 2500));
  navigator.serviceWorker.addEventListener('controllerchange', () => setTimeout(kick, 800));
})();
