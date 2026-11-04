import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// SITE_BASE lets the same build run at "/" (local, custom domain) or "/repo-name/" (GitHub Pages
// project URL). Nothing is deployed by this project; staging needs explicit authorisation.
export default defineConfig({
  base: process.env.SITE_BASE || "/",
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5180 },
  build: { chunkSizeWarningLimit: 1500, assetsInlineLimit: 0 },
});
