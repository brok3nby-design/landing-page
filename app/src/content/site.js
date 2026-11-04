// Site copy and page configuration. Text marked PLACEHOLDER is to be replaced after the Phase 9
// content audit - nothing here is invented fact about the studio.
export const BRAND = "BROK3N BY DESIGN";

export const NAV = [
  { to: "/", label: "Studio", end: true },
  { to: "/games", label: "Games" },
  { to: "/about", label: "About" },
  { to: "/projects", label: "Projects" },
  { to: "/wrfm", label: "WRFM" },
  { to: "/contact", label: "Contact" },
];

// Each page declares its exhibit; the shared <Exhibit> viewer reads this. Phase 5 builds the home
// exhibit; Games (crate) and About (notebook) exhibits arrive in Phase 6.
export const PAGES = {
  home: {
    eyebrow: "Independent game studio",
    title: BRAND,
    intro: "PLACEHOLDER — a short studio introduction goes here after the content audit.",
    ctas: [
      { to: "/games", label: "Explore games", primary: true },
      { to: "/about", label: "About the studio" },
    ],
    exhibit: {
      model: "models/studio_desk.glb",
      scope: "home",
      view: "CAM_Hero",
      fallback: "fallback/desk.png",
      fallbackAlt: "A handcrafted miniature developer desk on a wooden display base: two glowing monitors, a gaming chair with a red plaid blanket, shelves with plants, books and collectible figures, and a crate of game cartridges under the desk.",
      underView: true,
      // invisible camera colliders (glTF space, metres): platform, desktop, drawer cabinet
      colliders: [
        [[-1.25, -0.17, -1.0], [1.25, 0.0, 1.0]],
        [[-0.68, 0.72, -0.88], [0.92, 0.76, -0.16]],
        [[0.47, 0.0, -0.86], [0.91, 0.72, -0.2]],
      ],
      // the navigation hotspots also offered as plain buttons (keyboard / screen-reader path)
      hotspots: ["games_crate", "notebook", "monitor_left", "headphones", "contact_card"],
    },
  },
  games:    { eyebrow: "The collection", title: "Games", intro: "The standalone game crate exhibit arrives in Phase 6.", fallback: "fallback/crate.png" },
  about:    { eyebrow: "The notebook", title: "About", intro: "The notebook exhibit arrives in Phase 6." },
  projects: { eyebrow: "Work", title: "Projects", intro: "PLACEHOLDER — projects page (content after the audit)." },
  wrfm:     { eyebrow: "Audio", title: "WRFM", intro: "PLACEHOLDER — the WRFM / audio experience." },
  contact:  { eyebrow: "Get in touch", title: "Contact", intro: "PLACEHOLDER — contact details will come from the existing site after the audit." },
};

export const HOTSPOT_LABELS = {
  games_crate: "Game collection crate",
  notebook: "Notebook",
  monitor_left: "Monitors",
  monitor_right: "Monitors",
  headphones: "Headphones",
  contact_card: "Business cards",
};
