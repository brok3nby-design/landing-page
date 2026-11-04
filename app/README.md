# BROK3N BY DESIGN — website prototype (Phases 5–7)

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
  - **Navigating the model:** drag/touch to rotate, wheel/pinch to zoom, damping, polar and zoom limits. Invisible keep-out boxes (platform, desktop, cabinet, shelf unit, chair) make the camera slide along surfaces instead of passing through them (Phase 7). **Reset view** and **Look underneath** (orbits a pivot under the desktop, plus an inspection light).
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
- **Games page (`/games`), Phase 6:**
  - the standalone crate with a soft contact shadow, and a game list built from `diorama/data/games.json`;
  - selecting a case (click or list) lifts it out and turns it to the camera, and the panel shows **VIEW GAME** → `/games/<id>`;
  - closing returns the case to its exact place; empty slots say "Coming soon".
- **About page (`/about`), Phase 6:**
  - the notebook opens on arrival, with an Open/Close toggle;
  - the left page, right page and bookmark are clickable (made clickable by page config, no re-export).
- **Game pages (`/games/<id>`):** one per game in `games.json`, with sections to fill after the audit; unknown ids show not found.
- **Phase 7 (visual refinement):**
  - browser lighting copied from the Blender light rigs and checked against the Cycles renders;
  - soft shadows, sharper textures (anisotropic filtering), page crossfades, canvas fade-in and a gentle intro camera move;
  - on-demand rendering (no GPU work while the view is still) and step-wise adaptive quality.
  - Add **`?fps`** to the address (e.g. http://127.0.0.1:5180/?fps) for an overlay with frame rate (while moving), draw calls, triangles and quality level.
- **Not yet:** Projects, WRFM and Contact are placeholder pages. Each game's own miniature exhibit is a future phase.

## Tests
```bash
npm run test:browser
```
This builds the site and drives headless Chromium. Results go to `diorama/renders/phase7/` (screenshots + `results.json`):
- desktop and mobile screenshots;
- crate click → panel → EXPLORE GAMES → /games;
- drag doesn't select;
- keyboard hotspot path;
- direct routes and the 404 page;
- the fallback image;
- Games: case click → lift (11 cm) + panel + VIEW GAME, return on close, empty slot, keyboard list;
- About: opens on arrival, page click → panel, close/open;
- direct game routes;
- a simulated GPU reset, and safe mode;
- camera sweeps (normal and look-underneath): no jumps, never inside the model.

Lighting comparison with the Blender renders (screenshots through the exact Blender cameras):
```bash
npm run build && node scripts/visual-compare.mjs && python3 ../diorama/tools/visual_compare.py
```
Tuning flags for that page mode: `?frame=CAM_Hero&k=1.2&fill=0.8&amb=0.5&rim=1&env=1&sr=7&con=0.12&sat=0.06`.

The `?test` URL flag makes the canvas readable and skips the intro, for software-GL screenshots.

## Assets
`npm run dev` / `npm run build` copy the latest GLBs, `views.json`, the interaction/game data and fallback renders from `diorama/` into `public/` (git-ignored). Re-export in Blender, then rebuild the site; no manual copying needed.
