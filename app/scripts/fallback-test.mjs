// No-3D and reduced-motion check: every page must work without the 3D scene.
//   npm run test:fallback        (builds first)
//
// 1. WebGL switched off in the browser (old phones, graphics disabled, blocked drivers): every page with an
//    exhibit shows its still image (loaded, with alt text) and a note, the page text and its buttons are all
//    there, the nav works, and nothing throws.
// 2. Reduced motion (WebGL on): the home desk loads with no intro animation and the page still works.
// Results: diorama/renders/phase11/fallback/report.json (+ a screenshot per page).
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "phase11", "fallback");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".mp4": "video/mp4", ".ogg": "audio/ogg",
                ".mp3": "audio/mpeg", ".woff2": "font/woff2", ".glb": "model/gltf-binary", ".ktx2": "image/ktx2" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4183, "127.0.0.1");
const URL = "http://127.0.0.1:4183";
const { EXHIBITS } = await import(pathToFileURL(path.join(APP, "src/content/site.js")).href);
const route = (id) => (id === "wrfm" ? "/wrfm" : id === "graffiti" ? "/graffiti" : `/games/${id}`);
const PAGES = [["home", "/"], ["games", "/games"], ["about", "/about"], ...Object.keys(EXHIBITS).map((id) => [id, route(id)])];
const report = { no_webgl: {}, reduced_motion: {} };
let failures = 0;

// ---------- 1. no WebGL at all
const noGL = await chromium.launch({ args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] });
for (const [dname, dev] of [["desktop", { viewport: { width: 1440, height: 900 } }], ["phone", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
  const ctx = await noGL.newContext(dev);
  for (const [name, r] of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/WebGL|webgl|THREE\.WebGLRenderer/.test(m.text()) && errors.push(m.text()));
    await page.goto(`${URL}${r}?test`, { waitUntil: "load", timeout: 120000 });
    await page.waitForSelector(".fallback, .cover-exhibit", { timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(600);
    const res = await page.evaluate(async () => {
      const img = document.querySelector(".fallback img");
      if (img && !img.complete) await new Promise((ok) => { img.onload = img.onerror = ok; setTimeout(ok, 8000); });
      const canvas = document.querySelector(".exhibit canvas");
      return {
        fallback: !!document.querySelector(".fallback"),
        image_loaded: !!img && img.naturalWidth > 0,
        alt: (img?.alt || document.querySelector(".fallback-text")?.textContent || "").length,
        note: document.querySelector(".fallback .note")?.textContent?.trim().slice(0, 80) || "",
        canvas: !!canvas,
        heading: document.querySelector("h1")?.textContent?.trim().slice(0, 40) || "",
        links: document.querySelectorAll("main a[href], main button").length,
        nav: document.querySelectorAll(".nav a").length,
        overflow_px: Math.max(0, document.documentElement.scrollWidth - innerWidth),
      };
    });
    res.errors = errors.slice(0, 4);
    const ok = res.fallback && res.image_loaded && res.alt > 20 && !res.canvas && res.heading && res.links >= 3 && res.nav >= 7 && !res.overflow_px && !errors.length;
    if (!ok) failures++;
    report.no_webgl[`${dname}:${name}`] = { ok, ...res };
    console.log(`${ok ? "ok " : "!! "}no-webgl ${dname.padEnd(7)} ${name.padEnd(18)} img=${res.image_loaded} alt=${res.alt} links=${res.links} note="${res.note}"${errors.length ? " ERR " + errors[0].slice(0, 120) : ""}`);
    if (dname === "desktop" || name === "home") await page.screenshot({ path: path.join(OUT, `${dname}_${name}.jpg`), type: "jpeg", quality: 70 });
    await page.close();
  }
  // the desk's hotspot buttons still open their info (no 3D needed to navigate)
  const page = await ctx.newPage();
  await page.goto(`${URL}/?test`, { waitUntil: "load" });
  await page.waitForSelector(".fallback");
  await page.locator(".hotspots button.chip").first().click();
  const panel = await page.locator(".panel").isVisible().catch(() => false);
  const go = await page.locator(".panel a, .panel button:not(.close)").first().getAttribute("href").catch(() => null);
  report.no_webgl[`${dname}:home_hotspot_panel`] = { ok: panel, link: go };
  if (!panel) failures++;
  console.log(`${panel ? "ok " : "!! "}no-webgl ${dname.padEnd(7)} home hotspot button opens its panel (${go})`);
  await page.close();
  await ctx.close();
}
await noGL.close();

// ---------- 2. reduced motion, WebGL on (software)
const gl = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
{
  const ctx = await gl.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await ctx.addInitScript(() => { try { localStorage.setItem("b3d-preferences-v1", JSON.stringify({ skipIntro: true })); } catch { /* */ } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto(`${URL}/`, { waitUntil: "load" });
  await page.waitForFunction(() => window.__exhibit && window.__exhibit.ready, null, { timeout: 240000 });
  // with reduced motion the camera starts at its resting place: two readings a moment apart are the same
  const pos = () => page.evaluate(() => window.__exhibit.camera?.().p.map((v) => +v.toFixed(3)) ?? null);
  const a = await pos(); await page.waitForTimeout(1500); const b = await pos();
  const still = a === null || JSON.stringify(a) === JSON.stringify(b);
  const anims = await page.evaluate(() => document.getAnimations().filter((x) => x.playState === "running").length);
  const ok = still && anims === 0 && !errors.length;
  if (!ok) failures++;
  report.reduced_motion.home = { ok, still, camera: b, running_css_animations: anims, errors };
  console.log(`${ok ? "ok " : "!! "}reduced-motion home: camera still=${still} css animations=${anims} errors=${errors.length}`);
  await page.screenshot({ path: path.join(OUT, "reduced-motion_home.jpg"), type: "jpeg", quality: 70 });
  await ctx.close();
}
await gl.close();
server.close();
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
console.log(failures ? `\n${failures} problem(s) - see ${path.relative(APP, OUT)}/report.json` : "\nall pages work without 3D");
process.exit(failures ? 1 : 0);
