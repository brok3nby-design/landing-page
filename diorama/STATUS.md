# STATUS — Miniature Developer Desk diorama

**Current phase:** Phase 10 (real content from the existing site, ported features, clickable game boxes): complete, **awaiting your approval**.
- Phase 9 (audit, `AUDIT.md`) is done.
- Phase 8 (staging) is NOT started.
- Live-site fixes are prepared on branch `claude/site-fixes` of `brok3nby-design.github.io`, waiting for GitHub access to open the PR.
- Evidence: `renders/phase10/`. Run the prototype with the steps in [../app/README.md](../app/README.md).
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
