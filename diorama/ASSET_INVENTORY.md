# ASSET INVENTORY

Status key: **B** = blockout placeholder · **D** = detailed (Phase 2) · **—** = not started
All geometry is procedural (scripts in `blender/parts/`). No third-party assets.

| Collection | Object(s) | Status | Notes |
|---|---|---|---|
| BASE | `BASE_Platform` | B | Chamfered octagon, beveled edge. Needs trim border + plank detail |
| BASE | `BASE_Rug` | B | Flat slab; ornate pattern later (procedural/original texture) |
| DESK | `DESK_Top`, left sled frame (legs, rails) | B | Slim 4 cm top |
| DESK | `DESK_Cabinet_*`, `DESK_Drawer_1..3` + handles | B | 3 drawers, handles instanced |
| DESK | `DESK_ModestyPanel`, `DESK_LowShelf`, divider | B | Under-desk storage |
| SHELVES | `SHELF_Riser`, ends, `SHELF_Upper`, posts, back panel | B | Back panel will carry purple RGB glow |
| MONITORS | `MON_L/R` groups (base, neck, mount, housing, screen) | B | Instanced meshes; screens tagged interactive |
| CHAIR | `CHAIR` group: 5-star base, 5 instanced casters, gas lift, seat, backrest, arms | B | Blanket, pillows — missing |
| PROPS | Desk mat, keyboard, mouse, mug+coaster, pencil cup, brush cup, notebook, 3 dice | B | |
| PROPS | Lamp (base + glowing bulb), 2 speakers, headphone stand + headphones | B | |
| PROPS | 2 plant pots + foliage, 4 books, crystal cluster, small box, box stack | B | Trailing vine missing |
| PROPS | Storage bin, crate, 3 cartridges, low book stack, router | B | |
| COLLECTIBLES | `COLL_FigureA/B` (base, body, head) | B | Generic placeholders — no character likeness or logos |
| LIGHTS | Key / fill / rim area lights, desk-lamp point light | B | Proper amber/purple design = Phase 3 |
| CAMERAS | `CAM_Hero`, `CAM_Opposite`, `CAM_Back`, `CAM_Top` | done | Auto-framed with fixed negative space |
| — | Cables, webcam, LED strips, sketches/stationery details, small boxes under riser | — | Phase 2 |

## Interactive targets (tag `interactive_id`, exported as glTF extras)
| interactive_id | Object | Placeholder action |
|---|---|---|
| `monitor_left`, `monitor_right` | `MON_L_Screen`, `MON_R_Screen` | Projects |
| `cartridge` | `PROP_Cartridge_0` | Game details |
| `notebook` | `PROP_Notebook` | About / process |
| `mug` | `PROP_Mug` | Easter egg |
| `collectible_a`, `collectible_b` | `COLL_FigureA/B_Head` | Detail popover |
