# BROK3N BY DESIGN — website prototype (Phase 5)

A **local prototype** of the new interactive 3D studio site. It is completely separate from the production website:
no hosting, DNS or GitHub Pages settings are touched, and nothing is deployed.

## Run it (Windows, Command Prompt)
First-time setup (Git, Node.js and downloading the project) is described in `diorama/preview/WINDOWS.md`. Then:
```bat
cd %USERPROFILE%\landing-page
git pull
cd app
npm install
npm run dev
```
Open the printed address (normally http://127.0.0.1:5180/). Press **Ctrl + C** in the window to stop.

On macOS or Linux:
```bash
cd landing-page/app && npm install && npm run dev
```

## What's in Phase 5
- **Layout:** near-black `#080808`, white and grey type (Inter + Cormorant Garamond, self-hosted), deep-red accents. Text on the left, exhibit on the right; stacked on mobile.
- **Shared exhibit viewer** (`src/exhibit/`), configured per page in `src/content/site.js`: model, scope, camera view, fallback image, colliders, hotspots.
  - The 3D code is lazy-loaded (a separate chunk), so the page text appears immediately.
  - **Navigating the model:** drag/touch to rotate, wheel/pinch to zoom, damping, polar and zoom limits, invisible colliders (platform, desktop, cabinet). **Reset view** and **Look underneath** (wider angle plus an inspection light).
  - **Selecting objects:**
    - hover highlight in subtle deep red;
    - click/tap selection that ignores drags;
    - smooth camera focus that frames the object clear of the info panel.
  - **Info panels** come from `diorama/data/interactions.json`. The crate panel shows **EXPLORE GAMES** → `/games`.
- **Accessibility:**
  - normal HTML navigation everywhere;
  - an "Explore the desk" button list with the same actions as clicking objects;
  - keyboard control of the 3D view (arrows rotate, +/− zoom, R resets);
  - focus moves into a panel when it opens, and Esc closes it;
  - skip link; `prefers-reduced-motion` disables camera animations.
- **Fallbacks:** an image fallback if WebGL2 is missing or the 3D fails (or `?no3d`), plus an "Image view" toggle.
- **Performance:** quality drops automatically on slow devices (no bloom/shadows, lower pixel ratio). Bloom is subtle: only LEDs, lamp and screens glow.
- **Routing:** clean URLs that survive refresh on GitHub Pages. `npm run build` writes `dist/<route>/index.html` and `404.html`. `SITE_BASE=/sub/path/ npm run build` builds for a sub-path.
- **Not yet:** Games, About, Projects, WRFM and Contact are placeholder pages using the same layout. The Games (crate) and About (notebook) exhibits are Phase 6.

## Tests
```bash
npm run test:browser
```
This builds the site and drives headless Chromium. Results go to `diorama/renders/phase5/` (screenshots + `results.json`):
- desktop and mobile screenshots;
- crate click → panel → EXPLORE GAMES → /games;
- drag doesn't select;
- keyboard hotspot path;
- direct routes and the 404 page;
- the fallback image.

The `?test` URL flag renders on demand, for software-GL screenshots.

## Assets
`npm run dev` / `npm run build` copy the latest GLBs, `views.json`, the interaction/game data and fallback renders from `diorama/` into `public/` (git-ignored). Re-export in Blender, then rebuild the site; no manual copying needed.
