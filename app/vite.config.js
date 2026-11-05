import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";

// SITE_BASE lets the same build run at "/" (local, custom domain) or "/repo-name/" (GitHub Pages
// project URL). STAGING=1 builds the private staging site (test.brok3nbydesign.com): not indexed by
// search engines and marked with a small "STAGING" badge. Production launch is a separate phase.
const STAGING = process.env.STAGING === "1";
let commit = "local";
try { commit = execSync("git rev-parse --short HEAD").toString().trim(); } catch { /* not a git checkout */ }
const BUILD = { commit, date: new Date().toISOString().slice(0, 16).replace("T", " ") + " UTC", staging: STAGING };

export default defineConfig({
  base: process.env.SITE_BASE || "/",
  plugins: [
    react(),
    {
      name: "staging-noindex",
      transformIndexHtml(html) {
        return STAGING ? html.replace("<head>", '<head>\n    <meta name="robots" content="noindex, nofollow" />') : html;
      },
    },
  ],
  define: { __BUILD__: JSON.stringify(BUILD) },
  server: { host: "127.0.0.1", port: 5180 },
  build: { chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
});
