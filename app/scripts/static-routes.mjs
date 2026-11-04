// GitHub Pages has no server-side routing. After `vite build`, write a copy of index.html into a
// folder per route (dist/games/index.html, ...) so direct links and refreshes work with clean URLs,
// plus 404.html for anything else. (Configuration only - nothing is deployed.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(APP, "dist");
const routes = JSON.parse(fs.readFileSync(path.join(APP, "src", "content", "routes.json"), "utf8"));
// one page per game in games.json (adding a game adds its URL)
const games = JSON.parse(fs.readFileSync(path.join(APP, "public", "data", "games.json"), "utf8")).games || [];
for (const g of games) if (g.route) routes.push(g.route);
const html = fs.readFileSync(path.join(dist, "index.html"));
for (const r of routes.filter((r) => r !== "/")) {
  fs.mkdirSync(path.join(dist, r), { recursive: true });
  fs.writeFileSync(path.join(dist, r, "index.html"), html);
}
fs.writeFileSync(path.join(dist, "404.html"), html);
console.log("static route pages:", routes.join(" "), "+ 404.html");
