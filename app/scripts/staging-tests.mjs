// Phase 8: staging test pass on the STAGING build (dist/, STAGING=1), headless Chromium only.
//   npm run test:staging        (builds first)      node scripts/staging-tests.mjs [--no-lighthouse]
// 1. device matrix x pages: no horizontal scroll, nav reachable, exhibit loads (or falls back), an info
//    panel opens fully inside the view, phone tap targets, console errors, a screenshot each
// 2. accessibility: axe-core on every page (desktop + phone), serious/critical violations listed
// 3. performance: Lighthouse (mobile + desktop) for home, Games and a project page, plus transfer sizes
// Output: diorama/renders/phase8/ (report.json, contact sheets, screenshots)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";

let pw;
try { pw = await import("playwright"); }
catch { pw = await import(pathToFileURL(path.join(execSync("npm root -g").toString().trim(), "playwright", "index.mjs")).href); }
const { chromium, devices } = pw;
const require = createRequire(import.meta.url);
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(APP, "dist");
const OUT = path.resolve(APP, "..", "diorama", "renders", "phase8");
fs.mkdirSync(path.join(OUT, "devices"), { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm",
  ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".glb": "model/gltf-binary",
  ".mp4": "video/mp4", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".txt": "text/plain", ".ktx2": "image/ktx2" };
const server = http.createServer((req, res) => {
  let p = path.join(DIST, decodeURIComponent(req.url.split("?")[0]));
  if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, "index.html");
  let status = 200;
  if (!fs.existsSync(p)) { p = path.join(DIST, "404.html"); status = 404; }        // like GitHub Pages
  res.writeHead(status, { "Content-Type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(4186, "127.0.0.1");
const URL = "http://127.0.0.1:4186";
const ARGS = ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"];

const DEVICES = [
  ["iphone-se", { ...devices["iPhone SE"], deviceScaleFactor: 1 }],
  ["iphone-14-pro-max", { ...devices["iPhone 14 Pro Max"], deviceScaleFactor: 1 }],
  ["pixel-7", { ...devices["Pixel 7"], deviceScaleFactor: 1 }],
  ["ipad-mini", { ...devices["iPad Mini"], deviceScaleFactor: 1 }],
  ["ipad-mini-landscape", { ...devices["iPad Mini landscape"], deviceScaleFactor: 1 }],
  ["laptop-1366", { viewport: { width: 1366, height: 768 } }],
  ["desktop-1920", { viewport: { width: 1920, height: 1080 } }],
  ["desktop-2560", { viewport: { width: 2560, height: 1440 } }],
];
const PAGES = [["home", "/", "3d"], ["games", "/games", "3d"], ["project", "/games/bid-and-buried", ""],
               ["wrfm", "/wrfm", ""], ["about", "/about", "3d"], ["passport", "/passport", ""]];
const only = process.argv.find((a) => a.startsWith("--devices="))?.slice(10).split(",");

const report = { built: JSON.parse(fs.readFileSync(path.join(DIST, "version.json"), "utf8")), devices: {}, axe: {}, lighthouse: {}, sizes: {} };
const browser = await chromium.launch({ args: ARGS });

async function settle(page) {               // wait until the on-demand renderer is idle
  for (let i = 0; i < 120; i++) {
    const n = await page.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now();
      const f = () => { n++; if (performance.now() - t < 400) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
    if (n > 12) return;
  }
}

for (const [dname, dev] of DEVICES) {
  if (only && !only.includes(dname)) continue;
  const ctx = await browser.newContext(dev);
  const phone = !!dev.isMobile && dev.viewport.width < 600;
  report.devices[dname] = {};
  for (const [pname, route, kind] of PAGES) {
    const page = await ctx.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await page.goto(`${URL}${route}?test`, { waitUntil: "load", timeout: 120000 });
    let exhibit = "n/a";
    if (kind === "3d") {
      exhibit = await page.waitForFunction(() => (window.__exhibit && window.__exhibit.ready) || document.querySelector(".fallback"), null, { timeout: 240000 })
        .then(async () => (await page.evaluate(() => !!document.querySelector(".fallback"))) ? "fallback" : "3d").catch(() => "timeout");
      await settle(page);
    } else await page.waitForTimeout(800);
    // on phones the nav sits behind the Menu button: open it, check it, close it again
    const toggle = page.locator(".menu-toggle");
    const hasMenu = await toggle.isVisible().catch(() => false);
    if (hasMenu) await toggle.click();
    const r = await page.evaluate(({ phone }) => {
      const W = innerWidth;
      const overflow = document.documentElement.scrollWidth - W;
      const nav = [...document.querySelectorAll(".nav a")].map((a) => a.getBoundingClientRect());
      const navOk = nav.length >= 7 && nav.every((b) => b.width > 0 && b.right <= W + 1 && b.left >= -1);
      const small = [];
      if (phone) for (const el of document.querySelectorAll(".btn, .chip, .tool, .nav a, .music button, .panel .close, .footer-links a, .gallery button")) {
        const b = el.getBoundingClientRect();
        if (b.width === 0 || getComputedStyle(el).visibility === "hidden") continue;
        if (Math.min(b.width, b.height) < 40) small.push(`${(el.textContent || el.getAttribute("aria-label") || el.className).trim().slice(0, 24)} ${Math.round(b.width)}x${Math.round(b.height)}`);
      }
      return { overflow_px: Math.max(0, Math.round(overflow)), nav_ok: navOk, small_targets: [...new Set(small)].slice(0, 12) };
    }, { phone });
    r.menu = hasMenu;
    if (hasMenu) await toggle.click();
    // open an info panel (first hotspot / case / notebook part) and check it sits fully inside the view
    let panel = "n/a";
    if (kind === "3d") {
      const chip = page.locator(".hotspots button.chip").first();
      if (await chip.count()) {
        await chip.click();
        for (let i = 0; i < 25; i++) { await page.evaluate(() => window.__exhibit?.invalidate()); await page.waitForTimeout(60); }
        await settle(page);
        panel = await page.evaluate(() => {
          const p = document.querySelector(".panel"); if (!p) return "missing";
          const b = p.getBoundingClientRect(), e = document.querySelector(".exhibit").getBoundingClientRect();
          return b.left >= e.left - 1 && b.right <= e.right + 1 && b.top >= e.top - 1 && b.bottom <= e.bottom + 1 && b.right <= innerWidth + 1 ? "ok" : `clipped ${Math.round(b.top)}-${Math.round(b.bottom)} in ${Math.round(e.top)}-${Math.round(e.bottom)}`;
        });
      }
    }
    const shot = `devices/${dname}_${pname}.jpg`;
    await page.screenshot({ path: path.join(OUT, shot), type: "jpeg", quality: 72, timeout: 180000 }).catch((e) => errors.push("screenshot: " + e.message));
    report.devices[dname][pname] = { exhibit, panel, ...r, errors: errors.slice(0, 5), shot };
    const ok = r.overflow_px === 0 && r.nav_ok && !errors.length && (panel === "ok" || panel === "n/a") && exhibit !== "timeout";
    console.log(`${ok ? "ok " : "!! "}${dname.padEnd(20)} ${pname.padEnd(9)} exhibit=${exhibit} panel=${panel} overflow=${r.overflow_px} nav=${r.nav_ok} small=${r.small_targets.length} err=${errors.length}`);
    await page.close();
  }
  await ctx.close();
}

// ---------- accessibility (axe-core), desktop + phone
const axeSrc = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
for (const [dname, dev] of [["desktop", { viewport: { width: 1366, height: 768 } }], ["phone", { ...devices["Pixel 7"], deviceScaleFactor: 1 }]]) {
  if (process.argv.includes("--no-axe")) break;
  const ctx = await browser.newContext(dev);
  for (const [pname, route] of [...PAGES, ["press", "/press"], ["contact", "/contact"], ["settings", "/settings"], ["essay", "/about/built-by-design"], ["follow", "/follow"]]) {
    const page = await ctx.newPage();
    await page.goto(`${URL}${route}?no3d`, { waitUntil: "load" });          // the 3D canvas itself isn't DOM content
    await page.waitForTimeout(700);
    await page.addScriptTag({ content: axeSrc });
    const res = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations
      .map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length, sample: v.nodes[0]?.target?.join(" ") })));
    report.axe[`${dname}:${pname}`] = res;
    const bad = res.filter((v) => v.impact === "serious" || v.impact === "critical");
    console.log(`${bad.length ? "!! " : "ok "}axe ${dname}:${pname.padEnd(9)} serious/critical=${bad.length} other=${res.length - bad.length}${bad.length ? "  " + bad.map((v) => `${v.id}(${v.nodes}) ${v.sample}`).join(" | ") : ""}`);
    await page.close();
  }
  await ctx.close();
}
await browser.close();

// ---------- transfer sizes per page (what a first visit downloads)
const sizeOf = (rel) => { try { return fs.statSync(path.join(DIST, rel)).size; } catch { return 0; } };
const js = fs.readdirSync(path.join(DIST, "assets")).filter((f) => f.endsWith(".js")).map((f) => [f, sizeOf(`assets/${f}`)]);
report.sizes = {
  js_total_kb: Math.round(js.reduce((a, [, s]) => a + s, 0) / 1024),
  js_largest: js.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f, s]) => `${f} ${Math.round(s / 1024)} KB`),
  models_mb: Object.fromEntries(["studio_desk.glb", "games_collection.glb", "studio_notebook.glb"].map((f) => [f, +(sizeOf(`models/${f}`) / 1e6).toFixed(2)])),
  media_mb: +(execSync(`du -sb "${path.join(DIST, "media")}"`).toString().split("\t")[0] / 1e6).toFixed(1),
};
console.log("sizes", JSON.stringify(report.sizes));

// ---------- Lighthouse (software rendering here: scores are pessimistic for the 3D pages)
if (!process.argv.includes("--no-lighthouse")) {
  const { default: lighthouse } = await import("lighthouse");
  const chromeLauncher = await import("chrome-launcher");
  const chromePath = fs.existsSync("/opt/pw-browsers/chromium-1243/chrome-linux64/chrome") ? "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome" : chromium.executablePath();
  const lhPages = process.argv.find((a) => a.startsWith("--lh="))?.slice(5).split(",");
  for (const [pname, route] of [["home", "/"], ["games", "/games"], ["project", "/games/bid-and-buried"]]) {
    if (lhPages && !lhPages.includes(pname)) continue;
    for (const form of ["mobile", "desktop"]) {
      const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ["--headless=new", "--no-sandbox", ...ARGS] });
      try {
        const cfg = form === "desktop" ? (await import("lighthouse/core/config/desktop-config.js")).default : undefined;
        const { lhr } = await lighthouse(`${URL}${route}?test`, { port: chrome.port, output: "json", logLevel: "error", maxWaitForLoad: 120000,
                                                                onlyCategories: ["performance", "accessibility", "best-practices", "seo"] }, cfg);
        const s = Object.fromEntries(Object.entries(lhr.categories).map(([k, v]) => [k, Math.round(v.score * 100)]));
        const a = lhr.audits;
        report.lighthouse[`${pname}:${form}`] = { scores: s, fcp: a["first-contentful-paint"]?.displayValue, lcp: a["largest-contentful-paint"]?.displayValue,
          tbt: a["total-blocking-time"]?.displayValue, cls: a["cumulative-layout-shift"]?.displayValue, transfer: a["total-byte-weight"]?.displayValue,
          shifts: (a["layout-shifts"]?.details?.items || []).slice(0, 5).map((i) => `${i.node?.selector || "?"} ${(+i.score).toFixed(3)}`),
          failing: Object.values(a).filter((x) => x.score !== null && x.score < 0.9 && x.scoreDisplayMode === "binary").map((x) => x.id).slice(0, 12) };
        console.log(`lighthouse ${pname}:${form}`, JSON.stringify(report.lighthouse[`${pname}:${form}`]));
      } catch (e) { report.lighthouse[`${pname}:${form}`] = { error: String(e).slice(0, 200) }; console.log(`lighthouse ${pname}:${form} failed`, String(e).slice(0, 200)); }
      await chrome.kill();
    }
  }
}
fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 1));
server.close();
console.log("report:", path.relative(path.resolve(APP, ".."), path.join(OUT, "report.json")));
