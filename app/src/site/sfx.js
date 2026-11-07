// A sound for clicking things in the 3D scenes (desk items, Games cartridges, the About notebook), so every
// interaction answers back. Synthesised in the browser (exhibit/goldAudio.js) apart from the cartridge click.
// Respects the "Sound effects" setting (Settings page; on by default).
import { getPref } from "./prefs.js";
import { wakeAudio, blip, clink } from "../exhibit/goldAudio.js";
import { cartridgeClick } from "./music.js";

const play = {
  cartridge: () => cartridgeClick(),
  paper: () => blip("card", 0.7),
  stamp: () => blip("thunk", 0.55),
  blip: () => blip("sup", 0.35),
  tap: () => blip("step", 0.8),
  knock: () => { blip("thunk", 0.35); },
  clink: () => clink(0.4, 1.5),
  mug: () => clink(0.5, 0.75),
  creak: () => blip("creak", 0.3),
  ping: () => blip("ping", 0.4),
  box: () => { blip("card", 0.5); setTimeout(() => blip("step", 0.6), 60); },
};
// which sound each item makes (by its id); anything not listed gets a soft tap
const RULES = [
  [/^game_slot_/, "cartridge"], [/^games_crate$/, "knock"], [/^passport$/, "stamp"],
  [/^(notebook|contact_card|graffiti|page_|bookmark|book_)/, "paper"], [/^monitor_/, "blip"],
  [/^collectible_/, "clink"], [/^mug$/, "mug"], [/^drawer_/, "creak"], [/^radio$/, "ping"],
  [/^project_/, "box"], [/^headphones$/, "tap"], [/^egg_/, "ping"],
  [/^duck$/, null],                       // the duck has its own squeak
];
export function itemSound(id) {
  if (!id || !getPref("sfx")) return;
  const rule = RULES.find(([re]) => re.test(id));
  const kind = rule ? rule[1] : "tap";
  if (!kind) return;
  if (typeof window !== "undefined" && window.__sfx) window.__sfx.last = kind;
  try { wakeAudio(); play[kind](); } catch { /* audio unavailable */ }
}

// browser tests: which sound the last pick made
if (typeof window !== "undefined" && new URLSearchParams(location.search).has("test")) {
  const orig = itemSound;
  window.__sfx = { last: null, kindOf: (id) => { const r = RULES.find(([re]) => re.test(id)); return r ? r[1] : "tap"; } };
  void orig;
}
