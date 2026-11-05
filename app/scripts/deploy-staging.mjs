// Deploy the PRIVATE STAGING site (test.brok3nbydesign.com) - Phase 8.
//
//   npm run deploy:staging            build with STAGING=1 and push dist/ to the gh-pages branch
//   npm run deploy:staging -- --dry   build + commit locally, don't push
//
// Only the `gh-pages` branch of THIS repository (brok3nby-design/landing-page) is written: a git
// worktree holds that branch, its contents are replaced by dist/, then it is committed and pushed.
// GitHub Pages serves it once the repo's Pages source is set to gh-pages (see diorama/STAGING.md).
// It never touches the live site's repository, its Pages settings or any DNS.
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(APP, "..");
const WT = path.join(REPO, ".staging-worktree");
const DRY = process.argv.includes("--dry");
const sh = (cmd, cwd = REPO) => execSync(cmd, { cwd, stdio: "pipe" }).toString().trim();
const run = (cmd, cwd = REPO) => execSync(cmd, { cwd, stdio: "inherit" });

run("npm run build:staging", APP);
const dist = path.join(APP, "dist");
for (const f of ["CNAME", ".nojekyll", "robots.txt", "version.json", "index.html", "404.html"])
  if (!fs.existsSync(path.join(dist, f))) throw new Error(`staging build is missing ${f}`);
if (!fs.readFileSync(path.join(dist, "index.html"), "utf8").includes('name="robots" content="noindex'))
  throw new Error("staging index.html is missing the noindex meta tag");

const source = sh("git rev-parse --short HEAD");
const dirty = sh("git status --porcelain -- app diorama/data") ? " (with uncommitted changes)" : "";
// worktree on gh-pages (create the orphan branch the first time)
if (fs.existsSync(WT)) run(`git worktree remove --force "${WT}"`);
let remote = "";
try { remote = sh("git ls-remote --heads origin gh-pages"); } catch { /* offline */ }
if (remote) {
  run("git fetch origin gh-pages");
  run(`git worktree add -B gh-pages "${WT}" origin/gh-pages`);
} else {
  run(`git worktree add --detach "${WT}"`);
  run("git checkout --orphan gh-pages", WT);
  run("git rm -rfq .", WT);
}
for (const e of fs.readdirSync(WT)) if (e !== ".git") fs.rmSync(path.join(WT, e), { recursive: true, force: true });
fs.cpSync(dist, WT, { recursive: true });
run("git add -A", WT);
const changed = sh("git status --porcelain", WT);
if (!changed) { console.log("staging is already up to date"); }
else {
  const date = new Date().toISOString().slice(0, 16).replace("T", " ");
  run(`git -c user.name="Claude" -c user.email="noreply@anthropic.com" commit -q -m "Staging ${source}${dirty} ${date} UTC"`, WT);
  if (DRY) console.log("dry run: committed locally on gh-pages, not pushed");
  else {
    for (let i = 0, wait = 2; ; i++, wait *= 2) {
      try { run("git push -u origin gh-pages", WT); break; }
      catch (e) { if (i === 3) throw e; console.log(`push failed, retrying in ${wait}s`); execSync(`sleep ${wait}`); }
    }
  }
}
run(`git worktree remove --force "${WT}"`);
console.log(`staging ${DRY ? "prepared" : "deployed"} from ${source}${dirty} -> gh-pages (https://test.brok3nbydesign.com once DNS + Pages are set up)`);
