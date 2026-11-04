# Web exports (Phase 4)

All three assets are rebuilt from the Blender pipeline. Nothing is hand-edited.

```bash
diorama/.venv/bin/python diorama/blender/export.py        # rebuild scene, bake, export raw GLBs (~15 min on CPU)
cd diorama/tools && npm install && node optimize.mjs     # KTX2 + meshopt  ->  diorama/exports/*.glb
node optimize.mjs --webp                                 # optional WebP comparison variants
node inspect.mjs                                         # validate + measure -> diorama/exports/report.json
```

## Files
| Asset | File | Download | Draw calls | Triangles | Textures | GPU texture memory (est.) | Tags |
|---|---|---|---|---|---|---|---|
| Desk (homepage) | `exports/studio_desk.glb` | **8.6 MB** | 122 | 83,016 | 43 | **~20 MB** | 53 nodes |
| Games crate | `exports/games_collection.glb` | **0.48 MB** | 11 | 820 | 7 | ~1.3 MB | 13 nodes |
| Notebook (About) | `exports/studio_notebook.glb` | **0.31 MB** | 10 | 2,580 | 1 | ~0.8 MB | 10 nodes |

All three pass the Khronos glTF-Validator with **0 errors**. The warnings are expected:
- KTX2 images aren't decoded by the validator.
- Normal maps rely on runtime tangents; three.js derives them per pixel.

## Before / after
| Desk | Download | GPU textures | Draw calls | Notes |
|---|---|---|---|---|
| Phase 3 scene (Blender) | — | ~57 MB uncompressed source maps | ~307 objects | 308 meshes, ~84k triangles with bevels |
| Raw export (`exports/raw/`, git-ignored, reproducible) | 19.9 MB | ~92 MB | 122 | PNG textures, bakes included |
| WebP variant (`*_webp.glb`) | 3.1 MB | ~80 MB | 122 | Smallest download, but decodes to full RGBA in video memory |
| **KTX2 UASTC + RDO + meshopt (chosen)** | **8.6 MB** | **~20 MB** | 122 | GPU-compressed (~1 byte/pixel); visually checked against the raw export |
| KTX2 UASTC, no RDO (`--max-quality`) | 12.7 MB | ~20 MB | 122 | Kept as an option if a texture shows RDO artefacts |

**Why KTX2:** on phones and laptops, video memory and texture upload stalls hurt more than a few extra MB of one-time download. KTX2 stays compressed on the GPU. WebP is the fallback for a "data saver" tier.

## What was optimised (and what was deliberately not)
- **Draw calls:** 307 → 122.
  - Untagged static meshes merged per material (`STATIC_*`);
  - untagged siblings inside interactive groups merged per material.
  - Every navigation, discovery, movable and artwork-slot object stays separate with its name and tags.
- **Textures:** resized per role.
  - Normal maps 512, but the hero surfaces (planks, desk wood, rug) keep 1024;
  - base colour 1024, bakes 1024, roughness 512.
  - Then UASTC + RDO + Zstandard.
- **Geometry:** meshopt-compressed, quantised.
- **Polygons were not reduced.** 83k triangles isn't a bottleneck, and the bevels are part of the handcrafted look.
- **Removed:** Blender-only steam, lights and cameras (the viewer adds its own lights; camera presets live in `views.json`).

## Lighting in the GLBs (hybrid)
| Layer | How | Where |
|---|---|---|
| Ambient occlusion | Baked (128 spp, 2048 → stored 1024) on UV set 1, glTF `occlusionTexture` | Desk static parts; crate body (baked with the cases hidden) |
| Practical glow (screens, LEDs, lamp → purple wash, amber spill) | Baked diffuse light (192 spp) on UV set 1, glTF `emissiveTexture` | Desk static parts |
| Key spot, soft fill, purple/amber rims, reflections | **Runtime** in the viewer | Everything |
| Emissive screens, LED strips, filament, headphone ring | Kept emissive (+ bloom) | Everything |
| Not baked | Game cases and drawers (they will move), the notebook (pages will move), glass, emissive meshes | — |

Baked lighting is view-independent, so orbiting, the back and the underside all stay correct. `views.json` marks which lights are already baked (never re-add them at runtime).

## Runtime artwork swap
Every object that shows an artwork slot carries `artwork_slot` in its glTF extras. The preview replaces textures at runtime:
- the mug wrap;
- the game 1 cover;
- the left monitor (emissive map).
No re-export is needed. Rules for the website:
- set `texture.flipY = false` and `colorSpace = SRGBColorSpace`;
- replace `map`, or `emissiveMap` for screens;
- clone the material first if it's shared.

## Camera presets
`exports/views.json` holds every Blender camera converted to glTF Y-up (position, forward, vertical FOV, lens shift) and every light (marked baked or runtime).
