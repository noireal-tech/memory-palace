/* Memory Palace: the training session. Started from the training board in the foyer, it runs today's plan from the
   Training Program (train.js plan()): review what's due, build and learn a route, a lesson with a short drill,
   today's list (encode, a gap, recall, then your misses), and a moment to log sleep and exercise. Day 0 and day 40
   run the benchmark battery instead.
   It shows itself on the hand panel's Train face in the headset, and as a small card on a flat screen. Answers can be
   typed (the panel's keyboard, or the card's text box) or said aloud when the Voice answers tag is on. */
(function () {
  'use strict';
  var MP = window.MP, R = MP.R, T = MP.Train, Rt = MP.Routes;
  var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var S = MP.Session = { active: false, step: null, steps: [], i: 0, light: false, msg: '' };
  function fmt(sec) { sec = Math.max(0, Math.ceil(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); }
  function btn(label, sub, run, o) { return Object.assign({ label: label, sub: sub || '', run: run }, o || {}); }
  function voiceOn() { return !!SR && T.opt('voice'); }

  // ---------- Starting and stopping ----------
  S.canStart = function () { return T.training() && !S.active && !T.doneToday(); };
  S.start = function (light) {
    if (!S.canStart()) return false;
    if (light && !T.canLight()) return false;
    var plan = T.plan(); S.plan = plan; S.light = !!light; S.steps = []; S.i = 0;
    var due = T.due(), bdue = batteryDue();
    if (bdue) S.steps.push(batteryRecheck(bdue));
    due.forEach(function (d) { S.steps.push(recallStep(d.list, d.check, true)); });
    if (light) S.steps.push(habitsStep('light'));
    else {
      plan.steps.forEach(function (st) {
        if (st.t === 'battery') S.steps.push(batteryStep(!!st.benchmark));
        else if (st.t === 'route') S.steps.push(routeStep(st.n));
        else if (st.t === 'lesson') S.steps.push(lessonStep(st.n));
        else if (st.t === 'list') S.steps.push(listStep(st));
      });
      if (plan.day > 0) S.steps.push(habitsStep('full'));
    }
    S.active = true; S.go(0); if (S.walkOnly() && MP.Teleport) MP.Teleport.cancel(); return true;
  };
  S.go = function (i) {
    if (S.step && S.step.leave) S.step.leave();
    S.i = i; S.step = S.steps[i] || null; stopListening(); Rt.unfocus(); input.reset();
    if (!S.step) { finish(); return; }
    if (S.step.enter) S.step.enter();
    S.changed();
  };
  S.next = function () { S.go(S.i + 1); };
  S.stop = function () { if (S.step && S.step.leave) S.step.leave(); S.active = false; S.step = null; S.steps = []; Rt.unfocus(); stopListening(); if (Rt.tool.active) Rt.tool.cancel(); S.changed(); };
  function finish() { S.active = false; S.step = null; Rt.unfocus(); S.msg = 'Session done. See you tomorrow.'; S.changed(); }
  S.walkOnly = function () { return S.active && T.opt('walkOnly'); };
  var listeners = []; S.on = function (fn) { listeners.push(fn); }; S.changed = function () { listeners.forEach(function (fn) { try { fn(); } catch (e) { MP.log(e); } }); };
  S.view = function () {
    if (!S.active || !S.step) return null;
    var v = S.step.view(); v.progress = 'Step ' + (S.i + 1) + ' of ' + S.steps.length; return v;
  };

  // ---------- Answers: typed or spoken ----------
  // input.want(kind, prompt, fn): the next answer goes to fn. kind: 'word' | 'digits' | 'text'
  var input = S.input = { kind: null, prompt: '', fn: null,
    want: function (kind, prompt, fn) { input.kind = kind; input.prompt = prompt; input.fn = fn; },
    reset: function () { input.kind = null; input.fn = null; },
    give: function (text) { var f = input.fn; if (f) f(String(text || '').trim()); S.changed(); }
  };
  // the keyboard on the hand panel takes the answer like a name
  S.typeIt = function () {
    if (!input.fn) return;
    MP.Panel.openKeyboard({ name: '', digits: input.kind === 'digits', label: function () { return input.prompt; }, setName: function (t) { input.give(t); } });
  };
  var rec = null;
  S.listen = function () {
    if (!SR || !input.fn) return false; stopListening();
    rec = new SR(); rec.lang = navigator.language || 'en-US'; rec.interimResults = false; rec.maxAlternatives = 3; S.listening = true; S.changed();
    rec.onresult = function (e) { var r = e.results[0], t = r && r[0] ? r[0].transcript : ''; S.listening = false; input.give(t); };
    rec.onerror = function (e) { S.listening = false; S.msg = e.error === 'not-allowed' ? 'Microphone not allowed: type instead' : 'Didn’t catch that: try again or type'; S.changed(); };
    rec.onend = function () { S.listening = false; S.changed(); };
    try { rec.start(); return true; } catch (err) { S.listening = false; return false; }
  };
  function stopListening() { if (rec) { try { rec.abort(); } catch (e) { } rec = null; } S.listening = false; }
  function answerButtons(dontKnow) {
    var b = [];
    if (voiceOn()) b.push(btn(S.listening ? 'Listening…' : 'Say it', 'Speak your answer', function () { S.listen(); }));
    b.push(btn('Type it', 'On the keyboard', function () { S.typeIt(); }));
    if (dontKnow) b.push(btn('Don’t know', 'Move on', dontKnow));
    return b;
  }

  // ---------- The world's trigger, while a session wants it ----------
  // encode: next item; find the station: the station you point at. Returns true if the session used the pull.
  S.trigger = function (o, d) { if (!S.active || !S.step || !S.step.trigger) return false; return S.step.trigger(o, d) !== false; };

  // ---------- Recall: walk a list's stations, one answer at each ----------
  function stationsOf(L) { var out = []; L.routes.forEach(function (rid) { var r = T.route(rid); if (r) r.stations.forEach(function (s, i) { if (out.length < L.items.length) out.push({ route: rid, i: i }); }); }); return out; }
  function recaller(L, title, done) {
    var st = stationsOf(L), k = 0, answers = [], wait = 0, shown = null;
    function ask() {
      if (k >= L.items.length) { Rt.unfocus(); done(answers); return; }
      var s = st[k]; Rt.focus(s.route, s.i, { show: L.routes }); Rt.card(null);
      input.want('word', 'Station ' + (s.i + 1) + ': what did you place here?', function (t) { answer(t); });
    }
    function answer(t) {
      if (wait > 0) return; var item = L.items[k], ok = !!t && T.matchSpoken(t, item);
      answers.push({ said: t, ok: ok }); shown = { ok: ok, item: item, said: t };
      var s = st[k]; Rt.card(s.route, s.i, ok ? item : (t ? item + '  (not ' + t + ')' : item), ok ? 'good' : 'bad');
      input.reset(); wait = ok ? 0.9 : 1.8; S.changed();
    }
    return {
      start: function () { k = 0; answers = []; ask(); },
      tick: function (dt) { if (wait > 0) { wait -= dt; if (wait <= 0) { wait = 0; shown = null; k++; ask(); S.changed(); } } },
      view: function () {
        var s = st[Math.min(k, st.length - 1)], r = s && T.route(s.route);
        return { title: title + ' · station ' + (Math.min(k, L.items.length - 1) + 1) + ' of ' + L.items.length,
          lines: shown ? [shown.ok ? 'Right: ' + shown.item : 'It was: ' + shown.item] : [(r ? r.name + ', station ' + (s.i + 1) : '') + '. What did you place here?', 'Walk to the glowing plaque.'],
          buttons: shown ? [] : answerButtons(function () { answer(''); }), input: shown ? null : 'word' };
      },
      answers: function () { return answers; }
    };
  }
  function recallStep(L, check, review) {
    var rc = recaller(L, check === 'd7' ? 'A week on' : check === 'h24' ? 'Yesterday’s list' : 'Recall', function (ans) { T.record(L, check, ans); S.next(); });
    return { name: 'Review', enter: function () { rc.start(); }, tick: rc.tick, view: rc.view };
  }

  // ---------- Today's list: encode, gap, recall, misses ----------
  function listStep(st) {
    var L = null, phase = 'ready', k = 0, left = 0, gapLeft = 0, answers = [], misses = [], mi = 0, stations = [], rc = null, note = '';
    var size = st.size, sec = st.sec || T.state.load.sec || 20, kind = st.kind;
    function prepare() {
      var need = Math.ceil(size / 10), routes = T.freeRoutes(need);
      if (routes.length < need) { // not enough routes yet: a shorter list on what there is
        if (!routes.length) { note = 'You need a finished route first.'; return false; }
        size = routes.length * 10;
      }
      L = T.newList(kind, T.material(st.material, size), routes.map(function (r) { return r.id; }), sec);
      stations = stationsOf(L); return true;
    }
    function show() { var s = stations[k]; Rt.focus(s.route, s.i, { show: L.routes }); Rt.card(s.route, s.i, L.items[k]); }
    var step = {
      name: kind === 'long' ? 'The long walk' : kind === 'drill' ? 'Drill' : 'Today’s list',
      enter: function () { phase = 'ready'; if (!prepare()) phase = 'none'; },
      tick: function (dt) {
        if (phase === 'encode') { left -= dt; if (left <= 0) { step.toGap(); } }
        else if (phase === 'gap') { gapLeft -= dt; if (gapLeft <= 0) step.toRecall(); }
        else if (phase === 'recall') rc.tick(dt);
      },
      begin: function () { phase = 'encode'; k = 0; left = L.items.length * sec; show(); S.changed(); },
      nextItem: function () { if (phase !== 'encode') return; if (k < L.items.length - 1) { k++; show(); } else step.toGap(); S.changed(); },
      prevItem: function () { if (phase !== 'encode' || k === 0) return; k--; show(); S.changed(); },
      toGap: function () { phase = 'gap'; gapLeft = kind === 'drill' ? 60 : 180; Rt.unfocus(); S.changed(); },
      toRecall: function () { phase = 'recall'; rc = recaller(L, 'Recall', function (ans) { answers = ans; step.toMisses(); }); rc.start(); S.changed(); },
      toMisses: function () {
        var res = T.record(L, 'now', answers); if (kind === 'drill') { L.open = false; T.release(L); }
        if (kind === 'daily' && L.day > 10) T.adapt(res.pct);
        misses = []; answers.forEach(function (a, i) { if (!a.ok) misses.push(i); }); mi = 0; phase = 'misses';
        if (misses.length) { var s = stations[misses[0]]; Rt.focus(s.route, s.i, { show: L.routes }); Rt.card(s.route, s.i, L.items[misses[0]], 'bad'); }
        S.changed();
      },
      nextMiss: function () { mi++; if (mi >= misses.length) { Rt.unfocus(); S.next(); return; } var s = stations[misses[mi]]; Rt.focus(s.route, s.i, { show: L.routes }); Rt.card(s.route, s.i, L.items[misses[mi]], 'bad'); S.changed(); },
      trigger: function () { if (phase === 'encode') { step.nextItem(); return true; } return false; },
      view: function () {
        var title = step.name;
        if (phase === 'none') return { title: title, lines: [note, 'Build a route in this session, then come back to lists.'], buttons: [btn('Skip it', 'On to the next step', function () { S.next(); })] };
        if (phase === 'ready') {
          var names = L.routes.map(function (id) { return T.route(id).name; }).join(', ');
          return { title: title + ': ' + L.items.length + ' items', lines: ['On ' + names + '. Clear each route first: walk it and let the old pictures burn away.', 'You have ' + fmt(L.items.length * sec) + ' to place them all. At each glowing plaque, build a picture.'],
            buttons: [btn('Begin', 'The first item appears at station 1', step.begin, { primary: true })] };
        }
        if (phase === 'encode') return { title: 'Place: ' + L.items[k], lines: ['Item ' + (k + 1) + ' of ' + L.items.length + ' · ' + fmt(left) + ' left', 'Pull the trigger (or Next) when the picture is in place.'], big: L.items[k],
          buttons: [btn('Back', '', step.prevItem, { dim: k === 0 }), btn('Next', k === L.items.length - 1 ? 'Last one' : 'Item ' + (k + 2), step.nextItem, { primary: true })] };
        if (phase === 'gap') return { title: 'The gap · ' + fmt(gapLeft), lines: ['Count backward from 300 in sevens, out loud.', 'This clears your short-term memory, so recall is real.'],
          buttons: [btn('Skip the gap', 'Recall now (it weakens the test)', step.toRecall, { dim: true })] };
        if (phase === 'recall') return rc.view();
        var r = L.res.now;
        if (!misses.length) return { title: 'All ' + r.total + ' right', lines: [r.pct + '%. Tomorrow you recall them again: that score counts most.'], buttons: [btn('Next', '', function () { S.next(); }, { primary: true })] };
        return { title: r.correct + ' of ' + r.total + ' · ' + r.pct + '%', lines: ['Miss ' + (mi + 1) + ' of ' + misses.length + ': ' + L.items[misses[mi]], 'Rebuild it: bigger, louder, stranger, touching the station.'], big: L.items[misses[mi]],
          buttons: [btn('Rebuilt it', mi + 1 < misses.length ? 'Next miss' : 'Done', step.nextMiss, { primary: true })] };
      },
      leave: function () { Rt.unfocus(); },
      list: function () { return L; }, phase: function () { return phase; }
    };
    return step;
  }

  // ---------- A route: build it, learn it, find its stations ----------
  function routeStep(n) {
    var phase = 'intro', r = null, passes = 0, back = false, nextI = 0, finds = [], fk = 0, found = 0, flash = 0, flashOk = null;
    var where = n <= T.ROUTE_SPOTS.length ? T.ROUTE_SPOTS[n - 1] : 'a new closet';
    var step = {
      name: 'Route ' + n,
      enter: function () { phase = 'intro'; },
      build: function () { r = Rt.tool.start('Route ' + n); Rt.tool.onDone = function () { Rt.tool.onDone = null; step.learn(); }; phase = 'build'; S.changed(); },
      learn: function () { phase = 'learn'; passes = 0; back = false; nextI = 0; Rt.focus(r.id, 0); S.changed(); },
      tick: function (dt) {
        if (flash > 0) { flash -= dt; if (flash <= 0) { flash = 0; flashOk = null; step.ask(); } }
        if (phase !== 'learn' || !r) return;
        var at = Rt.standingAt(r.id); if (at !== nextI) return;
        if (!back) { if (nextI === r.stations.length - 1) { passes++; if (passes >= 3) { back = true; nextI = r.stations.length - 1; } else nextI = 0; } else nextI++; }
        else { if (nextI === 0) { step.toFind(); return; } nextI--; }
        Rt.focus(r.id, nextI); S.changed();
      },
      toFind: function () {
        phase = 'find'; var idx = []; for (var i = 0; i < r.stations.length; i++) idx.push(i);
        var rnd = MP.rng(T.clock() & 0xffff); for (var j = idx.length - 1; j > 0; j--) { var q = Math.floor(rnd() * (j + 1)), t = idx[j]; idx[j] = idx[q]; idx[q] = t; }
        finds = idx.slice(0, 5); fk = 0; found = 0; step.ask(); S.changed();
      },
      ask: function () { if (fk >= finds.length) { Rt.unfocus(); r.learned = T.today(); T.save(); phase = 'done'; S.changed(); return; } Rt.focus(r.id, -1, { blank: true }); },
      check: function (i) { if (phase !== 'find' || flash > 0) return; var ok = i === finds[fk]; if (ok) found++; flashOk = ok; Rt.focus(r.id, finds[fk], { blank: false }); flash = 1.4; fk++; S.changed(); },
      trigger: function (o, d) {
        if (phase === 'build') return false; // the route builder takes the pull
        if (phase !== 'find') return false; var i = o ? Rt.pointedAt(r.id, o, d) : Rt.pointed(r.id); step.check(i); return true;
      },
      view: function () {
        if (phase === 'intro') return { title: 'Build route ' + n, lines: ['Ten stations in ' + where + '. Pick things that look different from each other,', '2 to 3 metres apart, and always walk the same way round.'],
          buttons: [btn('Start placing', 'Point at the floor by each one and pull the trigger', step.build, { primary: true })] };
        if (phase === 'build') return { title: 'Station ' + (r.stations.length + 1) + ' of 10', lines: ['Point at the floor beside something memorable and pull the trigger.', 'Stations stay in this space: ' + (r.space === 'world' ? 'the palace' : 'this closet') + '.'],
          buttons: [btn('Undo', 'Remove the last station', function () { Rt.tool.undo(); }, { dim: !r.stations.length }), btn('Cancel', 'Drop this route', function () { Rt.tool.cancel(); phase = 'intro'; S.changed(); })] };
        if (phase === 'learn') return { title: back ? 'Walk it backwards' : 'Walk it · pass ' + (passes + 1) + ' of 3', lines: ['Walk to the glowing plaque: station ' + (nextI + 1) + '.', back ? 'From 10 back to 1, once.' : 'Forwards from 1 to 10, three times.'],
          buttons: [btn('Done walking', 'Go to the station test', step.toFind)] };
        if (phase === 'find') return { title: flash > 0 ? (flashOk ? 'Right' : 'Not that one') : 'Find station ' + (finds[fk] + 1), lines: [flash > 0 ? 'The numbers come back for a moment.' : 'The numbers are hidden. Point at station ' + (finds[fk] + 1) + ' and pull the trigger.', found + ' found so far'],
          buttons: flash > 0 ? [] : [btn('I’m standing at it', 'Check where you are', function () { step.check(Rt.standingAt(r.id)); })] };
        return { title: 'Route ' + n + ' is yours', lines: ['You found ' + found + ' of 5 stations from memory.'], buttons: [btn('Next', '', function () { S.next(); }, { primary: true })] };
      },
      leave: function () { if (Rt.tool.active) Rt.tool.cancel(); Rt.tool.onDone = null; },
      route: function () { return r; }, phase: function () { return phase; }
    };
    return step;
  }

  // ---------- A lesson in image craft, then a 10-word drill ----------
  function lessonStep(n) {
    var L = T.LESSONS[n], drill = null, phase = 'lesson';
    var step = {
      name: 'Lesson: ' + L.name,
      enter: function () { phase = 'lesson'; },
      tick: function (dt) { if (drill) drill.tick(dt); },
      trigger: function (o, d) { return drill ? drill.trigger(o, d) : false; },
      view: function () {
        if (phase === 'lesson') return { title: 'Lesson ' + (n + 1) + ': ' + L.name, lines: [L.rule, L.eg + ' Ten words follow: use this rule on every one.'],
          buttons: [btn('Got it', 'Start the drill', function () { drill = listStep({ kind: 'drill', size: 10, material: 'concrete', sec: 20 }); drill.enter(); phase = 'drill'; S.changed(); }, { primary: true })] };
        return drill.view();
      },
      leave: function () { if (drill) drill.leave(); }
    };
    return step;
  }

  // ---------- Sleep and exercise, then the day is logged ----------
  function habitsStep(kind) {
    var sleep = null;
    return {
      name: 'Log the day',
      view: function () {
        if (sleep === null) return { title: 'Last night’s sleep', lines: ['One tap. It lets you line your sleep up against your scores.'],
          buttons: ['Under 6 h', '6 to 7 h', '7 to 8 h', '8 h or more'].map(function (l, i) { return btn(l, '', function () { sleep = i; S.changed(); }); }) };
        return { title: 'Exercise today?', lines: ['Anything that got your heart rate up.'],
          buttons: [btn('Yes', '', function () { done(true); }), btn('Not yet', '', function () { done(false); })] };
      }
    };
    function done(ex) {
      var today = T.state.lists.filter(function (l) { return l.date === T.today() && l.kind !== 'drill' && l.res.now; })[0];
      T.logDay(kind, { sleep: sleep, exercise: ex, score: today ? today.res.now.pct : null }); S.next();
    }
  }

  // ---------- The benchmark battery ----------
  // Day 0 (and day 40): the tests that can run today, trained then transfer. Its word list and story come back after 24 hours.
  function batteryDue() {
    var t = T.today();
    return T.state.battery.filter(function (b) { var age = T.daysBetween(b.date, t); return !b.done24 && age >= 1 && age <= 3; })[0] || null;
  }
  function freeRecall(title, items, seconds, done, opts) {
    var said = [], left = seconds;
    return {
      enter: function () { said = []; left = seconds; want(); },
      tick: function (dt) { left -= dt; if (left <= 0) { left = 0; finish(); } },
      view: function () {
        return { title: title + ' · ' + fmt(left), lines: [opts && opts.hint || 'Say or type them one at a time, in any order.', said.length + ' given so far' + (said.length ? ': ' + said.slice(-4).join(', ') : '')],
          buttons: answerButtons(null).concat([btn('Done', 'That’s all I have', finish, { primary: true })]), input: 'word', list: said };
      }
    };
    function want() { input.want('word', title, function (t) { if (t) t.split(/[,;]|\s+and\s+|\s+/).filter(Boolean).forEach(function (w) { said.push(w); }); want(); }); }
    function finish() { if (finish.done) return; finish.done = true; input.reset(); done(said); }
  }
  function batteryStep(benchmark) {
    var n = T.batteryNumber(), words = T.material('concrete', 72), digits = '', rec = { date: T.today(), n: n, day: T.day(), benchmark: benchmark };
    var rnd = MP.rng((T.clock() & 0xffff) + 99); for (var i = 0; i < 80; i++) digits += Math.floor(rnd() * 10);
    rec.words = { items: words }; rec.digits = { items: digits };
    var parts = [], pi = 0, sub = null, story = T.story(n);
    function part(p) { parts.push(p); }
    function nextPart() { pi++; sub = parts[pi] || null; if (!sub) { T.addBattery(rec); if (!benchmark) T.logDay('baseline', {}); S.next(); return; } if (sub.enter) sub.enter(); S.changed(); }
    // 1. word list: study, then free recall
    part({ enter: function () { this.left = 600; }, tick: function (dt) { this.left -= dt; if (this.left <= 0) nextPart(); },
      view: function () { return { title: 'Word list · study ' + fmt(this.left), lines: ['72 words on the training board. Learn them any way you like.', 'When the time is up you’ll recall them in any order.'], board: { kind: 'words', items: words }, buttons: [btn('I’m ready', 'Recall now', nextPart, { primary: true })] }; } });
    part(Object.assign(freeRecall('Word list · recall', words, 300, function (said) { rec.words.now = T.scoreFree(words, said); nextPart(); }), {}));
    // 2. random digits: study, then type them in order
    part({ enter: function () { this.left = 300; }, tick: function (dt) { this.left -= dt; if (this.left <= 0) nextPart(); },
      view: function () { return { title: 'Random digits · study ' + fmt(this.left), lines: ['80 digits in rows on the training board. Learn them in order.'], board: { kind: 'digits', items: digits }, buttons: [btn('I’m ready', 'Recall now', nextPart, { primary: true })] }; } });
    part({ enter: function () { input.want('digits', 'The 80 digits, in order', function (t) { rec.digits.now = T.scoreDigits(digits, t); nextPart(); }); },
      view: function () { return { title: 'Random digits · recall', lines: ['Type the digits in order, as many as you can.'], buttons: [btn('Type it', 'On the keyboard', function () { S.typeIt(); }, { primary: true })], input: 'digits' }; } });
    // 3. digit span, forwards then backwards (transfer: no method)
    [false, true].forEach(function (backwards) {
      var len, tries, best, seq, showT, phase;
      part({
        enter: function () { len = backwards ? 2 : 3; tries = 0; best = 0; this.round(); },
        round: function () { var r2 = MP.rng((T.clock() & 0xfff) + len * 13 + tries); seq = ''; for (var k = 0; k < len; k++) seq += Math.floor(r2() * 10); showT = 0; phase = 'show'; S.changed(); },
        tick: function (dt) {
          if (phase !== 'show') return; showT += dt;
          if (showT >= seq.length + 0.5) { phase = 'answer'; var self = this; input.want('digits', 'The digits ' + (backwards ? 'backwards' : 'in order'), function (t) { self.check(t); }); S.changed(); }
        },
        check: function (t) {
          var want = backwards ? seq.split('').reverse().join('') : seq, ok = String(t).replace(/\D/g, '') === want;
          if (ok) { best = len; len++; tries = 0; this.round(); return; }
          tries++; if (tries >= 2) { rec[backwards ? 'spanB' : 'spanF'] = best; nextPart(); return; } this.round();
        },
        view: function () {
          var shown = phase === 'show' && showT >= 0.5 ? seq.charAt(Math.floor(showT - 0.5)) : '';
          return { title: 'Digit span · ' + (backwards ? 'backwards' : 'forwards') + ' · ' + len + ' digits', lines: [phase === 'show' ? 'Watch the board. No tricks: just hold them in mind.' : 'Now type them ' + (backwards ? 'in reverse order.' : 'in order.')],
            board: { kind: 'span', digit: shown }, big: shown, buttons: phase === 'answer' ? [btn('Type it', 'On the keyboard', function () { S.typeIt(); }, { primary: true })] : [], input: phase === 'answer' ? 'digits' : null };
        }
      });
    });
    // 4. story: listen once (or read it, if this browser can't speak), then retell it (transfer: no method)
    part({ enter: function () { this.left = 70; this.spoke = speak(story.text); }, tick: function (dt) { this.left -= dt; if (this.left <= 0) nextPart(); },
      view: function () { return { title: 'Story · ' + (this.spoke ? 'listen' : 'read it once') + ' · ' + fmt(this.left), lines: ['“' + story.title + '”. No method: just listen.', 'Afterwards, retell it in your own words.'], board: this.spoke ? { kind: 'text', text: 'Listening…' } : { kind: 'story', text: story.text }, buttons: [btn('Finished', 'Retell it now', function () { if (window.speechSynthesis) speechSynthesis.cancel(); nextPart(); }, { primary: true })] }; } });
    part(Object.assign(freeRecall('Retell the story', [], 240, function (said) { rec.story = { n: n, now: T.scoreStory(story, said.join(' ')) }; nextPart(); }, { hint: 'Say or type everything you remember, a bit at a time.' }), {}));
    // 5. the forgetting log
    var q = 0, ans = [];
    part({ enter: function () { q = 0; ans = []; },
      view: function () {
        return { title: 'Everyday memory · ' + (q + 1) + ' of ' + T.FORGET.length, lines: ['In the last month, how often: ' + T.FORGET[q] + '?'],
          buttons: T.FORGET_SCALE.map(function (l, i) { return btn(l, '', function () { ans.push(i); q++; if (q >= T.FORGET.length) { rec.forget = { answers: ans, total: ans.reduce(function (s, v) { return s + v; }, 0) }; nextPart(); } else S.changed(); }); }) };
      } });
    return {
      name: benchmark ? 'Benchmark' : 'Baseline',
      enter: function () { pi = -1; sub = null; nextPart.intro = true; },
      tick: function (dt) { if (sub && sub.tick) sub.tick(dt); },
      view: function () {
        if (!sub) return { title: benchmark ? 'Day 40 benchmark' : 'Day 0: your baseline', lines: ['About 45 minutes: a word list, random digits, digit span, a story and ten questions.', 'Stand at the training board. Tomorrow, the word list and story come back.'],
          buttons: [btn('Begin', '', nextPart, { primary: true })] };
        return sub.view();
      },
      record: function () { return rec; }, part: function () { return pi; }
    };
  }
  // the next day: the battery's word list and story, recalled again
  function batteryRecheck(b) {
    var phase = 0, sub = null, story = T.story(b.story ? b.story.n : 0);
    var parts = [
      freeRecall('Yesterday’s 72 words', b.words.items, 300, function (said) { b.words.h24 = T.scoreFree(b.words.items, said); go(1); }),
      freeRecall('Yesterday’s story, retold', [], 240, function (said) { if (b.story) b.story.h24 = T.scoreStory(story, said.join(' ')); b.done24 = true; T.save(); T.changed(); S.next(); }, { hint: 'Everything you still remember of “' + story.title + '”.' })
    ];
    function go(i) { phase = i; sub = parts[i]; sub.enter(); S.changed(); }
    return { name: 'Benchmark, 24 hours on', enter: function () { go(0); }, tick: function (dt) { if (sub && sub.tick) sub.tick(dt); }, view: function () { return sub.view(); } };
  }
  function speak(text) {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return false;
    try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(text); u.rate = 0.92; speechSynthesis.speak(u); return true; } catch (e) { return false; }
  }

  R.onFrame(function (dt) { if (S.active && S.step && S.step.tick) S.step.tick(Math.min(dt, 0.25)); });
  // tests: run the clock on
  S.advance = function (sec) { var n = Math.ceil(sec / 0.25); for (var i = 0; i < n; i++) if (S.active && S.step && S.step.tick) S.step.tick(0.25); };
  S.press = function (label) { var v = S.view(); if (!v) return false; var b = (v.buttons || []).filter(function (x) { return x.label === label; })[0]; if (!b) return false; b.run(); S.changed(); return true; };
})();
