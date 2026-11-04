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
