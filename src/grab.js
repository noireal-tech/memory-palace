/* Memory Palace: holding things with your hands. Squeeze the grip button (or pull the trigger) with your hand on
   something you can hold, such as a gate ring, the rake or a garden rock, and it's yours until you let go. A light buzz
   in the controller tells you when your hand is close enough to take hold.
   An item: { at(out) → its grab point (world), reach (m), near(p) → distance from world point p (optional, else from
   at()), grab(rec), move(rec, dt), drop(rec), label }. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, P = MP.Player;
  var items = [], held = {}, hot = {}, v = new THREE.Vector3(), hp = new THREE.Vector3();
  function handPos(rec, out) { return rec.grip.getWorldPosition(out); }
  function nearest(rec) {
    handPos(rec, hp); var best = null, bd = Infinity;
    items.forEach(function (it) {
      if (it.enabled && !it.enabled()) return;
      if (it.holder) return; // already in the other hand
      var d = it.near ? it.near(hp) : it.at(v).distanceTo(hp);
      if (d < it.reach && d < bd) { bd = d; best = it; }
    });
    return best;
  }
  function buzz(rec, strength, ms) { var a = rec.src && rec.src.gamepad && rec.src.gamepad.hapticActuators; if (a && a[0] && a[0].pulse) try { a[0].pulse(strength, ms); } catch (e) { } }
  var Gr = MP.Grab = {
    add: function (it) { items.push(it); return it; },
    remove: function (it) { var i = items.indexOf(it); if (i >= 0) items.splice(i, 1); },
    // a button went down: take hold of what's in reach. Returns true if something was taken.
    press: function (rec, button) {
      if (held[rec.i]) return true;
      var it = nearest(rec); if (!it) return false;
      held[rec.i] = { it: it, button: button }; it.holder = rec; buzz(rec, 0.5, 40);
      it.grab(rec); return true;
    },
    release: function (rec, button) {
      var h = held[rec.i]; if (!h || h.button !== button) return;
      delete held[rec.i]; h.it.holder = null; h.it.drop(rec);
    },
    // let go of an item without dropping it anywhere (it's being put away)
    forget: function (it) { Object.keys(held).forEach(function (k) { if (held[k].it === it) delete held[k]; }); it.holder = null; },
    holding: function (rec) { var h = held[rec.i]; return h ? h.it : null; },
    within: function (rec) { return nearest(rec); },
    handPos: handPos, buzz: buzz, items: items
  };
  R.onFrame(function (dt) {
    if (!R.presenting()) return;
    P.pads.forEach(function (rec) {
      if (!rec.src) return;
      var h = held[rec.i];
      if (h) { h.it.move(rec, dt); return; }
      // a short buzz the moment your hand comes within reach of something you can hold
      var it = nearest(rec), was = hot[rec.i];
      if (it && it !== was) buzz(rec, 0.15, 15);
      hot[rec.i] = it;
    });
  });
})();
