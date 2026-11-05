/* Memory Palace: naming rooms. Point at a room's brass plaque (or use Make ▸ Name this room near it) and type the name
   on the hand panel's keyboard, or say it if this browser can hear speech inside the app (Make ▸ Speak it). On a flat
   screen, clicking a plaque opens a small text box instead. Names are saved to your plan on this headset.
   Closets are named the same way, from their black nameplates (a closet brings its own label() and setName()). */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var N = MP.Naming = {};
  N.canSpeak = function () { return !!SR; };
  N.start = function (rm) {
    if (!rm) return;
    if (R.presenting()) { MP.Panel.openKeyboard(rm); return; }
    openBox(rm);
  };
  // Speak a name: the first thing heard becomes the room's name.
  N.speak = function (rm) {
    if (!SR || !rm) return false;
    var rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    MP.Panel.say('Listening… say the room’s name');
    rec.onresult = function (e) {
      var t = (e.results[0] && e.results[0][0] && e.results[0][0].transcript || '').trim();
      if (t) { t = t.charAt(0).toUpperCase() + t.slice(1); if (rm.setName) rm.setName(t); else MP.Rooms.setName(rm.address, t); MP.Panel.say('Named: ' + t); }
    };
    rec.onerror = function (e) { MP.Panel.say(e.error === 'not-allowed' ? 'Microphone not allowed; use the keyboard' : 'Didn’t catch that; try again or use the keyboard'); };
    try { rec.start(); return true; } catch (e) { MP.Panel.say('Speech isn’t available here; use the keyboard'); return false; }
  };
  // Flat screen: a small text box over the page
  var box = null;
  function openBox(rm) {
    if (!box) {
      box = document.createElement('form'); box.id = 'nameBox'; box.setAttribute('aria-label', 'Name this room');
      box.innerHTML = '<label for="nameInput">Name this room</label><input id="nameInput" maxlength="48" autocomplete="off"><p class="addr"></p><div class="row"><button type="button" id="nameCancel">Cancel</button><button type="submit" id="nameSave">Save</button></div>';
      document.body.appendChild(box);
      box.querySelector('#nameCancel').addEventListener('click', function () { box.hidden = true; });
      box.addEventListener('submit', function (e) { e.preventDefault(); var v = box.querySelector('#nameInput').value; if (box.target && box.target.setName) box.target.setName(v); else MP.Rooms.setName(box.dataset.addr, v); box.hidden = true; });
      box.addEventListener('keydown', function (e) { if (e.key === 'Escape') box.hidden = true; e.stopPropagation(); });
    }
    box.target = rm; box.dataset.addr = rm.address; box.querySelector('.addr').textContent = rm.setName ? (rm.where || '') : 'Address ' + rm.address;
    box.querySelector('label').textContent = rm.setName ? 'Name this closet' : 'Name this room';
    var inp = box.querySelector('#nameInput'); inp.value = rm.name || ''; box.hidden = false; inp.focus(); inp.select();
  }
})();
