// Page configuration (exhibits, hotspots). The words on the pages come from the existing website,
// imported into diorama/data/site_copy.json + projects.json (see content/data.js); nothing here is
// invented fact about the studio.
export const BRAND = "BROK3N BY DESIGN";

export const NAV = [
  { to: "/", label: "Studio", end: true },
  { to: "/games", label: "Games" },
  { to: "/about", label: "About" },
  { to: "/wrfm", label: "WRFM" },
  { to: "/follow", label: "Follow" },
  { to: "/passport", label: "Passport" },
  { to: "/contact", label: "Contact" },
];

// Each page declares its exhibit; the shared <Exhibit> viewer reads this. Phase 5 builds the home
// exhibit; Games (crate) and About (notebook) exhibits arrive in Phase 6.
export const PAGES = {
  home: {
    ctas: [
      { to: "/games", label: "Explore the Games", primary: true },
      { to: "/#launched", label: "See What’s Launched" },
      { to: "/#coming", label: "See What’s Coming" },
    ],
    exhibit: {
      model: "models/studio_desk.glb",
      scope: "home",
      view: "CAM_Hero",
      lights: "desk",                // runtime copy of the Cycles desk rig (else the generic exhibit rig)
      homeScale: 0.74,               // wide screens: frame the desk a little closer (its bounding sphere is generous)
      fallback: "fallback/desk.png",
      fallbackAlt: "A handcrafted miniature developer desk on a wooden display base: two glowing monitors, a gaming chair with a red plaid blanket, shelves with plants, books and collectible figures, and a crate of game cartridges under the desk.",
      // "Look underneath": orbit a pivot under the desktop, starting low at the front-right
      underView: { target: [0.0, 0.45, -0.45], distance: 2.4, elevation: -6 },
      // camera keep-out boxes (glTF space, metres): the camera slides along these, never through them
      colliders: [
        [[-1.25, -0.15, -1.0], [1.25, 0.0, 1.0]],      // display platform
        [[-0.68, 0.72, -0.88], [0.92, 0.77, -0.16]],   // desktop
        [[0.47, 0.0, -0.86], [0.91, 0.72, -0.16]],     // drawer cabinet
        [[-0.7, 0.77, -0.88], [0.95, 1.74, -0.62]],    // monitors + shelf unit
        [[-0.69, 0.31, -0.21], [0.05, 1.17, 0.48]],    // chair
      ],
      // the navigation hotspots also offered as plain buttons (keyboard / screen-reader path)
      hotspots: ["games_crate", "notebook", "monitor_left", "headphones", "contact_card", "passport", "graffiti",
                 "project_labyrinth-fate", "project_macabre-dolls", "project_juicebox"],
    },
  },
  games: {
    eyebrow: "Insert a cartridge",
    exhibit: {
      model: "models/games_collection.glb",
      scope: "games",
      view: "CAM_Asset_GamesCrate",
      frameOrigin: [0.33, 0.165, -0.48],   // where the crate sits in the desk scene (that camera's space)
      fallback: "fallback/crate.png",
      fallbackAlt: "A small wooden crate printed with a pixel creature, holding five game cartridges with pixel-art labels.",
      animation: "lift-turn",
      contactShadow: true,
      selectGlow: false,             // the lift already shows the selection; keep the cover art true
    },
  },
  about: {
    eyebrow: "Independent by design",
    exhibit: {
      model: "models/studio_notebook.glb",
      scope: "about",
      view: { forward: [-0.32, -0.72, -0.62] },
      fallback: "fallback/notebook.png",
      fallbackAlt: "An open sketchbook with pencil sketches of a tower and tents, a red ribbon bookmark and a pen.",
      animation: "notebook",
      focusScale: 1.15,              // pages are large: frame them tighter than small props
      contactShadow: false,          // flat object: the shadow plane read as a dark band on the black
      // parts of the notebook made clickable for this page only (glTF node name -> id)
      targets: { NOTE_Page_L: "page_process", NOTE_Page_R: "page_studio", NOTE_Bookmark: "bookmark" },
    },
    // notebook parts -> the About page sections they open (headings from about.html)
    panels: {
      page_process: { heading: "Design. Build. Play. Refine." },
      page_studio: { heading: "One creator. Plenty of strange ideas." },
      bookmark: { heading: "Why “Brok3n by Design”?", kind: "discovery" },
    },
  },
};

export const HOTSPOT_LABELS = {
  games_crate: "Crate — the games",
  notebook: "Notebook",
  monitor_left: "Monitors — brand film",
  monitor_right: "Monitors — brand film",
  headphones: "Headphones — WRFM Radio",
  contact_card: "Business cards — contact",
  passport: "Passport booklet — your stamps",
  graffiti: "Sticky notes — Graffiti",
  "project_labyrinth-fate": "Game box — The Maze",
  "project_macabre-dolls": "Game box — Macabre Dolls",
  "project_juicebox": "Game box — Juicebox",
  page_process: "Left page — process",
  page_studio: "Right page — the studio",
  bookmark: "Bookmark",
};

// Per-game exhibits (diorama/EXHIBITS.md). A game with an entry here shows its 3D diorama on its page
// instead of the cover art. `finds` = what each clickable item reveals (game-world flavour text,
// styled after the game's own haul screen: rarity + an appraisal).
export const EXHIBITS = {
  "bid-and-buried": {
    model: "models/exhibit_bid_and_buried.glb",
    scope: "bid-and-buried",
    view: { forward: [-0.498, -0.454, -0.739] },      // the Blender hero camera (azimuth 34°, elevation 27°)
    fallback: "fallback/exhibit-bid-and-buried.png",
    fallbackAlt: "A miniature storage unit seen from its open front: corrugated steel walls, a bare bulb, a locked safe, an old TV on a dresser, a globe, taped boxes, a barrel, a spare tire and a garbage bag; a bid paddle numbered 27 and a SOLD ticket lie outside.",
    focusScale: 1.8,
    homeScale: 0.98,                 // a little more room around the plinth
    findsTitle: "In the unit",
    finds: {
      bb_safe: { eyebrow: "Legendary?", title: "Locked Safe", text: "Heavy, locked and rattling. Nobody knows the combination, which is exactly why everyone bid on this unit." },
      bb_tv: { eyebrow: "Common", title: "CRT Television", text: "Weighs as much as a small car. Still works if you hit it on the left side." },
      bb_globe: { eyebrow: "Good find", title: "Dusty Explorer's Globe", text: "Hand-painted, sun-faded, and missing a country or two. Today's best find." },
      bb_records: { eyebrow: "Rare", title: "Crate of Records", text: "Mostly polka. One sleeve is heavier than the others." },
      bb_boxes: { eyebrow: "Junk", title: "Cardboard Boxes", text: "XMAS, MISC??? and one marked DO NOT OPEN. You'll open it." },
      bb_paddle: { eyebrow: "Lot 27", title: "Bid paddle", text: "Buy blind. Dig deep. Get rich. Sold, to the player with the paddle." },
    },
  },
  "pocket-wilds": {
    model: "models/exhibit_pocket_wilds.glb",
    scope: "pocket-wilds",
    view: { forward: [-0.498, -0.454, -0.739] },      // the Blender hero camera (azimuth 34°, elevation 27°)
    fallback: "fallback/exhibit-pocket-wilds.png",
    fallbackAlt: "A miniature dungeon corner of rough stone blocks lit by a wall torch: an iron-banded treasure chest with its lid thrown open, heaped with gold coins and gems; a golden goblet lies tipped over, spilling coins across the flagstones.",
    play: "gold",                    // real coin physics + gold sounds (exhibit/GoldPlay.jsx)
    noGlow: ["pw_gold"],             // the gold is played with, not highlighted
    focusScale: 1.8,
    homeScale: 0.98,
    findsTitle: "In the treasure room",
    finds: {
      pw_gold: { eyebrow: "Touch it", title: "The Gold", text: "Press and hold the gold to scoop up a handful, carry it anywhere and let go. Every coin is real physics. Brush the mouse over the pile to hear it jingle." },
      pw_chest: { eyebrow: "Opened", title: "Treasure Chest", text: "Iron-banded oak, the lid thrown back. Whoever opened it first didn't stay to count." },
      pw_goblet: { eyebrow: "Tipped over", title: "Golden Goblet", text: "Knocked over in a hurry, still pouring coins across the flagstones." },
      pw_torch: { eyebrow: "Still burning", title: "Wall Torch", text: "Somebody lit it recently. In a dungeon, that's never good news." },
    },
  },
  "glass-and-fortune": {
    model: "models/exhibit_glass_and_fortune.glb",
    scope: "glass-and-fortune",
    view: { forward: [-0.498, -0.454, -0.739] },      // the Blender hero camera (azimuth 34°, elevation 27°)
    fallback: "fallback/exhibit-glass-and-fortune.png",
    fallbackAlt: "A miniature fortune-teller's parlour: damask wallpaper, a moonlit window between red velvet curtains, and a round table under a black velvet cloth with a gold-embroidered hem. On it, a red and a blue glass die, a beaked mask with brass goggles leaning on a top hat, a crystal ball, an hourglass and a brass moth; an oil lantern glows on a cabinet.",
    play: "dice",                    // real dice physics + glass sounds (exhibit/DicePlay.jsx)
    noGlow: ["gf_die_red", "gf_die_blue"],
    focusScale: 1.8,
    homeScale: 0.92,
    findsTitle: "On the table",
    finds: {
      gf_mask: { eyebrow: "Watching", title: "The Fortune-Teller's Mask", text: "Beaked, goggled and somehow still judging your last roll. The fortune-teller has opinions." },
      gf_hat: { eyebrow: "Left behind", title: "Top Hat", text: "Its owner never goes far. Usually only as far as the next bad decision at the table." },
      gf_ball: { eyebrow: "Clouded", title: "Crystal Ball", text: "It shows the next roll, they say. It has never once agreed with the dice." },
      gf_hourglass: { eyebrow: "Running", title: "Hourglass", text: "One more roll. There's always time for one more roll." },
      gf_moth: { eyebrow: "Brass", title: "Brass Moth", text: "Drawn to the lantern, wound up by someone. Its wings tick when nobody is looking." },
      gf_lantern: { eyebrow: "Burning low", title: "Oil Lantern", text: "The only honest light in the room." },
    },
  },
  speck: {
    model: "models/exhibit_speck.glb",
    scope: "speck",
    view: { forward: [-0.498, -0.454, -0.739] },      // the Blender hero camera (azimuth 34°, elevation 27°)
    fallback: "fallback/exhibit-speck.png",
    fallbackAlt: "A tiny pixel planet hovering over a glowing pedestal: blue sea, green islands, beaches, hills and snowy peaks, a few blocky clouds. On top, a little homestead: a hut, a fenced farm plot with sprouts, a tree, a campfire, and a small robot with a speech bubble saying sup.",
    play: "speck",                   // spin the planet, leave something on it (exhibit/SpeckPlay.jsx)
    noGlow: ["sp_planet"],
    focusScale: 1.6,
    homeScale: 0.95,
    findsTitle: "On the speck",
    finds: {
      sp_planet: { eyebrow: "Start small", title: "The Speck", text: "A small beginning in a world full of possibility. Drag it to spin it. Tap anywhere to leave something behind: it will still be here next time you visit (it's saved in this browser only)." },
      sp_speck: { eyebrow: "sup", title: "A Speck", text: "Start small. Follow your curiosity. Make a place of your own." },
      sp_home: { eyebrow: "Home", title: "Homestead", text: "A hut, a fence and four rows of sprouts. Gather, craft and build at your own pace, and make a little space in the world feel like yours." },
    },
  },
  doqi: {
    model: "models/exhibit_doqi.glb",
    scope: "doqi",
    view: { forward: [-0.498, -0.454, -0.739] },      // the Blender hero camera (azimuth 34°, elevation 27°)
    fallback: "fallback/exhibit-doqi.png",
    fallbackAlt: "A miniature office of the Department of Questionable Inventions: grimy green walls, the DOQI sign, propaganda posters, a filing cabinet with a globe, a window onto a dusk city with a blimp. On the desk, J.E.F.F., a rusty green terminal with grumpy eyes, beside a stack of labelled folders, a BUREAUCRACY FUELS CREATIVITY mug, blueprints, a desk lamp, a tin robot, and a rubber stamp by Form 27-B.",
    play: "doqi",                    // J.E.F.F. watches you, the stamp files forms (exhibit/DoqiPlay.jsx)
    // What J.E.F.F. says when you click him: shown on his screen (and read out to screen readers), shuffled
    // so nothing repeats until he has said everything. A line can be plain text, or { text, audio } where
    // audio is a voice clip under public/media (e.g. "media/projects/doqi/jeff/filed.mp3"), played instead
    // of the beep when sounds are on. {clicks} becomes "1 time" / "4 times" (how often he's been clicked).
    // Draft lines for now; to be replaced with the studio's own.
    jeffLines: [
      "Visitor logged. Purpose of visit: unclear. Filed under 'browsing'.",
      "You have clicked me {clicks}. That is {clicks} more than required.",
      "The stamp is not a toy. Please continue playing with it.",
      "Your form has been received, reviewed and misplaced.",
      "Every game on this shelf was approved by me. Most of them reluctantly.",
      "I have seen the treasure room next door. I have filed it under 'excessive'.",
      "Please do not roll the dice in the office. That is Glass & Fortune's department.",
      "Ideas shouldn't behave themselves. Neither should visitors, apparently.",
      "This website is in development. So am I. Neither of us has an ETA.",
      "Complaint received. Complaint stamped. Complaint ignored.",
    ],
    noGlow: ["dq_stamp", "dq_form", "dq_pad"],
    focusScale: 1.8,
    homeScale: 0.95,
    findsTitle: "In the office",
    finds: {
      dq_jeff: { eyebrow: "Judicial Encyclopedic Filing Facilitator", title: "J.E.F.F.", text: "He has reviewed your file. He has concerns. Click him again for a ruling." },
      dq_stamp: { eyebrow: "Official", title: "The Stamp", text: "Your answers have been filed. Click the stamp or the form to file another." },
      dq_folders: { eyebrow: "The filing system", title: "Folders", text: "Proposals. Ideas. Rejected. Pending. Maybe. Actually…? Absurd. And when in doubt: file anyway." },
      dq_mug: { eyebrow: "Standard issue", title: "Mug", text: "Bureaucracy fuels creativity. So does whatever is in this mug." },
      dq_cabinet: { eyebrow: "Locked", title: "Filing Cabinet", text: "Same forms, different people." },
      dq_poster: { eyebrow: "Morale", title: "Poster", text: "Invent. File. Repeat. Ideas shouldn't behave themselves." },
      dq_robot: { eyebrow: "Prototype", title: "Tin Robot", text: "A questionable invention. Approved, somehow." },
    },
  },
  wrfm: {
    model: "models/exhibit_wrfm.glb",
    scope: "wrfm",
    view: { forward: [-0.498, -0.454, -0.739] },      // the Blender hero camera (azimuth 34°, elevation 27°)
    fallback: "fallback/exhibit-wrfm.png",
    fallbackAlt: "A miniature late-night radio studio: quilted burgundy padding, an ON AIR sign, the WRFM 97.1 logo and two band posters. At the broadcast desk, a big chrome microphone, a mixing console with glowing VU meters, headphones, a WRFM mug, the night's running order, a turntable with a record and an album sleeve, and a green clock reading 11:59.",
    play: "wrfm",                    // Vera on air, the hidden phone, the turntable (exhibit/WrfmPlay.jsx)
    noGlow: ["wr_onair"],
    focusScale: 1.8,
    homeScale: 0.95,
    findsTitle: "In the studio",
    // (the phone is deliberately not listed: finding it is the point)
    finds: {
      wr_mic: { eyebrow: "Live", title: "The Microphone", text: "Click it to put Vera on the air. Click again to go off air." },
      wr_turntable: { eyebrow: "33⅓", title: "Turntable", text: "Click to start or stop the studio's music. The record spins while it plays." },
      wr_console: { eyebrow: "Eight channels", title: "Mixing Console", text: "Mic 1, Vera, Phone, TT, Cart, Ads, Aux, Main. The needles move with whatever is on the air." },
      wr_onair: { eyebrow: "97.1", title: "ON AIR", text: "Lit while Vera is broadcasting. Everyone hears the same song at the same second." },
      wr_logo: { eyebrow: "Hosted by Vera Lang", title: "WRFM 97.1", text: "Smooth jazz for people who ship code." },
      wr_records: { eyebrow: "Vocal-free", title: "Record Crate", text: "Genuinely good instrumental smooth jazz, smooth enough to leave on all day." },
      wr_mug: { eyebrow: "Night shift", title: "Mug", text: "Still warm. The office is quiet and you're still here." },
    },
  },
  "labyrinth-fate": {
    model: "models/exhibit_labyrinth_fate.glb",
    scope: "labyrinth-fate",
    view: { forward: [-0.395, -0.707, -0.586] },      // the Blender hero camera (azimuth 34°, elevation 45°: see into the maze)
    fallback: "fallback/exhibit-labyrinth-fate.png",
    fallbackAlt: "A tabletop stone maze with moss and ivy on its walls, an arched gate lit by two torches, and a glowing keyhole altar at its heart. Outside: a wooden signpost with a compass, a skull, a question mark and pines, a lantern and a satchel, a rope fence, a dead tree with a crow, and a small castle on a rocky hill. A bone die and a small pawn with a lantern wait by the gate.",
    play: "maze",                    // roll the die, the pawn walks the path (exhibit/MazePlay.jsx)
    noGlow: ["mz_die"],
    focusScale: 1.8,
    homeScale: 0.95,
    findsTitle: "In the maze",
    finds: {
      mz_die: { eyebrow: "The world remembers the roll", title: "The Die", text: "Click it to roll. The wanderer walks that many steps toward the heart." },
      mz_pawn: { eyebrow: "Lantern in hand", title: "The Wanderer", text: "Choose your path, take a risk, and let the dice have their say." },
      mz_gate: { eyebrow: "The way in", title: "The Gate", text: "An unsettling maze, a little chance, and choices that stay with you." },
      mz_heart: { eyebrow: "The heart", title: "The Keyhole", text: "Something waits at the centre. The dice decide how long it waits." },
      mz_sign: { eyebrow: "Four ways", title: "Signpost", text: "A compass, a skull, a question mark and the pines. None of them point back." },
      mz_crow: { eyebrow: "Watching", title: "The Crow", text: "It has seen every wanderer go in." },
      mz_castle: { eyebrow: "On the hill", title: "The Castle", text: "Lit, at this hour. Somebody is still awake up there." },
    },
  },
  "macabre-dolls": {
    model: "models/exhibit_macabre_dolls.glb",
    scope: "macabre-dolls",
    view: { forward: [-0.498, -0.454, -0.739] },      // the Blender hero camera (azimuth 34°, elevation 27°)
    fallback: "fallback/exhibit-macabre-dolls.png",
    fallbackAlt: "A miniature forgotten nursery: dark wood walls with cobwebs, a moonlit window behind a lace curtain and an ornate mirror. On a lace doily sit three porcelain dolls in lace bonnets and dresses with hollow black eyes, a deck of MACABRE cards in front of them. Around them a worn teddy bear, a rocking horse, a painted music box, letter blocks, a dollhouse, a candle on a chest of old books, a cracked hand mirror, a tipped teacup and dried rose petals.",
    play: "dolls",                   // draw cards, the dolls watch you, the music box (exhibit/DollsPlay.jsx)
    noGlow: ["md_deck"],
    focusScale: 1.8,
    homeScale: 0.95,
    findsTitle: "In the nursery",
    finds: {
      md_deck: { eyebrow: "Doll Edition", title: "The Deck", text: "A dark and stylish card game with a haunting atmosphere. Click the deck to draw a card: every doll has a past." },
      md_doll_1: { eyebrow: "Porcelain", title: "The Eldest", text: "Strange, damaged and forgotten. Its story is suggested by its worn edges." },
      md_doll_2: { eyebrow: "Porcelain", title: "The Tall One", text: "It hasn't moved since you arrived. Look away and see." },
      md_doll_3: { eyebrow: "Porcelain", title: "The Little One", text: "Some toys should stay forgotten." },
      md_musicbox: { eyebrow: "Wind it up", title: "Music Box", text: "Click it to hear what it still remembers. The dolls always listen." },
      md_teddy: { eyebrow: "Worn", title: "Teddy Bear", text: "Loved until the fur gave out." },
      md_horse: { eyebrow: "Still rocking", title: "Rocking Horse", text: "Nobody has ridden it in years. It creaks anyway." },
      md_dollhouse: { eyebrow: "Occupied", title: "Dollhouse", text: "Every window is dark. Every room is taken." },
      md_mirror: { eyebrow: "Gilt", title: "The Mirror", text: "It shows the room. Not always the same one." },
      md_candle: { eyebrow: "Burning low", title: "The Candle", text: "Someone lit it tonight." },
    },
  },
  juicebox: {
    model: "models/exhibit_juicebox.glb",
    scope: "juicebox",
    view: { forward: [-0.498, -0.454, -0.739] },      // the Blender hero camera (azimuth 34°, elevation 27°)
    fallback: "fallback/exhibit-juicebox.png",
    fallbackAlt: "A miniature desert roadside at sunset: a cracked highway curving into a painted sky with mesas and the setting sun, an old rusty pickup truck on the shoulder, a hooded drifter with a backpack watching the sun go down, a green road sign reading GOOD PEOPLE STRANGE PLACES, sagebrush and rocks, and in front a glowing bottle of juice with a dripping smiley label.",
    play: "juicebox",                // shake the bottle, flip the sign, headlights (exhibit/JuiceboxPlay.jsx)
    focusScale: 1.8,
    homeScale: 0.95,
    findsTitle: "On the road",
    finds: {
      jb_bottle: { eyebrow: "Small format", title: "The Juice", text: "Small format. Strange possibilities. Click it and give it a shake." },
      jb_sign: { eyebrow: "Turn it over", title: "The Sign", text: "Good people. Strange places. Every sign has another side: click it." },
      jb_truck: { eyebrow: "Still runs", title: "The Truck", text: "Rust holding the paint together. Click it for the lights." },
      jb_drifter: { eyebrow: "Original character", title: "The Drifter", text: "Character and voice work in progress. For now, just watching the sun go down." },
    },
  },
};
