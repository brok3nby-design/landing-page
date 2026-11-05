// GitHub Pages has no server-side routing. After `vite build`:
//  1. write a copy of index.html into a folder per route (dist/games/index.html, ...) so direct links
//     and refreshes work with clean URLs, plus 404.html for anything else;
//  2. write small forwarding pages for every URL of the OLD website (/home.html, /bid-and-buried.html,
//     ...) so existing links, search results and shares keep working after launch (same pattern the
//     old site already used for lumina-dice.html: meta refresh + canonical + a visible link).
// Configuration only - nothing is deployed.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(APP, "dist");
const BASE = process.env.SITE_BASE || "/";
const STAGING = process.env.STAGING === "1";
const routes = JSON.parse(fs.readFileSync(path.join(APP, "src", "content", "routes.json"), "utf8"));
const projects = JSON.parse(fs.readFileSync(path.join(APP, "public", "data", "projects.json"), "utf8")).projects;
const route = (id) => (id === "wrfm" ? "/wrfm" : id === "graffiti" ? "/graffiti" : `/games/${id}`);
for (const p of projects) if (!routes.includes(route(p.id))) routes.push(route(p.id));
const html = fs.readFileSync(path.join(dist, "index.html"));
for (const r of routes.filter((r) => r !== "/")) {
  fs.mkdirSync(path.join(dist, r), { recursive: true });
  fs.writeFileSync(path.join(dist, r, "index.html"), html);
}
fs.writeFileSync(path.join(dist, "404.html"), html);

// old URL -> new route (AUDIT.md section 6)
const OLD = { "home.html": "/", "about.html": "/about", "built-by-design.html": "/about/built-by-design",
  "follow-development.html": "/follow", "subscribed.html": "/follow/subscribed", "passport.html": "/passport",
  "press-kit.html": "/press", "settings.html": "/settings", "pocket-wilds-changelog.html": "/games/pocket-wilds/updates",
  "lumina-dice.html": "/games/glass-and-fortune", "cyoa.html": "/games" };
for (const p of projects) OLD[`${p.id}.html`] = route(p.id);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
for (const [file, to] of Object.entries(OLD)) {
  const url = BASE.replace(/\/$/, "") + to;
  fs.writeFileSync(path.join(dist, file), `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Brok3n by Design</title>
<link rel="canonical" href="${esc(url)}">${STAGING ? '<meta name="robots" content="noindex, nofollow">' : ""}<meta http-equiv="refresh" content="0; url=${esc(url)}">
<style>body{background:#080808;color:#e8e8e8;font:16px/1.5 system-ui,sans-serif;padding:48px}a{color:#e8e8e8}</style>
</head><body><p>This page has moved. <a href="${esc(url)}">Continue to the new page →</a></p>
<script>location.replace(${JSON.stringify(url)} + location.hash)</script></body></html>\n`);
}
// staging (test.brok3nbydesign.com on GitHub Pages): custom domain, no Jekyll, no indexing, version stamp
if (STAGING) {
  fs.writeFileSync(path.join(dist, "CNAME"), "test.brok3nbydesign.com\n");
  fs.writeFileSync(path.join(dist, ".nojekyll"), "");
  fs.writeFileSync(path.join(dist, "robots.txt"), "User-agent: *\nDisallow: /\n");
  let commit = "local";
  try { commit = (await import("node:child_process")).execSync("git rev-parse --short HEAD").toString().trim(); } catch { /* none */ }
  fs.writeFileSync(path.join(dist, "version.json"), JSON.stringify({ commit, built: new Date().toISOString(), staging: true }, null, 1) + "\n");
  console.log("staging extras: CNAME, .nojekyll, robots.txt (disallow all), version.json");
}
console.log("static route pages:", routes.length, "+ 404.html; old-URL forwards:", Object.keys(OLD).length);
