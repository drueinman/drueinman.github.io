/* Emote v3.3.8s service worker (static web, Jarvis 111926). This folder holds only the sequencer add-on; the app shell, pictures and
   audio come from the v3.3.8w folder next to it. Install caches the add-on and the small v3.3.8w shell; pictures are cached the first
   time they are used. Audio is never intercepted (phones send Range requests for media). Pages are network-first so a fix shows up. */
const CACHE = 'aloy-emote-v338s-6590c6b28a', W = new URL('../sample1v3.3.8w-13ac067868/', self.registration.scope).pathname;
const MINE = ['./', 'seq-v338s.js', 'seq-v338s.css', 'seq-map-v338s.json'];
const WSHELL = ['app.js', 'assets.json', 'bots.json', 'bots/aloy.json', 'demos.json', 'emote-map.json', 'engine.js', 'focus.json', 'msg-v338p.css', 'msg-v338p.js',
  'pad-map.json', 'pad.css', 'pad.js', 'review.js', 'style.css', 'viseme-map.json', 'voice.js', 'drue-viseme-hook.js', 'focus-layers/focus-layers.js', 'icon-192.png'].map(f => W + f);
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(MINE.concat(WSHELL))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('aloy-emote-v338s-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url), mine = new URL('./', self.registration.scope).pathname;
  if (req.method !== 'GET' || u.origin !== location.origin || !(u.pathname.startsWith(mine) || u.pathname.startsWith(W))) return;
  if (/\.(mp3|m4a)$/i.test(u.pathname) || req.headers.has('range') || /eve-endpoint\.json$/.test(u.pathname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (r.status === 200 && u.pathname.startsWith(mine)) { const c = r.clone(); caches.open(CACHE).then(cc => cc.put('./', c)).catch(() => {}); } return r; })
      .catch(() => caches.match(u.pathname.startsWith(mine) ? './' : req)));
    return; }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(r => {
    if (r.status === 200 && r.type === 'basic') { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(u.pathname, c)).catch(() => {}); }
    return r; })));
});
