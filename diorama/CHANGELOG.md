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
