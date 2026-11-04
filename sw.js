// Memory Palace offline cache (written by build.js). CACHE changes whenever an app file changes.
const CACHE = 'memory-palace-5af0a80af0';
const FILES = ['./', './index.html', './manifest.webmanifest', './css/app.css', './fonts/bricolage-grotesque.woff2', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './lib/sky.js', './lib/three.min.js', './src/app.js', './src/links.js', './src/materials.js', './src/nature.js', './src/panel.js', './src/player.js', './src/portal.js', './src/render.js', './src/site.js', './src/textures.js', './src/util.js', './src/world.js', './src/skins/pagoda.js', './textures/index.json'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('memory-palace-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
// Serve from the cache straight away (works with no connection); fetch a fresh copy in the background.
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin || !url.pathname.startsWith(new URL('./', location).pathname)) return;
  e.respondWith(caches.open(CACHE).then(cache => cache.match(req, { ignoreSearch: true }).then(hit => {
    const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
    return hit || fresh;
  })));
});
