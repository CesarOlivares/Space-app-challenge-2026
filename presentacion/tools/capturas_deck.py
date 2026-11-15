"""QA del deck: captura cada lámina en varios instantes y recoge consola.
Uso: python capturas_deck.py outdir [laminas 1-7 separadas por coma] ; sirve dist/ en :8767"""
import asyncio, base64, json, os, random, shutil, signal, subprocess, sys, tempfile, urllib.request
import websockets
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True); B = shutil.which("brave-browser")
ONLY = [int(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else [1, 2, 3, 4, 5, 6, 7]
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TIMES = {1: [7], 2: [7], 3: [6, 17], 4: [6], 5: [6, 13, 22], 6: [6, 14, 24], 7: [7]}
async def main():
    port, dbg = random.randint(20000, 29999), random.randint(30000, 39999)
    srv = subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", os.path.join(R, "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    p = subprocess.Popen([B, "--headless=new", f"--remote-debugging-port={dbg}", "--disk-cache-size=1", f"--user-data-dir={UDD}", "--remote-allow-origins=*", "--window-size=1920,1080", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True)
    PROCS.extend([p, srv])
    for _ in range(60):
        try: t = json.load(urllib.request.urlopen(f"http://127.0.0.1:{dbg}/json")); break
        except Exception: await asyncio.sleep(.2)
    ws = await websockets.connect([x for x in t if x["type"] == "page"][0]["webSocketDebuggerUrl"], max_size=None)
    n = 0; errs = []; infos = []
    async def send(m, **pr):
        nonlocal n; n += 1; my = n
        await ws.send(json.dumps({"id": my, "method": m, "params": pr}))
        while True:
            d = json.loads(await ws.recv())
            if d.get("method") == "Runtime.exceptionThrown": errs.append(str(d["params"]["exceptionDetails"].get("exception", {}).get("description", d["params"]["exceptionDetails"]))[:400])
            if d.get("method") == "Runtime.consoleAPICalled":
                txt = " ".join(str(a.get("value", a.get("description", ""))) for a in d["params"]["args"])
                (infos if d["params"]["type"] == "info" else errs if d["params"]["type"] in ("error", "warning") else []).append(txt[:200])
            if d.get("id") == my: return d.get("result", {})
    await send("Runtime.enable"); await send("Page.enable")
    await send("Emulation.setDeviceMetricsOverride", width=1920, height=1080, deviceScaleFactor=0.5, mobile=False)
    for i in ONLY:
        await send("Page.navigate", url=(os.environ.get("BASE") or f"http://localhost:{port}/index.html") + f"?v={i}#lamina-{i}")
        t0 = 0
        for k, tm in enumerate(TIMES[i]):
            await asyncio.sleep(tm - t0); t0 = tm
            for _try in range(4):
                r = await send("Page.captureScreenshot", format="jpeg", quality=80)
                if "data" in r: open(f"{OUT}/s{i}_{k}.jpg", "wb").write(base64.b64decode(r["data"])); break
                await asyncio.sleep(1.5)
        await asyncio.sleep(1)
    print("consola:", infos); print("errores:", errs or "ninguno"); 
PROCS = []
UDD = tempfile.mkdtemp(prefix="zenit-qa-")
def matar():  # cierra el navegador y todos sus procesos hijos
    for q in PROCS:
        try: os.killpg(q.pid, signal.SIGKILL)
        except Exception: pass
    subprocess.run(["pkill", "-9", "-f", UDD])  # Brave crea procesos fuera del grupo
try: asyncio.run(main())
finally: matar()
