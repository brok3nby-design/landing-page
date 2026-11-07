// Browser check of the WRFM studio (headless Chromium, software WebGL): clicking the microphone puts Vera
// on air (ON AIR lit, the quote shown, the VU needles move), clicking again goes off air, the On air button
// works, the phone rings and Vera picks up (Studio B Passport stamp), the turntable starts the music.
// Screenshots + results.json in diorama/renders/exhibits/wrfm/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "wrfm", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4", ".ogg": "audio/ogg", ".mp3": "audio/mpeg" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4187, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(80); } };
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };
const W = () => page.evaluate(() => ({ onAir: window.__wrfm.onAir(), level: window.__wrfm.level(), needles: window.__wrfm.needles(), music: window.__wrfm.music(), sign: window.__wrfm.sign(), signText: window.__wrfm.signText() }));
// software GL can need seconds per frame for close views: wait until frames are really being drawn
const settle = async () => { for (let i = 0; i < 120; i++) {
  const n = await page.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now();
    const f = () => { n++; window.__exhibit?.invalidate(); if (performance.now() - t < 500) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
  if (n > 12) return; } };
const at = (name) => page.evaluate((n) => {
  const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect();
  const p = window.__exhibit.project(n);
  return p && { x: r.left + p.x, y: r.top + p.y };
}, name);

await page.goto("http://127.0.0.1:4187/wrfm?test");
await page.waitForFunction(() => window.__exhibit?.ready && window.__wrfm, null, { timeout: 240000 });
await page.evaluate(() => { localStorage.removeItem("b3d-wrfm-phone-found"); });
await frames(6);
await shot("01_loaded.png");
const mic = await at("WR_Mic_Body");
await page.mouse.click(mic.x, mic.y);
await frames(15);
results.mic_on = await W();
results.readout = await page.locator(".dice-result").textContent();
await shot("02_on_air.png");
await page.mouse.click(mic.x, mic.y);
await frames(6);
results.mic_off = await W();
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Go on air" }).click();
await frames(6);
results.button_on = await W();
await page.evaluate(() => window.dispatchEvent(new CustomEvent("wr-act", { detail: "phone" })));
await frames(4);
results.ringing = await W();
await wait(3500); await frames(8);
results.after_phone = await W();
results.stamp = await page.evaluate(() => JSON.parse(localStorage.getItem("b3d-passport-v1") || "{}")?.stamps?.["studio-b"] || null);
results.phone_readout = await page.locator(".dice-result").textContent();
await page.evaluate(() => window.dispatchEvent(new CustomEvent("wr-act", { detail: "air" })));   // off air
await frames(4);
const tt = await at("WR_Turntable");
await page.mouse.click(tt.x, tt.y);
await frames(10); await settle(); await frames(10);
results.turntable = await W();
await shot("03_music.png");
results.checks = {
  mic_puts_vera_on_air: results.mic_on.onAir && /On air/.test(results.readout || ""),
  needles_move: results.mic_on.needles.some((a) => a > -0.6) || results.ringing.needles.some((a) => a > -0.6),
  mic_again_goes_off_air: !results.mic_off.onAir,
  on_air_button: results.button_on.onAir,
  phone_rings_and_vera_picks_up: results.ringing.onAir && !!results.stamp && /Vera picks up|The phone/.test(results.phone_readout || ""),
  turntable_starts_music: results.turntable.music === true,
  sign_says_off_air_red: results.turntable.signText === "OFF AIR",
  sign_says_on_air_green: results.mic_on.signText === "ON AIR" && results.mic_on.sign > 0.8,
  no_errors: errors.length === 0,
};
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
