# PROJECT DIRECTION — Brok3n by Design interactive 3D studio website

_Recorded 2026-11-04. The desk diorama stays the foundation; nothing is restarted or rebuilt._

## Concept
A cinematic, museum-like website for **BROK3N BY DESIGN**, an independent game studio. Each major page presents one
**miniature 3D exhibit** (a handcrafted collectible-style model under soft spotlights). There's no surrounding room or scenery.

| Element | Rule |
|---|---|
| Background | Near-black `#080808`, large areas of negative space |
| Type | White + muted grey, elegant, restrained |
| Accent | Deep red, sparingly (important actions only) |
| Layout (desktop) | Content LEFT, interactive 3D exhibit RIGHT; consistent framing across pages |
| Interface | Minimal; no glowing UI decoration, no crowded nav, no background images |
| Motion | Smooth, restrained camera moves and selection animations |
| Models | Can be colourful and richly detailed; the site around them stays minimal |

## Pages
1. **Home — The Desk.** The existing diorama. Left: studio name, short description, navigation, calls to action.
   - Visitors can rotate (with limits), zoom, hover, select, and read info panels.
   - The **games crate** is the key navigation object. Selecting it moves the camera to the crate, opens a panel introducing the collection, and offers an **EXPLORE GAMES** button that goes to /games.
2. **Games — The Collection.** The standalone `NAV_GamesCrate` under a spotlight.
   - Each `GAME_Case_XX` can be selected. The case lifts and turns toward the camera, and a panel shows its title, description and links, with a **VIEW GAME** button.
   - Closing the panel returns the case to its place.
   - Games come from `data/games.json`, so adding a game doesn't mean rebuilding the scene.
3. **Individual game pages (future).** Same layout and viewer, each with its own exhibit. Examples: Glass & Fortune (antique dice table), Department of Questionable Inventions (1950s office terminal), Locker Auction (storage locker). These aren't modeled yet.

## Shared 3D exhibition system (future website phase — not started)
- **Stack:** React + Vite, Three.js, React Three Fiber, Drei. Assets are GLB exported from this Blender pipeline. No paid services.
- **One `<Exhibit>` viewer reused by every page**, configured per page:
  - which GLB to load, the camera framing and orbit limits, and which `interactive_scope` to listen to;
  - which data file supplies the panels (`data/interactions.json`, `data/games.json`).
- **Clicking:** the viewer raycasts, then walks up the hit object's parents to the first node with `interactive_id` in its glTF extras. Each tag has a scope (`home` or `games`), so a page only reacts to its own objects.
- **Viewer features:**
  - orbit with damping, limited vertical angle, zoom limits and a reset view;
  - smooth camera tweens to focus on an object, plus hover highlight;
  - selection animations, e.g. lift-and-turn using each case's own origin;
  - loading progress, error fallback, and quality tiers (DPR/shadow/texture size) for weaker devices;
  - lazy-loaded, never traps page scroll, works with keyboard and touch.
- **Accessibility:** ordinary HTML navigation always exists. No one has to use the 3D scene to navigate, and every 3D action has a matching link or button.
- **GitHub Pages:**
  - deep links must work. The recommended approach is to emit a static `index.html` per route at build time (e.g. `/games/index.html`), with Vite `base` set to the repository path. This gives clean URLs with no hash routing.
  - a `404.html` fallback covers anything missed.
  - all asset paths are relative to `base`.

## Asset rules for the Blender pipeline (applies to all current and future phases)
| # | Rule | How it's met today |
|---|---|---|
| A | Stable, descriptive names for interactive objects | `NAV_*` for navigation assets, `GAME_Case_XX`, `MON_*_Screen`, `PROP_Mug`, `PROP_Notebook`, `COLL_Figure*` |
| B | Important objects independently selectable | Separate objects/groups. Only non-interactive repeats are merged (keycaps, fringe, leaves) |
| C | Games crate exportable as standalone GLB | `NAV_GamesCrate` hierarchy is self-contained; export tested (see CHANGELOG) |
| D | Game cases individually selectable/animatable | One group per slot, origin at its base, own label mesh and material |
| E | Origins/transforms support independent movement | Group empties with clean transforms; children in local coordinates |
| F | Shared assets reusable across scenes | `storage.games_crate(parent, loc)` builds the crate anywhere; meshes shared where identical |
| G | Don't merge interactive geometry | Enforced: merging is used only for decorative repeats |
| H | Visual consistency desk ↔ standalone | Same objects, materials and textures; standalone preview render `09_asset_games_crate.png` |
| I | Record of interactive names → actions | `data/interactions.json`, `data/games.json`, table in ASSET_INVENTORY.md |
| J | Looks right from multiple angles | Every gate renders front, opposite, back, top and close-ups |

## Custom artwork
Every printed surface is an **artwork slot**: screens, mugs, deskmat, rug, blanket, sketchbook, book spines, crate print and per-game cover labels.
- **In Blender:** drop an image into `diorama/custom/` and rebuild (see `custom/README.md`).
- **On the website:** objects carry `artwork_slot` tags, so images (or video loops on the monitors) can be swapped from data files without re-exporting the model.
- New slots are added as new exhibits need them.

## Visual quality on the web
The Cycles renders set the quality bar. The real-time site gets as close as possible:
- baked AO and lighting in the desk textures (Phase 4);
- bloom and filmic tone mapping in the browser;
- quality tiers for weaker devices.
The renders also serve as the loading image and the non-3D fallback.

## Assets (Phase 4)
| Asset | File | Used on | Notes |
|---|---|---|---|
| Complete desk | `exports/studio_desk.glb` | Homepage | All navigation and discovery objects as separate tagged nodes |
| Games crate | `exports/games_collection.glb` | Games page | Same crate as under the desk. `GAME_Case_01..05` keep animation-ready origins and per-game cover labels |
| Notebook | `exports/studio_notebook.glb` | About page | Covers, page blocks and top pages are pivots on the spine (hinge axis Y), plus a bookmark and pen |

## Pages (updated)
- **Home, The Studio:** left = branding, intro and navigation; right = the desk (main navigation hub).
- **Games, The Collection:** left = intro; right = the standalone crate. A selected case lifts and turns, opens a panel, and **VIEW GAME** leads to its page.
- **About, The Notebook:** left = studio and process; right = the notebook. It may open, show sketches and turn pages later.
- **Individual game pages:** left = details, screenshots, video, release info and links; right = a unique exhibit (future modeling).
- **Other pages:** reuse the same layout and viewer with other miniatures.

## Camera and exploration (viewer requirements)
- **Controls:** drag or touch to rotate, wheel or pinch to zoom, smooth focus on selected objects, reset, hover highlight, selection animations, info panels.
- **Default view:** matches the Blender three-quarter renders (`views.json` → `CAM_Hero`).
- **Controlled exploration:**
  - sides, back and an **under-view** mode for looking under the desktop;
  - limited polar angles, zoom limits, and a collision guard that keeps the camera out of the model;
  - an inspection light in under-view;
  - easy return to the default view.
- **Click vs drag:** a click selects only if the pointer barely moved. Rotating never activates objects (prototyped in `preview/`).

## Staging and production rules (strict)
- **The new site is built and tested separately.** Do not modify the existing BROK3N BY DESIGN production site, its repository, its GitHub Pages config or the Namecheap DNS. Do not point the domain at the new site, and do not remove existing content.
- **Local first:** development runs locally. A separate staging deployment (possible future `test.brok3nbydesign.com`) is configured **only with explicit authorisation**.
- **Production:** replacing the production site requires explicit approval (Phase 11).

## Revised roadmap
| Phase | Scope | Status |
|---|---|---|
| 1 | Blockout | ✅ done |
| 2 | Detailed modeling | ✅ done |
| 3 | Materials and cinematic lighting | ✅ done |
| 4 | Web-ready assets: desk, crate and notebook GLBs; bakes; optimisation; tags; browser preview | ✅ done (approved) |
| 5 | Local website prototype: React layout, shared viewer, black/white/red identity, the desk with rotation, zoom, focus and selection | ✅ done (approved) |
| 6 | Connected pages: Games (crate) and About (notebook), panels, navigation, basic animations | ✅ done (approved) |
| 7 | Visual refinement: browser lighting and materials vs the Blender references, transitions, performance; camera fix | ✅ done, awaiting approval |
| 8 | Private development and staging tests: desktop and mobile; never affects production | — |
| 9 | Existing website audit: content inventory, game-by-game asset checklist, migration plan, URL preservation | — |
| 10 | Content implementation: approved content, game exhibits, more navigation objects, Easter eggs | — |
| 11 | Final testing and optional launch, only with explicit approval | — |

**Rule:** one phase at a time, each ending with evidence and a stop for approval. No custom artwork is requested before the Phase 9 audit identifies what's missing.
