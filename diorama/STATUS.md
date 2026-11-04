# STATUS — Miniature Developer Desk diorama

**Current phase:** Phase 2 (detailed modeling) — complete, **awaiting your approval** before Phase 3 (lighting & polish).
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
  diorama/.venv/bin/python diorama/blender/build.py --phase 2 --render
  ```
  Build ≈ 30 s (incl. 22 s cloth sim); 7 renders ≈ 5.5 min at 48 samples. `--views 01,05` renders a subset, `--retex` repaints textures.
- **Fan-art switch:** `FAN_ART = True` in `blender/config.py` builds the character likenesses + game logo (figure base, headphone cup). `False` builds generic figures, no logos. Same object names either way.

## Outputs
| File | What |
|---|---|
| `source/diorama_phase2.blend` | Phase 2 scene (textures linked relatively from `assets/textures/`) |
| `renders/phase2/01–04_*.png` | Reference angle, opposite angle, rear three-quarter, top plan |
| `renders/phase2/05_close_desk.png`, `06_close_shelf.png`, `07_close_chair.png`, `08_close_crate.png` | Close-ups to judge small details |
| `renders/phase2/09_asset_games_crate.png` | `NAV_GamesCrate` rendered **alone** under an exhibit spotlight (Games-page preview) |
| `data/games.json`, `data/interactions.json` | Website data: game slots and interactive-object → action mapping (separate from geometry) |
| `renders/phase2/checks.txt` | Automated checks |
| `assets/textures/*.png` | 20 code-painted textures (original artwork) |

## Measured numbers (Phase 2)
- 285 mesh objects, **~80.6k triangles** with bevels (budget target ≤ 250k)
- 20 textures, ~36 MB uncompressed in GPU memory (~48 MB with mipmaps), 8.1 MB of PNGs on disk. Phase 4 will compress (WebP/KTX2) and likely shrink the 1024² wood/plank maps.
- 77 declared resting contacts: **0 floating/sinking**; 6 collision group pairs: **0 overlaps**
- All materials are Principled BSDF + image textures → maps directly to glTF PBR. Glass uses transmission (KHR_materials_transmission).

## Reusable assets
- **`NAV_GamesCrate`**: self-contained hierarchy (crate body + `GAME_Case_01..05`, each its own group with origin at its base, own label mesh and material). It's built by `storage.games_crate(parent, loc)` and can be placed anywhere.
- Standalone GLB export of just this hierarchy was tested: 344 KB, with names, extras and local transforms intact after re-import. The production export comes in Phase 4.
- The `bpy` wheel ships without Draco/meshoptimizer, so Phase 4 compression will use `gltf-transform` (npm) instead.

## Known gaps / next
- Lighting is still the neutral blockout rig; amber/purple mood, LED light spill, lamp glow, DOF and miniature "tilt-shift" feel are Phase 3. The LED strips are emissive but don't light the scene much yet.
- Chair backrest is a fairly simple slab; headrest pillow not modeled.
- Coffee steam not modeled (planned as a Phase 3 Blender-only/web effect).
- The large wood panels (hutch back, shelf undersides) still show fairly bold grain bands.
- Draw-call count for web (285 objects) will be reduced in Phase 4 by merging static, non-interactive parts per material.
