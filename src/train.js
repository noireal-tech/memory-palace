/* Memory Palace: the training program's state, kept on this headset. Which mode the palace is in (Training, the
   default, or Working), the options flipped on the foyer's options board, where you are in the program (day 0 is the
   baseline; days 1 to 40 are the research protocol), your routes, every list you have memorized and how you did, and
   the benchmark results. The foyer (foyer.js) shows and changes it; the session runner (session.js) adds to it.
   The program itself is in the Memory Palace Training Program doc; plan() below turns a day number into its steps. */
(function () {
  'use strict';
  var MP = window.MP;
  var OPTS = [
    { k: 'plaques', label: 'Station plaques', sub: 'Numbered plaques on every route' },
    { k: 'walkOnly', label: 'Walk-only in sessions', sub: 'Teleport rests while you train' },
    { k: 'lightUse', label: 'Light follows use', sub: 'Lanterns glow by what you remember', later: true },
    { k: 'codeSuggest', label: 'Number code suggestions', sub: '', values: ['both', 'major', 'kana', 'off'], names: { both: 'Major System and kana', major: 'Major System only', kana: 'Kana only', off: 'None: my own images' }, later: true },
    { k: 'voice', label: 'Voice answers', sub: 'Say answers; typing always works' },
    { k: 'drills', label: 'Garden drills', sub: 'Quick code drills by the garden', later: true },
    { k: 'story', label: 'Story mode', sub: 'A story line at each station', later: true }
  ];
  function defaults() {
    return { v: 1, mode: 'training', opts: { plaques: true, walkOnly: true, lightUse: true, codeSuggest: 'both', voice: true, drills: true, story: false },
      log: [], load: { items: 30, sec: 20, streak: 0 }, used: { concrete: {}, abstract: {} }, routes: [], lists: [], battery: [], next: 1 };
  }
  var T = MP.Train = { OPTS: OPTS, state: defaults(), listeners: [] };
  T.clock = function () { return Date.now(); };              // tests move the clock
  T.dateOf = function (ms) { var d = new Date(ms); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  T.today = function () { return T.dateOf(T.clock()); };
  T.daysBetween = function (a, b) { return Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5); };
  T.id = function () { return T.state.next++; };

  // ---------- Keeping it ----------
  var saveTimer = 0;
  T.save = function (now) {
    clearTimeout(saveTimer);
    var go = function () { return MP.store.set('train', T.state); };
    if (now) return go(); saveTimer = setTimeout(go, 300); return Promise.resolve();
  };
  T.load = function () {
    return MP.store.get('train').then(function (s) {
      var d = defaults();
      if (s && s.v === 1) { Object.keys(d).forEach(function (k) { if (s[k] === undefined) s[k] = d[k]; }); Object.keys(d.opts).forEach(function (k) { if (s.opts[k] === undefined) s.opts[k] = d.opts[k]; }); T.state = s; }
      else T.state = d; // the first time, or nothing saved: Training mode
      T.changed();
    });
  };
  T.on = function (fn) { T.listeners.push(fn); };
  T.changed = function () { T.listeners.forEach(function (fn) { try { fn(); } catch (e) { MP.log('train listener', e); } }); };

  // ---------- Mode and options ----------
  T.mode = function () { return T.state.mode; };
  T.training = function () { return T.state.mode === 'training'; };
  T.setMode = function (m) { if (m !== 'training' && m !== 'working') return; T.state.mode = m; T.save(); T.changed(); };
  T.opt = function (k) { return T.state.opts[k]; };
  T.setOpt = function (k, v) { T.state.opts[k] = v; T.save(); T.changed(); };
  T.cycleOpt = function (k) {
    var o = OPTS.filter(function (x) { return x.k === k; })[0]; if (!o) return;
    if (o.values) { var i = o.values.indexOf(T.state.opts[k]); T.setOpt(k, o.values[(i + 1) % o.values.length]); } else T.setOpt(k, !T.state.opts[k]);
  };

  // ---------- Where you are in the program ----------
  // The day you are on: 0 until the baseline is done; then one more for each training day done (light days count).
  T.doneToday = function () { var t = T.today(); return T.state.log.filter(function (e) { return e.date === t; })[0] || null; };
  T.day = function () {
    var L = T.state.log, base = L.some(function (e) { return e.kind === 'baseline'; });
    if (!base) return 0;
    var n = L.filter(function (e) { return e.kind === 'full' || e.kind === 'light'; }).length, d = T.doneToday();
    return d && d.kind !== 'baseline' ? n : n + 1; // after today's session, today's day number stands until tomorrow
  };
  T.phase = function (day) {
    day = day === undefined ? T.day() : day;
    return day === 0 ? { n: 0, name: 'Baseline' } : day <= 10 ? { n: 1, name: 'Foundations' } : day <= 40 ? { n: 2, name: 'The loci block' } : day <= 124 ? { n: 3, name: 'The disciplines' } : { n: 4, name: 'Mastery' };
  };
  // A light day: review only, at most one in any seven days, never on day 0
  T.canLight = function () {
    if (T.day() === 0 || T.doneToday()) return false;
    var t = T.today();
    return !T.state.log.some(function (e) { return e.kind === 'light' && T.daysBetween(e.date, t) < 7; });
  };

  // ---------- The plan for a day ----------
  var P1_LISTS = { 3: 10, 4: 13, 5: 16, 6: 19, 7: 22, 8: 25, 9: 28, 10: 30 };
  var LONG = { 14: 50, 21: 67, 28: 84, 35: 100 };
  T.LESSONS = [
    { name: 'Size', rule: 'Make it huge or tiny.', eg: 'A strawberry the size of the bench.' },
    { name: 'Action', rule: 'Make it move, break, burn or crash.', eg: 'Still pictures fade first.' },
    { name: 'Senses', rule: 'Give it a sound, a smell, a texture, a temperature.', eg: 'The anvil rings, hot to the touch.' },
    { name: 'Feeling', rule: 'Make it funny, gross, absurd or alarming.', eg: 'Strong feeling makes it stick.' },
    { name: 'Contact', rule: 'Make it do something to the station.', eg: 'The strawberry crushes the bench.' }
  ];
  // Where to build route n in Phase 1 (you choose the stations; this is where the walk goes)
  T.ROUTE_SPOTS = ['the Central Hall, round its walls', 'the garden, round the sand', 'your first room', 'a closet', 'another closet'];
  T.plan = function (day) {
    day = day === undefined ? T.day() : day;
    var p = { day: day, phase: T.phase(day), steps: [] }, s = p.steps;
    if (day === 0) { s.push({ t: 'battery' }); return p; }
    s.push({ t: 'review' });
    if (day <= 5) s.push({ t: 'route', n: day });
    else if (day >= 11 && day <= 40 && (day - 11) % 3 === 0) s.push({ t: 'route', n: 5 + (day - 11) / 3 + 1 });
    if (day >= 2 && day <= 6) s.push({ t: 'lesson', n: day - 2 });
    if (LONG[day]) s.push({ t: 'list', kind: 'long', size: LONG[day], material: 'mixed' }); // a long walk replaces the day's list
    else if (P1_LISTS[day]) s.push({ t: 'list', kind: 'daily', size: P1_LISTS[day], material: 'concrete', sec: 20 });
    else if (day > 10) s.push({ t: 'list', kind: 'daily', size: T.state.load.items, material: day >= 30 ? 'mixed' : day >= 20 ? 'abstractMix' : 'concrete', sec: T.state.load.sec });
    if (day === 10) p.gate = true;
    if (day === 40) s.push({ t: 'battery', benchmark: true });
    return p;
  };

  // ---------- Words for a list ----------
  T.material = function (kind, n) {
    var u = T.state.used, W = MP.Words;
    if (kind === 'abstractMix') { var a = Math.round(n / 3); return mix(W.draw('concrete', n - a, u.concrete), W.draw('abstract', a, u.abstract)); }
    if (kind === 'mixed') { var b = Math.round(n / 2); return mix(W.draw('concrete', n - b, u.concrete), W.draw('abstract', b, u.abstract)); }
    return W.draw('concrete', n, u.concrete);
  };
  function mix(a, b) { var out = a.concat(b), r = MP.rng(T.clock() & 0xffff); for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; } return out; }

  // ---------- Checking an answer ----------
  function norm(s) { return String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, ''); }
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9; var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; } for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  // A spoken or typed answer matches a word if it is the word, its plural, or one slip of the finger away (two for long words)
  T.match = function (answer, word) {
    var a = norm(answer), w = norm(word); if (!a || !w) return false;
    if (a === w || a === w + 's' || a === w + 'es' || a + 's' === w) return true;
    if (/^\d+$/.test(w)) return a === w;
    var slack = w.length >= 9 ? 2 : w.length >= 5 ? 1 : 0;
    return slack > 0 && lev(a, w) <= slack;
  };
  // Speech often brings a whole phrase ("I think it was a kettle"): any word of it that matches counts
  T.matchSpoken = function (phrase, word) { if (T.match(phrase, word)) return true; return String(phrase || '').split(/\s+/).some(function (p) { return T.match(p, word); }); };

  // ---------- Lists and their checks ----------
  // A daily list is checked in the session and after 24 hours; a long walk also after 7 days. Then its routes are free.
  T.newList = function (kind, items, routes, sec) {
    var L = { id: T.id(), date: T.today(), day: T.day(), kind: kind, items: items, routes: routes, sec: sec, res: {}, open: true };
    T.state.lists.push(L); routes.forEach(function (rid) { var r = T.route(rid); if (r) { r.holds = L.id; r.lastUsed = L.date; } }); T.save(); return L;
  };
  T.list = function (id) { return T.state.lists.filter(function (l) { return l.id === id; })[0] || null; };
  T.record = function (L, check, answers) {
    var ok = answers.filter(function (a) { return a.ok; }).length;
    L.res[check] = { date: T.today(), correct: ok, total: L.items.length, pct: Math.round(ok / L.items.length * 100), answers: answers };
    var last = L.kind === 'long' ? 'd7' : 'h24';
    if (check === last) { L.open = false; T.release(L); }
    T.save(); T.changed(); return L.res[check];
  };
  T.release = function (L) { L.routes.forEach(function (rid) { var r = T.route(rid); if (r && r.holds === L.id) r.holds = null; }); };
  // what is due for review today: yesterday's lists (24 hours on) and long walks a week on; lists missed too long lapse
  T.due = function () {
    var t = T.today(), out = [];
    T.state.lists.forEach(function (L) {
      if (!L.open || L.kind === 'drill') return;
      var age = T.daysBetween(L.date, t);
      if (!L.res.h24 && age >= 1) { if (age <= 3) out.push({ list: L, check: 'h24' }); else if (L.kind !== 'long') { L.open = false; T.release(L); } }
      else if (L.kind === 'long' && L.res.h24 && !L.res.d7 && age >= 7) { if (age <= 10) out.push({ list: L, check: 'd7' }); else { L.open = false; T.release(L); } }
    });
    return out;
  };
  // the adaptive load: aim for 85% correct; two sessions at 90% or more raise it a step, under 70% lowers it a step.
  // The encode window is ten minutes: a step up means less time per item and so more items in the window.
  T.adapt = function (pct) {
    var L = T.state.load;
    if (pct >= 90) { L.streak++; if (L.streak >= 2) { L.sec = Math.max(4, Math.round(L.sec * 0.9 * 10) / 10); L.streak = 0; } }
    else { L.streak = 0; if (pct < 70) L.sec = Math.min(30, Math.round(L.sec / 0.9 * 10) / 10); }
    L.items = Math.max(10, Math.min(100, Math.floor(600 / L.sec)));
    T.save();
  };

  // ---------- Routes ----------
  T.route = function (id) { return T.state.routes.filter(function (r) { return r.id === id; })[0] || null; };
  // routes free for a new list: not holding one, longest rested first; 48 hours of rest preferred, 24 if that's all
  T.freeRoutes = function (n) {
    var t = T.today(), free = T.state.routes.filter(function (r) { return !r.holds && r.stations.length >= 10; });
    free.sort(function (a, b) { return (a.lastUsed || '0') < (b.lastUsed || '0') ? -1 : 1; });
    var rested = free.filter(function (r) { return !r.lastUsed || T.daysBetween(r.lastUsed, t) >= 2; });
    var pick = rested.slice(0, n); if (pick.length < n) free.forEach(function (r) { if (pick.length < n && pick.indexOf(r) < 0) pick.push(r); });
    return pick;
  };

  // ---------- The benchmark battery: what can run today ----------
  // Trained tests: word list, random digits. Transfer tests (no method allowed): digit span, story recall, the
  // forgetting log. Names and faces and object places join when the faces and the test closet exist.
  T.STORIES = [
    { title: 'The ferry', text: 'On a grey Tuesday morning, Marta Velez missed the seven o\'clock ferry to Port Aldine. She had stopped to buy oranges from a woman with a blue cart. While she waited for the next boat, a small brown dog sat beside her and would not leave. When the ferry came, the dog followed her on board. The captain, an old man with a silver beard, laughed and said the dog rode with him every day. He gave Marta a cup of sweet tea. When they landed, the dog ran straight to a bakery near the harbour, and the baker threw it a roll.',
      units: [['grey', 'gray'], ['tuesday'], ['marta'], ['missed'], ['seven', '7'], ['ferry'], ['aldine'], ['oranges', 'orange'], ['blue', 'cart'], ['dog'], ['brown'], ['followed', 'board'], ['captain'], ['silver', 'beard'], ['tea'], ['bakery', 'baker'], ['harbour', 'harbor'], ['roll', 'bread']] },
    { title: 'The lantern', text: 'Every winter the village of Holt held a lantern walk along the frozen river. This year the oldest lantern, a copper one shaped like a fish, went missing from the church. A boy named Teo found it under the bridge, half buried in snow, with a red ribbon tied to its handle. Nobody knew whose ribbon it was. At the walk, Teo carried the copper fish at the front of the line. When they reached the mill, the ribbon came loose and blew onto the ice, where a woman in a green coat picked it up and smiled as if she had been waiting for it.',
      units: [['winter'], ['holt'], ['lantern'], ['frozen', 'ice'], ['river'], ['copper'], ['fish'], ['missing', 'lost'], ['church'], ['teo'], ['bridge'], ['snow'], ['red'], ['ribbon'], ['front'], ['mill'], ['green', 'coat'], ['smiled', 'waiting']] },
    { title: 'The clockmaker', text: 'In a narrow street behind the market lived a clockmaker called Ines Albar. Her shop had forty clocks, and every one of them showed a different time. A tourist asked her why, and she said each clock kept the time of a city she had visited. The tallest clock, made of black walnut, kept the time of Lisbon, where she was born. One evening the walnut clock stopped. Ines did not repair it. She closed the shop, bought a train ticket, and left for Lisbon the next morning with only a small leather bag.',
      units: [['narrow'], ['market'], ['clockmaker', 'clocks'], ['ines'], ['albar'], ['forty', '40'], ['different', 'time'], ['tourist'], ['city', 'cities'], ['tallest'], ['walnut'], ['black'], ['lisbon'], ['born'], ['stopped'], ['repair', 'fix'], ['train', 'ticket'], ['leather', 'bag']] },
    { title: 'The garden', text: 'When the old school closed, Mr Okafor turned its yard into a garden. He planted beans along the fence and sunflowers by the gate. Children from the street came to help after lessons, and each child was given one square of soil to look after. A girl named Priya grew only purple carrots, which nobody had seen before. In August a storm knocked down the sunflowers, but the beans held on. Mr Okafor said that was the lesson: some things bend and some things break, and both can be planted again.',
      units: [['school'], ['closed'], ['okafor'], ['yard', 'garden'], ['beans'], ['fence'], ['sunflowers', 'sunflower'], ['gate'], ['children', 'kids'], ['square', 'soil'], ['priya'], ['purple'], ['carrots', 'carrot'], ['august'], ['storm'], ['knocked', 'down', 'fell'], ['lesson'], ['bend', 'break']] }
  ];
  T.FORGET = [
    'Forgetting the name of someone you just met',
    'Walking into a room and forgetting why',
    'Losing track of where you put your keys, glasses or phone',
    'Forgetting an appointment or a task you meant to do',
    'Losing the thread of what you were saying',
    'Forgetting what you read a few pages back',
    'Needing a list for a few items you could have kept in mind',
    'Forgetting a number you were told a minute ago',
    'Telling someone the same thing twice',
    'Forgetting something you were asked to pass on'
  ];
  T.FORGET_SCALE = ['Never', 'Rarely', 'Sometimes', 'Often', 'Very often'];
  // the battery taken on a given run: n = 0 for the baseline, then 1, 2, ... (a fresh story each time)
  T.batteryNumber = function () { return T.state.battery.length; };
  T.story = function (n) { return T.STORIES[n % T.STORIES.length]; };
  T.scoreStory = function (story, text) {
    var words = String(text || '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    var hit = story.units.filter(function (u) { return u.some(function (k) { return words.some(function (w) { return T.match(w, k); }); }); });
    return { units: hit.length, of: story.units.length, pct: Math.round(hit.length / story.units.length * 100) };
  };
  // free recall of a word list: each typed or spoken word counts once against the list
  T.scoreFree = function (items, said) {
    var left = items.slice(), got = [];
    said.forEach(function (s) { for (var i = 0; i < left.length; i++) if (T.match(s, left[i])) { got.push(left[i]); left.splice(i, 1); return; } });
    return { correct: got.length, total: items.length, pct: Math.round(got.length / items.length * 100), got: got };
  };
  // digits in order: correct until the end of the row, position by position
  T.scoreDigits = function (digits, typed) {
    var a = String(typed || '').replace(/\D/g, ''), ok = 0;
    for (var i = 0; i < digits.length && i < a.length; i++) if (a[i] === digits[i]) ok++;
    return { correct: ok, total: digits.length, pct: Math.round(ok / digits.length * 100) };
  };
  T.battery = function () { return T.state.battery; };
  T.addBattery = function (rec) { T.state.battery.push(rec); T.save(); T.changed(); };
  T.logDay = function (kind, extra) {
    var e = Object.assign({ date: T.today(), kind: kind, day: kind === 'baseline' ? 0 : T.day() }, extra || {});
    T.state.log = T.state.log.filter(function (x) { return !(x.date === e.date && x.kind === kind); });
    T.state.log.push(e); T.save(); T.changed(); return e;
  };
  // the headline: 24-hour recall of each daily list, by the day it was learned
  T.series24 = function () { return T.state.lists.filter(function (l) { return l.res.h24 && l.kind !== 'drill'; }).map(function (l) { return { day: l.day, pct: l.res.h24.pct }; }); };
})();
