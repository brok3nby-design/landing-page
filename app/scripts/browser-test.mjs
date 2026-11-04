// Automated browser check of the local prototype (headless Chromium, software WebGL):
// desktop + mobile screenshots, click-to-select on the crate, panel + EXPLORE GAMES link,
// keyboard path (hotspot buttons), routes, and the no-WebGL fallback. Output: diorama/renders/phase5/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "phase5");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
                ".wasm": "application/wasm", ".png": "image/png", ".woff2": "font/woff2", ".woff": "font/woff", ".glb": "model/gltf-binary" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");          // GitHub Pages behaviour
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4180, "127.0.0.1");
const URL = "http://127.0.0.1:4180";

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const results = {};
const errors = [];

async function openHome(page, q = "?test") {
  await page.goto(`${URL}/${q}`);
  await page.waitForFunction(() => window.__exhibit && window.__exhibit.ready, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
}
async function frames(page, n = 25) {           // demand mode: advance the camera transition
  for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit.invalidate()); await page.waitForTimeout(60); }
}
async function shot(page, file) { await frames(page, 3); await page.waitForTimeout(900); await page.screenshot({ path: path.join(OUT, file), timeout: 120000 }); console.log("shot", file); }

// ---------- desktop
const desk = await browser.newPage({ viewport: { width: 1600, height: 900 } });
desk.on("pageerror", (e) => errors.push(String(e)));
desk.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const t0 = Date.now();
await openHome(desk);
results.desktop_ready_ms = Date.now() - t0;
await shot(desk, "home_desktop.png");

// click the crate on the canvas (projected screen position, offset by the canvas rect)
const pt = await desk.evaluate(() => {
  const p = window.__exhibit.project("NAV_GamesCrate");
  const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect();
  return p && { x: r.left + p.x, y: r.top + p.y };
});
await desk.mouse.click(pt.x, pt.y);
await frames(desk, 30);
results.crate_click = await desk.evaluate(() => ({
  selected: window.__exhibit.selected,
  panel: document.querySelector(".panel h2")?.textContent,
  button: document.querySelector(".panel a.btn")?.textContent,
  href: document.querySelector(".panel a.btn")?.getAttribute("href"),
}));
await shot(desk, "home_crate_selected.png");

// drag on the canvas must NOT select anything
await desk.keyboard.press("Escape");
await frames(desk, 30);
await desk.mouse.move(pt.x, pt.y);
await desk.mouse.down();
await desk.mouse.move(pt.x + 120, pt.y + 10, { steps: 6 });
await desk.mouse.up();
await frames(desk, 10);
results.drag_selects = await desk.evaluate(() => window.__exhibit.selected);

// keyboard path: hotspot button -> panel, focus moves to the panel title
await desk.keyboard.press("Escape");
await desk.locator("button.chip", { hasText: "Headphones" }).focus();
await desk.keyboard.press("Enter");
await frames(desk, 30);
results.keyboard_hotspot = await desk.evaluate(() => ({ selected: window.__exhibit.selected,
  focused: document.activeElement?.id, panel: document.querySelector(".panel h2")?.textContent }));
await shot(desk, "home_headphones_selected.png");
results.after_shot = await desk.evaluate(() => ({ selected: window.__exhibit.selected, panel: !!document.querySelector(".panel") }));

// EXPLORE GAMES navigation from the crate panel
await desk.keyboard.press("Escape");
await desk.locator("button.chip", { hasText: "Game collection crate" }).click();
await frames(desk, 20);
await desk.locator(".panel a.btn").click();
await desk.waitForTimeout(500);
results.explore_games_url = desk.url();
await shot(desk, "games_placeholder.png");

// look-underneath mode
await openHome(desk);
await desk.locator("button.tool", { hasText: "Look underneath" }).click();
await desk.evaluate(() => window.__exhibit.select(null));
results.direct_routes = {};
for (const r of ["/about", "/contact", "/does-not-exist"]) {
  const p2 = await browser.newPage();
  await p2.goto(`${URL}${r}`);
  results.direct_routes[r] = await p2.locator("h1").first().textContent();
  await p2.close();
}

// ---------- mobile
const mob = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await openHome(mob);
await shot(mob, "home_mobile.png");
await mob.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await shot(mob, "home_mobile_scrolled.png");
results.mobile_scrollable = await mob.evaluate(() => document.documentElement.scrollHeight > innerHeight);

// ---------- simulated GPU reset (lost WebGL context) -> image + Retry -> 3D back in safe mode
const lost = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await openHome(lost);
await lost.evaluate(() => document.querySelector(".exhibit-canvas canvas").getContext("webgl2").getExtension("WEBGL_lose_context").loseContext());
await lost.waitForSelector(".fallback .linkbtn", { timeout: 20000 });
results.context_lost = { fallback: await lost.locator(".fallback .note").textContent() };
await lost.screenshot({ path: path.join(OUT, "home_context_lost.png") });
await lost.locator(".fallback .linkbtn").click();
await lost.waitForFunction(() => window.__exhibit && window.__exhibit.ready && document.querySelector(".exhibit-canvas canvas"), null, { timeout: 240000 });
results.context_lost.recovered = true;

// ---------- explicit safe mode
const safeP = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await openHome(safeP, "?test&quality=low");
await shot(safeP, "home_safe_mode.png");

// ---------- no-WebGL fallback
const fb = await browser.newPage({ viewport: { width: 1600, height: 900 } });
await fb.goto(`${URL}/?no3d`);
await fb.waitForSelector(".fallback img");
results.fallback_img = await fb.locator(".fallback img").getAttribute("alt");
await fb.screenshot({ path: path.join(OUT, "home_fallback.png") });

results.errors = errors.slice(0, 10);
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
