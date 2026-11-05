# Per-game exhibits (miniature dioramas for each game page)

Each game page gets its own small diorama, in the same series as the desk: a dark plinth, a soft key light, and a
practical light inside the scene. It is built in the Blender pipeline with `blender/build_exhibit.py --game <id>`
(source `source/exhibit_<id>.blend`, renders in `renders/exhibits/<id>/`). Renders are approved first; then it's
exported to GLB and shown in the right-hand exhibit spot of `/games/<id>`, where the cover art sits today.

| Game | Diorama | Interaction (website) | Status |
|---|---|---|---|
| **Bid & Buried** | The corner of a storage unit, cut away like a dollhouse: two corrugated steel walls (back + left), a cracked concrete floor, no door. Junk from the game's item list (locked safe, CRT TV on a dresser, the Dusty Explorer's Globe, crate of records, rolled rug, framed painting, taped boxes, wardrobe box, barrel, spare tire, suitcase, garbage bag). A bare bulb on the wall, the unit number "27" stencilled in orange, the bid paddle and a SOLD ticket outside | Click items for "finds" (name, rarity, value); the safe opens; the bulb flickers | ✅ on staging (/games/bid-and-buried) |
| **Pocket Wilds** | Matches the game's cover art: the corner of a dungeon (rough stone-block walls crumbling away toward the open sides, worn flagstones), a wooden chest with iron bands and rivets and its barrel lid thrown open, **heaped with gold** and gems (emerald, ruby, sapphire), gold spilling over the front rim and across the floor, a tipped-over golden goblet pouring coins, a wall torch and the gold's own warm glow | **Play with the gold** (`app/src/exhibit/GoldPlay.jsx`): brushing the mouse over the pile jingles it; press and hold to scoop a handful (12 coins, each a real rigid body, Rapier physics, MIT), carry it, let go to drop or throw it; coins bounce, roll and settle on the floor, back in the chest or off the plinth; every impact clinks as loud as the hit (`goldAudio.js`, synthesised in the browser, no sound files). A tap tosses a few coins; **Toss a handful** does it from the keyboard/touch; **Gold sounds** on/off is remembered | ✅ built, on staging |
| **Glass & Fortune** | Matches the game's cover art: a corner of the fortune-teller's parlour (dark damask wallpaper over a wood wainscot, a moonlit window with a far skyline between red velvet curtains), a round table under black velvet with a gold-embroidered, fringed hem; on it **two glass dice, red and blue, with white pips**, the beak mask with brass goggles leaning on a top hat, a crystal ball with a violet glow, an hourglass, a brass moth; a cabinet with an oil lantern and books | **Roll the dice** (`app/src/exhibit/DicePlay.jsx`, Rapier): tap a die or press *Roll the dice* to throw both; press and hold a die to pick it up, carry it and throw it. Real rounded-cube bodies tumble, knock into each other and the props, can fall to the floor; when they stop the top faces are read and shown ("Red 5 · Blue 3 — 8", cocked dice called out); glass/velvet/wood/brass hit sounds synthesised in the browser; *Sounds* on/off | ✅ built, on staging |
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
