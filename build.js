// Writes sw.js: the offline cache for every file the app needs, named by a hash of their contents so an update
// arrives on the next launch. Run after changing any app file: node build.js
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = __dirname;
const dirs = ['css', 'fonts', 'icons', 'lib', 'src', 'src/skins', 'textures'];
if (!fs.existsSync(path.join(ROOT, 'textures'))) fs.mkdirSync(path.join(ROOT, 'textures'));
const files = ['index.html', 'manifest.webmanifest'];
// Full-resolution textures aren't fetched up front: they load (and are kept for offline use) the first time you come
// within the detail bubble of them. Everything else is cached on install.
const fullRes = f => /^textures\//.test(f) && /\.jpg$/.test(f) && !/-1k\.jpg$|-r\.jpg$/.test(f);
dirs.forEach(d => fs.readdirSync(path.join(ROOT, d)).sort().forEach(f => { if (fs.statSync(path.join(ROOT, d, f)).isFile() && !fullRes(d + '/' + f)) files.push(d + '/' + f); }));
const hash = crypto.createHash('sha256'); files.forEach(f => hash.update(f).update(fs.readFileSync(path.join(ROOT, f))));
const version = hash.digest('hex').slice(0, 10);
fs.writeFileSync(path.join(ROOT, 'sw.js'), `// Memory Palace offline cache (written by build.js). CACHE changes whenever an app file changes.
const CACHE = 'memory-palace-${version}';
const FILES = ['./', ${files.map(f => `'./${f}'`).join(', ')}];
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
`);
console.log('built', version, files.length, 'files');
