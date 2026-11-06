// Browser check of the Glass & Fortune dice (headless Chromium, software WebGL): the exhibit loads with
// red 5 and blue 3 on top, "Roll the dice" rolls both and the result is read and shown, picking up a die
// and throwing it works, no die is lost, no errors. Screenshots + results.json in
// diorama/renders/exhibits/glass-and-fortune/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "glass-and-fortune", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4182, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(80); } };
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };
const settled = async () => {           // wait for the next announced result
  for (let i = 0; i < 120; i++) { const d = await page.evaluate(() => window.__dice); if (d?.dice) return d; await frames(4); }
  return null;
};
const summary = (d) => d && { faces: d.dice.map((x) => `${x.colour} ${x.value}${x.flat ? "" : " (cocked)"}`), total: d.total };

await page.goto("http://127.0.0.1:4182/games/glass-and-fortune?test");
await page.waitForFunction(() => window.__exhibit?.ready, null, { timeout: 240000 });
await page.waitForFunction(() => window.__dice, null, { timeout: 120000 });
results.start = summary(await page.evaluate(() => window.__dice));
await shot("01_loaded.png");

for (let k = 1; k <= 5; k++) {                       // the button
  await page.evaluate(() => { window.__dice = null; });
  await page.getByRole("button", { name: "Roll the dice" }).click();
  results[`roll_${k}`] = summary(await settled());
  results[`roll_${k}_text`] = await page.locator(".dice-result").textContent();
}
await shot("02_rolled.png");

// pick up the red die, carry it across the table and throw it
const at = (name) => page.evaluate((n) => {
  const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect();
  const p = window.__exhibit.project(n);
  return p && { x: r.left + p.x, y: r.top + p.y };
}, name);
const red = await at("GF_Die_Red");
await page.evaluate(() => { window.__dice = null; });
await page.mouse.move(red.x, red.y);
await page.mouse.down();
await frames(6);
for (let i = 1; i <= 6; i++) { await page.mouse.move(red.x - i * 25, red.y - i * 12); await frames(2); }
await page.mouse.up();
results.throw = summary(await settled());
await shot("03_thrown.png");
const ys = await page.evaluate(() => ["GF_Die_Red", "GF_Die_Blue"].map((n) => window.__exhibit.nodeWorld(n).y));
const ok = (r) => r && r.faces.length === 2 && r.total >= 2 && r.total <= 12;
results.checks = {
  start_is_red5_blue3: JSON.stringify(results.start?.faces) === JSON.stringify(["Red 5", "Blue 3"]),
  button_rolls: [1, 2, 3, 4, 5].every((k) => ok(results[`roll_${k}`])),
  rolls_vary: new Set([1, 2, 3, 4, 5].map((k) => results[`roll_${k}`]?.faces.join())).size > 1,
  readout_shown: /Red \d · Blue \d — \d+/.test(results.roll_5_text || ""),
  throw_works: ok(results.throw),
  dice_not_lost: ys.every((y) => y > -0.05),
  no_errors: errors.length === 0,
};
results.dice_y = ys;
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
