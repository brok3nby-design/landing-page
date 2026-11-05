# Per-game exhibits (miniature dioramas for each game page)

Each game page gets its own small diorama, in the same series as the desk: a dark plinth, a soft key light, and a
practical light inside the scene. It is built in the Blender pipeline with `blender/build_exhibit.py --game <id>`
(source `source/exhibit_<id>.blend`, renders in `renders/exhibits/<id>/`). Renders are approved first; then it's
exported to GLB and shown in the right-hand exhibit spot of `/games/<id>`, where the cover art sits today.

| Game | Diorama | Interaction (website) | Status |
|---|---|---|---|
| **Bid & Buried** | The corner of a storage unit, cut away like a dollhouse: two corrugated steel walls (back + left), a cracked concrete floor, no door. Junk from the game's item list (locked safe, CRT TV on a dresser, the Dusty Explorer's Globe, crate of records, rolled rug, framed painting, taped boxes, wardrobe box, barrel, spare tire, suitcase, garbage bag). A bare bulb on the wall, the unit number "27" stencilled in orange, the bid paddle and a SOLD ticket outside | Click items for "finds" (name, rarity, value); the safe opens; the bulb flickers | ✅ on staging (/games/bid-and-buried) |
| **Pocket Wilds** | Matches the game's cover art: the corner of a dungeon (dark stone-block walls, a stone ledge), a wooden chest with iron bands and its lid thrown open, **overflowing gold with gems** (emerald, ruby, sapphire), a tipped-over golden goblet, coins and gems spilled on the floor, a warm golden glow with sparkles | **Touch the gold**: gold sounds. Click the pile to **pick up a handful**, carry it around and **drop it**, with real coin physics (each coin a rigid body) and clinks. This needs a physics engine in the browser (Rapier, MIT licence) and procedurally generated clink sounds (no downloaded assets) | planned (next) |
| **Glass & Fortune** | A fortune-teller's table corner: velvet cloth, candle, cards, the masked fortune-teller's mask, **2 glass dice** | Roll the dice with real physics; number + colour shown | planned |
| **Speck** | A tiny floating chunk of world: grass, a tree, a half-built homestead, a speck | Place a block / grow a plant | idea |
| **DOQI** | A 1950s office corner: green-screen terminal, filing cabinet, rubber stamp, forms | Stamp "YOUR ANSWERS HAVE BEEN FILED" | idea |
| **WRFM Radio** | A late-night radio studio: vintage mic, ON AIR light, mixing desk, phone | ON AIR plays a clip; the phone rings | idea |
| **The Maze** | A tabletop hedge maze with a lantern and a die | Roll; a marker moves | idea |
| **Macabre Dolls** | A porcelain doll under a glass dome, cards fanned beside it | Lift the dome; the doll's head turns | idea |
| **Juicebox** | A roadside at sunset: car fender, road sign, the smiley juice bottle | Bottle slosh; sign flips | idea |
| **Graffiti** | A brick wall segment with pixel art | Spray a pixel tag | idea |
| **Under the Radar** | Secret: a radar screen with one blip | The blip moves when you look away | idea |

Notes:
- Ideas are starting points; each one is reviewed with renders before it goes on the site.
- Interactions are website code (three.js), so they can be refined without re-modelling.
