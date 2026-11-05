/* Memory Palace: the detail bubble. Every photographic material starts at standard resolution (1K). Its full
   resolution (4K for what you see up close, 2K for the rest) loads only while some surface wearing it is within
   RADIUS of you, and is released once every such surface is beyond RADIUS + MARGIN, so textures don't flicker at the
   edge. Far away the GPU samples small mip levels anyway, so swapping a whole material looks the same at distance and
   only costs memory while you're near. Later steps put near-only geometry (grass tufts, pebbles) in the same bubble. */
(function () {
  'use strict';
  var MP = window.MP;
  var D = MP.Detail = {
    RADIUS: +(MP.params.get('bubble') || 25), MARGIN: 7, EVERY: 0.4,
    sets: new Map()   // texture set → { set, mats: Set, boxes: [Box3], state: 'lo'|'loading'|'hi', hi: {map, normalMap}, dist }
  };
  function entry(set) {
    if (!D.sets.has(set)) D.sets.set(set, { set: set, mats: new Set(), boxes: [], state: 'lo', hi: null, dist: Infinity });
    return D.sets.get(set);
  }
  // A material made from a set with a full-resolution version (materials.js marks it)
  D.material = function (m, set) { if (set && set.hi) { entry(set).mats.add(m); m.userData.set = set; } };
  // A piece of world-space geometry about to be merged (render.js Batch.add calls this)
  D.note = function (mat, g) {
    var set = mat.userData.set; if (!set) return;
    if (!g.boundingBox) g.computeBoundingBox();
    entry(set).boxes.push(g.boundingBox.clone());
  };

  function useTextures(e, src) {
    e.mats.forEach(function (m) {
      m.map = src.map; if (m.normalMap) m.normalMap = src.normalMap;
      if (m.emissiveMap) m.emissiveMap = src.map;
    });
  }
  var busy = false;
  async function load(e) {
    busy = true; e.state = 'loading';
    try {
      var lo = e.set, out = await Promise.all([MP.Tex.loadTex(lo.hi[0], true), lo.hi[1] ? MP.Tex.loadTex(lo.hi[1], false) : null]);
      out[0].repeat.copy(lo.map.repeat); if (out[1]) out[1].repeat.copy(lo.normalMap.repeat);
      e.hi = { map: out[0], normalMap: out[1] || lo.normalMap };
      if (e.dist <= D.RADIUS + D.MARGIN) { useTextures(e, e.hi); e.state = 'hi'; } else { release(e); }
    } catch (err) { MP.log('detail load failed', lo && lo.name, err); e.state = 'failed'; }
    busy = false;
  }
  function release(e) {
    useTextures(e, e.set);
    var hi = e.hi; e.hi = null; e.state = 'lo';
    if (hi) setTimeout(function () { hi.map.dispose(); if (hi.normalMap !== e.set.normalMap) hi.normalMap.dispose(); }, 1000);
  }
  // Distance from a point to a box (0 inside)
  function boxDist(b, p) {
    var dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x), dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y), dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  var acc = 0, head = new THREE.Vector3();
  D.update = function (force) {
    if (!MP.ready && !force) return;
    if (MP.Closets) MP.Closets.anchor(head); else MP.Player.head(head); // in a closet: from where its doors begin in the palace
    var want = null;
    D.sets.forEach(function (e) {
      var d = Infinity; for (var i = 0; i < e.boxes.length && d > 0; i++) d = Math.min(d, boxDist(e.boxes[i], head));
      e.dist = d;
      if (e.state === 'hi' && d > D.RADIUS + D.MARGIN) release(e);
      else if (e.state === 'lo' && d <= D.RADIUS && (!want || d < want.dist)) want = e;   // nearest first, one at a time
    });
    if (want && !busy) load(want);
  };
  MP.R.onFrame(function (dt) { acc += dt; if (acc >= D.EVERY) { acc = 0; D.update(); } });
  D.report = function () {
    var out = {}; D.sets.forEach(function (e) { out[e.set.name] = { state: e.state, dist: Math.round(e.dist * 10) / 10, mats: e.mats.size, pieces: e.boxes.length }; }); return out;
  };
})();
