// The site music: a playlist that follows the page's mood (chill / fun / office / creepy), crossfades between
// moods, survives page changes and reloads, and only downloads the track that plays.
//   npm run build && node scripts/music-test.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
let pw;
try { pw = await import("playwright"); }
catch { pw = await import(pathToFileURL(path.join(execSync("npm root -g").toString().trim(), "playwright", "index.mjs")).href); }
const { chromium, devices } = pw;
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = process.env.DIST || path.join(APP, "dist");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
                ".png": "image/png", ".webp": "image/webp", ".glb": "model/gltf-binary", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".ktx2": "image/ktx2" };
const serve = (port) => http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(port, "127.0.0.1");
let fail = 0;
const check = (k, ok, v) => { if (!ok) fail++; console.log(`${ok ? "ok " : "!! "}${k}`, v === undefined ? "" : JSON.stringify(v)); };
const server = serve(4212);
const browser = await chromium.launch({ args: ["--disable-3d-apis", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
const fetched = []; page.on("request", (r) => { if (/\/media\/sounds\/(music\/|site_music)/.test(r.url())) fetched.push(r.url().split("/").pop()); });
const st = () => page.evaluate(() => window.__music.state());
await page.goto("http://127.0.0.1:4212/?test"); await page.waitForTimeout(1500);
await page.locator(".music button").first().click(); await page.waitForTimeout(2000);
const home = await st();
check("plays a chill track on the desk", home.playing && home.mood === "chill" && !!home.title, home);
await page.locator(".nav a", { hasText: /^Games$/i }).first().click(); await page.waitForTimeout(2500);
const games = await st();
check("Games crossfades to the fun track", games.playing && games.mood === "fun" && games.track === "pixel-groove-parade", games);
await page.goto("http://127.0.0.1:4212/games/macabre-dolls?test"); await page.waitForTimeout(2000);
const dolls = await st();
check("after a reload on Macabre Dolls it carries on, creepy", dolls.playing && dolls.mood === "creepy" && ["broken-carousel", "unsettled-lullaby"].includes(dolls.track), dolls);
const moods = await page.evaluate(() => Object.fromEntries(["/", "/about", "/games", "/games/pocket-wilds", "/games/doqi", "/games/macabre-dolls",
  "/games/labyrinth-fate", "/games/under-the-radar", "/wrfm", "/games/speck"].map((p) => [p, window.__music.moodFor(p)])));
check("page moods", moods["/"] === "chill" && moods["/games"] === "fun" && moods["/games/doqi"] === "office" && moods["/games/labyrinth-fate"] === "creepy" && moods["/wrfm"] === "chill", moods);
check("only playing tracks downloaded", new Set(fetched).size <= 3, [...new Set(fetched)]);
await page.locator(".music button").first().click(); await page.waitForTimeout(600);
check("pause", !(await st()).playing);
check("no page errors", !errs.length, errs.slice(0, 3));
await browser.close(); server.close();
console.log(fail ? `\n${fail} problem(s)` : "\nmusic checks pass");
process.exit(fail ? 1 : 0);
