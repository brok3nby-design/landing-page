// Browser check of Juicebox (headless Chromium, software WebGL): clicking the bottle sloshes it, clicking the
// sign flips the board (Passport stamp) and the back reads after a full flip, clicking the truck turns the
// headlights on, the buttons do the same. Screenshots + results.json in diorama/renders/exhibits/juicebox/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "juicebox", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4194, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(60); } };
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };
const J = () => page.evaluate(() => ({ wobbling: window.__juicebox.wobbling(), flips: window.__juicebox.flips(), lights: window.__juicebox.lights(), angle: window.__juicebox.boardAngle() }));
const at = (name) => page.evaluate((n) => { const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect(); const p = window.__exhibit.project(n); return p && { x: r.left + p.x, y: r.top + p.y }; }, name);
const click = async (name) => { const p = await at(name); await page.mouse.click(p.x, p.y); await frames(2); };
await page.goto("http://127.0.0.1:4194/games/juicebox?test");
await page.waitForFunction(() => window.__exhibit?.ready && window.__juicebox, null, { timeout: 240000 });
await frames(6);
await shot("01_loaded.png");
await click("JB_Bottle_Juice");
results.bottle = await J();
await frames(40);
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Reset view" }).click(); await frames(20);
await click("JB_Sign_Front");
results.sign_click = await J();
for (let i = 0; i < 40; i++) await frames(1);
results.after_flip = await J();
results.stamp = await page.evaluate(() => !!JSON.parse(localStorage.getItem("b3d-passport-v1") || "{}")?.stamps?.["strange-places"]);
await shot("02_sign_flipped.png");
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Reset view" }).click(); await frames(20);
await click("JB_Truck_Cab");
for (let i = 0; i < 30; i++) await frames(1);
results.truck_click = await J();
await shot("03_headlights.png");
await page.getByRole("button", { name: "Headlights" }).click(); await frames(6);
results.button_off = await J();
await page.getByRole("button", { name: "Shake the juice" }).click(); await frames(2);
results.button_shake = await J();
results.checks = {
  bottle_click_sloshes: results.bottle.wobbling,
  sign_click_flips: results.sign_click.flips === 1 && Math.abs(results.after_flip.angle - Math.PI) < 0.01,
  sign_stamp: results.stamp,
  truck_click_headlights: results.truck_click.lights === true,
  headlights_button: results.button_off.lights === false,
  shake_button: results.button_shake.wobbling,
  no_errors: errors.length === 0,
};
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
