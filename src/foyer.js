/* Memory Palace: the foyer's working parts. The sliding lattice doors at the entrance (point at them and pull the
   trigger, or click, to slide them open or shut; they start open), and the boards on its walls:
   - west wall: the mode board (two wooden tags, Training and Working: the palace starts in Training) and the options
     board (a tag for each training feature, flipped on or off);
   - east wall: the training board (today's session: start it here; during the baseline it shows what to study) and
     the trophy wall (your 24-hour recall by day against your baseline, and the benchmark results).
   The building itself is the skin's (pagoda.js SK.foyer). */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, T = MP.Train, W = MP.World;
  var Fy = MP.Foyer = {}, BRUSH = '"Kaushan Script", cursive', SERIF = 'Georgia, serif', INK = '#1f1a14', SEAL = '#a8342a', LACQUER = '#8e2a1f';
  var group = new THREE.Group(); group.name = 'foyer'; R.scene.add(group);

  // ---------- The sliding doors ----------
  var doors = { open: 1, target: 1, leaves: [] };
  function buildDoors() {
    var F = MP.FOYER, D = F.DOOR, M = MP.M; // two leaves, each covering half the opening; open, they slide behind the wall
    [-1, 1].forEach(function (s) {
      var leaf = new THREE.Group(), b = new MP.R.Batch(leaf), w = D.x, h = D.h - 0.02;
      // a dark frame, close vertical slats, two rails, paper behind the lower half
      MP.Geo.box(b, M.timber, -w / 2, 0, -0.03, -w / 2 + 0.07, h, 0.03); MP.Geo.box(b, M.timber, w / 2 - 0.07, 0, -0.03, w / 2, h, 0.03);
      MP.Geo.box(b, M.timber, -w / 2, 0, -0.03, w / 2, 0.1, 0.03); MP.Geo.box(b, M.timber, -w / 2, h - 0.08, -0.03, w / 2, h, 0.03);
      MP.Geo.box(b, M.timber, -w / 2, h * 0.42, -0.025, w / 2, h * 0.42 + 0.05, 0.025);
      for (var x = -w / 2 + 0.12; x < w / 2 - 0.08; x += 0.075) MP.Geo.box(b, M.timber, x, 0.1, -0.015, x + 0.022, h - 0.08, 0.015);
      MP.Geo.panel(b, M.shoji, 0, 0.1 + h * 0.16, 0.0, w - 0.14, h * 0.3, 'z-');
      b.flush(); leaf.userData.s = s; group.add(leaf); doors.leaves.push(leaf);
      MP.Interact.add(leaf, { label: 'Slide the doors', use: function () { Fy.setDoors(doors.target > 0.5 ? 0 : 1); } });
    });
    place();
  }
  function place() {
    var F = MP.FOYER, D = F.DOOR;
    doors.leaves.forEach(function (leaf) { var s = leaf.userData.s, shut = s * D.x / 2, open = s * D.x * 1.5; leaf.position.set(MP.lerp(shut, open, doors.open), 0.03, D.z + (s < 0 ? 0.035 : -0.035)); });
    var solid = doors.open < 0.6; if (solid !== doors.solid) { doors.solid = solid; W.drop('foyer:doors'); if (solid) W.solid(-D.x, D.z - 0.1, D.x, D.z + 0.1, D.h, 'foyer:doors'); }
  }
  Fy.setDoors = function (v) { doors.target = v; MP.store.set('foyerDoors', v); };
  Fy.doors = function () { return Math.round(doors.open * 100) / 100; };
  R.onFrame(function (dt) { if (!doors.leaves.length || doors.open === doors.target) return; var d = doors.target - doors.open, st = dt / 0.6; doors.open = Math.abs(d) <= st ? doors.target : doors.open + Math.sign(d) * st; place(); });

  // ---------- Boards: a canvas in a timber frame, hung on a wall, with buttons you point at ----------
  function board(o) {
    var c = document.createElement('canvas'); c.width = o.px[0]; c.height = o.px[1];
    var tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    var frame = new THREE.Group(), b = new MP.R.Batch(frame), M = MP.M, t = 0.05, d = 0.04;
    MP.Geo.box(b, M.inTimber, -o.w / 2 - t, -o.h / 2 - t, -d, o.w / 2 + t, -o.h / 2, 0.01); MP.Geo.box(b, M.inTimber, -o.w / 2 - t, o.h / 2, -d, o.w / 2 + t, o.h / 2 + t, 0.01);
    MP.Geo.box(b, M.inTimber, -o.w / 2 - t, -o.h / 2, -d, -o.w / 2, o.h / 2, 0.01); MP.Geo.box(b, M.inTimber, o.w / 2, -o.h / 2, -d, o.w / 2 + t, o.h / 2, 0.01);
    b.flush();
    var holder = new THREE.Group(); holder.add(mesh, frame); mesh.position.z = 0.012;
    holder.position.set(o.at[0], o.at[1], o.at[2]); holder.rotation.y = o.facing === 'x+' ? Math.PI / 2 : -Math.PI / 2; group.add(holder);
    var B = { canvas: c, g: c.getContext('2d'), tex: tex, mesh: mesh, buttons: [], o: o,
      redraw: function () { B.buttons = []; o.draw(B); tex.needsUpdate = true; },
      button: function (x, y, w, h, run, label) { B.buttons.push({ x: x, y: y, w: w, h: h, run: run, label: label || '' }); },
      click: function (uv) { var px = uv.x * c.width, py = (1 - uv.y) * c.height; for (var i = 0; i < B.buttons.length; i++) { var k = B.buttons[i]; if (px >= k.x && px <= k.x + k.w && py >= k.y && py <= k.y + k.h) { k.run(); return k.label || true; } } return false; },
      press: function (label) { var k = B.buttons.filter(function (x) { return x.label === label; })[0]; if (!k) return false; k.run(); return true; },
      labels: function () { return B.buttons.map(function (k) { return k.label; }); }
    };
    MP.Interact.add(mesh, { label: o.label, use: function (hit) { if (hit && hit.uv) B.click(hit.uv); } });
    return B;
  }
  // washi paper with a little fibre, like the hand panel
  function paper(g, w, h, tint) {
    g.fillStyle = tint || '#f2e8d2'; g.fillRect(0, 0, w, h);
    var r = MP.rng(w + h); for (var i = 0; i < w * h / 900; i++) { g.strokeStyle = 'rgba(150, 120, 80, ' + (0.03 + r() * 0.06) + ')'; g.lineWidth = 0.6 + r(); var x = r() * w, y = r() * h, a = r() * Math.PI, l = 8 + r() * 30; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  }
  function text(g, s, x, y, size, o) { o = o || {}; g.font = (o.bold ? 'bold ' : '') + size + 'px ' + (o.font || BRUSH); g.fillStyle = o.color || INK; g.textAlign = o.align || 'left'; g.textBaseline = 'middle'; g.globalAlpha = o.alpha || 1; g.fillText(s, x, y, o.max || 4000); g.globalAlpha = 1; }
  function inkBtn(B, x, y, w, h, label, sub, run, o) {
    var g = B.g; o = o || {};
    g.save(); if (o.primary) { g.fillStyle = 'rgba(168, 52, 42, 0.12)'; g.fillRect(x, y, w, h); }
    g.strokeStyle = o.primary ? SEAL : 'rgba(31, 26, 20, 0.6)'; g.lineWidth = 4; g.strokeRect(x + 2, y + 2, w - 4, h - 4); g.restore();
    text(g, label, x + w / 2, sub ? y + h * 0.4 : y + h / 2, sub ? 44 : 48, { align: 'center', max: w - 30, alpha: o.dim ? 0.45 : 1 });
    if (sub) text(g, sub, x + w / 2, y + h * 0.76, 28, { align: 'center', max: w - 30, alpha: 0.65 });
    B.button(x, y, w, h, run, label);
  }
  // a wooden tag: lacquered red with gold letters when on, plain wood with dark letters when off
  function tag(B, x, y, w, h, label, sub, on, run, state) {
    var g = B.g;
    g.fillStyle = on ? LACQUER : '#b89466'; g.fillRect(x, y, w, h);
    g.strokeStyle = on ? '#d8b25a' : '#6b4a2e'; g.lineWidth = 5; g.strokeRect(x + 3, y + 3, w - 6, h - 6);
    g.fillStyle = '#2a1c10'; g.beginPath(); g.arc(x + 26, y + h / 2, 8, 0, Math.PI * 2); g.fill(); // the peg it hangs on
    text(g, label, x + 52, sub ? y + h * 0.36 : y + h / 2, 40, { color: on ? '#f4dc9a' : '#2a1c10', max: w - 230 });
    if (sub) text(g, sub, x + 52, y + h * 0.74, 26, { color: on ? '#f0d9b0' : '#3a2616', alpha: 0.85, max: w - 230 });
    text(g, state || (on ? 'On' : 'Off'), x + w - 24, y + h / 2, 38, { align: 'right', color: on ? '#f4dc9a' : '#2a1c10', font: SERIF, bold: true, max: 190 });
    B.button(x, y, w, h, run, label);
  }

  var boards = {};
  function buildBoards() {
    var I = MP.FOYER.IN, xw = I[0] + 0.07, xe = I[2] - 0.07;
    // mode board
    // mode board: the current mode's tag is lacquered red
    boards.mode = board({ label: 'Mode board', w: 1.3, h: 0.86, px: [1040, 688], at: [xw, 1.55, -15.9], facing: 'x+', draw: function (B) {
      var g = B.g, tr = T.training(); paper(g, 1040, 688, '#e9dcc0'); text(g, 'The palace is in', 520, 70, 54, { align: 'center' });
      tag(B, 60, 140, 920, 220, 'Training', 'Plaques, the Train face, sessions', tr, function () { T.setMode('training'); }, tr ? 'Now' : 'Flip');
      tag(B, 60, 400, 920, 220, 'Working', 'Real memories, no training overlays', !tr, function () { T.setMode('working'); }, tr ? 'Flip' : 'Now');
    } });
    // options board
    boards.opts = board({ label: 'Options board', w: 1.7, h: 1.25, px: [1088, 800], at: [xw, 1.6, -13.75], facing: 'x+', draw: function (B) {
      var g = B.g; paper(g, 1088, 800, '#e9dcc0'); text(g, 'Training options', 544, 54, 50, { align: 'center' });
      text(g, T.training() ? 'Flip a tag to turn it on or off.' : 'Working mode: these rest until you flip back to Training.', 544, 100, 28, { align: 'center', alpha: 0.7 });
      T.OPTS.forEach(function (o, i) {
        var v = T.opt(o.k), on = o.values ? v !== 'off' : !!v, sub = o.values ? o.names[v] : o.sub;
        if (o.later) sub = (sub ? sub + ' · ' : '') + 'arrives in a later build';
        tag(B, 40, 134 + i * 92, 1008, 82, o.label, sub, on, function () { T.cycleOpt(o.k); });
      });
    } });
    // training board
    boards.train = board({ label: 'Training board', w: 1.9, h: 1.25, px: [1216, 800], at: [xe, 1.62, -15.55], facing: 'x-', draw: drawTraining });
    // trophy wall
    boards.trophy = board({ label: 'Trophy wall', w: 1.6, h: 1.1, px: [1164, 800], at: [xe, 1.62, -13.2], facing: 'x-', draw: drawTrophy });
    Object.keys(boards).forEach(function (k) { boards[k].redraw(); });
  }

  function drawTraining(B) {
    var g = B.g, w = 1216, h = 800; paper(g, w, h);
    var day = T.day(), ph = T.phase(day), v = MP.Session && MP.Session.view();
    text(g, day === 0 ? 'Day 0 · the baseline' : 'Day ' + day + (day <= 40 ? ' of 40' : '') + ' · Phase ' + ph.n + ': ' + ph.name, 40, 56, 50);
    g.strokeStyle = 'rgba(31,26,20,0.35)'; g.lineWidth = 2; g.beginPath(); g.moveTo(40, 96); g.lineTo(w - 40, 96); g.stroke();
    if (!T.training()) { text(g, 'Working mode: training is resting.', 40, 170, 44); text(g, 'Flip the mode board on the other wall to Training to train.', 40, 230, 32, { alpha: 0.7 }); return; }
    if (v) { // a session is running: what to study, or where you are
      var bd = v.board;
      if (bd && bd.kind === 'words') {
        text(g, v.title, 40, 140, 38); g.font = '26px ' + SERIF; g.fillStyle = INK; g.textAlign = 'left';
        bd.items.forEach(function (wd, i) { g.fillText(wd, 40 + Math.floor(i / 18) * 290, 196 + (i % 18) * 33); });
        return;
      }
      if (bd && bd.kind === 'digits') {
        text(g, v.title, 40, 140, 38);
        for (var r = 0; r < 4; r++) { var row = bd.items.slice(r * 20, r * 20 + 20).replace(/(\d{4})/g, '$1 '); text(g, row, 60, 240 + r * 110, 62, { font: SERIF }); }
        return;
      }
      if (bd && bd.kind === 'span') { text(g, v.title, 40, 140, 38); text(g, bd.digit || '', w / 2, 460, 300, { align: 'center', font: SERIF, bold: true }); return; }
      if (bd && bd.kind === 'story') { text(g, v.title, 40, 140, 38); wrap(g, bd.text, 40, 200, w - 80, 40, 30); return; }
      text(g, v.title, 40, 160, 46, { max: w - 80 }); (v.lines || []).forEach(function (l, i) { text(g, l, 40, 230 + i * 50, 32, { alpha: 0.8, max: w - 80 }); });
      if (bd && bd.kind === 'text') text(g, bd.text, w / 2, 470, 60, { align: 'center' });
      text(g, v.progress + ' · on your hand panel’s Train face', 40, h - 50, 28, { alpha: 0.6 });
      inkBtn(B, w - 330, h - 120, 290, 90, 'Stop', 'End the session', function () { MP.Session.stop(); });
      return;
    }
    var done = T.doneToday(), plan = T.plan(day);
    if (done) { text(g, done.kind === 'baseline' ? 'Baseline done. Day 1 starts tomorrow.' : 'Today’s session is done.', 40, 170, 44); text(g, MP.Session && MP.Session.msg || 'Come back tomorrow: the 24-hour recall counts most.', 40, 230, 32, { alpha: 0.7 }); return; }
    var lines = describe(plan); lines.forEach(function (l, i) { text(g, (i + 1) + '. ' + l, 60, 150 + i * 52, 34, { max: w - 120 }); });
    inkBtn(B, 40, h - 200, 560, 150, day === 0 ? 'Run the baseline' : 'Start today’s session', 'About ' + (day === 0 ? '45' : '30') + ' minutes', function () { MP.Session.start(false); }, { primary: true });
    if (day > 0) inkBtn(B, 620, h - 200, 556, 150, 'Light day', T.canLight() ? 'Review only, 5 to 10 minutes' : 'One a week: not today', function () { if (T.canLight()) MP.Session.start(true); }, { dim: !T.canLight() });
  }
  function describe(plan) {
    var out = [], due = T.due();
    if (plan.day === 0) return ['A word list: 10 minutes to study, then recall', 'Random digits, digit span, a short story', 'Ten questions about everyday memory', 'The word list and story come back tomorrow'];
    if (due.length) out.push('Review: ' + due.length + ' list' + (due.length > 1 ? 's' : '') + ' from before, markers hidden');
    plan.steps.forEach(function (s) {
      if (s.t === 'route') out.push('Build route ' + s.n + ' (10 stations), walk it, find its stations');
      if (s.t === 'lesson') out.push('Lesson: ' + T.LESSONS[s.n].name + ', then a 10-word drill');
      if (s.t === 'list') out.push((s.kind === 'long' ? 'The long walk: ' : 'Today’s list: ') + s.size + ' ' + (s.material === 'concrete' ? 'words' : 'words, some abstract') + ', then a gap and recall');
      if (s.t === 'battery') out.push('The day-40 benchmark');
    });
    out.push('Log last night’s sleep and today’s exercise');
    return out.slice(0, 7);
  }
  function wrap(g, s, x, y, maxW, lh, size) {
    g.font = size + 'px ' + SERIF; g.fillStyle = INK; g.textAlign = 'left'; var line = '', yy = y;
    s.split(' ').forEach(function (wd) { var t = line ? line + ' ' + wd : wd; if (g.measureText(t).width > maxW) { g.fillText(line, x, yy); line = wd; yy += lh; } else line = t; }); if (line) g.fillText(line, x, yy);
  }
  function drawTrophy(B) {
    var g = B.g, w = 1164, h = 800; paper(g, w, h, '#efe4cc');
    text(g, 'Your 24-hour recall', 40, 54, 48);
    var pts = T.series24(), base = T.battery()[0], bpct = base && base.words && base.words.h24 ? base.words.h24.pct : base && base.words && base.words.now ? base.words.now.pct : null;
    var x0 = 110, x1 = w - 50, y0 = 120, y1 = 470, maxDay = Math.max(40, pts.reduce(function (m, p) { return Math.max(m, p.day); }, 0));
    var X = function (d) { return x0 + (d / maxDay) * (x1 - x0); }, Y = function (p) { return y1 - p / 100 * (y1 - y0); };
    g.strokeStyle = 'rgba(31,26,20,0.18)'; g.lineWidth = 2; [0, 25, 50, 75, 100].forEach(function (p) { g.beginPath(); g.moveTo(x0, Y(p)); g.lineTo(x1, Y(p)); g.stroke(); text(g, p + '%', x0 - 14, Y(p), 24, { align: 'right', font: SERIF, alpha: 0.6 }); });
    [0, 10, 20, 30, 40].forEach(function (d) { if (d <= maxDay) text(g, 'day ' + d, X(d), y1 + 30, 24, { align: 'center', font: SERIF, alpha: 0.6 }); });
    if (bpct != null) { g.setLineDash([12, 10]); g.strokeStyle = 'rgba(31,26,20,0.55)'; g.beginPath(); g.moveTo(x0, Y(bpct)); g.lineTo(x1, Y(bpct)); g.stroke(); g.setLineDash([]); text(g, 'baseline ' + bpct + '%', x1, Y(bpct) - 18, 24, { align: 'right', font: SERIF, alpha: 0.75 }); }
    if (pts.length) {
      g.strokeStyle = SEAL; g.lineWidth = 5; g.beginPath(); pts.forEach(function (p, i) { if (i) g.lineTo(X(p.day), Y(p.pct)); else g.moveTo(X(p.day), Y(p.pct)); }); g.stroke();
      g.fillStyle = SEAL; pts.forEach(function (p) { g.beginPath(); g.arc(X(p.day), Y(p.pct), 7, 0, Math.PI * 2); g.fill(); });
      var last = pts[pts.length - 1]; text(g, last.pct + '%', X(last.day) + 14, Y(last.pct) - 16, 32, { font: SERIF, bold: true, color: SEAL });
    } else text(g, 'Your first point appears the day after your first list.', (x0 + x1) / 2, (y0 + y1) / 2, 30, { align: 'center', alpha: 0.6 });
    // the benchmark: baseline against the latest, trained and transfer side by side
    var bs = T.battery(); text(g, 'Benchmark', 40, 560, 40);
    if (!bs.length) { text(g, 'Run the baseline at the training board to start the record.', 40, 620, 28, { alpha: 0.65 }); return; }
    var a = bs[0], z = bs[bs.length - 1], rows = [
      ['Trained', 'Word list', pct(a.words.now), pct(z.words.now)], ['Trained', 'Random digits', pct(a.digits.now), pct(z.digits.now)],
      ['Transfer', 'Digit span, fwd / back', (a.spanF || 0) + ' / ' + (a.spanB || 0), (z.spanF || 0) + ' / ' + (z.spanB || 0)], ['Transfer', 'Story recall', pct(a.story && a.story.now), pct(z.story && z.story.now)]];
    text(g, 'Baseline', 760, 560, 26, { font: SERIF, align: 'center', alpha: 0.7 }); text(g, bs.length > 1 ? 'Latest' : '', 980, 560, 26, { font: SERIF, align: 'center', alpha: 0.7 });
    rows.forEach(function (r, i) { var y = 610 + i * 42; text(g, r[0], 40, y, 26, { font: SERIF, alpha: 0.6 }); text(g, r[1], 200, y, 30, { font: SERIF }); text(g, r[2], 760, y, 30, { font: SERIF, align: 'center' }); if (bs.length > 1) text(g, r[3], 980, y, 30, { font: SERIF, align: 'center', bold: true }); });
  }
  function pct(r) { return r ? r.pct + '%' : '–'; }

  Fy.build = function () {
    buildDoors(); buildBoards();
    return MP.store.get('foyerDoors').then(function (v) { if (typeof v === 'number') { doors.open = doors.target = v; place(); } });
  };
  Fy.redraw = function () { Object.keys(boards).forEach(function (k) { boards[k].redraw(); }); };
  Fy.board = function (k) { return boards[k]; };
  // the boards follow the training state and the session (the session board also ticks its clocks)
  T.on(function () { if (boards.mode) Fy.redraw(); });
  if (MP.Session) MP.Session.on(function () { if (boards.train) { boards.train.redraw(); boards.trophy.redraw(); } });
  var acc = 0;
  R.onFrame(function (dt) { acc += dt; if (acc > 0.5 && boards.train && MP.Session && MP.Session.active) { acc = 0; boards.train.redraw(); } });
  Fy.inside = function (p) { var I = MP.FOYER.IN; return W.space === 'world' && p.x > I[0] && p.x < I[2] && p.z > I[1] && p.z < I[3]; };
})();
