# ASSET INVENTORY

Status: **D** = detailed (Phase 2) · **B** = blockout · **—** = missing
All geometry is procedural (`blender/parts/`), all textures are painted by code (`blender/lib/textures.py`). No third-party assets.
Repeated small parts (keycaps, rug fringe, leaves, blanket fringe) are **merged into single meshes** (1 draw call each); medium repeats (casters, cartridges, drawer handles, speaker parts) are **shared-mesh instances**.

| Collection | Object(s) | Status | Notes |
|---|---|---|---|
| BASE | Platform (plank texture), raised mitred trim, dark plinth | D | |
| BASE | Rug (original medallion pattern) + merged fringe | D | |
| DESK | Wood-grain top, amber LED strip, left metal sled frame | D | |
| DESK | Cabinet, 3 drawers, brass bar handles on standoffs, LED | D | |
| DESK | Modesty panel, cable tray, power strip + plugs, low shelf + legs/divider | D | |
| SHELVES | Riser (closed back, grommet, amber LED), upper shelf, posts, back panel, 2 purple LED strips | D | |
| MONITORS | 2× housing, back bulge, mount, neck, rounded base; code-painted screens | D | Left: editor UI with castle scene. Right: sunset pine wallpaper |
| MONITORS | Webcam on right monitor | D | |
| CHAIR | 5-star base, twin-wheel casters ×5, hub, gas lift, mechanism, tilt lever | D | |
| CHAIR | Seat + bolsters + brown panel, backrest + wings + belt slots + brown panel, triangle emblem, quilted lumbar pillow, armrests | D | Headrest pillow missing |
| CHAIR | Plaid blanket (cloth-simulated, frozen) + merged fringe | D | |
| PROPS | Deskmat, TKL keyboard (87 keycaps, purple glow), mouse + glow, cables | D | |
| PROPS | Mug (hollow, handle, coffee, controller icon) on cork coaster | D | Steam missing (Phase 3) |
| PROPS | Open sketchbook (curved pages, tower sketches) + pen | D | |
| PROPS | Pencil cup + 5 pencils, brush cup + 3 brushes, dice (d20, d8, d20) | D | |
| PROPS | Books (green/yellow) + router with LEDs under the riser | D | |
| PROPS | Edison lamp (glass dome, bulb, glowing filament), 2 speakers (woofer/tweeter/brass rings), headphone stand + headphones (padded band, cushions, purple rings) | D | |
| PROPS | Trailing pothos (6 vines, merged leaves), upright plant | D | |
| PROPS | 5 books (spine atlas) + leaning book, crystal cluster on rock, retro gadget box, 3 stacked game boxes | D | |
| PROPS | Fabric bin + 6 decorative cartridges | D | |
| PROPS | **`NAV_GamesCrate`** — reusable crate asset (body with original pixel-creature print + `GAME_Case_01..05`) | D | Standalone-exportable; see STATUS |
| PROPS | Cable management: monitors, speakers, lamp, keyboard → grommet → tray; power lead | D | |
| COLLECTIBLES | Figure A — hooded sniper w/ eyepatch, rifle, logo base (FAN_ART) | D | Fan art: see licensing note in STATUS |
| COLLECTIBLES | Figure B — office manager w/ "World's Best Boss" mug (FAN_ART) | D | |
| LIGHTS | Key / fill / rim area lights, desk-lamp point light | B | Phase 3 |
| CAMERAS | Hero, Opposite, Back, Top + 3 close-ups | done | |

## Artwork slots (your images; details in `custom/README.md`)
Objects tagged `artwork_slot` (exported as glTF extras, so the website can swap images at runtime):
| Slot | Object(s) |
|---|---|
| `screen_left`, `screen_right` | `MON_L_Screen`, `MON_R_Screen` (also retints the monitor light) |
| `mug_wrap` / `mug_figure` | `PROP_Mug` (outer wall only; handle and rim stay ceramic) / `COLL_FigureB_Mug` |
| `deskmat`, `rug`, `blanket`, `sketchbook` | `PROP_DeskMat`, `BASE_Rug`, `CHAIR_Blanket`, `PROP_Notebook_Pages` |
| `crate_print` | `NAV_GamesCrate_Body` |
| `book_spine_1..6` | `PROP_Book_0..4`, `PROP_Book_Leaning` |
| `game_label_01..05` | `GAME_Case_01..05_Label` (each with its own texture and material; or `games.json` `label_texture`) |

## Phase 3 additions
| Object(s) | Notes |
|---|---|
| `CHAIR_HeadPillow`, `CHAIR_BackStitch_0..3` | Headrest pillow, stitch channels on the backrest |
| `FX_Steam_0..2` | Mug steam, Blender-only (`blender_only` flag) |
| `PROP_StickyNote_0..2` | Sticky notes on the desk |
| `LIGHT_*` | Phase 3 rig (see STATUS → Lighting); `LIGHT_Exhibit_*` = standalone exhibit rig |
| `CAM_Beauty` (+ `CAM_Beauty_Focus`) | Hero framing with depth of field |

## Phase 4 additions
| Object(s) | Notes |
|---|---|
| `NAV_Notebook` → `NOTE_Cover_Back/Front`, `NOTE_PageBlock_L/R`, `NOTE_Page_L/R` (pivots on the spine, hinge axis Y), `NOTE_Spine`, `NOTE_Bookmark`, `NOTE_Pen` | Replaces `PROP_Notebook`. Same look, animation-ready, exported alone as `studio_notebook.glb` |
| `NAV_ContactCards` (holder + 2 cards, artwork slot `business_card`) | Only new prop: the Contact navigation object |
| `DESK_Drawer_1..3_Group` | Drawers grouped (front, handle, standoffs) so they can slide out later |
| `EGG_*` markers (10) + `EGG_UnderDesktop_Sticker`, `EGG_UnderPlatform_Plate` | Hiding places + two hidden test details (see EASTER_EGGS.md) |
| `STATIC_*` (web export only) | Merged untagged static meshes, one per material |

## Interactive objects (navigation vs discovery; full map in `data/interactions.json`)
| interactive_id | kind | scope | Object | Intended action |
|---|---|---|---|---|
| `games_crate` | navigation | home | `NAV_GamesCrate` | Focus → panel → **EXPLORE GAMES** → /games |
| `notebook` | navigation | home | `NAV_Notebook` | Focus → panel → About |
| `monitor_left/right` | navigation | home | `MON_L/R_Screen` | Projects |
| `headphones` | navigation | home | `PROP_Headphones_Stand` | WRFM / audio experience |
| `contact_card` | navigation | home | `NAV_ContactCards` | Contact |
| `game_slot_01..05` | navigation | games | `GAME_Case_01..05` | Lift + turn → panel (games.json) → **VIEW GAME** |
| `mug` | discovery | home | `PROP_Mug` | Optional humorous interaction |
| `collectible_a/b` | discovery | home | `COLL_FigureA/B` | Easter-egg popover |
| `book_1..6` | discovery | home | `PROP_Book_0..4`, `PROP_Book_Leaning` | Optional discoveries |
| `drawer_1..3` | discovery | home | `DESK_Drawer_N_Group` | Future slide-out |
| `egg_qa_sticker`, `egg_maker_plate` | discovery | home | `EGG_UnderDesktop`, `EGG_UnderPlatform` | Hidden test details |

Website rule: on the homepage, tags with `interactive_scope = games` (the cases) are skipped, so clicking inside the crate selects the crate. The preview viewer already does this.
