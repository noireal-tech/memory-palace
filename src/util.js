/* Memory Palace: shared helpers. Everything lives on one namespace, MP, loaded as plain scripts in order. */
(function () {
  'use strict';
  var MP = window.MP = window.MP || {};
  MP.DEBUG = /[?&]debug\b/.test(location.search);
  MP.params = new URLSearchParams(location.search);

  // ---------- Noise: hashed value noise, tileable at a given period, and fractal sums of it ----------
  function hash(i, j, s) {
    var h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
  }
  function noise(x, y, period, seed) {
    var xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    var x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period, x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    var a = hash(x0, y0, seed), b = hash(x1, y0, seed), c = hash(x0, y1, seed), d = hash(x1, y1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  // Fractal noise over the unit square, tileable: base frequency, octaves, seed.
  function fbm(u, v, base, octaves, seed) {
    var t = 0, amp = 0.5, f = base, n = 0;
    for (var o = 0; o < octaves; o++) { t += amp * noise(u * f, v * f, f, seed + o * 17); n += amp; amp *= 0.5; f *= 2; }
    return t / n;
  }
  // Repeatable random numbers.
  function rng(seed) { var k = (seed | 0) || 1; return function () { k = Math.imul(k ^ (k >>> 15), 2246822507) + 0x9e3779b9 | 0; k ^= k >>> 13; return ((k >>> 0) % 1000003) / 1000003; }; }
  MP.hash = hash; MP.noise = noise; MP.fbm = fbm; MP.rng = rng;
  MP.clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  MP.lerp = function (a, b, t) { return a + (b - a) * t; };
  MP.smooth = function (a, b, t) { t = MP.clamp((t - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  // Let the browser draw a frame (and the headset keep its view) between pieces of long work.
  MP.yieldFrame = function () { return new Promise(function (r) { setTimeout(r, 0); }); };
  // Run work in slices: call slice() repeatedly; it returns true when done. Yields every few milliseconds.
  MP.sliced = async function (budgetMs, slice) {
    var t = performance.now();
    while (!slice()) { if (performance.now() - t > budgetMs) { await MP.yieldFrame(); t = performance.now(); } }
  };

  // ---------- Storage on this device: a small key-value store in IndexedDB (localStorage as a fallback) ----------
  var dbp = null;
  function db() {
    if (!dbp) dbp = new Promise(function (res, rej) {
      if (!window.indexedDB) return rej(new Error('no indexedDB'));
      var r = indexedDB.open('memory-palace', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('kv'); };
      r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
    });
    return dbp;
  }
  function tx(mode, fn) {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction('kv', mode), st = t.objectStore('kv'), out = fn(st);
        t.oncomplete = function () { res(out && 'result' in out ? out.result : undefined); }; t.onerror = function () { rej(t.error); }; t.onabort = function () { rej(t.error); };
      });
    });
  }
  MP.store = {
    get: function (k) { return tx('readonly', function (s) { return s.get(k); }).catch(function () { try { var v = localStorage.getItem('mp.' + k); return v ? JSON.parse(v) : undefined; } catch (e) { return undefined; } }); },
    set: function (k, v) { return tx('readwrite', function (s) { s.put(v, k); }).catch(function () { try { localStorage.setItem('mp.' + k, JSON.stringify(v)); } catch (e) { } }); },
    del: function (k) { return tx('readwrite', function (s) { s.delete(k); }).catch(function () { try { localStorage.removeItem('mp.' + k); } catch (e) { } }); }
  };

  MP.$ = function (s) { return document.querySelector(s); };
  MP.log = function () { if (MP.DEBUG) console.log.apply(console, ['[palace]'].concat([].slice.call(arguments))); };
})();
