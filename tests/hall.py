# The Central Hall: the gate stops you while it's shut and a ring swings a leaf open; you walk in, climb both flights
# of the zigzag stair to the top landing, and the hall's ceiling stops teleport arcs. In the garden a rake stroke
# leaves grooves, the stand's settings change the rocks, the sand and the tines, and the bench sits you facing the
# garden or away. The gate, the sand and the settings survive a reload. Then in an emulated Quest 3 (IWER): grip a
# gate ring and pull; take the rake off its rack and drag it through the sand; pick up a rock and set it down.
import asyncio, subprocess, os, math, json
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..'); SHOTS = os.path.join(HERE, 'shots')
IW = open(os.path.join(HERE, 'vendor', 'iwer.min.js')).read()
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
URL = 'http://localhost:8838/index.html?debug&nosw'
async def ready(pg):
    for _ in range(400):
        await pg.wait_for_timeout(250)
        if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): return True
    return False
async def pump(pg, n=4):  # headless pages draw a frame only when asked
    for _ in range(n): await pg.screenshot(); await pg.wait_for_timeout(120)
def grooves(p):  # how many dips along a height profile
    return sum(1 for i in range(1, len(p) - 1) if p[i] < p[i - 1] and p[i] <= p[i + 1] and p[i] < 0.4)

async def flat(b, r):
    ctx = await b.new_context(viewport={'width': 800, 'height': 480}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    await pg.goto(URL); await ready(pg); E = pg.evaluate
    await E("document.getElementById('card').hidden = true")
    T = 'palaceDebug.MP.Teleport'; Gd = 'palaceDebug.MP.Garden'
    r['gate at first'] = await E('palaceDebug.MP.Gate.angles()')
    # the shut gate: walking stops at it, and so does a teleport arc
    pos = await E('palaceDebug.place(0, 0, -15, false), palaceDebug.look(Math.PI, 0), palaceDebug.walk(200, 1, 0)')
    r['shut gate stops you'] = pos[2] < -12.2
    r['shut gate stops arcs'] = (await E(f'{T}.aimAt([0, 1.4, -14], [0, 0, 1])'))['why']; await E(f'{T}.cancel()')
    await pg.screenshot(path=os.path.join(SHOTS, 'hall-gate.png'))
    # click the left leaf's outer ring: it swings open
    rings = await E('palaceDebug.MP.Gate.rings()'); lo = next(x for x in rings[0] if x['outer'])['at']
    r['ring clicked'] = await E(f'palaceDebug.MP.Interact.useRay([{lo[0]}, {lo[1] - 0.2}, -14], [0, 0, 1])')
    await pump(pg, 10)
    r['gate after click'] = await E('palaceDebug.MP.Gate.angles()')
    await E('palaceDebug.place(0, 0, -15, false), palaceDebug.look(Math.PI, 0.05)'); await pump(pg, 2)
    await pg.screenshot(path=os.path.join(SHOTS, 'hall-gate-open.png'))
    # walk in through the open half
    await E('palaceDebug.place(-1.0, 0, -15, false), palaceDebug.look(Math.PI, 0)')
    pos = await E('palaceDebug.walk(320, 1, 0)')
    r['walked into the hall'] = pos[2] > -9.5
    r['hall floor'] = await E('palaceDebug.MP.World.groundAt(-1, -8)')
    # the ceiling stops arcs; the east landing is a good teleport spot
    r['ceiling stops arcs'] = (await E(f'{T}.aimAt([3, 5.1, 9], [0, 1, -0.2])'))['why']  # from the landing, aiming up
    land = await E(f'{T}.aimAt([3, 1.5, 4], [0, 1, 0.5])')
    r['teleport to landing'] = land['ok'] and abs(land['point'][1] - 3.6) < 0.01; await E(f'{T}.cancel()')
    # climb: along the back wall up the first flight, across the landing, back up the second to the top landing
    await E('palaceDebug.place(-4.5, 0, 9.6, false); palaceDebug.look(-Math.PI / 2, 0)')
    up1 = await E('palaceDebug.walk(200, 1, 0)')
    await E('palaceDebug.look(0, 0)'); await E('palaceDebug.walk(52, 1, 0)')
    await E('palaceDebug.look(Math.PI / 2, 0)'); top = await E('palaceDebug.walk(260, 1, 0)')
    r['up the first flight'] = round(up1[1], 2)
    r['top landing'] = [round(top[0], 2), round(top[1], 2)]
    await E('palaceDebug.look(Math.PI / 2, 0.05)'); await pump(pg, 2)
    await pg.screenshot(path=os.path.join(SHOTS, 'hall-stair-top.png'))
    await E('palaceDebug.place(5.5, 0, 1.5, false); palaceDebug.look(2.3, 0.1)'); await pump(pg, 2)
    await pg.screenshot(path=os.path.join(SHOTS, 'hall-stair.png'))
    # the garden: a stroke across the plain grooves leaves its own
    before = await E(f'{Gd}.profile(1.1, -3.6, 2.1, -3.6, 101)')
    r['raked'] = await E(f'{Gd}.rakeStroke([[1.6, -1.6], [1.6, -4.2]], 5)')
    after = await E(f'{Gd}.profile(1.1, -3.6, 2.1, -3.6, 101)')
    r['grooves across before'] = grooves(before); r['grooves across after'] = grooves(after)
    # the stand: point at its options
    async def board(u, v):
        p = await E(f'{Gd}.boardPoint({u}, {v})'); n = await E(f'{Gd}.boardNormal()')
        return await E(f'palaceDebug.MP.Interact.useRay([{p[0] + n[0] * 0.5}, {p[1] + n[1] * 0.5}, {p[2] + n[2] * 0.5}], [{-n[0]}, {-n[1]}, {-n[2]}])')
    r['stand clicked'] = await board(0.385, 1 - 118 / 400)            # Rocks: 3
    r['rocks 3'] = len((await E(f'{Gd}.report()'))['rocks'])
    await board(140 / 512 + (0.5 + 3) * (342 / 4) / 512, 1 - 192 / 400)  # Sand: Charcoal
    await board(140 / 512 + 2.5 * (342 / 3) / 512, 1 - 266 / 400)          # Tines: 7
    rep = await E(f'{Gd}.report()'); r['settings'] = rep['settings']; r['tines on the rake'] = rep['tines']
    await board(0.5, 1 - 340 / 400); r['smoothed'] = grooves(await E(f'{Gd}.profile(1.1, -3.6, 2.1, -3.6, 101)')) == grooves(before)
    await E(f'{Gd}.rakeStroke([[1.6, -1.6], [1.6, -4.2]], 7)')
    kept = await E(f'{Gd}.profile(1.1, -3.6, 2.1, -3.6, 101)')
    await E("palaceDebug.place(0, 2.6, -7.5, true); palaceDebug.look(Math.PI, -0.55)"); await pump(pg, 2)
    await pg.screenshot(path=os.path.join(SHOTS, 'hall-garden.png'))
    await E("palaceDebug.place(-7.3, 0, -3.1, false); palaceDebug.look(-Math.PI / 2, -0.3)"); await pump(pg, 2)
    await pg.screenshot(path=os.path.join(SHOTS, 'hall-stand.png'))
    # the bench: from the garden's side you face the garden; from the far side, away
    await E('palaceDebug.place(5.6, 0, -1.2, false); palaceDebug.look(-Math.PI / 2, -0.3)')
    r['bench clicked'] = await E('palaceDebug.MP.Interact.useRay([5.6, 1.6, -1.2], [0.8, -1.16, 0])')
    seat = await E('[palaceDebug.MP.Player.seat && palaceDebug.MP.Player.seat.eye, palaceDebug.MP.R.rig.rotation.y, palaceDebug.MP.Player.head(new THREE.Vector3()).y]')
    r['seated facing garden'] = abs(seat[1] - math.pi / 2) < 0.01 and abs(seat[2] - seat[0]) < 0.02
    await pump(pg, 2); await pg.screenshot(path=os.path.join(SHOTS, 'hall-bench.png'))
    await pg.keyboard.down('w'); await pump(pg, 2); await pg.keyboard.up('w')
    r['stood up'] = await E('palaceDebug.MP.Player.seat === null')
    await E('palaceDebug.place(7.2, 0, -1.2, false)')
    r['other side'] = await E('palaceDebug.MP.Hall.sit()'); await E('palaceDebug.MP.Player.stand()')
    # sound: the cascade starts with everything else on a click
    await pg.mouse.click(400, 240); await pg.wait_for_timeout(800)
    r['cascade sound'] = (await E('palaceDebug.sound()')).get('cascade')
    # reload: the open leaf, the sand, the settings are kept
    await pg.wait_for_timeout(1800)
    await pg.goto(URL); await ready(pg)
    r['gate after reload'] = await E('palaceDebug.MP.Gate.angles()')
    r['settings after reload'] = (await E(f'{Gd}.report()'))['settings']
    now = await E(f'{Gd}.profile(1.1, -3.6, 2.1, -3.6, 101)'); r['sand kept'] = max(abs(a - b) for a, b in zip(now, kept)) <= 0.011 and grooves(now) == grooves(kept)
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
    E = pg.evaluate
    r['in VR'] = await E('palaceDebug.presenting()')
    async def frames(n):  # wait for n more frames
        f0 = await E('palaceDebug.frames().length')
        for _ in range(80):
            await pg.wait_for_timeout(150)
            if await E('palaceDebug.frames().length') >= f0 + n: return
    # the rig faces yaw; a hand at world (x, y, z) is at this controller position in the rig
    async def hand(rig, yaw, w):
        dx, dz = w[0] - rig[0], w[2] - rig[1]; c, s = math.cos(yaw), math.sin(yaw)
        lx, lz = dx * c - dz * s, dx * s + dz * c
        await E(f'__iwer.controllers.right.position.set({lx}, {w[1]}, {lz})'); await frames(2)
    async def squeeze(v): await E(f"__iwer.controllers.right.updateButtonValue('squeeze', {v})"); await frames(2)
    # grip the right leaf's outer ring and pull it back toward you
    rings = await E('palaceDebug.MP.Gate.rings()'); ro = next(x for x in rings[1] if x['outer'])['at']
    rig = [ro[0], -13.4]; await E(f'palaceDebug.place({rig[0]}, 0, {rig[1]}, true); palaceDebug.MP.R.rig.rotation.y = Math.PI')
    await hand(rig, math.pi, ro); r['in reach of the ring'] = await E("!!palaceDebug.MP.Grab.within(palaceDebug.MP.Player.hand('right'))")
    a0 = (await E('palaceDebug.MP.Gate.angles()'))[1]
    await squeeze(1)
    for k in range(1, 6): await hand(rig, math.pi, [ro[0] - 0.05 * k, ro[1], ro[2] - 0.25 * k])
    await squeeze(0)
    a1 = (await E('palaceDebug.MP.Gate.angles()'))[1]; await frames(2)
    r['pulled the right leaf'] = [round(a0, 2), round(a1, 2)]
    r['stays where left'] = abs((await E('palaceDebug.MP.Gate.angles()'))[1] - a1) < 0.01
    # the rake: take it off its rack, lower it into the sand, drag it
    rig = [-6.7, -1.2]; await E(f'palaceDebug.place({rig[0]}, 0, {rig[1]}, true); palaceDebug.MP.R.rig.rotation.y = -Math.PI / 2')
    await hand(rig, -math.pi / 2, [-5.85, 1.12, -0.9]); await squeeze(1)
    r['holding the rake'] = await E("(palaceDebug.MP.Grab.holding(palaceDebug.MP.Player.hand('right')) || {}).label")
    before = await E('palaceDebug.MP.Garden.profile(-4.35, -0.4, -3.15, -0.4, 121)')
    h = [-4.35, 0.2, 2.1]; await hand(rig, -math.pi / 2, h)
    r['tines in the sand'] = [round(v, 2) for v in await E('palaceDebug.MP.Garden.rakeTip()')]
    for k in range(1, 9): await hand(rig, -math.pi / 2, [h[0] + 0.6, h[1], h[2] - 0.25 * k])
    after = await E('palaceDebug.MP.Garden.profile(-4.35, -0.4, -3.15, -0.4, 121)')
    r['raked with the real rake'] = [grooves(before), grooves(after)]
    await squeeze(0); await frames(6)
    r['rake back on its rack'] = (await E('palaceDebug.MP.Garden.report()'))['rake']
    # a rock: pick it up and set it down somewhere else
    rk = (await E('palaceDebug.MP.Garden.report()'))['rocks'][0]
    rig = [rk[0] - 0.6, rk[2]]; await E(f'palaceDebug.place({rig[0]}, 0, {rig[1]}, true); palaceDebug.MP.R.rig.rotation.y = -Math.PI / 2')
    await hand(rig, -math.pi / 2, [rk[0], rk[1] + 0.1, rk[2]]); await squeeze(1)
    r['holding a rock'] = await E("(palaceDebug.MP.Grab.holding(palaceDebug.MP.Player.hand('right')) || {}).label")
    await hand(rig, -math.pi / 2, [rk[0] + 0.5, 1.0, rk[2] - 0.8]); await squeeze(0); await frames(6)
    moved = (await E('palaceDebug.MP.Garden.report()'))['rocks'][0]
    r['rock moved'] = [round(moved[0] - rk[0], 2), round(moved[2] - rk[2], 2), round(moved[1], 2)]
    r['vr errors'] = errs[:3]
    await ctx.close()

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8838'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=GL)
            await flat(b, r); await vr(b, r); await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    ga = r['gate after click']
    ok = (r['gate at first'] == [0, 0] and r['shut gate stops you'] and r['shut gate stops arcs'] == 'wall' and r['ring clicked'] and ga[0] > 1.5 and ga[1] == 0
          and r['walked into the hall'] and abs(r['hall floor'] - 0.04) < 1e-6 and r['ceiling stops arcs'] == 'wall' and r['teleport to landing']
          and abs(r['up the first flight'] - 3.6) < 0.05 and r['top landing'][0] < -3.3 and abs(r['top landing'][1] - 7.2) < 0.05
          and r['raked'] and r['grooves across before'] == 0 and r['grooves across after'] >= 4
          and r['rocks 3'] == 3 and r['settings'] == {'rocks': 3, 'sand': 'Charcoal', 'tines': 7} and r['tines on the rake'] == 7 and r['smoothed']
          and r['seated facing garden'] and r['stood up'] and r['other side'] == 'away' and r['cascade sound']
          and r['gate after reload'] == ga and r['settings after reload'] == r['settings'] and r['sand kept'] and not r['flat errors']
          and r['in VR'] and r['in reach of the ring'] and r['pulled the right leaf'][1] > 0.5 and r['stays where left']
          and r['holding the rake'] == 'Rake' and r['raked with the real rake'][0] == 0 and r['raked with the real rake'][1] >= 3
          and math.hypot(r['rake back on its rack'][0] + 5.85, r['rake back on its rack'][2] + 0.5) < 0.05
          and r['holding a rock'] == 'Rock' and abs(r['rock moved'][0] - 0.5) < 0.1 and abs(r['rock moved'][1] + 0.8) < 0.1 and not r['vr errors'])
    print('HALL TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
