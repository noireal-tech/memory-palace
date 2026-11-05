// Memory Palace offline cache (written by build.js). CACHE changes whenever an app file changes.
const CACHE = 'memory-palace-fdc5b4ceba';
const FILES = ['./', './index.html', './manifest.webmanifest', './css/app.css', './fonts/bricolage-grotesque.woff2', './fonts/kaushan-script.woff2', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './lib/sky.js', './lib/three.min.js', './src/app.js', './src/detail.js', './src/interact.js', './src/links.js', './src/materials.js', './src/naming.js', './src/nature.js', './src/panel.js', './src/player.js', './src/portal.js', './src/render.js', './src/rooms.js', './src/site.js', './src/sound.js', './src/textures.js', './src/util.js', './src/world.js', './src/skins/pagoda.js', './textures/bark-1k.jpg', './textures/bark-n-1k.jpg', './textures/bark-r.jpg', './textures/blossom-1k.jpg', './textures/blossom-n-1k.jpg', './textures/blossom-r.jpg', './textures/gate-1k.jpg', './textures/gate-n-1k.jpg', './textures/gate-r.jpg', './textures/grass-1k.jpg', './textures/grass-n-1k.jpg', './textures/grass-r.jpg', './textures/gravel-1k.jpg', './textures/gravel-n-1k.jpg', './textures/gravel-r.jpg', './textures/index.json', './textures/paving-1k.jpg', './textures/paving-n-1k.jpg', './textures/paving-r.jpg', './textures/pine-1k.jpg', './textures/pine-n-1k.jpg', './textures/pine-r.jpg', './textures/plaster-1k.jpg', './textures/plaster-n-1k.jpg', './textures/plaster-r.jpg', './textures/roof-1k.jpg', './textures/roof-n-1k.jpg', './textures/roof-r.jpg', './textures/shoji-1k.jpg', './textures/shoji-n-1k.jpg', './textures/shoji-r.jpg', './textures/stone-1k.jpg', './textures/stone-n-1k.jpg', './textures/stone-r.jpg', './textures/timber-1k.jpg', './textures/timber-n-1k.jpg', './textures/timber-r.jpg', './textures/window-1k.jpg', './textures/window-n-1k.jpg', './textures/window-r.jpg'];
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
