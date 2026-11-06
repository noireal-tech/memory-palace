# Getting around: the teleport arc lands on paving, refuses water, walls, a closed door and a roof, goes through an
# open door into a room, and a landing moves you there with a blink; the Settings face changes turning and teleport
# and keeps them after a reload. Then in an emulated Quest 3 (IWER): the right stick pushed forward aims, letting go
# lands you; snap turn turns by its step; smooth turn turns by about its rate. Takes views into tests/shots/.
import asyncio, subprocess, os, json, math
from playwright.async_api import async_playwright
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, '..'); SHOTS = os.path.join(HERE, 'shots')
IW = open(os.path.join(HERE, 'vendor', 'iwer.min.js')).read()
PLAN = {'rooms': [{'address': a} for a in ['E1.W.N2', 'W1.E.N1', 'C.E.N3']]}
GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
async def ready(pg):
    for _ in range(400):
        await pg.wait_for_timeout(250)
        if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): return True
    return False
async def pump(pg, ms):
    # headless pages only draw a frame when asked: a screenshot asks for one
    for _ in range(max(2, ms // 200)): await pg.screenshot(); await pg.wait_for_timeout(110)
async def flat(b, r):
    ctx = await b.new_context(viewport={'width': 800, 'height': 480}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
    await pg.goto('http://localhost:8837/index.html?debug&nosw'); await ready(pg)
    await pg.set_input_files('#planFile', files=[{'name': 'plan.json', 'mimeType': 'application/json', 'buffer': json.dumps(PLAN).encode()}]); await pg.wait_for_timeout(1500)
    E = pg.evaluate; T = 'palaceDebug.MP.Teleport'
    r['paving'] = await E(f'{T}.aimAt([0, 1.6, -25], [0, -0.3, 1])')
    r['water'] = (await E(f'{T}.aimAt([10, 1.6, -31.5], [0, 0.1, -1])'))['why']
    rm = next(x for x in await E('palaceDebug.MP.Rooms.report()') if x['address'] == 'E1.W.N2'); dx, dz = rm['door']; out = rm['out']; inner = rm['inner']
    r['wall'] = (await E(f'{T}.aimAt([{dx + out * 3}, 1.6, {dz + 2.6}], [{-out}, 0.05, 0])'))['why']
    r['closed door'] = (await E(f'{T}.aimAt([{dx + out * 3}, 1.6, {dz}], [{-out}, -0.05, 0])'))['why']
    cx, cz = (inner[0] + inner[2]) / 2, (inner[1] + inner[3]) / 2
    r['roof'] = (await E(f'{T}.aimAt([{cx}, 14, {cz}], [0.1, -1, 0])'))['why']
    # stand in the street, aim a little ahead: a ring on the paving; that's the view
    await E(f'palaceDebug.place({dx + out * 6}, 0, {dz}, false); palaceDebug.look({out * math.pi / 2}, 0.1)')
    await E("document.getElementById('card').hidden = true")
    await E(f'{T}.aimAt([{dx + out * 6 - out * 0.3}, 1.3, {dz - 0.3}], [{-out}, -0.05, 0.12])'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=os.path.join(SHOTS, 'teleport-ok.png'))
    await E(f'{T}.aimAt([{dx + out * 6 - out * 0.3}, 1.35, {dz - 0.3}], [{-out}, 0.15, 0.05])'); await pg.wait_for_timeout(300)
    await pg.screenshot(path=os.path.join(SHOTS, 'teleport-refused.png'))
    await E(f'{T}.cancel()')
    # open the door: now the arc goes in, under the lintel, and lands on the room's floor
    await E(f"palaceDebug.MP.Rooms.toggleDoor('E1.W.N2')"); await pg.wait_for_timeout(1300)
    inroom = await E(f'{T}.aimAt([{dx + out * 3}, 1.2, {dz}], [{-out}, -0.08, 0])')
    r['open door'] = inroom['ok'] and inner[0] < inroom['point'][0] < inner[2] and inner[1] < inroom['point'][2] < inner[3]
    # land: a blink, and you're there (head over the ring, feet on the floor)
    n0 = await E(f'{T}.count'); await E(f'{T}.release()'); await pump(pg, 900)
    head = await E('(() => { const h = palaceDebug.MP.Player.head(new THREE.Vector3()); return [h.x, palaceDebug.MP.R.rig.position.y, h.z]; })()')
    r['landed'] = (await E(f'{T}.count')) == n0 + 1 and math.hypot(head[0] - inroom['point'][0], head[2] - inroom['point'][2]) < 0.05 and abs(head[1] - inroom['point'][1]) < 0.02
    r['current room'] = await E('palaceDebug.MP.Rooms.current() && palaceDebug.MP.Rooms.current().address')
    r['blink cleared'] = not await E(f'{T}.blinking()')
    # walking under the lintel still works: walk back out through the door
    pos = await E(f'palaceDebug.look({out * math.pi / 2 + math.pi}, 0), palaceDebug.walk(240, 1, 0)')
    r['walk out under lintel'] = (pos[0] - dx) * out > 0.5
    # the Settings face: turning and teleport, kept after a reload
    await E("palaceDebug.MP.Panel.press('Settings')"); await E('palaceDebug.MP.Panel.tick(0.4)')
    r['settings buttons'] = await E('palaceDebug.MP.Panel.buttons()')
    await E("palaceDebug.MP.Panel.press('Turning')"); await E("palaceDebug.MP.Panel.press('Turning')"); await E("palaceDebug.MP.Panel.press('Teleport')")
    await pg.goto('http://localhost:8837/index.html?debug&nosw'); await ready(pg)
    r['after reload'] = await E('palaceDebug.MP.Player.settings')
    r['teleport off: no aim'] = not await E(f'{T}.stick({{ray: palaceDebug.MP.R.camera}}, 0, -1)')
    await E("palaceDebug.MP.Player.setTurn('snap30'); palaceDebug.MP.Player.setTeleport(true)")
    # flat screen: hold Space, let go
    await E('palaceDebug.place(0, 0, -25, false); palaceDebug.look(Math.PI, -0.2)'); await pg.wait_for_timeout(300)
    await pg.keyboard.down('Space'); await pump(pg, 300); aiming = await E(f'{T}.aiming()'); await pg.keyboard.up('Space'); await pump(pg, 900)
    z = await E('palaceDebug.MP.Player.head(new THREE.Vector3()).z')
    r['space teleport'] = aiming and z > -24
    # the panel's Settings face, drawn
    await E("palaceDebug.MP.Panel.press('Settings')"); await E('palaceDebug.MP.Panel.tick(0.4)')
    await E("(() => { const c = palaceDebug.MP.Panel.canvas, a = document.createElement('a'); window.__panel = c.toDataURL(); })()")
    data = await E('window.__panel')
    import base64; open(os.path.join(SHOTS, 'panel-settings.png'), 'wb').write(base64.b64decode(data.split(',')[1]))
    # standing still with your head swaying over a step's edge: the view must not bob between the two floors (the shake
    # Endless Clay once had). 3 cm of sway at 7 Hz-ish, on each edge in the foyer and at the gate's sill.
    r['sway on edges'] = await pg.evaluate('''(function () {
      var P = palaceDebug.MP.Player, rig = palaceDebug.MP.R.rig, out = {};
      [['step', -17.0, 0.04], ['step from below', -17.0, -0.1], ['sill', -12.14, 0.04], ['porch', -19.0, 0.06], ['threshold', -18.75, 0.03]].forEach(function (c) {
        palaceDebug.place(0, c[2], c[1]); rig.position.y = c[2]; var ys = [], last = 0;
        for (var f = 0; f < 240; f++) { var s = Math.sin(f * 0.7) * 0.03; rig.position.z += s - last; last = s; P.move(1 / 72, 0, 0); if (f >= 30) ys.push(rig.position.y); }
        out[c[0]] = Math.round((Math.max.apply(null, ys) - Math.min.apply(null, ys)) * 1000);
      });
      return out; })()''')
    r['flat errors'] = errs
    await ctx.close()

async def vr(b, r):
    ctx = await b.new_context(viewport={'width': 640, 'height': 400}); pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.add_init_script(IW + "\n;(function(){ window.__iwer = new IWER.XRDevice(IWER.metaQuest3); window.__iwer.installRuntime({ forceInstall: true }); })();\n"
                             "addEventListener('load', function () { setTimeout(function () { navigator.xr.dispatchEvent(new Event('sessiongranted')); }, 300); });")
    await pg.goto('http://localhost:8837/index.html?debug&nosw&via=clay')
    for _ in range(300):
        await pg.wait_for_timeout(300)
        if await pg.evaluate('window.palaceDebug && palaceDebug.presenting() && palaceDebug.ready()'): break
    E = pg.evaluate; T = 'palaceDebug.MP.Teleport'
    r['in VR'] = await E('palaceDebug.presenting()')
    await E("palaceDebug.MP.arrive()"); await pg.wait_for_timeout(500)
    # the right controller held out, pointing ahead and a little down
    a = -0.35
    await E(f"(() => {{ const c = __iwer.controllers.right; c.position.set(0.2, 1.3, -0.3); c.quaternion.set({math.sin(a / 2)}, 0, 0, {math.cos(a / 2)}); }})()")
    await pg.wait_for_timeout(400)
    start = await E('(() => { const h = palaceDebug.MP.Player.head(new THREE.Vector3()); return [h.x, h.z]; })()')
    await E("__iwer.controllers.right.updateAxes('thumbstick', 0, -1)"); await pg.wait_for_timeout(600)
    r['vr aiming'] = await E(f'{T}.aiming()'); r['vr aim'] = await E(f'{T}.lastAim()')
    n0 = await E(f'{T}.count'); await E("__iwer.controllers.right.updateAxes('thumbstick', 0, 0)")
    for _ in range(40):  # the emulator draws only a few frames a second: wait for the landing and the end of the blink
        await pg.wait_for_timeout(200)
        if await E(f'{T}.count') > n0 and not await E(f'{T}.blinking()'): break
    end = await E('(() => { const h = palaceDebug.MP.Player.head(new THREE.Vector3()); return [h.x, h.z]; })()')
    r['vr moved (m)'] = round(math.hypot(end[0] - start[0], end[1] - start[1]), 2)
    # snap turn: one push, one step
    yaw = lambda: E('palaceDebug.MP.R.rig.rotation.y')
    y0 = await yaw(); await E("__iwer.controllers.right.updateAxes('thumbstick', 1, 0)"); await pg.wait_for_timeout(500); await E("__iwer.controllers.right.updateAxes('thumbstick', 0, 0)"); await pg.wait_for_timeout(300)
    r['snap step (deg)'] = round(math.degrees(y0 - await yaw()), 1)
    await E("palaceDebug.MP.Player.setTurn('snap45')")
    y0 = await yaw(); await E("__iwer.controllers.right.updateAxes('thumbstick', -1, 0)"); await pg.wait_for_timeout(500); await E("__iwer.controllers.right.updateAxes('thumbstick', 0, 0)"); await pg.wait_for_timeout(300)
    r['snap45 step (deg)'] = round(math.degrees(await yaw() - y0), 1)
    # smooth turn: held for a while, turns steadily (60° a second at full stick)
    await E("palaceDebug.MP.Player.setTurn('smooth')")
    # log each frame's turn against that frame's time step, then read the rate off the frames where the stick was held
    await E("(() => { const MP = palaceDebug.MP; window.__turns = []; let y = MP.R.rig.rotation.y; MP.R.onFrame(function (dt) { const n = MP.R.rig.rotation.y; window.__turns.push([dt, y - n]); y = n; }); })()")
    await E("__iwer.controllers.right.updateAxes('thumbstick', 1, 0)"); await pg.wait_for_timeout(2500); await E("__iwer.controllers.right.updateAxes('thumbstick', 0, 0)")
    rates = await E('window.__turns.filter(t => t[1] > 1e-6 && t[0] > 0).map(t => t[1] / t[0] * 180 / Math.PI).sort((a, b) => a - b)')
    r['smooth rate (deg/s)'] = round(rates[len(rates) // 2], 1) if rates else 0
    r['vr errors'] = errs[:3]
    await ctx.close()

async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8837'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=GL)
            await flat(b, r); await vr(b, r); await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    ok = (r['paving']['ok'] and r['paving']['point'][2] > -25 and r['water'] == 'water' and r['wall'] == 'wall' and r['closed door'] == 'wall' and r['roof'] == 'wall'
          and r['open door'] and r['landed'] and r['current room'] == 'E1.W.N2' and r['blink cleared'] and r['walk out under lintel']
          and all(k in r['settings buttons'] for k in ('Turning', 'Teleport', 'Sound'))
          and r['after reload'] == {'turn': 'smooth', 'teleport': False} and r['teleport off: no aim'] and r['space teleport'] and all(v <= 2 for v in r['sway on edges'].values()) and not r['flat errors']
          and r['in VR'] and r['vr aiming'] and r['vr moved (m)'] > 1 and abs(r['snap step (deg)'] - 30) < 0.5 and abs(r['snap45 step (deg)'] - 45) < 0.5
          and abs(r['smooth rate (deg/s)'] - 60) < 1 and not r['vr errors'])
    print('MOVE TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
