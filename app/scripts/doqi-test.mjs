// Browser check of the DOQI office (headless Chromium, software WebGL): J.E.F.F.'s eyes follow the mouse,
// clicking the stamp files a form (mark + count), it is remembered after a reload, "Stamp it" works,
// clicking J.E.F.F. shows a ruling, no errors. Screenshots + results.json in diorama/renders/exhibits/doqi/test/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "exhibits", "doqi", "test");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".woff2": "font/woff2", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4186, "127.0.0.1");

const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
const errors = [], results = {};
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
const wait = (ms) => page.waitForTimeout(ms);
const frames = async (n = 10) => { for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await wait(80); } };
const shot = async (f) => { await frames(3); await page.screenshot({ path: path.join(OUT, f), timeout: 180000 }); console.log("shot", f); };
const open = async () => {
  await page.goto("http://127.0.0.1:4186/games/doqi?test");
  await page.waitForFunction(() => window.__exhibit?.ready && window.__doqi, null, { timeout: 240000 });
  await frames(6);
};
const at = (name) => page.evaluate((n) => {
  const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect();
  const p = window.__exhibit.project(n);
  return p && { x: r.left + p.x, y: r.top + p.y };
}, name);
const doqi = () => page.evaluate(() => ({ count: window.__doqi.count(), marks: window.__doqi.marks(), face: window.__doqi.face() }));
const settle = async () => { for (let i = 0; i < 40; i++) { await frames(2); } };

await open();
await page.evaluate(() => localStorage.removeItem("b3d-doqi-filed-v1"));
await open();
await shot("01_loaded.png");
await page.mouse.move(80, 450); await frames(4);
const left = (await doqi()).face.px;
await page.mouse.move(1580, 450); await frames(4);
const right = (await doqi()).face.px;
results.eyes = { left, right };
const st = await at("DQ_Stamp");
await page.mouse.click(st.x, st.y);
await frames(4);
await shot("02_stamping.png");
await settle();
results.after_stamp = await doqi();
await shot("03_filed.png");
await open();
results.after_reload = await doqi();
await page.getByRole("button", { name: "Stamp it" }).click();
await settle();
results.after_button = await doqi();
const jf = await at("DQ_Jeff_Screen");
await page.mouse.click(jf.x, jf.y);
await frames(4);
results.ruling = (await doqi()).face.text;
results.readout = await page.locator(".dice-result").textContent();
await shot("04_ruling.png");
results.checks = {
  eyes_follow_mouse: left < -0.2 && right > 0.2,
  stamp_files_a_form: results.after_stamp.count === 1 && results.after_stamp.marks === 1,
  remembered_after_reload: results.after_reload.count === 1 && results.after_reload.marks === 1,
  stamp_button: results.after_button.count === 2 && results.after_button.marks === 2,
  jeff_ruling: !!results.ruling && /J\.E\.F\.F\.:/.test(results.readout || ""),
  no_errors: errors.length === 0,
};
results.errors = errors;
fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
await browser.close();
server.close();
