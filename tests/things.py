# Things in the hall: the four paper lanterns are there from the start and switch off and on (and stay so after a
# reload); the hand panel's Make face adds things from its catalog; every kind lands on what's under it; the singing
# bowl rings; Hall sound "White noise" replaces every other sound inside the hall, and the world comes back outside.
# Then in an emulated Quest 3 (IWER): grip a lantern, carry it onto the sand and let go; hold a thing and put it away
# from the panel. Takes views into tests/shots/.
import asyncio, subprocess, os, math
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..'); SHOTS = os.path.join(HERE, 'shots')
IW = open(os.path.join(HERE, 'vendor', 'iwer.min.js')).read()
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
URL = 'http://localhost:8839/index.html?debug&nosw'
async def ready(pg):
    for _ in range(400):
        await pg.wait_for_timeout(250)
        if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): return True
    return False
async def pump(pg, n=4):  # headless pages draw a frame only when asked
    for _ in range(n): await pg.screenshot(); await pg.wait_for_timeout(120)

async def flat(b, r):
    ctx = await b.new_context(viewport={'width': 800, 'height': 480}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    await pg.goto(URL); await ready(pg); E = pg.evaluate; T = 'palaceDebug.MP.Things'
    await E("document.getElementById('card').hidden = true")
    first = await E(f'{T}.report()')
    r['at first'] = sorted(set((t['kind'], t['on']) for t in first)); r['how many at first'] = len(first)
    # switch the south-west lantern off by pointing at it
    sw = next(t for t in first if t['at'][0] < 0 and t['at'][2] < 0)
    await E('palaceDebug.place(-5.6, 0, -7.5, false); palaceDebug.look(Math.PI, -0.3)')
    r['pointed at'] = await E(f"palaceDebug.MP.Interact.useRay([-5.6, 1.5, -7], [0, -0.35, 1])")
    r['lantern off'] = next(t for t in await E(f'{T}.report()') if t['id'] == sw['id'])['on'] is False
    await pump(pg, 2); await pg.screenshot(path=os.path.join(SHOTS, 'things-lantern-off.png'))
    # the panel's Make face, inside the hall: add a wind bell from the catalog
    await E('palaceDebug.place(0, 0, -8.6, false); palaceDebug.look(Math.PI, -0.2)')
    await E("palaceDebug.MP.Panel.press('Make')"); await E('palaceDebug.MP.Panel.tick(0.4)')
    r['make face'] = await E('palaceDebug.MP.Panel.buttons()')
    await E("palaceDebug.MP.Panel.press('Add to the hall')"); r['catalog'] = await E('[palaceDebug.MP.Panel.face(), palaceDebug.MP.Panel.buttons()]')
    await E("palaceDebug.MP.Panel.press('Wind bell')"); r['after adding'] = await E('palaceDebug.MP.Panel.face()')
    rep = await E(f'{T}.report()'); bell = rep[-1]
    r['wind bell in front of you'] = bell['kind'] == 'furin' and abs(bell['at'][0]) < 0.3 and -7.8 < bell['at'][2] < -7.0
    # every kind: set one out and check it stands on what's under it
    await E('palaceDebug.place(0, 0, -6.2, false); palaceDebug.look(Math.PI, -0.25)')
    for kind in ['candle', 'incense', 'fireflies', 'bonsai', 'bowl', 'shishi', 'koto', 'andon']:
        await E(f"palaceDebug.MP.Things.spawn('{kind}')"); await E('palaceDebug.look(palaceDebug.MP.Player.flatYaw + 0.55, -0.25)')
    await pump(pg, 4)
    rep = await E(f'{T}.report()')
    grounds = await E(f"palaceDebug.MP.Things.report().map(t => [t.at[1], palaceDebug.MP.World.groundAt(t.at[0], t.at[2])])")
    r['how many now'] = len(rep); r['all on the ground'] = all(abs(a - g) < 0.002 for a, g in grounds)
    r['kinds'] = sorted(set(t['kind'] for t in rep))
    await E('palaceDebug.place(0, 1.0, -8.8, true); palaceDebug.look(Math.PI, -0.32)'); await pump(pg, 3)
    await pg.screenshot(path=os.path.join(SHOTS, 'things-all.png'))
    # sound: wake it with a click; the bowl rings when struck
    await pg.mouse.click(400, 470); await pg.wait_for_timeout(600); await pump(pg, 2)
    bowl = next(t for t in rep if t['kind'] == 'bowl')
    await E(f"palaceDebug.place({bowl['at'][0]}, 0, {bowl['at'][2] - 0.7}, false)"); await pump(pg, 3)
    quiet = await E('palaceDebug.MP.Sound.level()')
    r['struck'] = await E(f"palaceDebug.MP.Things.use(palaceDebug.MP.Things.find({bowl['id']}))"); await pg.wait_for_timeout(250)
    ring = await E('palaceDebug.MP.Sound.level()')
    r['bowl rings (chime band dB)'] = [quiet['chimeBandDb'], ring['chimeBandDb']]
    # white noise: inside the hall, nothing else; outside, the world again
    await E("palaceDebug.MP.Panel.press('Settings')"); await E('palaceDebug.MP.Panel.tick(0.4)')
    r['settings face'] = await E('palaceDebug.MP.Panel.buttons()')
    await E("palaceDebug.MP.Panel.press('Hall sound')"); await pump(pg, 6); await pg.wait_for_timeout(1600)
    snd = await E('palaceDebug.sound()'); lv = await E('palaceDebug.MP.Sound.level()')
    r['white noise inside'] = [snd['hallSound'], snd['white'], snd['world'], lv['chimeBandDb'], lv['cicadaBandDb']]
    await E('palaceDebug.place(0, 0, -20, false)'); await pump(pg, 6); await pg.wait_for_timeout(1600)
    snd2 = await E('palaceDebug.sound()'); lv2 = await E('palaceDebug.MP.Sound.level()')
    r['outside again'] = [snd2['white'], snd2['world']]
    # reload: the things, where they are, and the lantern left off
    await pg.wait_for_timeout(900)
    before = sorted((t['kind'], t['at'][0], t['at'][2], t['on']) for t in await E(f'{T}.report()'))
    await pg.goto(URL); await ready(pg)
    after = sorted((t['kind'], t['at'][0], t['at'][2], t['on']) for t in await E(f'{T}.report()'))
    r['kept after reload'] = before == after
    r['hall sound kept'] = (await E('palaceDebug.sound()'))['hallSound']
    await E("palaceDebug.MP.Sound.setHallSound('natural')")
    r['flat errors'] = errs[:4]
    await ctx.close()

async def vr(b, r):
    ctx = await b.new_context(viewport={'width': 640, 'height': 400}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(IW + "\n;(function(){ window.__iwer = new IWER.XRDevice(IWER.metaQuest3); window.__iwer.installRuntime({ forceInstall: true }); })();\n"
                             "addEventListener('load', function () { setTimeout(function () { navigator.xr.dispatchEvent(new Event('sessiongranted')); }, 300); });")
    await pg.goto(URL + '&via=clay')
    for _ in range(300):
        await pg.wait_for_timeout(300)
        if await pg.evaluate('window.palaceDebug && palaceDebug.presenting() && palaceDebug.ready()'): break
    E = pg.evaluate; T = 'palaceDebug.MP.Things'
    r['in VR'] = await E('palaceDebug.presenting()')
    async def frames(n):
        f0 = await E('palaceDebug.frames().length')
        for _ in range(80):
            await pg.wait_for_timeout(150)
            if await E('palaceDebug.frames().length') >= f0 + n: return
    async def hand(rig, yaw, w):
        dx, dz = w[0] - rig[0], w[2] - rig[1]; c, s = math.cos(yaw), math.sin(yaw)
        await E(f'__iwer.controllers.right.position.set({dx * c - dz * s}, {w[1]}, {dx * s + dz * c})'); await frames(2)
    async def squeeze(v): await E(f"__iwer.controllers.right.updateButtonValue('squeeze', {v})"); await frames(2)
    # the north-east lantern: grip it, carry it onto the sand, let go
    ne = next(t for t in await E(f'{T}.report()') if t['at'][0] > 0 and t['at'][2] > 0)
    rig = [ne['at'][0] + 0.8, ne['at'][2]]; await E(f'palaceDebug.place({rig[0]}, 0, {rig[1]}, true); palaceDebug.MP.R.rig.rotation.y = Math.PI / 2')
    await hand(rig, math.pi / 2, [ne['at'][0], 0.6, ne['at'][2]]); await squeeze(1)
    r['holding the lantern'] = await E("(palaceDebug.MP.Grab.holding(palaceDebug.MP.Player.hand('right')) || {}).label")
    for k in range(1, 5): await hand(rig, math.pi / 2, [ne['at'][0] - 0.3 * k, 0.9, ne['at'][2] - 0.5 * k])
    await squeeze(0); await frames(5)
    moved = next(t for t in await E(f'{T}.report()') if t['id'] == ne['id'])
    r['lantern moved onto the sand'] = [moved['at'], abs(moved['at'][1] - 0.17) < 0.002]
    # hold another lantern and put it away from the panel's Make face
    se = next(t for t in await E(f'{T}.report()') if t['at'][0] > 0 and t['at'][2] < 0)
    rig = [se['at'][0] + 0.8, se['at'][2]]; await E(f'palaceDebug.place({rig[0]}, 0, {rig[1]}, true)')
    await hand(rig, math.pi / 2, [se['at'][0], 0.6, se['at'][2]]); await squeeze(1)
    await E("palaceDebug.MP.Panel.press('Make')"); await E('palaceDebug.MP.Panel.tick(0.4)'); await frames(2)
    r['make face holding'] = await E('palaceDebug.MP.Panel.buttons()')
    r['put away'] = await E("palaceDebug.MP.Panel.press('Put it away')")
    await squeeze(0); await frames(2)
    r['left'] = len(await E(f'{T}.report()'))
    r['vr errors'] = errs[:3]
    await ctx.close()

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8839'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=GL)
            await flat(b, r); await vr(b, r); await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    wn, out = r['white noise inside'], r['outside again']
    ok = (r['at first'] == [('andon', True)] and r['how many at first'] == 4 and r['pointed at'] and r['lantern off']
          and 'Add to the hall' in r['make face'] and r['catalog'][0] == 'Catalog' and len(r['catalog'][1]) == 10 and r['after adding'] == 'Make' and r['wind bell in front of you']
          and r['how many now'] == 13 and r['all on the ground'] and len(r['kinds']) == 9
          and r['struck'] == 'struck' and r['bowl rings (chime band dB)'][1] > r['bowl rings (chime band dB)'][0] + 6
          and 'Hall sound' in r['settings face'] and wn[0] == 'white' and wn[1] and wn[2] < 0.05 and abs(wn[3] - wn[4]) < 4
          and out[0] is False and out[1] > 0.95
          and r['kept after reload'] and r['hall sound kept'] == 'white' and not r['flat errors']
          and r['in VR'] and r['holding the lantern'] == 'paper lantern' and r['lantern moved onto the sand'][1]
          and 'Put it away' in r['make face holding'] and r['put away'] and r['left'] == 3 and not r['vr errors'])
    print('THINGS TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
