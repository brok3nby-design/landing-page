// Live WRFM on the desk radio (no network needed: CloudFront is stood in by a local track that supports seeking).
//   npm run build && node scripts/wrfm-live-test.mjs
// Checks: the radio panel offers Tune in live / Funny clip; tuning in asks WRFM's CloudFront for exactly the
// file the station schedule says is on air, and starts at the same second; the bar shows the real song and
// artist; it keeps playing on other pages; Stop ends it.
import http from "node:http"; import fs from "node:fs"; import path from "node:path";
import os from "node:os";
import { createRequire } from 'node:module'; import { execSync } from 'node:child_process';
import { fileURLToPath } from "node:url";
const { chromium } = createRequire(execSync('npm root -g').toString().trim() + '/x')('playwright');
const DIST = process.env.DIST || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const T = { ".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".wasm":"application/wasm",".png":"image/png",".webp":"image/webp",".glb":"model/gltf-binary",".ogg":"audio/ogg" };
const server = http.createServer((req, res) => { let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html"); if (!fs.existsSync(p)) p = path.join(DIST, "404.html");
  res.writeHead(200, { "Content-Type": T[path.extname(p)] || "application/octet-stream" }); fs.createReadStream(p).pipe(res); }).listen(4201, "127.0.0.1");
const browser = await chromium.launch({ args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errs = []; page.on("pageerror", (e) => errs.push(String(e)));
const asked = [];
// stand-in for WRFM's CloudFront: any file -> a long local Vorbis clip (so seeking into a song works)
// a 7-minute stand-in track (made with ffmpeg) so the deck can seek into the middle of a "song"
const longOgg = path.join(os.tmpdir(), "wrfm-standin.ogg");
if (!fs.existsSync(longOgg)) execSync(`ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=220:duration=420" -c:a libvorbis -q:a 0 ${longOgg}`);
const LONG = fs.readFileSync(longOgg);
await page.route("https://dfoy1tvbxddp7.cloudfront.net/**", (r) => {    // like S3/CloudFront: byte ranges (seeking)
  asked.push(r.request().url().split("/").pop());
  const m = /bytes=(\d+)-(\d*)/.exec(r.request().headers()["range"] || "");
  if (!m) return r.fulfill({ status: 200, contentType: "audio/ogg", headers: { "Accept-Ranges": "bytes" }, body: LONG });
  const a = +m[1], b = m[2] ? Math.min(+m[2], LONG.length - 1) : LONG.length - 1;
  r.fulfill({ status: 206, contentType: "audio/ogg", headers: { "Accept-Ranges": "bytes", "Content-Range": `bytes ${a}-${b}/${LONG.length}` }, body: LONG.subarray(a, b + 1) });
});
await page.addInitScript(() => { const play = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { this.loop = false; return play.call(this); }; });
await page.goto("http://127.0.0.1:4201/?test");
await page.waitForFunction(() => window.__exhibit?.ready, null, { timeout: 300000 });
await page.locator(".hotspots .chip", { hasText: "Radio — WRFM" }).click();
await page.waitForTimeout(1500);
console.log("panel buttons:", await page.locator(".radio-actions button").allInnerTexts());
await page.getByRole("button", { name: "Tune in live" }).click();
await page.waitForFunction(() => window.__radio?.state().playing, null, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(1500);
const onAir = await page.evaluate(() => window.__radio.onAir());
const deck = await page.evaluate(() => ({ s: window.__radio.state(), src: window.__radio.src().split("/").pop(), t: window.__radio.time() }));
console.log("on air now (schedule):", JSON.stringify(onAir));
console.log("deck:", JSON.stringify(deck));
console.log("asked CloudFront for the on-air file:", asked.includes(onAir.cid), " | playing from second", deck.t?.toFixed(1), "vs schedule", onAir.offset.toFixed(1));
console.log("bar:", (await page.locator(".radio-bar").innerText()).replace(/\n/g, " | "));

// keeps playing across pages
for (const tab of ["Games", "About", "Passport"]) {
  await page.locator(".nav a", { hasText: new RegExp(`^${tab}$`, "i") }).first().click(); await page.waitForTimeout(2500);
  console.log(`on ${tab}:`, JSON.stringify(await page.evaluate(() => ({ url: location.pathname, playing: window.__radio.state().playing, bar: !!document.querySelector(".radio-bar") }))));
}

await page.getByRole("button", { name: "Stop the radio" }).click(); await page.waitForTimeout(500);
console.log("after Stop:", JSON.stringify(await page.evaluate(() => ({ playing: window.__radio.state().playing, bar: !!document.querySelector(".radio-bar") }))));
const ok = asked.includes(onAir.cid) && Math.abs((deck.t ?? -99) - onAir.offset) < 2 && !errs.length;
console.log("errors:", errs);
console.log(ok ? "\nlive radio in sync with the station" : "\nPROBLEM: live radio not in sync");
process.exitCode = ok ? 0 : 1;
await browser.close(); server.close();
