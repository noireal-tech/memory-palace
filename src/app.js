/* Memory Palace: start-up. Paint the materials, raise the site and the keep in the chosen skin, put you in the
   forecourt, and go into the headset if a portal handed over a VR session. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, P = MP.Player, $ = MP.$;
  var groups = { site: new THREE.Group(), keep: new THREE.Group() };
  R.scene.add(groups.site, groups.keep);

  MP.arrive = function () { var a = MP.SITE.ARRIVE; P.place(a.x, a.z, a.yaw); P.flatPitch = 0.03; MP.Portal && MP.Portal.reset(); };

  // ---------- Your plan: picked from a file you keep, stored only on this device ----------
  MP.Plan = {
    data: null,
    load: function () { return MP.store.get('plan').then(function (p) { MP.Plan.data = p || null; return MP.Plan.data; }); },
    importText: function (text) {
      var o = JSON.parse(text), rooms = o && o.rooms;
      if (!Array.isArray(rooms) || !rooms.length) throw new Error('no rooms');
      var clean = rooms.map(function (r) { return { address: String(r.address || ''), name: r.name ? String(r.name) : '', wall: r.wall || null, accent: r.accent || null }; })
        .filter(function (r) { return /^(W2|W1|C|E1|E2)\.(W|E)\.(N|S)\d+$/.test(r.address); });
      if (!clean.length) throw new Error('no valid addresses');
      var plan = { v: 1, rooms: clean, at: Date.now() };
      return MP.store.set('plan', plan).then(function () { MP.Plan.data = plan; return plan; });
    }
  };
  function planNote() { var p = MP.Plan.data; return p ? 'Your plan: ' + p.rooms.length + ' rooms, kept on this headset only.' : 'No plan yet. Open your palace plan to add your rooms.'; }

  // ---------- Building ----------
  async function build() {
    var T = {}, names = MP.Tex.names.concat(['blossom', 'pine']);
    for (var i = 0; i < names.length; i++) { R.status('Preparing materials… ' + Math.round(i / names.length * 100) + '%', true); T[names[i]] = await MP.Tex.get(names[i]); }
    MP.makeMaterials(T);
    R.status('Raising the palace…', true); await MP.yieldFrame();
    var rnd = MP.rng(7);
    MP.SITE.build(groups.site, rnd); await MP.yieldFrame();
    var skin = MP.Skins[MP.params.get('skin') || 'pagoda'] || MP.Skins.pagoda;
    skin.keep(groups.keep); await MP.yieldFrame();
    MP.Portal.build(groups.site); await MP.yieldFrame();
    // prepare every material's shaders before the first full frame, in the background where the browser allows it
    R.status('Lighting the palace…', true);
    try { if (R.renderer.compileAsync) await R.renderer.compileAsync(R.scene, R.camera); else R.renderer.compile(R.scene, R.camera); } catch (e) { MP.log('compile', e); }
    R.refreshShadows();
    await MP.Plan.load();
    MP.ready = true; P.enabled = true;
    R.status(planNote(), false);
    MP.Panel.say(MP.Plan.data ? 'Forecourt · ' + MP.Plan.data.rooms.length + ' rooms in your plan' : 'Forecourt');
  }

  // ---------- The page's card ----------
  var via = MP.params.get('via');
  if (via === 'clay') $('#card').classList.add('arriving');
  $('#enter').addEventListener('click', function () { R.enterVR(); });
  $('#home').addEventListener('click', function () { MP.Links.go('clay', 'via=palace'); });
  if (!navigator.xr) { $('#enter').disabled = true; $('#enter').textContent = 'VR not available here'; }
  $('#planBtn').addEventListener('click', function () { $('#planFile').click(); });
  $('#planFile').addEventListener('change', async function (e) {
    var f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    try { await MP.Plan.importText(await f.text()); R.status(planNote(), false); MP.Panel.say('Forecourt · ' + MP.Plan.data.rooms.length + ' rooms in your plan'); }
    catch (err) { R.status('That file isn’t a palace plan.', false); }
  });
  R.onSession('start', function () { $('#card').hidden = true; });
  R.onSession('end', function () { $('#card').hidden = false; });

  // ---------- Go ----------
  MP.arrive();
  // A VR session handed over by the portal: go straight in and let the palace finish building around you.
  if (window.__xrGranted) R.enterVR();
  addEventListener('xrgranted', function () { R.enterVR(); });
  build().catch(function (e) {
    console.error(e); MP.ready = true; P.enabled = true;
    R.status('Something went wrong raising the palace. Reload to try again.', true);
  });

  if (MP.DEBUG) window.palaceDebug = {
    MP: MP, ready: function () { return !!MP.ready; }, presenting: R.presenting, frames: R.frames,
    stats: function () { var i = R.renderer.info.render; return { tris: i.triangles, calls: i.calls, meshes: groups.site.children.length + groups.keep.children.length, world: MP.World.counts() }; },
    place: function (x, y, z, hold) { R.rig.position.set(x, y, z); P.hold = !!hold; MP.Portal.reset(); },
    look: function (yaw, pitch) { P.flatYaw = yaw; P.flatPitch = pitch; R.rig.rotation.y = yaw; R.camera.rotation.set(pitch, 0, 0); },
    walk: function (n, f, s) { for (var i = 0; i < n; i++) { P.move(1 / 60, f, s || 0); MP.Portal.check(); } return R.rig.position.toArray(); },
    lastLink: function () { return MP.lastLink || null; }
  };
})();
