# CHANGELOG

## Phase 1 — blockout (2026-11-04)
- Phase 0 audit: no Blender installed; blender.org blocked; installed official `bpy` 5.2.3 into `diorama/.venv`.
- Added reproducible pipeline: `blender/build.py`, `config.py` (all dimensions), `lib/` (geometry, materials, cameras, checks), `parts/` (one file per area).
- Built platform, rug, desk + cabinet + low shelf, riser + upper shelf, two monitors, chair, placeholder props and collectibles; 10 named collections.
- Auto-framed cameras; 4 preview renders; automated contact/collision checks (all passing).
- Iteration after first render: rug pulled inside platform chamfer, chair moved closer to desk and back shortened, hero camera azimuth 22°→18° to match reference, key light reduced.

## Phase 2 — detailed modeling (2026-11-04)
- Locked Phase 1 (`APPROVED_FILES`). Build now writes `diorama_phase2.blend` and `renders/phase2/`.
- New helpers: lathe (revolved shapes), smooth tubes (cables, vines, handles, headband), merged meshes, subdivided grids, world-scale box UVs, decal "fit" UVs with atlas regions, auto sharp edges.
- New `lib/textures.py`: 20 original code-painted textures (wood ×3, planks, rug, plaid, leather ×2, quilt, fabric, deskmat, 2 screens, sketchbook, 2 mug wraps, book spines, cartridge labels, crate, game boxes); cached on disk.
- New `lib/library.py`: single named material library (glTF-compatible PBR).
- Detailed every area (see ASSET_INVENTORY). Added cloth-simulated blanket with a push-out clean-up pass.
- Added `FAN_ART` switch for the figurines/logos (user requested the reference characters).
- Added close-up cameras (desk, shelf, chair).
- Fixes after review renders: finer/lower-contrast wood grain, keyboard and mouse glow toned down, blanket no longer clips the chair wing, figurine hair reshaped, denser pothos.

### Phase 2 addendum — website direction (2026-11-04)
- Recorded the expanded direction (interactive 3D studio website) in `PROJECT_DIRECTION.md`. The desk stays the homepage exhibit; no rebuild.
- Reuse review found that only the crate needed changes. The crate and its cartridges were separate objects under the scene root, the cases had no stable names, and their labels shared meshes with the bin. Low-risk fixes:
  - New reusable `NAV_GamesCrate` hierarchy (`storage.games_crate()`), same position under the desk.
  - Crate cartridges became `GAME_Case_01..05`: groups with origins at their bases, `game_slot` metadata, their own label mesh and per-slot label material, and `game_slot_XX` tags (scope `games`).
  - The crate is tagged `games_crate` (scope `home`). The bin's `cartridge` tag is retired.
  - Interactive tags gained `interactive_scope`.
- Added `data/games.json` (slots 1–3: Glass & Fortune, Department of Questionable Inventions, Locker Auction, all placeholder text; 4–5 empty) and `data/interactions.json`.
- Added crate close-up (`08`) and a standalone asset render (`09`) with a hidden-by-default exhibit spotlight.
- Fixed coplanar floor/wall faces in open containers (dark strip on crate/bin bottom edges).
- Tested exporting only the `NAV_GamesCrate` hierarchy to GLB and re-importing it: names, extras and local transforms intact.

## Phase 3 — lighting, materials, polish, artwork slots (2026-11-04)
- Locked Phase 2. Build defaults to `--phase 3` → `diorama_phase3.blend`, `renders/phase3/`.
- **Lighting:** a new rig (key spot, soft fill, purple and amber rims, screen-tinted monitor lights, LED-strip area lights, lamp filament light). The world matches the website `#080808`. AgX Medium High Contrast look, exposure −0.35, firefly clamp, 128 samples (beauty 256).
- **Beauty render:** `CAM_Beauty` with depth of field, plus numpy bloom post (`lib/post.py`). Both are Blender-only.
- **Reusable exhibit rig:** `lights.exhibit_rig()`, scaled to the asset (used for the standalone crate).
- **Materials:** code-generated normal maps (12) and roughness maps (3) wired into the library. Calmer grain on the hutch back panel and riser back.
- **Details:** chair headrest pillow and stitch channels; mug steam (Blender-only); sticky notes; keyboard glow toned down; bluer purple LEDs; brighter screens.
- **Artwork slots** (`lib/artwork.py`, `custom/`): 22 slots (screens, mugs, deskmat, rug, blanket, sketchbook, crate print, 6 book spines, 5 game labels).
  - Custom images override the defaults. A manifest tracks changes, and removing an image restores the default.
  - Templates are generated, and objects are tagged `artwork_slot`.
  - Game labels became per-slot textures; `games.json` `label_texture` is honoured.
  - The mug lathe now maps the image to the outer wall only, with a ceramic second material for the handle, rim and inside.
- **Verified:**
  - A test image dropped into the `mug_wrap` slot showed up upright, facing the viewer, and the default came back after removal.
  - The automated checks pass.

## Phase 4 — web-ready assets (2026-11-04)
- **Locked Phase 3.** Build defaults to `--phase 4`.
- **Notebook:** `NAV_Notebook` rebuilt from parts with spine pivots (covers, page blocks, pages), a red bookmark and the pen. Appearance verified unchanged.
- **Tags:**
  - new `interactive_kind` (navigation / discovery);
  - newly tagged: headphones (WRFM), contact card holder (new tiny prop + `business_card` artwork slot), books, drawers (now groups).
- **Discoveries:** `parts/discoveries.py` adds 10 `EGG_*` hiding-place markers and two hidden test decals (under the desktop, under the platform).
  - The pixel font now covers the full alphabet, digits and punctuation.
- **`blender/export.py`:**
  - strip Blender-only items;
  - apply modifiers;
  - merge static meshes per material, then merge siblings inside groups;
  - lightmap UVs;
  - AO bake (128 spp) and practical-glow bake (192 spp) into 1024 atlases;
  - glTF material wiring;
  - three GLBs, `views.json`, an export report.
- **`tools/`:**
  - `optimize.mjs`: per-role texture sizes, KTX2 UASTC + RDO + Zstandard, meshopt, prune that keeps empty tagged nodes;
  - `inspect.mjs`: validator, draw calls, triangles, GPU memory estimate, tag listing;
  - `compare.mjs`: comparison sheets.
- **`preview/`** (Vite + three.js technical preview):
  - runtime key/fill/rims, AgX tone mapping, bloom, environment reflections;
  - toggles for AO, glow, runtime lights, shadows, bloom and under-view;
  - scope-aware click picking (click vs drag) and hover highlight;
  - stats overlay and a runtime artwork-swap test;
  - Playwright screenshot suite.
- **Verified in headless Chromium:** all three models load with correct scale and orientation, from default, back, side and under angles. Picking resolves the right ids, the artwork swap works on the mug, a game label and the left screen, and the hybrid lighting comparison is captured.
- **Docs:** EXPORTS.md, EASTER_EGGS.md, `data/interactions.json` rewritten as navigation/discovery, PROJECT_DIRECTION roadmap (11 phases) and staging rules.

## Phase 4 follow-up (2026-11-04)
- The preview's bloom was reduced (strength 0.38 → 0.16, threshold 0.97) and its exposure lowered to 0.92, per feedback that it was too bright.
- Added a Windows quick-start for the preview (`diorama/preview/WINDOWS.md`). The raw-export option is disabled when the raw files aren't present.

## Phase 5 — local website prototype (2026-11-04)
- New `app/` (React 19, Vite 6, React Three Fiber 9, drei 10, postprocessing, React Router 7, self-hosted fonts). It is local only: no deployment, DNS or Pages changes.
- Layout and identity: `#080808`, white and grey type, deep-red accents. Content left, exhibit right; stacked on mobile.
- Shared `<Exhibit>` viewer driven by per-page config.
  - **Loading:** lazy 3D chunk, KTX2 + meshopt GLB, runtime key/fill/rims over the baked AO and glow, room-environment reflections, AgX tone mapping, subtle bloom.
  - **Camera:** CameraControls with damping, limits and colliders; focus transitions that frame the object clear of the panel; reset; look-underneath with an inspection light.
  - **Selection:** scope-aware hover and select that ignores drags. Info panels come from `interactions.json`; the crate panel has EXPLORE GAMES → /games.
- Accessibility: hotspot button list, keyboard camera control, panel focus management, Esc, skip link, reduced motion, image fallback and Image-view toggle.
- The canvas clear colour is compensated (`#111111`) so the tone-mapped background exactly matches the page's `#080808` (measured).
- GitHub Pages-compatible static route pages + 404, and a `SITE_BASE` build option.
- Automated browser test (`npm run test:browser`), all passing with no console errors:
  - crate click → panel and EXPLORE GAMES;
  - a drag doesn't select;
  - the keyboard path;
  - direct routes and 404;
  - mobile scroll;
  - the fallback.

### Phase 5 fix — white exhibit on Windows (2026-11-04)
- **Cause found:** one GPU-compressed texture (business card, 1024×585) wasn't a multiple of 4 in size. Real GPUs reject that; headless Chrome only warned.
  - `tools/optimize.mjs` now snaps every texture to multiples of 4;
  - `tools/inspect.mjs` flags any that slip through;
  - the desk GLB was re-optimised.
- **The site recovers from GPU failures:**
  - a lost WebGL context shows the still render with **Retry 3D**, which reloads in a lighter safe mode (no post-processing or shadows, 1× pixels);
  - a startup error shows the reason on screen;
  - a broken fallback image falls back to a text description.
- **`?quality=low`** forces safe mode.
- **Shadow type:** set to PCF (the removed PCFSoft type is no longer requested).
- **Browser test** now also simulates a GPU reset and runs safe mode. All pass.

## Phase 6 — connected pages (2026-11-04)
- **Games page:**
  - `games_collection.glb` exhibit with a contact shadow, and a game list from `games.json`;
  - selecting a case lifts it 11 cm, turns it to face the camera, and frames the camera on the lifted case;
  - the panel has VIEW GAME → `/games/<id>`; closing restores the case's original transform exactly;
  - empty slots show "Coming soon".
- **About page:** `studio_notebook.glb` exhibit.
  - It opens on arrival: the right-hand pivots rotate about the spine, with a raised axis so the closed book stacks. There's an Open/Close toggle, and the pen hides while closed.
  - The pages and bookmark are clickable via runtime `targets` (no re-export).
- **Game pages** `/games/<id>` come from `games.json` (placeholder sections); unknown ids show not found.
- **Shared viewer additions:**
  - per-page `view` (a camera name or an explicit direction), `targets`, `animation` (`lift-turn` / `notebook`), `contactShadow`, `selectGlow`, `focusScale`;
  - more margin on phones;
  - page fade-in between routes.
- Static route pages for every game URL. New `blender/render_fallbacks.py` renders the About fallback image (`renders/phase6/notebook_fallback.png`).
- **Fix:** leaving an exhibit page no longer reports a false "3D view stopped" (the viewer's own context teardown is ignored).
- **Browser test** extended; all checks pass with no console errors.

## Phase 7 — visual refinement, camera, transitions, performance (2026-11-04)
- **Camera fix (reported: "choppy, and flips all over when looking under the desk"):**
  - Cause, reproduced in headless Chrome: camera-controls' raycast colliders clamp the camera to the first hit from the pivot. The pivot sits on the desktop surface, so looking up from below, the hit was ~0 m away. The camera teleported 6.8 m onto the pivot and spun in place.
  - Replaced with **sliding keep-out boxes**: platform, desktop, cabinet, monitors/shelf unit and chair. Each frame the camera is clamped to the face of the box it entered through, judged from where it was the frame before. It slides along surfaces and can't jump or tunnel through a thin slab. The orbit angle stays continuous (no wrap-around spins).
  - The pivot can no longer wander off into empty space (target boundary = model bounds).
  - **Look underneath** now orbits a pivot under the desktop, starting low at the front-right. It can go down to the floor, crawl under the desk, or go round the platform edge to see underneath it.
  - Same drag sequence: largest jump 6.8 m → 0.16 m, frames inside the model: many → 0. New automated sweep test in `npm run test:browser`.
- **Lighting matched to Cycles:**
  - The runtime rigs are now copies of the Blender rigs in `parts/lights.py`: same key spot position, target and cone. Spot softness is converted from Blender's spot blend, so the pool of light falls off at the platform edges as in the renders.
  - Fill, rims and ambient were re-balanced, and the reflection environment halved (it was adding flat fill light).
  - Soft (PCF radius) shadows, and a light saturation grade closer to the AgX "Medium High Contrast" look. Contrast stays at 0: it crushed the `#080808` background to pure black.
  - Result (`renders/phase7/compare_desk_final.png`, `compare_crate_final.png`, `compare_desk_before_after.png`):
    - mean brightness of the desk 0.320 vs Cycles 0.334; top/bottom bands within 1%, middle 11% lower;
    - saturation 0.286 vs 0.280;
    - crate 0.286 vs 0.273.
  - New comparison tools: `app/scripts/visual-compare.mjs` renders the site through the exact Blender cameras (`?frame=CAM_x`), and `diorama/tools/visual_compare.py` writes side-by-side sheets with luminance numbers (`renders/phase7/compare_*.png`).
- **Sharper textures:** anisotropic filtering (8×) on all model textures. The rug, planks and desk grain stay crisp at grazing angles.
- **Export fix:** merging static meshes deleted the copper pencil cup before its pencils were re-parented, so the pencils (and the red pencil and graphite stick) fell to the scene origin, on the rug by the chair. `merge_static` now flattens every affected object to world space before the first join. The desk was re-exported with `--tag phase7` (writes `source/diorama_phase7*.blend`; the approved Phase 4 files are untouched).
- **Transitions:**
  - page crossfade via the View Transitions API (header stays put), with a simple fade in other browsers;
  - the 3D canvas fades in when its first frame is ready, and the camera eases in from slightly farther on first load;
  - all of these are disabled under `prefers-reduced-motion`.
- **Performance:**
  - rendering is **on demand**: nothing is drawn while the view is still (lower GPU use, heat and battery). Animations, hover and camera moves request frames.
  - new adaptive quality: busy-frame timing steps down to fewer pixels, then to no shadows/bloom. The old monitor misread idle on-demand rendering as slow.
  - the pixel ratio is capped at 1.75;
  - the inspection light is always mounted, so toggling "Look underneath" no longer recompiles every shader (that caused a visible hitch);
  - `?fps` shows an overlay with frame rate, draw calls, triangles, pixel ratio and quality level.

## Phase 9 — existing website audit (brought forward; 2026-11-04)
- Read-only audit of `brok3nby-design/brok3nby-design.github.io` (commit `b66fb99`). Nothing in production was changed. The live domain isn't reachable from the build environment, so the repository was the source.
- `AUDIT.md` covers:
  - a site map of all 25 pages plus the teasers;
  - the homepage and About copy mapped to new-site slots;
  - the full project catalogue (11 projects from `studio-data.js`: status, hooks, cover art, media, progress);
  - corrections to the placeholder data ("Locker Auction" is Bid & Buried; DOQI);
  - old features → 3D equivalents, and an old→new URL preservation map;
  - problems found on the current site (missing share images, private notes publicly served, a stray page, unlinked teasers);
  - open questions.


## Phase 10 — real content, ported features, game boxes (2026-11-04)
- **Content imported from the existing site** with the new `diorama/tools/import_site.py` (read-only; text verbatim, sources recorded):
  - `diorama/data/projects.json`: all 11 projects from `studio-data.js` (status, hook, description, accent, progress report) plus each project page's copy (lead, genres, sections), cover art, gallery, trailer and live link;
  - `diorama/data/site_copy.json`: home, about, the Built by Design essay, follow, press kit, passport, settings, entrance, the five WRFM "Meet the Station" clips with transcripts, the 52-entry Pocket Wilds update log, studio facts and links;
  - `app/media/`: only the media the new site uses. Images are re-encoded to WebP (max 1600 px) and the Speck and Pocket Wilds trailers, WRFM clips, site music and cartridge sound are copied. Nothing comes from `teasers/`.
- **The crate holds the five most active games:** Glass & Fortune, Bid & Buried, Speck, Pocket Wilds and DOQI, each with its real cover art on the case label (`diorama/custom/covers/`, via `label_texture`).
  - Under the Radar stays secret; the sticker under the desktop reveals it and earns a stamp.
- **The desk, re-exported with `--tag phase10`:**
  - the three stacked game boxes on the upper shelf are now The Maze, Macabre Dolls and Juicebox: clickable, with title spines (new artwork slots `gamebox_label_0..2`);
  - the sticky notes → Graffiti;
  - the business card shows BROK3NBYDESIGN.COM.
- **Pages:**
  - home (hero, Launched with the brand film + WRFM, What's coming up, About, Field Notes);
  - Games (crate + every project + "Take me somewhere strange");
  - `/games/<id>` for every project: status, hook, progress report, trailer, about / how it plays, gallery with lightbox; WRFM at `/wrfm` with its clips and transcripts, and Graffiti at `/graffiti`;
  - About (the notebook opens the About sections, then the whole story below), `/about/built-by-design`;
  - Follow, Subscribed, Contact, Press kit, Studio Passport, Settings, the Pocket Wilds update log, and a 404.
- **Panels:**
  - headphones → WRFM, with the live station;
  - monitors → brand film;
  - business cards → contact;
  - notebook → About;
  - crate → "Choose your next world.";
  - books, mug, drawers and collectibles have small discovery panels.
- **Ported from the old site:**
  - studio entrance (skip-next-time; `?intro=1` forces it);
  - background music (off by default, session volume, yields to trailers, clips and the live station);
  - cartridge click (off by default);
  - cursor particles and hover effects (red-tinted, honour reduced motion and Settings), the konami "forbidden debug disco", and J.E.F.F. the footer robot;
  - Studio Passport: stamps, backup/restore/reset and the terminal.
  - Preferences and the Passport use the old storage keys and format (`b3d-preferences-v1`, `b3d-passport-v1`), so visitors keep their stamps and settings after launch. Four new 3D stamps: under the radar, fine print, bookworm, coffee break.
- **Old URLs keep working:** the build writes a forwarding page for every old `.html` URL (22) to its new route, using the pattern of the old `lumina-dice.html`.
- **Playable teasers are not included**, per your decision.
