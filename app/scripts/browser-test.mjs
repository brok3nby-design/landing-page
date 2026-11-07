// Automated browser check of the local prototype (headless Chromium, software WebGL):
// desktop + mobile screenshots, click-to-select on the crate, panel + EXPLORE GAMES link,
// keyboard path (hotspot buttons), routes, camera sweeps, and the no-WebGL fallback. Output: diorama/renders/phase7/.
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
const OUT = path.resolve(APP, "..", "diorama", "renders", "phase10");
fs.mkdirSync(OUT, { recursive: true });
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json",
                ".wasm": "application/wasm", ".png": "image/png", ".webp": "image/webp", ".svg": "image/svg+xml",
                ".mp4": "video/mp4", ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".txt": "text/plain", ".woff2": "font/woff2", ".woff": "font/woff", ".glb": "model/gltf-binary" };
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

async function openHome(page, q = "?test", route = "/") {
  await page.goto(`${URL}${route}${q}`);
  await page.waitForFunction(() => window.__exhibit && window.__exhibit.ready, null, { timeout: 240000 });
  await page.waitForTimeout(1500);
}
async function frames(page, n = 25) {           // demand mode: advance the camera transition
  for (let i = 0; i < n; i++) { await page.evaluate(() => window.__exhibit.invalidate()); await page.waitForTimeout(60); }
}
// wait until queued frames have drawn (software GL can need seconds per frame for close views)
async function settle(page, max = 240) {
  for (let i = 0; i < max; i++) {
    const n = await page.evaluate(() => new Promise((r) => { let n = 0; const t = performance.now();
      const f = () => { n++; if (performance.now() - t < 500) requestAnimationFrame(f); else r(n); }; requestAnimationFrame(f); }));
    if (n > 15) return;
  }
}
async function shot(page, file) { await frames(page, 3); await settle(page); await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, file), timeout: 180000 }); console.log("shot", file); }

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
await desk.locator("button.chip", { hasText: "Crate — the games" }).click();
await frames(desk, 20);
await desk.locator(".panel a.btn", { hasText: "EXPLORE GAMES" }).click();
await desk.waitForTimeout(500);
results.explore_games_url = desk.url();
await shot(desk, "games_from_explore.png");

// camera regression (Phase 7): drag sweeps in normal and look-underneath mode. The camera must never
// jump (the old raycast colliders teleported it ~7 m onto the pivot) or end up inside the model.
const KEEP_OUT = [[[-1.25, -0.15, -1.0], [1.25, 0, 1.0]], [[-0.68, 0.72, -0.88], [0.92, 0.77, -0.16]],
                  [[0.47, 0, -0.86], [0.91, 0.72, -0.16]], [[-0.7, 0.77, -0.88], [0.95, 1.74, -0.62]],
                  [[-0.69, 0.31, -0.21], [0.05, 1.17, 0.48]]];
async function sweep(page, moves) {
  const r = await page.evaluate(() => document.querySelector(".exhibit-canvas canvas").getBoundingClientRect().toJSON());
  const cx = r.left + r.width * 0.55, cy = r.top + r.height * 0.5;
  let prev = (await page.evaluate(() => window.__exhibit.camera())).p, worst = 0, inside = 0;   // worst: step / distance
  for (const [dx, dy, wheel] of moves) {
    await page.mouse.move(cx, cy);
    if (wheel) { await page.keyboard.down("Control"); await page.mouse.wheel(0, wheel); await page.keyboard.up("Control"); }   // Ctrl+wheel zooms
    else { await page.mouse.down(); await page.mouse.move(cx + dx, cy + dy, { steps: 3 }); await page.mouse.up(); }
    await frames(page, 4);
    await settle(page);
    const { p, t } = await page.evaluate(() => window.__exhibit.camera());
    const dist = Math.hypot(p[0] - t[0], p[1] - t[1], p[2] - t[2]);
    worst = Math.max(worst, Math.hypot(p[0] - prev[0], p[1] - prev[1], p[2] - prev[2]) / Math.max(dist, 0.05));
    if (KEEP_OUT.some(([a, b]) => p.every((v, k) => v > a[k] && v < b[k]))) inside++;
    prev = p;
  }
  return { steps: moves.length, worst_step_vs_distance: +worst.toFixed(3), frames_inside_model: inside };
}
await openHome(desk);
const rep = (n, m) => Array.from({ length: n }, () => m);
results.camera_normal = await sweep(desk, [...rep(6, [0, -40]), ...rep(6, [60, 0]), ...rep(4, [0, 0, -300]), ...rep(6, [0, 40])]);
{ // a plain mouse wheel over the 3D view scrolls the page (zoom needs Ctrl/⌘)
  const r = await desk.evaluate(() => document.querySelector(".exhibit-canvas canvas").getBoundingClientRect().toJSON());
  const before = await desk.evaluate(() => ({ y: scrollY, cam: window.__exhibit.camera().p }));
  await desk.mouse.move(r.left + r.width / 2, r.top + r.height / 2);
  await desk.mouse.wheel(0, 400);
  await frames(desk, 6); await desk.waitForTimeout(400);
  const after = await desk.evaluate(() => ({ y: scrollY, cam: window.__exhibit.camera().p }));
  results.wheel_scrolls_page = after.y > before.y && Math.hypot(...after.cam.map((v, i) => v - before.cam[i])) < 1e-3;
  await desk.evaluate(() => scrollTo(0, 0));
}
await desk.locator("button.tool", { hasText: "Look underneath" }).click();
await desk.evaluate(() => window.__exhibit.invalidate());
await settle(desk);
await shot(desk, "home_under_view.png");
results.camera_under = await sweep(desk, [...rep(8, [0, -18]), ...rep(8, [25, 0]), ...rep(4, [0, -18]), ...rep(8, [-25, 0])]);
// a 40 px drag rotates ~0.35 rad (step/distance ~0.35); the old teleport was >> 1
results.camera_ok = results.camera_normal.worst_step_vs_distance < 0.8 && results.camera_under.worst_step_vs_distance < 0.8 &&
                    !results.camera_normal.frames_inside_model && !results.camera_under.frames_inside_model;
await desk.close();                     // free the CPU: software GL is slow for close-up under-views
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
await mob.close();

// ---------- Games page: case lifts + turns, panel, VIEW GAME, returns on close
const games = await browser.newPage({ viewport: { width: 1600, height: 900 } });
games.on("pageerror", (e) => errors.push("games: " + String(e)));
games.on("console", (m) => m.type() === "error" && errors.push("games: " + m.text()));
await openHome(games, "?test", "/games");
await shot(games, "games_page.png");
const y0 = await games.evaluate(() => window.__exhibit.nodeWorld("GAME_Case_01").y);
const cp = await games.evaluate(() => {
  const p = window.__exhibit.project("GAME_Case_01");
  const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect();
  return { x: r.left + p.x, y: r.top + p.y - 10 };
});
await games.mouse.click(cp.x, cp.y);
await frames(games, 45);
const y1 = await games.evaluate(() => window.__exhibit.nodeWorld("GAME_Case_01").y);
results.games = {
  click_selected: await games.evaluate(() => window.__exhibit.selected),
  panel: await games.locator(".panel h2").textContent(),
  view_game: await games.locator(".panel a.btn", { hasText: "VIEW GAME" }).getAttribute("href"),
  stamp_cartridge: await games.evaluate(() => window.__passport.has("cartridge")),
  case_lift_m: +(y1 - y0).toFixed(3),
};
await shot(games, "games_case_selected.png");
await games.keyboard.press("Escape");
await frames(games, 60);
results.games.returned_m = +((await games.evaluate(() => window.__exhibit.nodeWorld("GAME_Case_01").y)) - y0).toFixed(4);
results.games.all_projects_cards = await games.locator(".project-card").count();
await games.locator("button.chip", { hasText: "Bid & Buried" }).focus();
await games.keyboard.press("Enter");
await frames(games, 45);
results.games.keyboard = await games.evaluate(() => window.__exhibit.selected);
await shot(games, "games_keyboard_bid_and_buried.png");
await games.locator(".panel a.btn", { hasText: "VIEW GAME" }).click();
await games.waitForTimeout(900);
results.games.view_game_url = games.url();
results.games.game_page_h1 = await games.locator("h1").first().textContent();
await games.screenshot({ path: path.join(OUT, "game_page_bid_and_buried.png"), fullPage: true });
await games.close();

// ---------- About page: notebook opens on arrival, pages clickable, close/open toggle
const about = await browser.newPage({ viewport: { width: 1600, height: 900 } });
about.on("pageerror", (e) => errors.push("about: " + String(e)));
await openHome(about, "?test", "/about");
await frames(about, 60);
results.about = { angle_after_open: +(await about.evaluate(() => window.__exhibit.nodeWorld("NOTE_Cover_Front").bookAngle)).toFixed(3) };
await shot(about, "about_page.png");
const pp = await about.evaluate(() => {
  const p = window.__exhibit.project("NOTE_Page_R");
  const r = document.querySelector(".exhibit-canvas canvas").getBoundingClientRect();
  return { x: r.left + p.x, y: r.top + p.y };
});
await about.mouse.click(pp.x, pp.y);
await frames(about, 30);
results.about.click_page = { selected: await about.evaluate(() => window.__exhibit.selected), panel: await about.locator(".panel h2").textContent() };
await shot(about, "about_page_selected.png");
await about.keyboard.press("Escape");
await about.locator("button.tool", { hasText: "Close notebook" }).click();
await frames(about, 70);
results.about.angle_after_close = +(await about.evaluate(() => window.__exhibit.nodeWorld("NOTE_Cover_Front").bookAngle)).toFixed(3);
await shot(about, "about_notebook_closed.png");
await about.close();

// ---------- direct game routes
for (const r of ["/games/glass-and-fortune", "/games/labyrinth-fate", "/wrfm", "/graffiti", "/games/under-the-radar",
                 "/about/built-by-design", "/follow", "/press", "/passport", "/settings", "/games/pocket-wilds/updates", "/games/nope"]) {
  const p2 = await browser.newPage();
  await p2.goto(`${URL}${r}`);
  results.direct_routes[r] = await p2.locator("h1").first().textContent();
  await p2.close();
}
const gm = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await openHome(gm, "?test", "/games");
await shot(gm, "games_mobile.png");
await gm.close();

// ---------- Phase 10: real content + ported features
results.phase10 = {};
const p10 = await browser.newPage({ viewport: { width: 1440, height: 900 } });
p10.on("pageerror", (e) => errors.push("p10: " + String(e)));
p10.on("console", (m) => m.type() === "error" && errors.push("p10: " + m.text()));
// old URLs forward to the new routes
results.phase10.old_urls = {};
for (const [from, to] of [["/home.html", "/"], ["/bid-and-buried.html", "/games/bid-and-buried"], ["/lumina-dice.html", "/games/glass-and-fortune"],
                          ["/about.html", "/about"], ["/wrfm.html", "/wrfm"], ["/press-kit.html", "/press"], ["/labyrinth-fate.html", "/games/labyrinth-fate"]]) {
  await p10.goto(`${URL}${from}?test`);
  await p10.waitForURL((u) => new globalThis.URL(u).pathname.replace(/\/$/, "") === to.replace(/\/$/, ""), { timeout: 15000 }).catch(() => {});
  results.phase10.old_urls[from] = new globalThis.URL(p10.url()).pathname === to;
}
// entrance screen at "/" (no ?test), skip preference, music off by default
await p10.goto(`${URL}/`);
await p10.waitForSelector(".entrance", { timeout: 15000 });
results.phase10.entrance_shown = await p10.locator(".entrance").isVisible();
results.phase10.music_off_by_default = (await p10.locator(".music button").first().getAttribute("aria-pressed")) === "false";
await p10.screenshot({ path: path.join(OUT, "entrance.png") });
await p10.locator(".entrance-skip input").check();
await p10.locator(".entrance-enter").click();
results.phase10.entrance_closed = (await p10.locator(".entrance").count()) === 0;
await p10.goto(`${URL}/?`);
await p10.waitForTimeout(1200);
results.phase10.entrance_skipped_next_time = (await p10.locator(".entrance").count()) === 0;
results.phase10.prefs_storage = await p10.evaluate(() => JSON.parse(localStorage.getItem("b3d-preferences-v1")));
// settings persist
await p10.goto(`${URL}/settings?test`);
// "Sound effects" is on by default: switch it off, reload, it stays off (then back on)
const sfxBox = () => p10.locator(".setting", { hasText: "Sound effects" }).locator("input");
results.phase10.sound_effects_on_by_default = await sfxBox().isChecked();
await sfxBox().uncheck();
await p10.reload();
results.phase10.setting_persists = !(await sfxBox().isChecked());
await sfxBox().check();
// project page content: Speck trailer + gallery, WRFM clips, Pocket Wilds log
await p10.goto(`${URL}/games/speck?test`);
await p10.waitForSelector(".gallery img");
results.phase10.speck = { h1: (await p10.locator("h1").first().textContent()).trim(), video: await p10.locator("#trailer video").count(),
                          gallery: await p10.locator(".gallery img").count(), stamp: await p10.evaluate(() => window.__passport.has("visit-speck")) };
await p10.locator(".gallery button").first().click();
results.phase10.lightbox = await p10.locator(".lightbox").isVisible();
await p10.keyboard.press("Escape");
await p10.screenshot({ path: path.join(OUT, "project_speck.png"), fullPage: true });
await p10.goto(`${URL}/wrfm?test`);
await p10.waitForSelector(".clip");
results.phase10.wrfm = { clips: await p10.locator(".clip").count(), audio: await p10.locator(".clip audio").count(),
                         live: await p10.locator('a[href="https://brok3nby-design.github.io/wrfm/"]').count() };
await p10.screenshot({ path: path.join(OUT, "project_wrfm.png") });
await p10.goto(`${URL}/games/pocket-wilds/updates?test`);
await p10.waitForSelector(".build");
results.phase10.pocket_wilds_updates = await p10.locator(".build").count();
await p10.goto(`${URL}/passport?test`);
await p10.waitForSelector(".stamp");
results.phase10.passport = { stamps_listed: await p10.locator(".stamp").count(), earned: await p10.locator(".stamp.earned").count(),
                             storage: await p10.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("b3d-passport-v1")).stamps)) };
await p10.screenshot({ path: path.join(OUT, "passport.png"), fullPage: true });
await p10.goto(`${URL}/?test`);
await p10.waitForSelector(".more #launched");
await p10.screenshot({ path: path.join(OUT, "home_full.png"), fullPage: true });
await p10.close();

// desk discoveries + new clickable objects (needs the Phase 10 desk export)
const d10 = await browser.newPage({ viewport: { width: 1600, height: 900 } });
d10.on("pageerror", (e) => errors.push("d10: " + String(e)));
await openHome(d10);
results.phase10.desk = {};
for (const [node, id] of [["PROP_GameBox_0", "project_labyrinth-fate"], ["PROP_GameBox_2", "project_juicebox"], ["PROP_StickyNote_0", "graffiti"]]) {
  results.phase10.desk[node] = await d10.evaluate(([n]) => !!window.__exhibit.nodeWorld(n) && (window.__exhibit.select(null), true), [node]);
}
await d10.locator("button.chip", { hasText: "Game box — The Maze" }).click();
await frames(d10, 30);
results.phase10.desk.maze_panel = await d10.locator(".panel h2").textContent();
await shot(d10, "home_gamebox_maze.png");
await d10.keyboard.press("Escape");
await d10.evaluate(() => window.__exhibit.select("egg_qa_sticker"));
await frames(d10, 30);
results.phase10.desk.sticker = { panel: await d10.locator(".panel h2").textContent(),
                                 stamp_radar: await d10.evaluate(() => window.__passport.has("radar")),
                                 route: await d10.locator(".panel a.btn").first().getAttribute("href") };
await shot(d10, "home_under_the_radar.png");
await d10.close();

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
