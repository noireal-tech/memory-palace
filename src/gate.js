/* Memory Palace: the keep's gate. Two timber leaves, each with a giant iron ring on its outer face. Take hold of a
   ring (grip, or trigger with your hand on it) and pull: that leaf swings open toward you, as far as you pull it.
   Open one leaf or both. Each leaf has a matching ring on its inner face: from inside, pull it to swing the leaf
   shut. The leaves stay where you leave them, here on this headset. Pointing at a ring and pulling the trigger (or
   clicking it on a flat screen) swings that leaf all the way, for when reaching isn't easy. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, W = MP.World;
  var OPEN = 1.6, BLOCK = 0.85; // radians: fully open; open further than this and the leaf no longer blocks its half
  var leaves = [], v = new THREE.Vector3();

  function setAngle(L, a) {
    a = MP.clamp(a, 0, OPEN); if (Math.abs(a - L.a) < 1e-5) return; L.a = a;
    L.pivot.rotation.y = L.sd < 0 ? a : -a;
    var blocks = a < BLOCK;
    if (blocks !== L.blocks) { L.blocks = blocks; W.drop(L.tag); if (blocks) addSolid(L); }
  }
  function addSolid(L) { var G0 = MP.KEEP.GATE; W.solid(L.sd < 0 ? -G0.x : -0.03, G0.z - 0.08, L.sd < 0 ? 0.03 : G0.x, G0.z + 0.18, 30, L.tag); } // overlapping at the middle: nothing slips between the leaves
  // the angle your hand makes about a leaf's hinge (0 = shut, growing as the hand comes out toward the forecourt)
  function handAngle(L, p) { var dx = p.x - L.hx, dz = p.z - L.hz; return Math.atan2(-dz, L.sd < 0 ? dx : -dx); }

  var saveTimer = 0;
  function save() { clearTimeout(saveTimer); saveTimer = setTimeout(function () { MP.store.set('gate', leaves.map(function (L) { return L.a; })); }, 400); }
  function swing(L, to) { L.anim = { from: L.a, to: to, t: 0 }; }

  MP.Gate = {
    build: function (group) {
      var M = MP.M, G0 = MP.KEEP.GATE, w = G0.w, h = G0.h - 0.02, th = 0.1;
      var leafGeo = new THREE.BoxGeometry(w, h, th);
      var ringGeo = new THREE.TorusGeometry(0.2, 0.028, 10, 36), bossGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.05, 16); bossGeo.rotateX(Math.PI / 2);
      var plateGeo = new THREE.BoxGeometry(0.34, 0.06, 0.012), studGeo = new THREE.SphereGeometry(0.032, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2); studGeo.rotateX(-Math.PI / 2);
      [-1, 1].forEach(function (sd) {
        var pivot = new THREE.Group(); pivot.position.set(sd * G0.x, 0.02, G0.z + th / 2); group.add(pivot);
        var leaf = new THREE.Mesh(leafGeo, M.doorLeaf); leaf.position.set(-sd * w / 2, h / 2, 0); leaf.castShadow = false; leaf.receiveShadow = true; pivot.add(leaf);
        // the ironwork (bands, studs, bosses and plates on both faces) merged into one mesh per leaf: one draw, not dozens
        var iron = new MP.R.Batch(pivot);
        function piece(geo, x, y, z, turn) { var g = geo.clone(); if (turn) g.rotateY(Math.PI); g.translate(x, y, z); iron.add(M.iron, g, true); }
        [0.45, h - 0.45].forEach(function (y) { [-1, 1].forEach(function (f) {
          piece(new THREE.BoxGeometry(w - 0.04, 0.09, 0.012), -sd * w / 2, y, f * (th / 2 + 0.006));
          for (var k = 0; k < 6; k++) piece(studGeo, -sd * (0.17 + k * (w - 0.34) / 5), y, f * (th / 2 + 0.012), f > 0);
        }); });
        var L = { sd: sd, pivot: pivot, a: -1, blocks: null, tag: 'gate:' + (sd < 0 ? 'L' : 'R'), hx: sd * G0.x, hz: G0.z + th / 2, rings: [] };
        // a ring on each face, near the meeting edge, hanging from a boss
        [-1, 1].forEach(function (f) {
          var rx = -sd * (w - 0.42), ry = 1.25, rz = f * (th / 2 + 0.035);
          piece(bossGeo, rx, ry + 0.24, f * (th / 2 + 0.02)); piece(plateGeo, rx, ry + 0.24, f * (th / 2 + 0.006));
          var ring = new THREE.Mesh(ringGeo, M.iron); ring.position.set(rx, ry, rz); pivot.add(ring);
          var outer = f < 0; // the outer face looks out at the forecourt (-z)
          ring.userData.outer = outer; L.rings.push(ring);
          MP.Interact.add(ring, { label: outer ? 'Pull the gate open' : 'Pull the gate shut', use: function () { swing(L, L.a > OPEN / 2 ? 0 : OPEN); } });
          MP.Grab.add({
            label: 'Gate ring', reach: 0.26,
            at: function (out) { return ring.getWorldPosition(out); },
            grab: function (rec) { L.anim = null; L.off = handAngle(L, MP.Grab.handPos(rec, v)) - L.a; },
            move: function (rec) { var a0 = L.a; setAngle(L, handAngle(L, MP.Grab.handPos(rec, v)) - L.off); if (Math.abs(L.a - a0) > 0.002) MP.Grab.buzz(rec, 0.08, 10); },
            drop: function () { save(); }
          });
        });
        iron.flush(); iron.meshes.forEach(function (m) { m.castShadow = false; });
        leaves.push(L); setAngle(L, 0);
      });
      R.onFrame(function (dt) {
        leaves.forEach(function (L) {
          if (!L.anim) return;
          L.anim.t = Math.min(1, L.anim.t + dt / 0.9); var e = L.anim.t < 0.5 ? 2 * L.anim.t * L.anim.t : 1 - Math.pow(-2 * L.anim.t + 2, 2) / 2;
          setAngle(L, MP.lerp(L.anim.from, L.anim.to, e)); if (L.anim.t >= 1) { L.anim = null; save(); }
        });
      });
      return MP.store.get('gate').then(function (a) { if (Array.isArray(a)) leaves.forEach(function (L, i) { if (typeof a[i] === 'number') setAngle(L, a[i]); }); });
    },
    angles: function () { return leaves.map(function (L) { return Math.round(L.a * 1000) / 1000; }); },
    set: function (i, a) { setAngle(leaves[i], a); save(); },
    rings: function () { return leaves.map(function (L) { return L.rings.map(function (r) { var p = r.getWorldPosition(new THREE.Vector3()); return { outer: r.userData.outer, at: p.toArray() }; }); }); }
  };
})();
