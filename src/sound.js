/* Memory Palace: spatial sound. Every sound is made live in the browser (no recordings to download, and nothing loops
   audibly) and placed in the world, so it comes from where its source is and shifts as you turn your head (HRTF).
   - wind: all around you, rising and falling with the gusts
   - wind chimes: five bronze tubes hanging at the front door, swaying and ringing as gusts push the clapper
   - water: lapping in the moat on both sides of the causeway
   - the portal ring: a low, soft hum
   - leaves rustling in the trees nearest you (only the closest few make sound, like the detail bubble)
   - evening cicadas (higurashi) in the pines round the moat, and now and then a bush warbler in the cherries
   - your footsteps: stone, gravel or grass, depending on what's under you
   - in the Central Hall: the cascade, and whatever you've set out there (a singing bowl, a wind bell, a bamboo
     fountain, a koto box: things.js decides when they sound, here is how they sound)
   One wind drives everything: the chimes' sway, how often they ring, and the wind's own sound.
   Hall sound "White noise" (Settings face): inside the hall, every other sound fades out and plain white noise plays
   instead; step outside and the world comes back.
   Routing: every source → world → out → your ears; the white noise → out. The Sound switch is `out`; white noise
   mode turns `world` down. (`master` below is `world`.) */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R;
  var S = MP.Sound = { on: true, ready: false };
  var listener = null, ctx = null, master = null, out = null, white = null, hallBus = null;

  // ---------- The wind: a slow, gusty value 0..1 everyone shares ----------
  var W = MP.Wind = { t: 0, gust: 0.3 };
  W.at = function (t) { // smooth layered noise, with occasional stronger gusts
    var a = MP.noise(t * 0.11, 3.7, 4096, 901), b = MP.noise(t * 0.37, 1.3, 4096, 903), c = MP.noise(t * 0.03, 8.1, 4096, 905);
    return MP.clamp(0.15 + 0.55 * a * a + 0.25 * b * c + 0.35 * MP.smooth(0.62, 0.9, c), 0, 1);
  };
  R.onFrame(function (dt) { W.t += dt; W.gust = W.at(W.t); });

  // ---------- Sound building blocks ----------
  function noiseBuffer(sec, brown) {
    var n = Math.floor(ctx.sampleRate * sec), buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
    for (var i = 0; i < n; i++) { var w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
    // fade the loop's ends together so the join is silent
    var f = Math.floor(ctx.sampleRate * 0.05); for (i = 0; i < f; i++) { var k = i / f; d[n - f + i] = d[n - f + i] * (1 - k) + d[i] * k; }
    return buf;
  }
  function loop(buf) { var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = 0; s.loopEnd = buf.duration - 0.05; s.start(ctx.currentTime + Math.random() * 0.5); return s; }
  function positional(obj, node, ref, roll, max, dest) {
    var p = new THREE.PositionalAudio(listener);
    p.panner.panningModel = 'HRTF'; p.setDistanceModel('inverse'); p.setRefDistance(ref); p.setRolloffFactor(roll); p.setMaxDistance(max);
    p.setNodeSource(node); obj.add(p);
    p.gain.disconnect(); p.gain.connect(dest || master); // everything goes through the world bus, then the Sound switch
    return p;
  }

  // ---------- Wind (all around: not positional) ----------
  var wind = {};
  function makeWind() {
    var src = loop(noiseBuffer(6, false)), bp = ctx.createBiquadFilter(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
    bp.type = 'bandpass'; bp.Q.value = 0.6; bp.frequency.value = 500; lp.type = 'lowpass'; lp.frequency.value = 1800; g.gain.value = 0;
    src.connect(bp); bp.connect(lp); lp.connect(g);
    var a = new THREE.Audio(listener); a.setNodeSource(g); a.gain.disconnect(); a.gain.connect(master);
    wind = { bp: bp, g: g };
  }

  // ---------- Wind chimes at the front door ----------
  // Five tubes tuned to a pentatonic chord; a tube rings with the partials of a free metal bar (1, 2.756, 5.404, 8.933).
  var CHIME = { at: [2.95, 3.45, -12.4],  // under the corner of the gate's roof, clear of the leaves' swing
                notes: [880, 987.8, 1108.7, 1318.5, 1480] }; // A5 B5 C#6 E6 F#6
  var chime = null, chimeBus = null;
  function buildChimes(group) {
    var M = MP.M, g = new THREE.Group(); g.position.fromArray(CHIME.at); group.add(g);
    var brass = M.gold, string = new THREE.LineBasicMaterial({ color: 0x2a2420 });
    var top = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20), M.bronze); top.position.y = -0.08; g.add(top);
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.08, 0)]), string));
    var tubes = [];
    CHIME.notes.forEach(function (f, i) {
      var a = i / 5 * Math.PI * 2, len = 0.52 - i * 0.045, pivot = new THREE.Group();
      pivot.position.set(Math.cos(a) * 0.075, -0.095, Math.sin(a) * 0.075); g.add(pivot);
      pivot.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.06, 0)]), string));
      var tube = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, len, 12, 1, true), brass); tube.position.y = -0.06 - len / 2; pivot.add(tube);
      var cap = new THREE.Mesh(new THREE.CircleGeometry(0.011, 12), brass); cap.rotation.x = Math.PI / 2; cap.position.y = -0.06 - len; pivot.add(cap);
      tubes.push({ pivot: pivot, f: f, phase: Math.random() * 6.28, rest: 0, ax: 0, az: 0 });
    });
    var clap = new THREE.Group(); clap.position.y = -0.095; g.add(clap);
    clap.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.5, 0)]), string));
    var striker = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.018, 18), M.timber); striker.position.y = -0.3; clap.add(striker);
    var sail = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.15), M.timber); sail.position.y = -0.58; clap.add(sail);
    g.traverse(function (o) { o.castShadow = false; o.matrixAutoUpdate = true; });
    chime = { group: g, tubes: tubes, clap: clap, next: 0, swing: 0 };
  }
  // One strike of a tube: its partials ring and fade, the high ones fastest.
  function strike(tube, force) {
    if (!ctx || !S.on || !chimeBus) return;
    var t = ctx.currentTime, parts = [[1, 1, 3.2], [2.756, 0.5, 1.8], [5.404, 0.25, 0.9], [8.933, 0.12, 0.45]];
    parts.forEach(function (p) {
      var o = ctx.createOscillator(), g = ctx.createGain(), f = tube.f * p[0] * (1 + (Math.random() - 0.5) * 0.002);
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.3 * force * p[1], t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + p[2] * (0.7 + force * 0.5));
      o.connect(g); g.connect(chimeBus); o.start(t); o.stop(t + p[2] * 1.3 + 0.1);
    });
    tube.kick = 0.06 * force; // the struck tube swings away
  }
  function chimeTick(dt, now) {
    if (!chime) return;
    var gust = W.gust, tt = W.t;
    chime.swing += ((0.05 + gust * 0.3) - chime.swing) * Math.min(1, dt * 0.8);
    // the clapper and sail are pushed by the wind; the tubes sway gently and get knocked when struck
    chime.clap.rotation.x = chime.swing * Math.sin(tt * 2.1) * (0.6 + 0.4 * MP.noise(tt * 0.9, 1, 4096, 911));
    chime.clap.rotation.z = chime.swing * Math.sin(tt * 1.7 + 1) * 0.7;
    chime.tubes.forEach(function (tb) {
      tb.kick = (tb.kick || 0) * Math.pow(0.04, dt);
      tb.pivot.rotation.x = 0.25 * chime.swing * Math.sin(tt * 1.3 + tb.phase) + (tb.kick || 0) * Math.sin(now / 90 + tb.phase);
      tb.pivot.rotation.z = 0.25 * chime.swing * Math.sin(tt * 1.1 + tb.phase * 1.7);
    });
    // how often the clapper meets a tube depends on the gust: from a note every few seconds to bright little runs
    if (tt >= chime.next) {
      if (gust > 0.22) strike(chime.tubes[Math.floor(Math.random() * 5)], MP.clamp(0.35 + gust * 0.8 * Math.random(), 0.2, 1));
      chime.next = tt + (gust > 0.6 ? 0.12 + Math.random() * 0.5 : 0.6 + Math.random() * (4 - gust * 4));
    }
  }

  // ---------- Water in the moat, and the portal's hum ----------
  function makeWater(group) {
    var y = MP.SITE.WATER + 0.1, z = MP.SITE.MO[1] + 3;
    [-6, 6].forEach(function (x, i) {
      var src = loop(noiseBuffer(7, true)), lp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), depth = ctx.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 650; g.gain.value = 0.35;
      lfo.frequency.value = 0.23 + i * 0.07; depth.gain.value = 0.22; lfo.connect(depth); depth.connect(g.gain); lfo.start(); // slow lapping swell
      src.connect(lp); lp.connect(g);
      var o = new THREE.Object3D(); o.position.set(x, y, z); group.add(o); positional(o, g, 3, 1.4, 80);
    });
  }
  function makeHum(group) {
    var g = ctx.createGain(); g.gain.value = 0.05;
    [110, 110.7, 220.3].forEach(function (f, i) { var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; var k = ctx.createGain(); k.gain.value = i === 2 ? 0.3 : 1; o.connect(k); k.connect(g); o.start(); });
    var shimmer = loop(noiseBuffer(4, false)), bp = ctx.createBiquadFilter(), sg = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 3200; bp.Q.value = 4; sg.gain.value = 0.15;
    shimmer.connect(bp); bp.connect(sg); sg.connect(g);
    var o = new THREE.Object3D(); o.position.set(MP.RING.x, MP.RING.y, MP.RING.z); group.add(o); positional(o, g, 1.5, 2, 30);
  }

  // ---------- The cascade in the Central Hall: a steady trickle, and drops plinking into the pool ----------
  var cascade = null, scrapeG = null;
  function makeCascade(group) {
    var bus = ctx.createGain(); bus.gain.value = 1;
    var src = loop(noiseBuffer(5, false)), hp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), dep = ctx.createGain();
    hp.type = 'highpass'; hp.frequency.value = 700; bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 0.6; g.gain.value = 0.22;
    lfo.frequency.value = 1.3; dep.gain.value = 0.06; lfo.connect(dep); dep.connect(g.gain); lfo.start(); // the trickle wavers
    src.connect(hp); hp.connect(bp); bp.connect(g); g.connect(bus);
    var low = loop(noiseBuffer(6, true)), lp = ctx.createBiquadFilter(), lg = ctx.createGain(); lp.type = 'lowpass'; lp.frequency.value = 480; lg.gain.value = 0.16; // the splash into the pool
    low.connect(lp); lp.connect(lg); lg.connect(bus);
    var o = new THREE.Object3D(); o.position.set(MP.Hall.BASIN.x, 0.8, MP.Hall.BASIN.z); group.add(o); positional(o, bus, 1.6, 1.3, 45);
    cascade = { bus: bus, next: 0, inside: null };
    // raking: a soft scrape of tines through sand, heard as if from your own hands
    var sc = loop(noiseBuffer(3, false)), sbp = ctx.createBiquadFilter(); sbp.type = 'bandpass'; sbp.frequency.value = 3600; sbp.Q.value = 0.8;
    scrapeG = ctx.createGain(); scrapeG.gain.value = 0; sc.connect(sbp); sbp.connect(scrapeG); scrapeG.connect(master);
  }
  function drip() { // a drop: a short rising "plink"
    var t = ctx.currentTime + 0.01, o = ctx.createOscillator(), g = ctx.createGain(), f = 1100 + Math.random() * 1200;
    o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.03 + Math.random() * 0.05, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    o.connect(g); g.connect(cascade.bus); o.start(t); o.stop(t + 0.09);
    cascade.next = ctx.currentTime + 0.05 + Math.random() * Math.random() * 0.4;
  }
  S.scrape = function (v) { if (scrapeG) scrapeG.gain.setTargetAtTime(v * 0.1, ctx.currentTime, 0.04); };
  // inside the keep, the wind outside is muffled
  function indoors() { if (MP.World.space !== 'world') return true; /* a closet is indoors too */ if (!MP.KEEP) return false; var h = MP.Player.head(new THREE.Vector3()), I = MP.KEEP.IN; return h.x > I[0] && h.x < I[2] && h.z > I[1] && h.z < I[3] && h.y < MP.KEEP.SHAFT + 0.5; }

  // ---------- Leaves: a few rustle sources that follow the trees nearest you ----------
  var rustles = [], RUSTLE_N = 4, rustleAcc = 0;
  function makeRustles(group) {
    var buf = noiseBuffer(5, false);
    for (var i = 0; i < RUSTLE_N; i++) {
      var src = loop(buf), hp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), crackle = ctx.createGain();
      hp.type = 'highpass'; hp.frequency.value = 1400; bp.type = 'peaking'; bp.frequency.value = 4200; bp.gain.value = 6; g.gain.value = 0;
      src.connect(hp); hp.connect(bp); bp.connect(crackle); crackle.connect(g);
      var o = new THREE.Object3D(); group.add(o); positional(o, g, 3, 1.3, 50);
      rustles.push({ obj: o, g: g, crackle: crackle, tree: null, seed: i * 13 + 1 });
    }
  }
  function rustleTick(dt) {
    if (!rustles.length) return;
    rustleAcc += dt;
    if (rustleAcc > 0.7) { // hand the sources to the nearest trees
      rustleAcc = 0; var h = MP.Player.head(new THREE.Vector3());
      var near = MP.Nature.trees.slice().sort(function (a, b) { return Math.hypot(a.x - h.x, a.z - h.z) - Math.hypot(b.x - h.x, b.z - h.z); }).slice(0, RUSTLE_N);
      rustles.forEach(function (r, i) { var t = near[i]; if (t && r.tree !== t) { r.tree = t; r.obj.position.set(t.x, t.y, t.z); } });
    }
    var t = ctx.currentTime, gu = W.gust;
    rustles.forEach(function (r) {
      var flutter = 0.5 + 0.5 * MP.noise(W.t * 3.1 + r.seed, r.seed, 4096, 921), lvl = r.tree ? (r.tree.kind === 'pine' ? 0.5 : 1) * (0.015 + gu * gu * 0.22) * (0.4 + flutter) : 0;
      r.g.gain.setTargetAtTime(lvl, t, 0.15);
    });
  }

  // ---------- Evening cicadas (higurashi): bell-like "kana-kana-kana" phrases that fall away, from distant pines ----------
  var cicadas = [];
  function makeCicadas(group) {
    var pines = MP.Nature.trees.filter(function (t) { return t.kind === 'pine'; });
    for (var i = 0; i < 3 && pines.length; i++) {
      var t = pines[Math.floor(i * pines.length / 3)], bus = ctx.createGain(); bus.gain.value = 1;
      var o = new THREE.Object3D(); o.position.set(t.x, t.y, t.z); group.add(o); positional(o, bus, 14, 0.9, 260);
      cicadas.push({ bus: bus, next: ctx.currentTime + 2 + i * 5 + Math.random() * 6, pitch: 4300 + i * 260 + Math.random() * 200 });
    }
  }
  function cicadaPhrase(c) {
    var t0 = ctx.currentTime + 0.05, n = 14 + Math.floor(Math.random() * 10), gap = 0.11;
    for (var k = 0; k < n; k++) {
      var t = t0 + k * gap, fall = 1 - 0.18 * k / n, amp = 0.05 * Math.sin(Math.PI * Math.min(1, (k + 1) / n * 1.2)) * (1 - 0.5 * k / n);
      var o = ctx.createOscillator(), am = ctx.createOscillator(), amg = ctx.createGain(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(c.pitch * fall * 1.04, t); o.frequency.exponentialRampToValueAtTime(c.pitch * fall * 0.94, t + gap * 0.9);
      am.type = 'square'; am.frequency.value = 180; amg.gain.value = 0.5; am.connect(amg); amg.connect(g.gain); // the buzzing pulse
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + gap * 0.95);
      o.connect(g); g.connect(c.bus); o.start(t); am.start(t); o.stop(t + gap); am.stop(t + gap);
    }
    c.next = t0 + n * gap + 4 + Math.random() * 12;
  }
  // ---------- A bush warbler (uguisu): a long rising "hoo", then a quick "ho-ke-kyo" ----------
  var warbler = null;
  function makeWarbler(group) {
    var bus = ctx.createGain(), o = new THREE.Object3D(); group.add(o); positional(o, bus, 6, 1.1, 150);
    warbler = { bus: bus, obj: o, next: ctx.currentTime + 8 + Math.random() * 10 };
  }
  function warblerSong() {
    var cher = MP.Nature.trees.filter(function (t) { return t.kind === 'cherry'; }), t = cher[Math.floor(Math.random() * cher.length)];
    if (t) warbler.obj.position.set(t.x, t.y + 0.5, t.z);
    var t0 = ctx.currentTime + 0.05;
    function note(at, f0, f1, dur, amp) {
      var o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine';
      o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + dur);
      g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(amp, at + dur * 0.2); g.gain.linearRampToValueAtTime(amp * 0.8, at + dur * 0.8); g.gain.linearRampToValueAtTime(0, at + dur);
      o.connect(g); g.connect(warbler.bus); o.start(at); o.stop(at + dur + 0.02);
    }
    note(t0, 1150, 1300, 1.3, 0.09);                 // hoo…
    note(t0 + 1.55, 2300, 2500, 0.12, 0.08);         // ho
    note(t0 + 1.72, 3100, 2600, 0.14, 0.08);         // ke
    note(t0 + 1.92, 2900, 1700, 0.32, 0.09);         // kyo
    warbler.next = t0 + 14 + Math.random() * 30;
  }

  // ---------- Footsteps: what you hear depends on what you're standing on ----------
  var steps = { last: null, dist: 0, bus: null, buf: null };
  function surfaceAt(x, z) {
    var S2 = MP.SITE, P = S2.PLAT;
    if (Math.abs(x) <= 3.9 && z < P[1] && z >= S2.MO[1] - 0.8) return 'stone';           // stair and causeway
    if (x < P[0] || x > P[2] || z < P[1] || z > P[3]) return 'grass';
    if (S2.GARDENS.some(function (g) { return x >= g[0] && x <= g[1] && Math.abs(z) > 2; })) return 'grass';
    if (Math.abs(x) <= 11 && z <= -11) return 'stone';                                        // forecourt
    if (Math.abs(z) <= 2) return 'stone';                                                      // spine
    if (Object.keys(S2.BANDS).some(function (k) { return Math.abs(x - S2.BANDS[k]) <= 2; })) return 'stone';
    return 'gravel';
  }
  function makeSteps() { steps.bus = ctx.createGain(); steps.bus.gain.value = 0.5; steps.bus.connect(master); steps.buf = noiseBuffer(1, false); }
  function footstep(kind) {
    var t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = steps.buf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    var cfg = { stone: ['bandpass', 900, 1.2, 0.09, 0.07], gravel: ['bandpass', 2600, 0.7, 0.22, 0.14], grass: ['lowpass', 1300, 0.7, 0.16, 0.05] }[kind];
    f.type = cfg[0]; f.frequency.value = cfg[1] * (0.9 + Math.random() * 0.2); f.Q.value = cfg[2];
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(cfg[4] * (0.8 + Math.random() * 0.4), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + cfg[3]);
    s.connect(f); f.connect(g); g.connect(steps.bus); s.start(t, Math.random() * 0.7); s.stop(t + cfg[3] + 0.05);
    if (kind === 'gravel') setTimeout(function () { if (ctx) footstepGrit(); }, 40); // the crunch settles
  }
  function footstepGrit() {
    var t = ctx.currentTime, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = steps.buf; f.type = 'highpass'; f.frequency.value = 3500; g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    s.connect(f); f.connect(g); g.connect(steps.bus); s.start(t, Math.random() * 0.7); s.stop(t + 0.15);
  }
  function stepTick() {
    if (!steps.bus || !MP.Player.enabled) return;
    var r = R.rig.position, h = MP.Player.head(new THREE.Vector3());
    if (steps.last) {
      var d = Math.hypot(h.x - steps.last.x, h.z - steps.last.z);
      if (d < 3) steps.dist += d; // a jump or teleport isn't a step
      if (steps.dist > 0.72) { steps.dist = 0; footstep(surfaceAt(h.x, h.z)); }
    }
    steps.last = { x: h.x, z: h.z };
  }
  MP.Sound.surfaceAt = surfaceAt;

  // ---------- Things set out in the hall (things.js) ----------
  // Each gets its own voice: a bus placed at the thing, so it sounds from where it stands.
  var things = [], SPOT = { bowl: [1.5, 1.2], furin: [1.4, 1.1], shishi: [1.6, 1.2], koto: [1.3, 1.2] };
  function voice(t) {
    if (t.voice || !SPOT[t.kind] || !ctx) return;
    var bus = ctx.createGain(), sp = SPOT[t.kind]; bus.gain.value = 1;
    t.voice = { bus: bus, p: positional(t.anchor, bus, sp[0], sp[1], 40, hallBus) };
    if (t.kind === 'shishi') { // the trickle into its basin, while it runs
      var src = loop(noiseBuffer(3, false)), bp = ctx.createBiquadFilter(), g = ctx.createGain(); bp.type = 'bandpass'; bp.frequency.value = 2900; bp.Q.value = 1.1; g.gain.value = 0;
      src.connect(bp); bp.connect(g); g.connect(bus); t.voice.trickle = g;
    }
    S.thingState(t);
  }
  S.addThing = function (t) { things.push(t); voice(t); };
  S.removeThing = function (t) {
    var i = things.indexOf(t); if (i >= 0) things.splice(i, 1);
    if (t.voice) { var v = t.voice; v.bus.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(function () { try { v.bus.disconnect(); v.p.disconnect(); } catch (e) { } if (v.p.parent) v.p.parent.remove(v.p); }, 300); t.voice = null; }
  };
  S.thingState = function (t) { if (t.voice && t.voice.trickle) t.voice.trickle.gain.setTargetAtTime(t.on ? 0.05 : 0, ctx.currentTime, 0.2); };
  function partial(dest, t0, f, gain, decay, detune) { // one ringing partial; two oscillators a hair apart make it shimmer
    [0, detune || 0].forEach(function (d, k) {
      if (k && !detune) return;
      var o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.value = f + d;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(gain / (detune ? 2 : 1), t0 + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t0 + decay);
      o.connect(g); g.connect(dest); o.start(t0); o.stop(t0 + decay + 0.05);
    });
  }
  function knock(dest, t0, f, q, gain, len) { // a short filtered noise burst: a tap, a knock, a pluck's bite
    var n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain(); n.buffer = knock.buf || (knock.buf = noiseBuffer(0.5, false));
    bp.type = 'bandpass'; bp.frequency.value = f; bp.Q.value = q; g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + len);
    n.connect(bp); bp.connect(g); g.connect(dest); n.start(t0); n.stop(t0 + len + 0.02);
  }
  // play(t, what, opts): a sound from a thing, now
  S.play = function (t, what, o) {
    if (!t.voice || !S.on) return false; var bus = t.voice.bus, t0 = ctx.currentTime + 0.005; o = o || {};
    if (what === 'strike') { // a singing bowl: inharmonic partials that ring for a long time
      var f0 = o.f || 220;
      [[1, 0.42, 11, 0.7], [2.76, 0.24, 7, 1.3], [5.4, 0.1, 4, 2.1], [8.93, 0.04, 2.2, 3]].forEach(function (p) { partial(bus, t0, f0 * p[0], p[1] * (o.gain || 1), p[2], p[3]); });
      knock(bus, t0, 2400, 2, 0.15, 0.05);
    } else if (what === 'ting') { // a glass wind bell
      var fb = o.f || 2650;
      [[1, 0.1, 1.8], [2.03, 0.05, 1.1], [3.3, 0.025, 0.6]].forEach(function (p) { partial(bus, t0, fb * p[0], p[1] * (o.gain || 1), p[2], 2); });
    } else if (what === 'clack') { // the bamboo arm knocking on its stone
      knock(bus, t0, 1100, 4, 0.9, 0.09); partial(bus, t0, 520, 0.35, 0.16); partial(bus, t0 + 0.002, 170, 0.3, 0.12);
    } else if (what === 'pluck') { // a koto string: a bright twang that settles into a soft tone
      var fk = o.f || 440, ok = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lp = ctx.createBiquadFilter();
      ok.type = 'triangle'; o2.type = 'sawtooth'; ok.frequency.setValueAtTime(fk * 1.012, t0); ok.frequency.exponentialRampToValueAtTime(fk, t0 + 0.06); o2.frequency.value = fk;
      lp.type = 'lowpass'; lp.frequency.setValueAtTime(fk * 8, t0); lp.frequency.exponentialRampToValueAtTime(fk * 1.5, t0 + 0.5);
      var g2 = ctx.createGain(); g2.gain.value = 0.18; o2.connect(g2); g2.connect(lp); ok.connect(lp); lp.connect(g);
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(0.16 * (o.gain || 1), t0 + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.4);
      g.connect(bus); ok.start(t0); o2.start(t0); ok.stop(t0 + 2.5); o2.stop(t0 + 2.5);
      knock(bus, t0, fk * 3, 1.5, 0.08, 0.03);
    }
    return true;
  };
  S.WHITE = 0.07; // how loud the white noise is
  S.hallSound = 'natural';
  try { if (localStorage.getItem('mp.hallsound') === 'white') S.hallSound = 'white'; } catch (e) { }
  S.setHallSound = function (mode) { S.hallSound = mode === 'white' ? 'white' : 'natural'; try { localStorage.setItem('mp.hallsound', S.hallSound); } catch (e) { } return S.hallSound; };

  // ---------- Starting (a browser lets sound start only after a tap, click or trigger pull) ----------
  var group = null;
  S.build = function (g) { group = g; buildChimes(g); R.onFrame(tick); };
  S.wake = function () {
    if (!group) return;
    if (!listener) {
      listener = new THREE.AudioListener(); R.camera.add(listener); ctx = listener.context;
      out = ctx.createGain(); out.gain.value = S.on ? 1 : 0; out.connect(listener.getInput());
      master = ctx.createGain(); master.gain.value = 1; master.connect(out);
      if (MP.DEBUG) { S.analyser = ctx.createAnalyser(); S.analyser.fftSize = 2048; out.connect(S.analyser); }
      var wn = loop(noiseBuffer(4, false)); white = ctx.createGain(); white.gain.value = 0; wn.connect(white); white.connect(out);
      hallBus = ctx.createGain(); hallBus.gain.value = 1; hallBus.connect(master); hallBus.inside = null;
      chimeBus = ctx.createGain(); chimeBus.gain.value = 1;
      positional(chime.group, chimeBus, 2.5, 1.1, 90);
      makeWind(); makeWater(group); makeHum(group); makeRustles(group); makeCicadas(group); makeWarbler(group); makeSteps();
      if (MP.Hall) makeCascade(group);
      S.ready = true;
      things.forEach(voice); // things set out before sound could start
    }
    if (ctx.state !== 'running') ctx.resume();
  };
  S.toggle = function () { S.on = !S.on; if (out) out.gain.setTargetAtTime(S.on ? 1 : 0, ctx.currentTime, 0.1); try { localStorage.setItem('mp.sound', S.on ? '1' : '0'); } catch (e) { } return S.on; };
  try { if (localStorage.getItem('mp.sound') === '0') S.on = false; } catch (e) { }
  function tick(dt, now) {
    chimeTick(dt, now);
    if (!ctx || !S.ready) return;
    rustleTick(dt); stepTick();
    if (S.on) {
      cicadas.forEach(function (c) { if (ctx.currentTime >= c.next) cicadaPhrase(c); });
      if (warbler && ctx.currentTime >= warbler.next) warblerSong();
    }
    var isIn = indoors();
    // white noise in the hall: everything else fades out
    var wn = isIn && S.hallSound === 'white';
    if (wn !== S.whiteNow) { S.whiteNow = wn; master.gain.setTargetAtTime(wn ? 0 : 1, ctx.currentTime, 0.4); white.gain.setTargetAtTime(wn ? S.WHITE : 0, ctx.currentTime, 0.4); }
    if (isIn !== hallBus.inside) { hallBus.inside = isIn; hallBus.gain.setTargetAtTime(isIn ? 1 : 0.06, ctx.currentTime, 0.3); } // the walls muffle the hall's things outside
    if (cascade) { // the cascade is heard in the hall; outside the keep's walls only the faintest trickle reaches you
      if (isIn !== cascade.inside) { cascade.inside = isIn; cascade.bus.gain.setTargetAtTime(isIn ? 1 : 0.06, ctx.currentTime, 0.3); }
      if (isIn && S.on && ctx.currentTime >= cascade.next) drip();
    }
    if (wind.g && ctx) { var gu = W.gust, t = ctx.currentTime, inside = isIn ? 0.3 : 1; wind.g.gain.setTargetAtTime((0.02 + gu * gu * 0.08) * inside, t, 0.4); wind.bp.frequency.setTargetAtTime(320 + gu * 900, t, 0.6); }
  }
  ['pointerdown', 'keydown', 'click'].forEach(function (ev) { addEventListener(ev, function () { S.wake(); }, { capture: true }); });
  R.onSession('start', function () { S.wake(); });
  S.debug = function () { return { hallSound: S.hallSound, white: !!S.whiteNow, world: master ? Math.round(master.gain.value * 100) / 100 : null, things: things.length, voices: things.filter(function (t) { return t.voice; }).length, cascade: !!cascade, ready: S.ready, state: ctx && ctx.state, on: S.on, gust: Math.round(W.gust * 100) / 100, chimeSwing: chime && Math.round(chime.swing * 100) / 100 }; };
  // test helper: loudness now (RMS) and the strongest frequency
  S.level = function () {
    if (!S.analyser) return null; var a = S.analyser, d = new Float32Array(a.fftSize), f = new Float32Array(a.frequencyBinCount); a.getFloatTimeDomainData(d); a.getFloatFrequencyData(f);
    var rms = 0; for (var i = 0; i < d.length; i++) rms += d[i] * d[i]; var k = 0; for (i = 1; i < f.length; i++) if (f[i] > f[k]) k = i;
    var hz = ctx.sampleRate / a.fftSize, band = function (lo, hi) { var e = 0, n = 0; for (var j = Math.floor(lo / hz); j <= Math.ceil(hi / hz); j++) { e += Math.pow(10, f[j] / 10); n++; } return 10 * Math.log10(e / n + 1e-20); };
    return { rms: Math.sqrt(rms / d.length), peakHz: Math.round(k * hz), chimeBandDb: Math.round(band(850, 1550)), cicadaBandDb: Math.round(band(3800, 5200)) };
  };
  S.cicadaNow = function () { cicadas.forEach(cicadaPhrase); };
  S.hushChimes = function (sec) { if (chime) chime.next = W.t + sec; }; // test helper: the clapper rests for a while
  S.hushCicadas = function (sec) { if (ctx) cicadas.forEach(function (c) { c.next = ctx.currentTime + sec; }); }; // test helper: no calls for a while
  S.warblerNow = function () { if (warbler) warblerSong(); };
  S.strikeAll = function () { if (chime) chime.tubes.forEach(function (t, i) { setTimeout(function () { strike(t, 0.9); }, i * 160); }); };
})();
