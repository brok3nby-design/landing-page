// Desk radio + games-crate lift.
//   npm run test:desk-extras     (builds first)
// 1. Home: the "Radio - WRFM clips" option plays a clip with a now-playing bar; Next changes the clip (never the
//    same twice in a row); Stop ends it; the guestbook and radio are clickable items.
// 2. Games: a cartridge from the middle of the crate rises without ever overlapping the cartridges around it.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = await import(pathToFileURL(path.join(execSync("npm root -g").toString().trim(), "playwright", "index.mjs")).href)); }
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(APP, "dist");
const OUT = path.resolve(APP, "..", "diorama", "renders", "phase11", "desk-extras");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".ktx2": "image/ktx2" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4190, "127.0.0.1");
const URL = "http://127.0.0.1:4190";
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const results = {}; let fail = 0;
const check = (k, ok, v) => { results[k] = { ok, v }; if (!ok) fail++; console.log(`${ok ? "ok " : "!! "}${k}`, v === undefined ? "" : JSON.stringify(v)); };

// ---------- 1. the desk radio
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${URL}/?test`);
  await page.waitForFunction(() => window.__exhibit?.ready, null, { timeout: 300000 });
  const ids = await page.evaluate(() => [...document.querySelectorAll(".hotspots .chip")].map((b) => b.textContent));
  check("radio and guestbook options listed", ids.some((t) => /Radio/.test(t)) && ids.some((t) => /Guestbook/.test(t)), ids);
  await page.locator(".hotspots .chip", { hasText: "Radio" }).click();
  await page.waitForSelector(".radio-bar", { timeout: 20000 }).catch(() => {});
  const t1 = await page.locator(".radio-now").textContent().catch(() => null);
  check("radio plays with a now-playing bar", !!t1, t1);
  const titles = [t1];
  for (let i = 0; i < 6; i++) {
    await page.getByRole("button", { name: "Next clip" }).click(); await page.waitForTimeout(500);
    titles.push(await page.locator(".radio-now").textContent().catch(() => null));
  }
  check("Next always changes the clip", titles.every((t, i) => i === 0 || (t && t !== titles[i - 1])), titles);
  await page.screenshot({ path: path.join(OUT, "radio_playing.png") });
  await page.getByRole("button", { name: "Stop the radio" }).click(); await page.waitForTimeout(400);
  check("Stop ends it", (await page.locator(".radio-bar").count()) === 0);
  check("tuned-in stamp after 5 clips", await page.evaluate(() => window.__passport?.has("tuned-in") ?? null), null);
  await page.evaluate(() => window.__exhibit.select("graffiti"));
  for (let i = 0; i < 40; i++) { await page.evaluate(() => window.__exhibit.invalidate()); await page.waitForTimeout(100); }
  check("guestbook opens the Graffiti panel", /Graffiti/.test(await page.locator(".panel").textContent().catch(() => "")));
  const r = await page.evaluate(() => window.__exhibit.selectedRect());
  check("guestbook framed in view", !!r && r.x0 >= 0 && r.x1 <= r.w && r.y0 >= 0 && r.y1 <= r.h, r);
  await page.locator(".exhibit").screenshot({ path: path.join(OUT, "guestbook_selected.png"), timeout: 240000 });
  check("home: no page errors", !errors.length, errors.slice(0, 3));
  await page.close();
}

// ---------- 2. the games crate lift
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${URL}/games?test`);
  await page.waitForFunction(() => window.__exhibit?.ready, null, { timeout: 300000 });
  const fitted = await page.evaluate(() => {
    const c = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect();
    const p = window.__exhibit.project("NAV_GamesCrate_Frame"); return { w: c.width, h: c.height, centre: p };
  });
  await page.locator(".exhibit").screenshot({ path: path.join(OUT, "crate_home.png"), timeout: 240000 });
  const overlap = (a, b) => Math.max(0, Math.min(a[3], b[3]) - Math.max(a[0], b[0])) * Math.max(0, Math.min(a[4], b[4]) - Math.max(a[1], b[1])) * Math.max(0, Math.min(a[5], b[5]) - Math.max(a[2], b[2]));
  const body = (n) => `GAME_Case_0${n}_Body`;
  // home boxes first: any overlap the cases already have at rest is not caused by the lift
  const base = await page.evaluate((ns) => ns.map((n) => window.__exhibit.box(n)), [1, 2, 3, 4, 5].map(body));
  const rest = [2, 4].map((k) => overlap(base[2], base[k - 1]));
  await page.evaluate(() => window.__exhibit.select("game_slot_03"));
  let worst = 0, frames = 0, maxRise = 0;
  for (let i = 0; i < 120; i++) {
    await page.evaluate(() => window.__exhibit.invalidate()); await page.waitForTimeout(40);
    const b = await page.evaluate((ns) => ns.map((n) => window.__exhibit.box(n)), [body(2), body(3), body(4)]);
    worst = Math.max(worst, overlap(b[1], b[0]) - rest[0], overlap(b[1], b[2]) - rest[1]);
    maxRise = Math.max(maxRise, b[1][1] - base[2][1]); frames++;
  }
  check("lifted cartridge never overlaps its neighbours", worst <= 1e-9, { worst_m3: worst, frames, rest_overlap: rest });
  check("cartridge lifts clear of the crate", maxRise > 0.1, { rise_m: +maxRise.toFixed(3) });
  await page.locator(".exhibit").screenshot({ path: path.join(OUT, "crate_lifted.png"), timeout: 240000 });
  results.crate_fit = fitted;
  await page.close();
}
await browser.close(); server.close();
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
console.log(fail ? `\n${fail} problem(s)` : "\nall desk-extras checks pass");
process.exit(fail ? 1 : 0);
