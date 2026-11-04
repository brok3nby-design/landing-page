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
| PROPS | Fabric bin + crate (original pixel-creature print), 11 cartridges with pixel-art labels | D | |
| PROPS | Cable management: monitors, speakers, lamp, keyboard → grommet → tray; power lead | D | |
| COLLECTIBLES | Figure A — hooded sniper w/ eyepatch, rifle, logo base (FAN_ART) | D | Fan art: see licensing note in STATUS |
| COLLECTIBLES | Figure B — office manager w/ "World's Best Boss" mug (FAN_ART) | D | |
| LIGHTS | Key / fill / rim area lights, desk-lamp point light | B | Phase 3 |
| CAMERAS | Hero, Opposite, Back, Top + 3 close-ups | done | |

## Interactive targets (tag `interactive_id`, exported as glTF extras; also in INTERACTIVE_TARGETS)
| interactive_id | Object | Placeholder action |
|---|---|---|
| `monitor_left`, `monitor_right` | `MON_L_Screen`, `MON_R_Screen` | Projects |
| `cartridge` | `PROP_Cartridge_0` (group) | Game details |
| `notebook` | `PROP_Notebook` (group) | About / process |
| `mug` | `PROP_Mug` | Easter egg |
| `collectible_a`, `collectible_b` | `COLL_FigureA`, `COLL_FigureB` (groups) | Detail popover |

Groups: a click on any child mesh resolves to the nearest ancestor that has an `interactive_id`.
