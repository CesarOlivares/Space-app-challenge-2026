"""QA de la animación explicativa: reloj virtual (tiempos exactos aunque el equipo sea lento), capturas en instantes dados y consola.
Uso: PYTHONPATH=<websockets> python capturas_explainer.py outdir [t1,t2,...]   (sirve dist/ en un puerto al azar)
Con VIDEO=salida.mp4 graba además el clip completo a 30 fps (necesita imageio_ffmpeg)."""
import asyncio, base64, json, os, random, re, shutil, signal, subprocess, sys, tempfile, urllib.request
import websockets
R = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1]; os.makedirs(OUT, exist_ok=True); B = shutil.which("brave-browser") or "chromium"
TIMES = [float(x) for x in sys.argv[2].split(",")] if len(sys.argv) > 2 else [2, 3.8, 6, 8.5, 10.5, 13, 16, 19, 22, 25, 27.5, 31]
CLOCK = re.search(r'CLOCK = r"""(.*?)"""', open(os.path.join(R, "tools/grabar_video.py")).read(), re.S).group(1)
DPR = float(os.environ.get("DPR", ".5")); VIDEO = os.environ.get("VIDEO"); FPS = 30
PROCS = []; UDD = tempfile.mkdtemp(prefix="zenith-expl-")
def matar():
    for q in PROCS:
        try: os.killpg(q.pid, signal.SIGKILL)
        except Exception: pass
    subprocess.run(["pkill", "-9", "-f", UDD])
async def main():
    port, dbg = random.randint(20000, 29999), random.randint(30000, 39999)
    PROCS.append(subprocess.Popen([sys.executable, "-m", "http.server", str(port), "--directory", os.path.join(R, "dist")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True))
    PROCS.append(subprocess.Popen(["nice", "-n", "19", B, "--headless=new", f"--remote-debugging-port={dbg}", f"--user-data-dir={UDD}", "--remote-allow-origins=*", "--disk-cache-size=1",
                                   "--window-size=1920,1080", "--hide-scrollbars", "about:blank"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, start_new_session=True))
    for _ in range(80):
        try: t = json.load(urllib.request.urlopen(f"http://127.0.0.1:{dbg}/json")); break
        except Exception: await asyncio.sleep(.25)
    ws = await websockets.connect([x for x in t if x["type"] == "page"][0]["webSocketDebuggerUrl"], max_size=None)
    n = 0; errs = []; logs = []
    async def send(m, **pr):
        nonlocal n; n += 1; my = n
        await ws.send(json.dumps({"id": my, "method": m, "params": pr}))
        while True:
            d = json.loads(await ws.recv())
            if d.get("method") == "Runtime.exceptionThrown": errs.append(str(d["params"]["exceptionDetails"].get("exception", {}).get("description", d["params"]["exceptionDetails"]))[:300])
            if d.get("method") == "Runtime.consoleAPICalled": logs.append(" ".join(str(a.get("value", a.get("description", ""))) for a in d["params"]["args"])[:300])
            if d.get("id") == my: return d.get("result", {})
    js = lambda e: send("Runtime.evaluate", expression=e, awaitPromise=True, returnByValue=True)
    await send("Page.enable"); await send("Runtime.enable")
    await send("Page.addScriptToEvaluateOnNewDocument", source=CLOCK)
    dpr = 1 if VIDEO else DPR
    await send("Emulation.setDeviceMetricsOverride", width=1920, height=1080, deviceScaleFactor=dpr, mobile=False)
    await send("Page.navigate", url=f"http://localhost:{port}/explainer.html?captura=1")
    for _ in range(150):
        await asyncio.sleep(.2)
        r = await js("!!(window.Globo && document.fonts.status === 'loaded' && !document.getElementById('load') || document.getElementById('load')?.style.opacity !== '')")
        if r.get("result", {}).get("value"): break
    await asyncio.sleep(1.5)  # textura (reloj detenido)
    enc = None
    if VIDEO:
        import imageio_ffmpeg
        enc = subprocess.Popen([imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", str(FPS), "-c:v", "mjpeg", "-i", "-",
                                "-c:v", "libx264", "-preset", "medium", "-crf", "21", "-pix_fmt", "yuv420p", "-movflags", "+faststart", VIDEO], stdin=subprocess.PIPE, start_new_session=True)
        PROCS.append(enc)
    now, end, dt = 0.0, max(TIMES), 1000 / FPS; pend = sorted(TIMES)
    while now <= end + 1e-6:
        if enc:
            shot = await send("Page.captureScreenshot", format="jpeg", quality=90); enc.stdin.write(base64.b64decode(shot["data"]))
        while pend and pend[0] <= now + 1e-6:
            tt = pend.pop(0); shot = await send("Page.captureScreenshot", format="jpeg", quality=80)
            open(os.path.join(OUT, f"e_{tt:05.1f}.jpg"), "wb").write(base64.b64decode(shot["data"]))
        await js(f"window.__advance({dt}); true"); now += dt / 1000
        if not enc and not pend: break
    if enc: enc.stdin.close(); enc.wait()
    done = (await js("JSON.stringify([!!window.__done, window.__marks])")).get("result", {}).get("value")
    print("hecho:", done, "| consola:", logs, "| errores:", errs or "ninguno")
    await ws.close()
try: asyncio.run(main())
finally: matar()
