/* Emote v3.3.8w service worker (static web, Jarvis 111926). Install caches only the small app shell; pictures are cached the first
   time they are used. Audio is never intercepted (phones send Range requests for media). Pages are network-first so a fix shows up. */
const CACHE = 'aloy-emote-v338w-d9c2d063e3', SHELL = ["./", "app.js", "assets.json", "bots.json", "bots/aloy.json", "bots/chappie.json", "bots/chippy.json", "bots/ebot.json", "bots/iris.json", "bots/jarvis.json", "bots/max.json", "bots/tweakx.json", "credits.html", "demos.json", "drowsy-seed.json", "drue-viseme-hook.js", "emote-map.json", "engine.js", "eve-endpoint.json", "focus.json", "manifest.webmanifest", "msg-v338p.css", "msg-v338p.js", "pad-map.json", "pad.css", "pad.js", "review.js", "style.css", "viseme-map.json", "voice.js", "icon-192.png"];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('aloy-emote-v338w-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const req = e.request, u = new URL(req.url);
  if (req.method !== 'GET' || u.origin !== location.origin || !u.pathname.startsWith(new URL('./', self.registration.scope).pathname)) return;
  if (/\.(mp3|m4a)$/i.test(u.pathname) || req.headers.has('range') || /eve-endpoint\.json$/.test(u.pathname)) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { if (r.status === 200) { const c = r.clone(); caches.open(CACHE).then(cc => cc.put('./', c)).catch(() => {}); } return r; })
      .catch(() => caches.match('./')));
    return; }
  e.respondWith(caches.match(req, {ignoreSearch: true}).then(hit => hit || fetch(req).then(r => {
    if (r.status === 200 && r.type === 'basic') { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(u.pathname, c)).catch(() => {}); }
    return r; })));
});
