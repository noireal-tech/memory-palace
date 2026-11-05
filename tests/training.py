# Training, step 1: the foyer in front of the keep (walk in through its sliding doors, on through the ring gate), its
# boards (the palace starts in Training mode; flip to Working and back; flip an option), the day-0 baseline battery run
# from the training board, day 1's route (ten stations, walked, found from memory), day 2's lesson and drill, day 3's
# first list (encode, the gap, recall with misses), day 4's 24-hour review on the trophy wall, a light day, and all of
# it kept after a reload. The clock is moved a day at a time. Then in an emulated Quest 3: the Train face on the hand
# panel, a session started from it, and the number pad for digits.
import asyncio, subprocess, os, json
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..'); SHOTS = os.path.join(HERE, 'shots')
IW = open(os.path.join(HERE, 'vendor', 'iwer.min.js')).read()
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
URL = 'http://localhost:8844/index.html?debug&nosw'
S = 'palaceDebug.MP.Session'; T = 'palaceDebug.MP.Train'
HALL = [[-6, -8], [-3, -8.5], [0, -8.8], [3, -8.5], [6, -8], [7.5, -4], [7.8, 0], [6, 4], [-6, 4], [-7.8, 0]]
GARDEN = [[-4, -4.5], [-2, -5], [0, -5.2], [2, -5], [4, -4.5], [4.6, -2], [4.6, 1], [2, 2.6], [-2, 2.6], [-4.6, 0]]
async def ready(pg):
    for _ in range(400):
        await pg.wait_for_timeout(250)
        if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): return True
    return False
async def pump(pg, n=3):
    for _ in range(n): await pg.screenshot(); await pg.wait_for_timeout(120)
async def snap(pg, name):
    await pump(pg, 3); await pg.screenshot(path=os.path.join(SHOTS, name + '.png'))

async def flat(b, r):
    ctx = await b.new_context(viewport={'width': 900, 'height': 560}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    await pg.goto(URL); await ready(pg); E = pg.evaluate
    await E("document.getElementById('card').hidden = true")
    async def V(): return await E('palaceDebug.train().view')
    async def press(l):
        if not await E(f"{S}.press({json.dumps(l)})"): r.setdefault('missing buttons', []).append([l, await V()])
    async def day(n): await E(f"{T}.clock = function () {{ return Date.now() + {n} * 864e5; }}; palaceDebug.MP.Foyer.redraw()")
    async def give(t): await E(f"{S}.input.give({json.dumps(t)})")
    async def route(pts, y=0.04):
        await press('Start placing')
        for x, z in pts: await E(f"palaceDebug.MP.Routes.tool.place([{x}, {y}, {z}])")
        for _ in range(3):
            for x, z in pts: await E(f"palaceDebug.place({x}, {y}, {z}); {S}.advance(0.25)")
        for x, z in reversed(pts): await E(f"palaceDebug.place({x}, {y}, {z}); {S}.advance(0.25)")
        for _ in range(5):
            n = int((await E(f"{S}.step.view().title")).split()[-1]) - 1; x, z = pts[n]
            await E(f"palaceDebug.place({x}, {y}, {z})"); await press('I’m standing at it'); await E(f"{S}.advance(1.5)")
        found = (await V())['lines'][0]; await press('Next'); return found
    async def recall(items, wrong=()):
        for i, w in enumerate(items):
            await give('teapot' if i in wrong else w); await E(f"{S}.advance(2)")

    # ---- the foyer: from the forecourt, through its doors, up to the gate
    await E('palaceDebug.place(0, 0, -24); palaceDebug.look(Math.PI, 0.04)'); await snap(pg, 'foyer-outside')
    r['doors start open'] = await E('palaceDebug.MP.Foyer.doors()') == 1
    p = await E('palaceDebug.walk(420, 1, 0)'); r['walk in to the gate'] = p[2] > -13.2 and p[2] < -12.0 and abs(p[1] - 0.04) < 0.02; r['walked to'] = p
    await E('palaceDebug.MP.Foyer.setDoors(0)'); await E('palaceDebug.place(0, 0, -21); palaceDebug.look(Math.PI, 0); palaceDebug.MP.R.renderer.render(palaceDebug.MP.R.scene, palaceDebug.MP.R.camera)')
    await pump(pg, 6); p = await E('palaceDebug.walk(240, 1, 0)'); r['shut doors stop you'] = p[2] < -18.9
    await E('palaceDebug.MP.Foyer.setDoors(1)'); await pump(pg, 6)
    await E('palaceDebug.place(-1.6, 0.04, -14.6); palaceDebug.look(-Math.PI / 2 - 0.3, 0.02)'); await snap(pg, 'foyer-boards-east')
    await E('palaceDebug.place(1.6, 0.04, -14.8); palaceDebug.look(Math.PI / 2 + 0.3, 0.02)'); await snap(pg, 'foyer-boards-west')
    # ---- modes and options
    r['starts in Training'] = (await E('palaceDebug.train()'))['mode'] == 'training'
    await E("palaceDebug.MP.Foyer.board('mode').press('Working')"); r['working'] = (await E('palaceDebug.train()'))['mode']
    r['working hides Train'] = 'Train' not in await E('palaceDebug.MP.Panel.faces()')
    r['working: no session'] = not await E(f"{S}.start(false)")
    await E("palaceDebug.MP.Foyer.board('mode').press('Training')"); r['Train face back'] = (await E('palaceDebug.MP.Panel.faces()'))[0] == 'Train'
    await E("palaceDebug.MP.Foyer.board('opts').press('Voice answers')"); r['option flipped'] = (await E('palaceDebug.train()'))['opts']['voice'] is False
    await E("palaceDebug.MP.Foyer.board('opts').press('Voice answers')")

    # ---- day 0: the baseline battery, from the training board
    await E("palaceDebug.MP.Foyer.board('train').press('Run the baseline')"); await press('Begin')
    await E('palaceDebug.place(2.6, 0.04, -15.55); palaceDebug.look(-Math.PI / 2, 0.02)'); await snap(pg, 'training-baseline-words')
    await press('I’m ready'); words = await E(f"{S}.step.record().words.items")
    for w in words[:26]: await give(w)
    await press('Done'); await press('I’m ready'); dg = await E(f"{S}.step.record().digits.items"); await give(dg[:20])
    for _ in range(4): await E(f"{S}.advance(12)"); await give('9')
    await press('Finished'); await give('Marta missed the ferry, bought oranges, and a brown dog followed her on board'); await press('Done')
    for _ in range(10): await press('Sometimes')
    t = await E('palaceDebug.train()'); r['baseline logged'] = bool(t['done']) and t['done']['kind'] == 'baseline' and t['battery'] == 1
    bat = await E(f"{T}.state.battery[0]"); r['baseline scores'] = [bat['words']['now']['correct'], bat['digits']['now']['correct'], bat['spanF'], bat['spanB'], bat['story']['now']['units'], bat['forget']['total']]

    # ---- day 1: the battery's 24-hour checks, then route 1 in the hall
    await day(1); await E("palaceDebug.MP.Foyer.board('train').press('Start today’s session')")
    r['day 1 starts with the 24-hour words'] = (await V())['title'].startswith('Yesterday’s 72 words')
    for w in words[:18]: await give(w)
    await press('Done'); await give('ferry oranges dog'); await press('Done')
    r['route 1'] = await route(HALL); await press('7 to 8 h'); await press('Yes')
    r['day 1 done'] = (await E('palaceDebug.train()'))['done']['kind'] == 'full'
    await E('palaceDebug.place(0, 0.04, -1.5); palaceDebug.look(Math.PI + 0.5, 0.0)'); await snap(pg, 'training-route-plaques')

    # ---- day 2: route 2 in the garden, lesson 1 (size) and its 10-word drill on route 1
    await day(2); await E(f"{S}.start(false)")
    r['route 2'] = await route(GARDEN, 0.12)
    r['lesson'] = (await V())['title']; await press('Got it'); await press('Begin')
    drill = await E(f"{S}.step.view().title"); items = []
    for _ in range(10):
        items.append((await V())['title'][len('Place: '):]); await E(f"{S}.trigger()")
    r['drill reached the gap'] = (await V())['title'].startswith('The gap'); await E(f"{S}.advance(61)")
    await recall(items, wrong=(2,)); r['drill misses'] = (await V())['title']; await press('Rebuilt it'); await press('Under 6 h'); await press('Not yet')

    # ---- day 3: route 3, lesson 2 (action) and drill, then the first list: 10 words on a rested route
    await day(3); await E(f"{S}.start(false)")
    await route([[x, z - 2.2] for x, z in HALL[:5]] + [[x - 2.2, z] for x, z in HALL[5:7]] + [[6, 1.6], [-6, 1.6], [-5.6, -1.5]])
    await press('Got it'); await press('Begin')
    for _ in range(10): await E(f"{S}.trigger()")
    await E(f"{S}.advance(61)"); await recall(['x'] * 10, wrong=())
    while (await V())['title'].startswith('Miss') or 'Rebuilt it' in (await V())['buttons']: await press('Rebuilt it')
    v = await V(); r['list ready'] = v['title']; await press('Begin')
    st = await E(f"(function () {{ var L = {S}.step.list(), r = {T}.route(L.routes[0]); return [r.stations[0], r.space]; }})()")
    await E(f'''(function () {{ var L = {S}.step.list(), r = {T}.route(L.routes[0]), s0 = r.stations[0], cx = 0, cz = 0;
      r.stations.forEach(function (s) {{ cx += s[0] / r.stations.length; cz += s[2] / r.stations.length; }});
      var dx = cx - s0[0], dz = cz - s0[2], d = Math.hypot(dx, dz), px = s0[0] + dx / d * 2.2, pz = s0[2] + dz / d * 2.2;
      palaceDebug.place(px, s0[1], pz); palaceDebug.look(Math.atan2(px - s0[0], pz - s0[2]), 0.18); }})()'''); await snap(pg, 'training-encode-card')
    lst = [];
    for _ in range(10): lst.append((await V())['title'][len('Place: '):]); await E(f"{S}.trigger()")
    await E(f"{S}.advance(181)"); await recall(lst, wrong=(1, 5))
    r['list result'] = (await V())['title']
    await E('palaceDebug.place(-1.5, 0.04, -9.3); palaceDebug.look(Math.PI + 0.4, 0.05)'); await snap(pg, 'training-miss')
    await press('Rebuilt it'); await press('Rebuilt it'); await press('8 h or more'); await press('Yes')
    # ---- day 4: yesterday's list comes back first; the trophy wall gets its first point
    await day(4); await E(f"{S}.start(false)")
    r['day 4 review'] = (await V())['title']; await recall(lst, wrong=(1,))
    r['24h recorded'] = await E(f"{T}.series24()")
    await E(f"{S}.stop()")
    await E('palaceDebug.place(1.8, 0.04, -13.2); palaceDebug.look(-Math.PI / 2, 0.02)'); await snap(pg, 'training-trophy')
    # a light day: review only, once a week
    r['light day allowed'] = await E(f"{T}.canLight()")
    await E(f"{S}.start(true)"); await press('7 to 8 h'); await press('Yes')
    r['light logged'] = (await E('palaceDebug.train()'))['done']['kind'] == 'light'
    await day(5); r['second light day refused'] = not await E(f"{T}.canLight()")
    r['day after light'] = await E(f"{T}.day()")
    # ---- kept after a reload
    await E(f"{T}.save(true)"); await pg.wait_for_timeout(400)
    await pg.reload(); await ready(pg)
    t = await E('palaceDebug.train()'); r['kept'] = [len(t['routes']), len([l for l in t['lists'] if l['kind'] != 'drill']), t['battery'], t['mode']]
    r['plaques after reload'] = all(x['shown'] for x in t['routes'])
    r['flat errors'] = errs[:4]
    await ctx.close()

async def vr(b, r):
    ctx = await b.new_context(viewport={'width': 640, 'height': 400}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    await pg.add_init_script(IW + "\n;(function(){ window.__iwer = new IWER.XRDevice(IWER.metaQuest3); window.__iwer.installRuntime({ forceInstall: true }); })();\n"
                             "addEventListener('load', function () { setTimeout(function () { navigator.xr.dispatchEvent(new Event('sessiongranted')); }, 300); });")
    await pg.goto(URL + '&via=clay')
    for _ in range(300):
        await pg.wait_for_timeout(300)
        if await pg.evaluate('window.palaceDebug && palaceDebug.presenting() && palaceDebug.ready()'): break
    E = pg.evaluate
    r['in VR'] = await E('palaceDebug.presenting()')
    r['vr faces'] = await E('palaceDebug.MP.Panel.faces()')
    await E("palaceDebug.MP.Panel.show('Train')"); r['vr train buttons'] = await E('palaceDebug.MP.Panel.buttons()')
    await E("palaceDebug.MP.Panel.press('Start here')"); r['vr session'] = (await E('palaceDebug.train()'))['step']
    await E(f"{S}.press('Begin')"); await E(f"{S}.press('I’m ready')"); await E(f"{S}.press('Done')"); await E(f"{S}.press('I’m ready')")
    await E(f"{S}.typeIt()"); r['vr number pad'] = await E('palaceDebug.MP.Panel.buttons()')
    for k in '314': await E(f"palaceDebug.MP.Panel.press('{k}')")
    await E("palaceDebug.MP.Panel.press('Done')")
    r['vr digits given'] = (await E(f"{S}.step.record().digits.now")) is not None
    await E("palaceDebug.MP.Panel.show('Train')"); await pg.wait_for_timeout(300)
    png = await E("palaceDebug.MP.Panel.canvas.toDataURL('image/png')")
    import base64; open(os.path.join(SHOTS, 'training-panel.png'), 'wb').write(base64.b64decode(png.split(',')[1]))
    await pg.wait_for_timeout(600)
    r['vr panel face after'] = await E('palaceDebug.MP.Panel.face()')
    r['vr errors'] = errs[:3]
    await ctx.close()

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8844'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=GL)
            await flat(b, r); await vr(b, r); await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    ok = (r['doors start open'] and r['walk in to the gate'] and r['shut doors stop you'] and r['starts in Training'] and r['working'] == 'working'
          and r['working hides Train'] and r['working: no session'] and r['Train face back'] and r['option flipped'] and 'missing buttons' not in r
          and r['baseline logged'] and r['baseline scores'][0] == 26 and r['day 1 starts with the 24-hour words'] and 'found 5 of 5' in r['route 1']
          and r['day 1 done'] and 'found 5 of 5' in r['route 2'] and r['lesson'].startswith('Lesson 1') and r['drill reached the gap'] and r['drill misses'].startswith('9 of 10')
          and r['list ready'].startswith('Today’s list: 10') and r['list result'].startswith('8 of 10') and r['day 4 review'].startswith('Yesterday’s list')
          and r['24h recorded'] == [{'day': 3, 'pct': 90}] and r['light day allowed'] and r['light logged'] and r['second light day refused'] and r['day after light'] == 5
          and r['kept'] == [3, 1, 1, 'training'] and r['plaques after reload'] and not r['flat errors']
          and r['in VR'] and r['vr faces'][0] == 'Train' and 'Start here' in r['vr train buttons'] and r['vr session'] == 'Baseline'
          and '0' in r['vr number pad'] and r['vr digits given'] and r['vr panel face after'] == 'Train' and not r['vr errors'])
    print('TRAINING TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
