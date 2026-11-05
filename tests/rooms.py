# Room facades: a made-up plan with rooms in every band raises facade modules with the band's window shape; a street
# door opens with a click and stays open after a reload; you can walk in and the placeholder room is furnished while
# you're near; naming a room changes its plaque and is kept; an active subject gets its top tier, shuttered when dormant;
# the hand panel's faces flip by tab. Takes views into tests/shots/.
import asyncio, subprocess, os, json, math
from playwright.async_api import async_playwright
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'); SHOTS = os.path.join(ROOT, 'tests', 'shots')
PLAN = {'rooms': [{'address': a} for a in ['W2.W.N1', 'W2.E.N2', 'W1.W.N3', 'W1.E.N1', 'C.W.N2', 'C.E.N3', 'E1.W.N2', 'E1.E.N1', 'E2.W.N1', 'E2.E.N2', 'C.W.N1']]}
async def ready(pg):
    for _ in range(400):
        await pg.wait_for_timeout(250)
        if await pg.evaluate('window.palaceDebug && palaceDebug.ready()'): return True
    return False
async def main():
    os.makedirs(SHOTS, exist_ok=True)
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8836'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    await asyncio.sleep(1); r = {}
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'])
            ctx = await b.new_context(viewport={'width': 1280, 'height': 760}); pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and '404' not in m.text else None)
            await pg.goto('http://localhost:8836/index.html?debug&nosw'); await ready(pg)
            await pg.set_input_files('#planFile', files=[{'name': 'plan.json', 'mimeType': 'application/json', 'buffer': json.dumps(PLAN).encode()}]); await pg.wait_for_timeout(1500)
            E = pg.evaluate
            async def full(addr):   # far rooms are placeholders; wait for the one you're at to come up in full detail
                for _ in range(60):
                    if next((x for x in await E('palaceDebug.MP.Rooms.report()') if x['address'] == addr), {}).get('detail') == 'full': return True
                    await pg.wait_for_timeout(300)
                return False
            rep = await E('palaceDebug.MP.Rooms.report()')
            r['rooms raised'] = len(rep); r['skipped (on the keep)'] = 'C.W.N1' not in [x['address'] for x in rep]
            r['bands'] = sorted(set(x['band'] for x in rep))
            # stand in the street in front of E1.W.N2's door and click it open
            rm = next(x for x in rep if x['address'] == 'E1.W.N2'); dx, dz = rm['door']; out = rm['out']; inner = rm['inner']
            yaw = out * math.pi / 2   # facing the door from the street
            await E(f'palaceDebug.place({dx + out * 3.2}, 0, {dz}, false); palaceDebug.look({yaw}, 0)'); r['full detail at the door'] = await full('E1.W.N2'); await pg.wait_for_timeout(500)
            await pg.evaluate("document.getElementById('card').hidden = true")
            await pg.screenshot(path=os.path.join(SHOTS, 'room-door.png'))
            await E(f'palaceDebug.look({yaw} + 0.12, 0)')   # aim at one leaf, not the gap between them
            r['clicked'] = await E('palaceDebug.MP.Interact.useAhead()'); await pg.wait_for_timeout(1200)
            r['door open'] = next(x for x in await E('palaceDebug.MP.Rooms.report()') if x['address'] == 'E1.W.N2')['open']
            pos = await E(f'palaceDebug.look({yaw}, 0), palaceDebug.walk(150, 1, 0)')
            r['walked inside'] = inner[0] < pos[0] < inner[2] and inner[1] < pos[2] < inner[3]
            await pg.wait_for_timeout(1200)
            r['furnished inside'] = next(x for x in await E('palaceDebug.MP.Rooms.report()') if x['address'] == 'E1.W.N2')['furnished']
            r['current room'] = await E('palaceDebug.MP.Rooms.current() && palaceDebug.MP.Rooms.current().address')
            await E(f'palaceDebug.look({yaw + math.pi}, 0.05)'); await pg.wait_for_timeout(800)  # look back out through the door
            await pg.screenshot(path=os.path.join(SHOTS, 'room-inside-out.png'))
            await E(f'palaceDebug.look({yaw}, 0.05)'); await pg.wait_for_timeout(800)
            await pg.screenshot(path=os.path.join(SHOTS, 'room-inside.png'))
            # name it and make it active
            await E("palaceDebug.MP.Rooms.setName('E1.W.N2', 'Solar vortex')"); await E("palaceDebug.MP.Rooms.setActive('E1.W.N2', true)"); await pg.wait_for_timeout(800)
            # walls stop you: walk into the back wall
            back = await E(f'palaceDebug.look({yaw}, 0), palaceDebug.walk(300, 1, 0)')
            r['back wall stops you'] = inner[0] < back[0] < inner[2]
            # the hand panel's faces flip by tab
            await E("palaceDebug.MP.Panel.press('Make')"); await E('palaceDebug.MP.Panel.tick(0.4)')
            r['panel face'] = await E('palaceDebug.MP.Panel.face()'); r['make buttons'] = await E('palaceDebug.MP.Panel.buttons()')
            # reload: the name, the open door and the active tier are remembered
            await pg.goto('http://localhost:8836/index.html?debug&nosw'); await ready(pg); await pg.wait_for_timeout(800)
            again = next(x for x in await E('palaceDebug.MP.Rooms.report()') if x['address'] == 'E1.W.N2')
            r['after reload'] = {k: again[k] for k in ('name', 'open', 'tier')}
            await E("palaceDebug.MP.Rooms.setActive('E1.W.N2', false)"); await pg.wait_for_timeout(300)
            r['dormant tier'] = next(x for x in await E('palaceDebug.MP.Rooms.report()') if x['address'] == 'E1.W.N2')['tier']
            await E("palaceDebug.MP.Rooms.setActive('E1.W.N2', true)")
            # flat screen: clicking a plaque opens the name box
            await E(f'palaceDebug.place({dx + out * 3.0}, 0, {dz}, false); palaceDebug.look({yaw}, 0.55)'); await full('E1.W.N2'); await pg.wait_for_timeout(400)
            await pg.evaluate("document.getElementById('card').hidden = true")
            await pg.screenshot(path=os.path.join(SHOTS, 'room-plaque.png'))
            r['plaque ahead'] = await E("(() => { const MP = palaceDebug.MP, v = new THREE.Vector3(); MP.R.camera.getWorldDirection(v); const o = new THREE.Vector3().setFromMatrixPosition(MP.R.camera.matrixWorld); const p = MP.Interact.pick(new THREE.Ray(o, v)); return p && p.t.label; })()")
            await pg.mouse.click(640, 380); await pg.wait_for_timeout(400)
            r['name box'] = await E("!!document.getElementById('nameBox') && !document.getElementById('nameBox').hidden && document.getElementById('nameInput').value")
            await pg.keyboard.press('Escape')
            # views of the street and from above
            await E('palaceDebug.place(24, 0, -1, true); palaceDebug.look(Math.PI, 0.02)'); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=os.path.join(SHOTS, 'room-street.png'))
            await E('palaceDebug.place(-62, 30, -78, true); palaceDebug.look(3.75, -0.32)'); await pg.wait_for_timeout(1500)
            await pg.screenshot(path=os.path.join(SHOTS, 'rooms-aerial.png'))
            r['draw cost'] = await E('palaceDebug.stats()')
            r['errors'] = errs
            await b.close()
    finally: srv.terminate()
    for k, v in r.items(): print(k, v)
    ok = (r['rooms raised'] == 10 and r['full detail at the door'] and r['skipped (on the keep)'] and r['bands'] == ['C', 'E1', 'E2', 'W1', 'W2'] and r['clicked'] and r['door open']
          and r['walked inside'] and r['furnished inside'] and r['current room'] == 'E1.W.N2' and r['back wall stops you']
          and r['panel face'] == 'Make' and 'Name this room' in r['make buttons']
          and r['after reload'] == {'name': 'Solar vortex', 'open': True, 'tier': 'active'} and r['dormant tier'] == 'shuttered'
          and r['name box'] == 'Solar vortex' and not r['errors'])
    print('ROOM TESTS', 'PASSED' if ok else 'FAILED')
asyncio.run(main())
