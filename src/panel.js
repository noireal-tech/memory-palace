/* Memory Palace: the hand panel. A small board above the left wrist; point at it with the right controller and pull
   the trigger to press a button. Later steps add Walk there / Jump, search, the Door tool and the Dream Journal. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, P = MP.Player;
  var W = 640, H = 420, canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  var tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  var board = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2 * H / W), new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false, fog: false }));
  board.position.set(0, 0.075, -0.02); board.rotation.x = -0.75; board.visible = false;
  var ray = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, -1)]), new THREE.LineBasicMaterial({ color: 0xf4ead8, transparent: true, opacity: 0.7 }));
  ray.visible = false;
  var dot = new THREE.Mesh(new THREE.SphereGeometry(0.004, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd4ad55 }));
  dot.visible = false;
  var buttons = [], hover = -1, note = '';
  var F = '"Bricolage Grotesque", system-ui, sans-serif';

  // Buttons: { label, sub, run, x, y, w, h } in canvas pixels.
  function layout() {
    buttons = [
      { label: 'Endless Clay', sub: 'Travel through the portal', run: function () { MP.Portal.travel(); }, x: 28, y: 150, w: W - 56, h: 104 },
      { label: 'Back to the forecourt', sub: 'Stand in front of the keep', run: function () { MP.arrive(); }, x: 28, y: 270, w: W - 56, h: 104 }
    ];
  }
  function draw() {
    var g = canvas.getContext('2d'); g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(24, 20, 16, 0.9)'; g.beginPath(); if (g.roundRect) g.roundRect(4, 4, W - 8, H - 8, 36); else g.rect(4, 4, W - 8, H - 8); g.fill();
    g.fillStyle = '#d4ad55'; g.font = '600 28px ' + F; g.fillText('MEMORY PALACE', 30, 58);
    g.fillStyle = '#f4ead8'; g.font = '500 32px ' + F; g.fillText(note || 'Forecourt', 30, 108, W - 60);
    buttons.forEach(function (bt, i) {
      g.fillStyle = i === hover ? '#d4ad55' : 'rgba(244, 234, 216, 0.1)'; g.beginPath(); if (g.roundRect) g.roundRect(bt.x, bt.y, bt.w, bt.h, 20); else g.rect(bt.x, bt.y, bt.w, bt.h); g.fill();
      g.fillStyle = i === hover ? '#1b1712' : '#f4ead8'; g.font = '700 36px ' + F; g.fillText(bt.label, bt.x + 24, bt.y + 48);
      g.globalAlpha = 0.75; g.font = '500 24px ' + F; g.fillText(bt.sub, bt.x + 24, bt.y + 84); g.globalAlpha = 1;
    });
    tex.needsUpdate = true;
  }
  layout(); draw();

  var rc = new THREE.Raycaster(), m4 = new THREE.Matrix4(), attached = null;
  function attach() {
    var left = P.hand('left'), right = P.hand('right');
    if (left && attached !== left) { left.grip.add(board); attached = left; }
    if (right && ray.parent !== right.ray) { right.ray.add(ray); R.scene.add(dot); }
    board.visible = !!left; ray.visible = false; dot.visible = false;
  }
  R.onFrame(function () {
    if (!R.presenting()) { board.visible = false; return; }
    attach();
    var right = P.hand('right'); hover = -1;
    if (right && board.visible) {
      m4.identity().extractRotation(right.ray.matrixWorld);
      rc.ray.origin.setFromMatrixPosition(right.ray.matrixWorld); rc.ray.direction.set(0, 0, -1).applyMatrix4(m4);
      var hit = rc.intersectObject(board)[0];
      if (hit && hit.uv) {
        var px = hit.uv.x * W, py = (1 - hit.uv.y) * H;
        buttons.forEach(function (bt, i) { if (px >= bt.x && px <= bt.x + bt.w && py >= bt.y && py <= bt.y + bt.h) hover = i; });
        ray.visible = true; ray.scale.z = hit.distance; dot.visible = true; dot.position.copy(hit.point);
      }
    }
    if (hover !== draw.hover) { draw.hover = hover; draw(); }
  });
  P.onSelect = function (rec) {
    if (MP.awaitTrigger) { MP.awaitTrigger = false; MP.Links.go('clay', 'via=palace'); return; }
    if (rec.hand === 'right' && hover >= 0) { var bt = buttons[hover]; bt.run(); }
  };
  MP.Panel = { say: function (t) { note = t; draw(); }, buttons: function () { return buttons; }, press: function (i) { buttons[i].run(); } };
})();
