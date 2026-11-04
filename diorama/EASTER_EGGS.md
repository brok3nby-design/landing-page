# Discoveries & Easter eggs — plan

Two kinds of interaction, kept separate everywhere (Blender tag `interactive_kind`, `data/interactions.json`):

- **Navigation:** gets visitors to a section of the site. It must also exist as a normal HTML link or button.
- **Discovery:** an optional reward for curiosity (a small animation, a caption, a hidden detail). Never required to navigate.

**Tone:** dry, deadpan studio humour. Understated labels and bureaucratic deadpan. No childish gags, no memes, nothing that needs explaining.

## Hiding places (stable ids already in the model)
Each place is an empty marker `EGG_*` carrying an `egg_id`. A future detail is parented to its marker, so it can be added without rebuilding the scene.

| egg_id | Marker / where | Visible from | Status | Proposed content |
|---|---|---|---|---|
| `egg_under_desktop` | `EGG_UnderDesktop`, underside of the desktop (knee space) | under-view | **test detail** | Sticker: "QUALITY ASSURED (MOSTLY)" |
| `egg_under_platform` | `EGG_UnderPlatform`, bottom of the display base | under-view below the platform | **test detail** | Brass maker's plate: "HANDMADE BY BROK3N BY DESIGN · NO WARRANTY, EXPRESS OR IMPLIED · PLEASE STOP LOOKING UNDER THINGS." |
| `egg_shelf_underside` | `EGG_ShelfUnderside`, under the upper shelf | low angle from the front | planned | Pencilled maths that doesn't add up, signed "accounting" |
| `egg_hutch_back` | `EGG_HutchBack`, back of the hutch panel | rear view | planned | Stencil: "THIS SIDE TOWARDS WALL" (there is no wall) |
| `egg_behind_monitor` | `EGG_BehindMonitor`, behind the right monitor | rear/side view | planned | Taped note: "IF YOU CAN READ THIS, THE CAMERA CONTROLS WORK" |
| `egg_cabinet_back` | `EGG_CabinetBack`, back of the drawer cabinet | rear view | planned | Inventory tag: "ITEM 0001 · FUNCTION: UNKNOWN" |
| `egg_drawer_inside` | `EGG_DrawerInside`, inside drawer 1 | drawer slides out | planned (needs drawer interior) | Spare dice, an unused "employee of the month" frame |
| `egg_chair_underside` | `EGG_ChairUnderside`, under the seat | under-view | planned | Tag: "DO NOT REMOVE UNDER PENALTY OF NOTHING" |
| `egg_crate_bottom` | `EGG_CrateBottom`, under the games crate | Games page, tilt the crate | planned | Stamp: "CONTENTS MAY SHIFT DURING DEVELOPMENT" |
| `egg_notebook_back` | `EGG_NotebookBack`, outside the back cover | About page, when the notebook closes | planned | Sticker: "IF FOUND, PLEASE DO NOT RETURN. WE HAVE COPIES." |

## Rules
1. A discovery never blocks or replaces a navigation path.
2. Max one tiny animation per discovery. Restrained motion, consistent with the site.
3. Discoveries must not clutter the default three-quarter view. They live on backs, undersides and insides.
4. Text in the model uses the built-in pixel font (`lib/textures.py`) or a custom artwork slot.
5. Each detail is a small decal or prop under its marker, with its own triangle budget (a few hundred at most).

## Already verified (Phase 4)
- The undersides and backs are real modeled surfaces: desktop underside, shelf undersides, platform bottom, hutch and cabinet backs.
- The drawers are solid fronts; a drawer interior has to be modeled before `egg_drawer_inside` can exist.
- The under-desk sticker is upright for a viewer looking up from the front.
- It is dark under the desk. The website's under-view should add a small inspection light that follows the camera (Phase 5 viewer task).
