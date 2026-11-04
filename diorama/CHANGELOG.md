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
