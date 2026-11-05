/* Memory Palace: the training session on a flat screen. A small paper card in the corner shows what the hand panel's
   Train face shows in the headset: the step, a line or two, the item to place in large letters, its buttons, and a
   text box for answers (press Enter to give one). In the headset this card stays hidden. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, S = MP.Session;
  var el = document.createElement('aside'); el.id = 'train'; el.hidden = true; el.setAttribute('aria-live', 'polite'); el.setAttribute('aria-label', 'Training session');
  el.innerHTML = '<h2></h2><p class="lines"></p><p class="big"></p><form><label for="trainAnswer" class="vh">Your answer</label><input id="trainAnswer" autocomplete="off" spellcheck="false"><button type="submit">Give</button></form><div class="buttons"></div><p class="progress"></p>';
  document.body.appendChild(el);
  var h2 = el.querySelector('h2'), lines = el.querySelector('.lines'), big = el.querySelector('.big'), form = el.querySelector('form'), inp = el.querySelector('input'), bts = el.querySelector('.buttons'), prog = el.querySelector('.progress');
  form.addEventListener('submit', function (e) { e.preventDefault(); var v = inp.value; inp.value = ''; if (S.input.fn) S.input.give(v); });
  inp.addEventListener('keydown', function (e) { e.stopPropagation(); });
  var last = '';
  function render(force) {
    var v = S.view(), tool = MP.Routes.tool.active;
    var show = !R.presenting() && (!!v || tool);
    el.hidden = !show; if (!show) { last = ''; return; }
    if (!v) v = { title: 'Placing stations', lines: ['Click the floor by each one, in the order you’ll walk them.'], buttons: [] };
    var key = JSON.stringify([v.title, v.lines, v.big, (v.buttons || []).map(function (b) { return b.label + b.sub + !!b.dim; }), v.input, v.progress]);
    if (key === last && !force) return; last = key;
    h2.textContent = v.title; lines.textContent = (v.lines || []).join(' '); big.textContent = v.big || ''; big.hidden = !v.big;
    form.hidden = !v.input || !S.input.fn; inp.inputMode = v.input === 'digits' ? 'numeric' : 'text'; inp.placeholder = v.input === 'digits' ? 'Digits' : 'Type, then Enter';
    bts.innerHTML = '';
    (v.buttons || []).forEach(function (b) {
      if (b.label === 'Type it') return; // the text box is right there
      var x = document.createElement('button'); x.type = 'button'; x.textContent = b.label; if (b.sub) x.title = b.sub; if (b.primary) x.className = 'primary'; if (b.dim) x.classList.add('dim');
      x.addEventListener('click', function () { b.run(); S.changed(); }); bts.appendChild(x);
    });
    prog.textContent = v.progress || '';
    if (!form.hidden && document.activeElement !== inp && !MP.DEBUG) inp.focus({ preventScroll: true });
  }
  S.on(function () { render(true); });
  var acc = 0; R.onFrame(function (dt) { acc += dt; if (acc > 0.25) { acc = 0; render(false); } });
  // a click in the world goes to the session when it wants the trigger (encode: next; find a station: that one)
  var down = null, canvas = MP.$('#scene');
  canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', function (e) {
    if (R.presenting() || !down || !S.active || MP.Routes.tool.active) return; var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); down = null; if (moved > 6) return;
    var rc = new THREE.Raycaster(); rc.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), R.camera);
    if (MP.Interact.pick(rc.ray.clone())) return; // a board or a door under the cursor has it
    if (S.trigger(rc.ray.origin.clone(), rc.ray.direction.clone())) e.stopImmediatePropagation();
  }, true);
})();
