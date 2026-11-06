// The desk radio (home page): each click plays a different WRFM clip - callers, sponsors, Vera - never the same
// one twice in a row; Next skips, Stop ends it. Site music pauses while it plays. Listeners can subscribe for the
// "now playing" bar. Five different clips heard earns the "tuned-in" Passport stamp.
import { pauseMusic } from "./music.js";
import { unlock } from "./passport.js";

export const CLIPS = [
  ["01-vera-signs-on", "Vera signs on"], ["02-rubber-duck-rental", "Sponsor: Rubber Duck Rental"],
  ["03-after-hours-intake-one-value", "After-hours intake"], ["04-mitch-from-it", "Caller: Mitch from IT"],
  ["05a-vera-phone-tease", "Vera teases the phone line"], ["06-vera-still-here", "Vera: still here"],
  ["caller-one-checkbox", "Caller: one checkbox"], ["caller-the-intern", "Caller: the intern"],
  ["phone-darling-im-on-the-radio", "Darling, I'm on the radio"], ["phone-dial-666", "Dial 666"],
  ["sponsor-debug-investigator", "Sponsor: the Debug Investigator"], ["sponsor-friday-defense-fund", "Sponsor: the Friday Defense Fund"],
  ["vera-crime-blotter", "Vera's crime blotter"], ["vera-hr-memo-cheryl", "An HR memo from Cheryl"],
];
const HEARD = "b3d-radio-heard-v1";
let audio = null, current = -1, bag = [];
const subs = new Set();
const emit = () => { const s = state(); subs.forEach((f) => f(s)); };
export const state = () => ({ playing: !!audio && !audio.paused, title: current >= 0 ? CLIPS[current][1] : "", index: current });
export function subscribe(f) { subs.add(f); f(state()); return () => subs.delete(f); }

function nextIndex() {                       // shuffle-bag: every clip once before any repeats, never twice in a row
  if (!bag.length) bag = CLIPS.map((_, i) => i).filter((i) => i !== current).sort(() => Math.random() - 0.5);
  return bag.pop();
}
function heard(i) {
  try {
    const set = new Set(JSON.parse(localStorage.getItem(HEARD) || "[]")); set.add(i);
    localStorage.setItem(HEARD, JSON.stringify([...set]));
    if (set.size >= 5) unlock("tuned-in");
  } catch { /* storage blocked: no stamp */ }
}
export function play() {
  stop(false);
  current = nextIndex();
  audio = new Audio(`${import.meta.env.BASE_URL}media/wrfm/audio/${CLIPS[current][0]}.ogg`);
  audio.dataset.pauseMusic = "1";
  audio.addEventListener("ended", () => { audio = null; emit(); });
  audio.addEventListener("pause", emit);
  pauseMusic();
  audio.play().then(() => { heard(current); emit(); }).catch(() => { audio = null; emit(); });
  emit();
}
export function stop(notify = true) {
  if (audio) { audio.pause(); audio.src = ""; audio = null; }
  if (notify) emit();
}
