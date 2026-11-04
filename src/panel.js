/* Memory Palace: the hand panel. Washi paper in a bamboo frame above your left wrist, lettered in brush script.
   Like Endless Clay's panel it never crowds: it has separate faces, each with a few large buttons, and flips between
   them like the faces of a prism. Two ways to flip: tap a name in the tab row along the top, or point the right
   controller at the panel and push its stick left or right (while you point at the panel, the stick flips faces
   instead of turning you). The keyboard for naming a room takes the whole panel while you type.
     Go: Endless Clay, back to the forecourt   (later: walk there, jump, search, Dream Journal)
     Make: name this room, speak its name, active subject   (later: the Door tool, recordings, posters)
     Settings: sound   (later: movement, time of day) */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, P = MP.Player;
  var W = 768, H = 640, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  var tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  var holder = new THREE.Group(); holder.position.set(0, 0.085, -0.03); holder.rotation.x = -0.75;
  var board = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24 * H / W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, fog: false, side: THREE.DoubleSide }));
  holder.add(board); holder.visible = false;
  var ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0x2a2018, transparent: true, opacity: 0.8 }));
  ray.visible = false;
  var dot = new THREE.Mesh(new THREE.SphereGeometry(0.003, 8, 6), new THREE.MeshBasicMaterial({ color: 0xa8342a })); dot.visible = false;
  var BRUSH = '"Kaushan Script", cursive', INK = '#1f1a14', SEAL = '#a8342a';
  var FACES = ['Go', 'Make', 'Settings'], face = 0, keyboard = null, buttons = [], hover = -1, note = 'Forecourt';

  // ---------- Faces ----------
  function bt(label, sub, run, x, y, w, h) { return { label: label, sub: sub, run: run, x: x, y: y, w: w, h: h }; }
  function roomNow() { return MP.Rooms ? MP.Rooms.current() : null; }
  function layout() {
    buttons = [];
    if (keyboard) return layoutKeyboard();
    FACES.forEach(function (f, i) { buttons.push(bt(f, '', function () { flip(i - face); }, 40 + i * 232, 34, 220, 78)); buttons[i].tab = true; });
    var y0 = 196, bw = W - 80, bh = 118, gap = 18;
    if (face === 0) {
      buttons.push(bt('Endless Clay', 'Through the portal', function () { MP.Portal.travel(); }, 40, y0, bw, bh));
      buttons.push(bt('The forecourt', 'Back in front of the keep', function () { MP.arrive(); }, 40, y0 + bh + gap, bw, bh));
    } else if (face === 1) {
      var rm = roomNow();
      if (!rm) { buttons.push(bt('No room near', 'Walk up to a room’s door', function () { }, 40, y0, bw, bh)); buttons[buttons.length - 1].dim = true; }
      else {
        buttons.push(bt('Name this room', MP.Rooms.label(rm), function () { MP.Naming.start(rm); }, 40, y0, bw, bh));
        var half = (bw - gap) / 2;
        if (MP.Naming.canSpeak()) buttons.push(bt('Speak it', 'Say the name', function () { MP.Naming.speak(rm); }, 40, y0 + bh + gap, half, bh));
        buttons.push(bt(rm.active ? 'Active' : 'Dormant', rm.active ? 'Top tier lit' : 'Make it active', function () { MP.Rooms.setActive(rm.address, !rm.active); }, MP.Naming.canSpeak() ? 40 + half + gap : 40, y0 + bh + gap, MP.Naming.canSpeak() ? half : bw, bh));
      }
    } else {
      buttons.push(bt('Sound', MP.Sound && MP.Sound.on ? 'On: wind, chimes, water' : 'Off', function () { MP.Sound.toggle(); }, 40, y0, bw, bh));
    }
  }
  // Keyboard: big keys, the name so far across the top
  var ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
  function layoutKeyboard() {
    var kw = 66, kh = 74, gx = 6, top = 150;
    ROWS.forEach(function (row, ri) {
      var x0 = (W - (row.length * (kw + gx) - gx)) / 2;
      row.split('').forEach(function (ch, ci) { buttons.push(bt(ch, '', function () { type(ch); }, x0 + ci * (kw + gx), top + ri * (kh + gx), kw, kh)); });
    });
    var y = top + 3 * (kh + gx) + 6;
    buttons.push(bt('Space', '', function () { type(' '); }, 40, y, 300, kh));
    buttons.push(bt('Delete', '', function () { keyboard.text = keyboard.text.slice(0, -1); }, 352, y, 170, kh));
    buttons.push(bt('Aa', '', function () { keyboard.lower = !keyboard.lower; }, 534, y, 194, kh));
    y += kh + 14;
    buttons.push(bt('Cancel', '', function () { closeKeyboard(false); }, 40, y, 330, kh));
    buttons.push(bt('Done', '', function () { closeKeyboard(true); }, 398, y, 330, kh)); buttons[buttons.length - 1].primary = true;
  }
  function type(ch) {
    if (keyboard.text.length >= 48) return;
    var c = ch === ' ' ? ' ' : (keyboard.lower ? ch.toLowerCase() : ch);
    keyboard.text += c;
    if (ch !== ' ' && !keyboard.lower && keyboard.text.length >= 1) keyboard.lower = true; // capital first, then small letters
    if (ch === ' ') keyboard.lower = false;
  }
  function closeKeyboard(save) {
    var k = keyboard; keyboard = null;
    if (save && k) MP.Rooms.setName(k.room.address, k.text);
    face = 1; layout(); draw();
  }

  // ---------- Drawing: washi paper, a bamboo frame, brush lettering ----------
  var paper = null;
  function paperLayer() {
    var c = document.createElement('canvas'); c.width = W; c.height = H; var g = c.getContext('2d');
    g.fillStyle = '#f2e8d2'; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 900; i++) { // kozo fibres
      g.strokeStyle = 'rgba(150, 120, 80, ' + (0.03 + Math.random() * 0.06) + ')'; g.lineWidth = 0.6 + Math.random();
      var x = Math.random() * W, y = Math.random() * H, a = Math.random() * Math.PI, l = 8 + Math.random() * 30;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + 4, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // bamboo poles round the edge, with nodes, lashed at the corners
    function pole(x, y, w, h, horiz) {
      var grd = horiz ? g.createLinearGradient(0, y, 0, y + h) : g.createLinearGradient(x, 0, x + w, 0);
      grd.addColorStop(0, '#8a7a3c'); grd.addColorStop(0.35, '#d8c27a'); grd.addColorStop(0.6, '#c2a95c'); grd.addColorStop(1, '#6e5f2c');
      g.fillStyle = grd; g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(70, 55, 20, 0.55)';
      var len = horiz ? w : h; for (var p = 90 + Math.random() * 40; p < len - 30; p += 150 + Math.random() * 60) { if (horiz) g.fillRect(x + p, y, 4, h); else g.fillRect(x, y + p, w, 4); }
    }
    var t = 22; pole(0, 0, W, t, true); pole(0, H - t, W, t, true); pole(0, 0, t, H, false); pole(W - t, 0, t, H, false);
    g.fillStyle = '#3b2a1a'; [[0, 0], [W - 34, 0], [0, H - 34], [W - 34, H - 34]].forEach(function (p) { for (var k = 0; k < 4; k++) g.fillRect(p[0] + 4 + k * 7, p[1] + 2, 3, 30); });
    return c;
  }
  function inkBox(g, b, filled) {
    g.save();
    if (filled) { g.fillStyle = 'rgba(31, 26, 20, 0.14)'; g.beginPath(); if (g.roundRect) g.roundRect(b.x, b.y, b.w, b.h, 18); else g.rect(b.x, b.y, b.w, b.h); g.fill(); }
    g.strokeStyle = 'rgba(31, 26, 20, 0.55)'; g.lineWidth = 3; g.lineCap = 'round';
    // a brush outline: slightly uneven strokes rather than a ruled box
    g.beginPath(); g.moveTo(b.x + 10, b.y + 2); g.lineTo(b.x + b.w - 8, b.y + 4); g.lineTo(b.x + b.w - 2, b.y + b.h - 10); g.lineTo(b.x + 12, b.y + b.h - 2); g.lineTo(b.x + 2, b.y + 14); g.closePath(); g.stroke();
    g.restore();
  }
  function draw() {
    var g = canvas.getContext('2d'); if (!paper) paper = paperLayer();
    g.clearRect(0, 0, W, H); g.drawImage(paper, 0, 0);
    g.textBaseline = 'middle'; g.fillStyle = INK;
    if (keyboard) {
      g.font = '40px ' + BRUSH; g.textAlign = 'left'; g.fillText('Name: ' + MP.Rooms.label(keyboard.room), 40, 58, W - 80);
      g.font = '50px ' + BRUSH; var shown = keyboard.text + (Math.floor(performance.now() / 500) % 2 ? '|' : ' ');
      g.fillText(shown, 40, 112, W - 80);
      g.strokeStyle = 'rgba(31, 26, 20, 0.4)'; g.beginPath(); g.moveTo(40, 138); g.lineTo(W - 40, 138); g.stroke();
    } else {
      g.font = '28px ' + BRUSH; g.textAlign = 'left'; g.globalAlpha = 0.7; g.fillText(note, 44, 150, W - 88); g.globalAlpha = 1;
    }
    buttons.forEach(function (b, i) {
      var on = i === hover, cur = b.tab && FACES[face] === b.label;
      inkBox(g, b, on || cur || b.primary);
      g.textAlign = b.sub ? 'left' : 'center'; g.fillStyle = b.dim ? 'rgba(31, 26, 20, 0.5)' : INK;
      var tx = b.sub ? b.x + 28 : b.x + b.w / 2;
      g.font = (b.tab ? 40 : keyboard ? 40 : 52) + 'px ' + BRUSH;
      var label = keyboard && b.label.length === 1 && keyboard.lower ? b.label.toLowerCase() : b.label;
      g.fillText(label, tx, b.sub ? b.y + b.h * 0.38 : b.y + b.h / 2 + 2, b.w - 40);
      if (b.sub) { g.font = '30px ' + BRUSH; g.globalAlpha = 0.68; g.fillText(b.sub, tx, b.y + b.h * 0.75, b.w - 56); g.globalAlpha = 1; }
      if (cur) { g.fillStyle = SEAL; g.beginPath(); g.arc(b.x + b.w - 22, b.y + 20, 7, 0, Math.PI * 2); g.fill(); } // a red seal marks the face you're on
    });
    tex.needsUpdate = true;
  }

  // ---------- Flipping between faces ----------
  var flipT = -1, flipDir = 0, flipTo = 0;
  function flip(by) {
    if (keyboard || !by) return;
    flipTo = (face + by + FACES.length) % FACES.length; flipDir = by > 0 ? 1 : -1; flipT = 0;
  }
  function flipTick(dt) {
    if (flipT < 0) return;
    flipT += dt / 0.32;
    if (flipT >= 0.5 && face !== flipTo) { face = flipTo; layout(); draw(); }
    holder.rotation.y = flipT < 0.5 ? flipDir * flipT * Math.PI : -flipDir * (1 - flipT) * Math.PI; // turn away, then the new face turns in
    if (flipT >= 1) { flipT = -1; holder.rotation.y = 0; }
  }

  // ---------- Pointing and pressing ----------
  var rc = new THREE.Raycaster(), m4 = new THREE.Matrix4(), attached = null, pointing = false, stickReady = true, redrawAcc = 0;
  function attach() {
    var left = P.hand('left'), right = P.hand('right');
    if (left && attached !== left) { left.grip.add(holder); attached = left; }
    if (right && ray.parent !== right.ray) { right.ray.add(ray); R.scene.add(dot); }
    holder.visible = !!left; ray.visible = false; dot.visible = false;
  }
  R.onFrame(function (dt) {
    pointing = false;
    if (!R.presenting()) { holder.visible = false; return; }
    attach(); flipTick(dt);
    var right = P.hand('right'), prev = hover; hover = -1;
    if (right && holder.visible) {
      m4.identity().extractRotation(right.ray.matrixWorld);
      rc.ray.origin.setFromMatrixPosition(right.ray.matrixWorld); rc.ray.direction.set(0, 0, -1).applyMatrix4(m4);
      var hit = rc.intersectObject(board)[0];
      if (hit && hit.uv) {
        pointing = true;
        var px = hit.uv.x * W, py = (1 - hit.uv.y) * H;
        buttons.forEach(function (b, i) { if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) hover = i; });
        ray.visible = true; ray.scale.z = hit.distance; dot.visible = true; dot.position.copy(hit.point);
        // pushing the right stick while pointing at the panel flips its faces
        var gp = right.src && right.src.gamepad, sx = gp ? gp.axes[2] || 0 : 0;
        if (Math.abs(sx) > 0.7 && stickReady) { flip(sx > 0 ? 1 : -1); stickReady = false; }
        if (Math.abs(sx) < 0.3) stickReady = true;
      }
    }
    redrawAcc += dt;
    if (hover !== prev || (keyboard && redrawAcc > 0.5) || (face === 1 && redrawAcc > 1)) { redrawAcc = 0; if (!keyboard) layout(); draw(); } // the Make face follows the room you're near
  });
  P.onSelect = function (rec) {
    if (MP.awaitTrigger) { MP.awaitTrigger = false; MP.Links.go('clay', 'via=palace'); return; }
    if (MP.Sound) MP.Sound.wake(); // a trigger pull lets sound start
    if (rec.hand !== 'right') return;
    if (pointing) { if (hover >= 0) { buttons[hover].run(); if (!keyboard) layout(); draw(); } return; }
    if (MP.Interact) MP.Interact.select(rec);
  };

  layout();
  if (document.fonts && document.fonts.load) document.fonts.load('40px "Kaushan Script"').then(function () { paper = null; draw(); }).catch(function () { draw(); });
  else draw();
  MP.Panel = {
    say: function (t) { note = t; draw(); },
    pointing: function () { return pointing; },
    face: function () { return keyboard ? 'Keyboard' : FACES[face]; },
    flip: function (by) { flip(by); },
    buttons: function () { return buttons.map(function (b) { return b.label; }); },
    press: function (label) { for (var i = 0; i < buttons.length; i++) if (buttons[i].label === label) { buttons[i].run(); if (!keyboard) layout(); draw(); return true; } return false; },
    openKeyboard: function (rm) { keyboard = { room: rm, text: rm.name || '', lower: !!rm.name }; layout(); draw(); },
    tick: function (dt) { flipTick(dt); },
    canvas: canvas
  };
})();
