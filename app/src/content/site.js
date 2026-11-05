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
      hotspots: ["games_crate", "notebook", "monitor_left", "headphones", "contact_card", "graffiti",
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
  graffiti: "Sticky notes — Graffiti",
  "project_labyrinth-fate": "Game box — The Maze",
  "project_macabre-dolls": "Game box — Macabre Dolls",
  "project_juicebox": "Game box — Juicebox",
  page_process: "Left page — process",
  page_studio: "Right page — the studio",
  bookmark: "Bookmark",
};
