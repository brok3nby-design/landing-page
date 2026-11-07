# STATUS — Miniature Developer Desk diorama

**Current phase:** Phase 11 — pre-launch. The whole site is built and on private staging at
https://brok3nbydesign.com/landing-page/ (the `gh-pages` branch of this repository). Production is untouched.
- **Built:** the studio desk homepage, the Games crate, the About notebook, and a hand-built 3D diorama with its own
  interactions on every project page (all 11: see [EXHIBITS.md](EXHIBITS.md)), the Studio Passport, settings, music.
- **Pre-launch check (stage 3, 2026-11-06), all passing:**
  - every exhibit's browser test (`npm run test:<id>` in `app/`) and the site test (`npm run test:browser`);
  - `npm run test:fallback` (new): all 14 pages with a 3D scene work with WebGL switched off (image + alt text, all
    text and buttons, the desk's hotspot buttons still open their panels), and reduced motion skips the intro;
  - the device matrix (`node scripts/staging-tests.mjs` after `npm run build:staging`): 9 pages × 8 devices from
    iPhone SE to 2560 px, no overflow, nav and panels fit, phone tap targets ≥ 40 px, no console errors; axe-core:
    no serious/critical issues on any page; Lighthouse accessibility and best practices 100 (results in `renders/phase8/`).
  - Fixed during the check: info panels now open above the exhibit tool row (on Juicebox one covered the Headlights button).
- **Homepage (this session):** the camera fits the whole desk between the hint line and the buttons (`fit` in the home
  exhibit config), the first view swings in (`intro`), the 3D area starts below the header, the copy sits further in.
- **Phone models:** every GLB has a `_m` phone version (`optimize.mjs --mobile`, ~2-4x smaller); phones and ≤ 4 GB
  devices load them (EXPORTS.md). Browsers drawing 3D in software (hardware acceleration off) start on the still image.
- **Added 2026-11-06/07:**
  - Desk (phase 11 re-export): monitors face the chair; the sticky notes became an open **guestbook** (Graffiti); a
    walnut **WRFM radio** (dial on 97.1); a rebuilt slatted **games crate** with detailed cartridges.
  - **Desk radio:** *Tune in live* plays WRFM 97.1 in sync with the real station (its clock-driven schedule, synced from
    `wrfm-source` with `npm run sync:wrfm`), or *Funny clip*; a now-playing bar follows you across pages.
  - **Site music:** the studio's 10 tracks + the original theme as a playlist that follows the page's mood
    (`site/music.js`; masters in `custom/music/`). The **headphones** play / pause it.
  - **My Gaming History** (`/about/gaming-history`, text in `app/src/content/gaming-history.md`), from the figurine.
  - **Item views framed by the studio** (`framed` / `framedPhone` in `site.js`; frame more on staging with `?frames`);
    compact info panel on phones; every item makes a sound (Sound effects setting, on by default).
  - Fixes: header tabs stacking pages (duplicate React key), selection stalls (angles precomputed in
    `data/focus_views.json` by `scripts/focus-views.mjs`), shelf keep-out boxes split so everything is reachable,
    WRFM lightbox reads OFF AIR (red) / ON AIR (green), back-to-top button, brand-film thumbnail.
  - New tests: `test:desk-extras`, `test:wrfm-live`, `test:phone-panel`, `test:music` (and the header-tab check in `test:fallback`).
- **Waiting for you:** real-device walk-through ([STAGING.md](STAGING.md)), your J.E.F.F. lines (`jeffLines` in
  `app/src/content/site.js`), and approval before anything goes live on brok3nbydesign.com.
- Live-site repository: PR brok3nby-design/brok3nby-design.github.io#1 merged; the removed files were also purged from its history.

*(Older phase notes follow.)*
Phases 1–3 are approved and locked. See [EXPORTS.md](EXPORTS.md) (files, measurements), [EASTER_EGGS.md](EASTER_EGGS.md),
`data/interactions.json` (interaction map) and [PROJECT_DIRECTION.md](PROJECT_DIRECTION.md) (revised 11-phase roadmap, staging rules).

## Phase 4 at a glance
- **Exports:** `exports/studio_desk.glb` (8.6 MB), `exports/games_collection.glb` (0.48 MB), `exports/studio_notebook.glb` (0.31 MB).
  They use KTX2 UASTC + RDO textures and meshopt geometry. glTF-Validator: 0 errors.
- **Desk:** 122 draw calls (was ~307 objects), 83k triangles, ~20 MB GPU texture memory (raw export: ~92 MB).
- **Hybrid lighting:** baked AO + baked practical glow on UV set 1, plus runtime key/fill/rims in the browser.
- **Browser preview** (technical, not the website): `diorama/preview/`. Screenshots and comparisons are in `renders/phase4/`.
- **Launch the viewer on your own computer:** first download the project (git clone of `brok3nby-design/landing-page`, branch `claude/new-session-zkgerx`), then run `npm install` and `npm run dev` inside `diorama/preview`.
  - **Windows:** step-by-step guide in [preview/WINDOWS.md](preview/WINDOWS.md).
  - **macOS/Linux:** `cd landing-page/diorama/preview && npm install && npm run dev`.
  - The "raw export" option only works where `export.py` has been run; it's disabled otherwise.
**Project direction:** the diorama is the homepage exhibit of a larger interactive 3D studio website. See
[PROJECT_DIRECTION.md](PROJECT_DIRECTION.md) for the concept, page plan, shared viewer architecture and asset rules.
The website itself is **not started** (future phase).
Phase 1 blockout is approved and locked (`source/diorama_phase1.blend` cannot be overwritten by a rebuild).

## How it's built
- Blender **5.2.3 LTS** as a Python module (`bpy` from PyPI) in a project-local venv `diorama/.venv` (git-ignored). No MCP, no add-ons, no downloaded assets.
- Renders use **Cycles on CPU** (this container has no GPU/EGL, so EEVEE/Workbench can't run).
- Rebuild everything (deterministic; all "random" placement is seeded):
  ```bash
  python3 -m venv diorama/.venv && diorama/.venv/bin/pip install bpy==5.2.3   # once per fresh container
  diorama/.venv/bin/python diorama/blender/build.py --render          # Phase 4 scene is now the default
  diorama/.venv/bin/python diorama/blender/export.py                  # web export (see EXPORTS.md)
  ```
  Build ≈ 30 s (incl. 22 s cloth sim); 7 renders ≈ 5.5 min at 48 samples. `--views 01,05` renders a subset, `--retex` repaints textures.
- **Fan-art switch:** `FAN_ART = True` in `blender/config.py` builds the character likenesses + game logo (figure base, headphone cup). `False` builds generic figures, no logos. Same object names either way.

## Outputs (Phase 3)
| File | What |
|---|---|
| `source/diorama_phase3.blend` | Phase 3 scene (textures linked relatively from `assets/textures/`) |
| `renders/phase3/01–04_*.png` | Reference angle, opposite angle, rear three-quarter, top plan (128 samples) |
| `renders/phase3/05–08_close_*.png` | Close-ups: desk, shelf, chair, crate |
| `renders/phase3/09_asset_games_crate.png` | Games crate alone under the reusable exhibit spotlight rig |
| `renders/phase3/10_beauty_hero.png` | Presentation render: depth of field + bloom (256 samples) |
| `custom/` | **Your artwork slots.** Drop images here; see `custom/README.md` and `custom/templates/` |
| `data/games.json`, `data/interactions.json` | Website data (separate from geometry) |
| Phase 2 outputs | Still in `source/diorama_phase2.blend` and `renders/phase2/` |

## Lighting (Phase 3)
- **Background:** world colour = the website background `#080808` in linear light, so renders sit seamlessly on the page.
- **Key and rims:**
  - soft overhead key spotlight (a pool of light that falls off to black), plus a weak soft fill;
  - a cool purple rim on the left and a warm amber rim on the right separate the silhouette from the black.
- **Practical lights** (invisible to the camera; the glowing meshes are what you see):
  - each monitor casts light tinted by the average colour of its screen image. A custom screen image automatically retints the light.
  - amber LED light under the desk front, the riser and the cabinet top;
  - purple light under the shelf front, plus a purple wash on the hutch back panel;
  - the Edison lamp filament (its glass casts no shadow).
- **Colour look:** AgX view transform with the "Medium High Contrast" look, exposure −0.35. Indirect light clamp to suppress fireflies.
- **Blender-only effects** (not part of the web asset; the website gets real-time equivalents):
  - depth of field on `CAM_Beauty` (f/0.55, focused on the desk front) for the miniature/tilt-shift feel;
  - bloom (numpy post-process, `lib/post.py`) on the beauty render;
  - mug steam `FX_Steam_*`, flagged `blender_only` so Phase 4 skips it.
- **Exhibit rig:** `lights.exhibit_rig(asset)` builds a key spot, fill and rim scaled to any standalone asset. It's hidden in desk renders and reused for future game exhibits.

## Materials (Phase 3)
- **Normal (bump) maps** generated by code: woods ×3, planks, leather ×2, quilt, fabric bin, rug, plaid, crate and deskmat.
- **Roughness variation maps:** desk wood, planks and leather.
- All are standard glTF maps (normalTexture, metallicRoughness), so they carry over to the web.
- Edge wear is deferred: it needs a curvature bake, which happens in Phase 4 alongside the web light bake.

## Reusable assets
- **`NAV_GamesCrate`**: self-contained hierarchy (crate body + `GAME_Case_01..05`, each its own group with origin at its base, own label mesh and material). It's built by `storage.games_crate(parent, loc)` and can be placed anywhere.
- Standalone GLB export of just this hierarchy was tested: 344 KB, with names, extras and local transforms intact after re-import. The production export comes in Phase 4.
- The `bpy` wheel ships without Draco/meshoptimizer, so Phase 4 compression will use `gltf-transform` (npm) instead.

## Web quality plan (Phase 4+)
Cycles renders will always look a bit richer than real-time WebGL. To close the gap:
- **Phase 4:** bake ambient occlusion, edge wear and soft light into the static desk textures (lightmaps), export one baked `desk.glb` and one `games_crate.glb`, then measure size and memory after compression.
- **Website phase:** real-time bloom, ACES/AgX-like tone mapping, soft shadows only where cheap, and quality tiers.
  - The Phase 3 renders double as the loading image and the accessible non-3D fallback.

## Known gaps / next
- Chair backrest now has stitch channels and a headrest pillow; the backrest itself is still flat (no curvature), to keep the blanket simulation stable.
- Draw-call count for web (285 objects) will be reduced in Phase 4 by merging static, non-interactive parts per material.
