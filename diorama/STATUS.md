# STATUS — Miniature Developer Desk diorama

**Current phase:** Phase 1 (blockout) — complete, **awaiting your approval** before Phase 2.

## How it's built
- Blender **5.2.3 LTS** used as a Python module (`bpy` from PyPI) in a project-local venv `diorama/.venv` (git-ignored). No MCP, no add-ons, no downloaded assets.
- Renders use **Cycles on CPU** — this container has no GPU/EGL, so EEVEE and Workbench can't run here.
- Rebuild everything from scratch (deterministic):
  ```bash
  python3 -m venv diorama/.venv && diorama/.venv/bin/pip install bpy==5.2.3   # once per fresh container
  diorama/.venv/bin/python diorama/blender/build.py --phase 1 --render
  ```
  ~1.5 min for 4 renders at 48 samples.

## Outputs
| File | What |
|---|---|
| `source/diorama_phase1.blend` | Saved Blender scene (opens in Blender 5.2+) |
| `renders/phase1/01_reference_angle.png` | Hero three-quarter view matching the reference |
| `renders/phase1/02_opposite_angle.png` | Mirror three-quarter from front-left |
| `renders/phase1/03_side_back.png` | Rear three-quarter (checks the back isn't a facade) |
| `renders/phase1/04_top_plan.png` | Top-down plan (checks layout/proportions) |
| `renders/phase1/checks.txt` | Automated checks: contacts, collisions, counts, triangles |

## Automated check results (Phase 1)
- 58 declared resting contacts, **0 floating/sinking**
- 6 collision group pairs (chair vs desk/cabinet/drawers, monitors vs shelves/props), **0 overlaps**
- 107 mesh objects, ~23k triangles with bevels, overall 2.50 W × 2.00 D × 1.85 H m (represented scale)

## Known gaps / uncertain (intentional for blockout)
- Clay tints only; wood reads peach under the neutral blockout lights. Real materials = Phase 2, lighting = Phase 3.
- Chair is a generic office shape; gaming-style bolsters, pillows, red blanket come in Phase 2.
- Props, plants, figurines are placeholder shapes marking size and position only.
- Riser back is open from behind; cable management and rear panels in Phase 2.
- Platform has no raised trim border yet; rug has no pattern.
