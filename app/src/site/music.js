// Background music: the studio's own tracks, as a playlist that follows the mood of the page you're on.
// Off until the visitor presses play (header "Play music", or the headphones on the desk); volume and
// on/off are remembered for this browser session (b3d-site-music-v1), like the old site's single track.
//
//   chill   (home, About, WRFM, most pages) - rotates through the lo-fi / late-night tracks
//   fun     (Games, Pocket Wilds)           - Pixel Groove Parade
//   office  (DOQI)                          - Paperwork Parade
//   creepy  (Macabre Dolls, The Maze, Under the Radar) - Broken Carousel, Unsettled Lullaby
//
// Each track plays through, then the next one in the page's mood starts (shuffled, never the same twice in a
// row). Changing to a page with another mood crossfades to it. It yields to trailers, radio clips, the live
// WRFM station and embedded video. Tracks: app/media/sounds/music/<id>.ogg|.mp3 (masters in diorama/custom/music).
import { useEffect, useState } from "react";

const KEY = "b3d-site-music-v1";
const BASE = import.meta.env.BASE_URL;
export const TRACKS = {
  "studio-theme": "Studio Theme", "rainy-desk-light": "Rainy Desk Light", "rainy-study-loop": "Rainy Study Loop",
  "two-am-studio": "Two A.M. Studio", "two-am-studio-light": "Two A.M. Studio (Light)",
  "focus-loop": "Focus Loop", "warm-loop-focus": "Warm Loop Focus",
  "pixel-groove-parade": "Pixel Groove Parade", "paperwork-parade": "Paperwork Parade",
  "broken-carousel": "Broken Carousel", "unsettled-lullaby": "Unsettled Lullaby",
};
const MOODS = {
  chill: ["studio-theme", "rainy-desk-light", "two-am-studio", "focus-loop", "rainy-study-loop", "two-am-studio-light", "warm-loop-focus"],
  fun: ["pixel-groove-parade"],
  office: ["paperwork-parade"],
  creepy: ["broken-carousel", "unsettled-lullaby"],
};
export function moodFor(path) {
  const p = path.replace(BASE.replace(/\/$/, ""), "") || "/";
  if (/^\/games\/?$/.test(p) || /^\/games\/pocket-wilds/.test(p)) return "fun";
  if (/^\/games\/doqi/.test(p)) return "office";
  if (/^\/games\/(macabre-dolls|labyrinth-fate|under-the-radar)/.test(p)) return "creepy";
  return "chill";
}

let saved = {};
try { saved = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { /* none */ }
const vol = () => (Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.25);
let volume = vol();
let audio = null, playing = false, mood = moodFor(typeof location !== "undefined" ? location.pathname : "/");
let track = saved.track && TRACKS[saved.track] ? saved.track : null, last = null;
const ogg = typeof Audio !== "undefined" && new Audio().canPlayType("audio/ogg; codecs=vorbis");
const listeners = new Set();
const snapshot = () => ({ playing, volume, track, title: track ? TRACKS[track] : "", mood });
const emit = () => { const s = snapshot(); listeners.forEach((f) => f(s)); };

function pick(m, avoid) {                     // a track from the mood, not the one that just played
  const list = MOODS[m] || MOODS.chill;
  const options = list.length > 1 ? list.filter((t) => t !== avoid) : list;
  return options[Math.floor(Math.random() * options.length)];
}
function src(id) {                           // the original site theme lives one folder up
  return id === "studio-theme" ? `${BASE}media/sounds/site_music_1.${ogg ? "ogg" : "mp3"}` : `${BASE}media/sounds/music/${id}.${ogg ? "ogg" : "mp3"}`;
}
function deck(id, at = 0) {                   // a fresh <audio> for this track
  const a = new Audio(src(id));
  a.dataset.siteMusic = "1";
  a.preload = "auto";
  a.volume = 0;
  if (at) a.addEventListener("loadedmetadata", () => { if (at < a.duration - 2) a.currentTime = at; }, { once: true });
  a.addEventListener("ended", () => { if (audio === a) next(); });
  a.addEventListener("play", () => { if (audio === a) { playing = true; emit(); } });
  a.addEventListener("pause", () => { if (audio === a && !a.ended) { playing = false; persist(); emit(); } });
  return a;
}
function fade(a, to, ms, done) {              // smooth volume ramp (crossfades, gentle start / stop)
  const from = a.volume, t0 = performance.now();
  const step = () => {
    if (a !== audio && to > 0) return;        // replaced meanwhile
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(step); else done?.();
  };
  requestAnimationFrame(step);
}
function start(id, at = 0) {
  window.dispatchEvent(new Event("b3d-music-start"));   // the radio steps aside (one voice at a time)
  const old = audio;
  track = id; last = id;
  audio = deck(id, at);
  const a = audio;
  a.play().then(() => fade(a, volume, 900)).catch(() => { if (audio === a) { playing = false; emit(); } });
  if (old) fade(old, 0, 900, () => { old.pause(); old.removeAttribute("src"); old.load(); });
  persist(); emit();
}
function persist() {
  try { sessionStorage.setItem(KEY, JSON.stringify({ enabled: playing, volume, track, time: audio?.currentTime || 0 })); } catch { /* ignore */ }
}

export async function playMusic() {
  if (audio && audio.paused && track && (MOODS[mood] || []).includes(track)) {   // resume where it paused
    window.dispatchEvent(new Event("b3d-music-start"));
    try { await audio.play(); fade(audio, volume, 600); } catch { /* blocked: button stays usable */ }
    persist(); return;
  }
  start(track && (MOODS[mood] || []).includes(track) ? track : pick(mood, last), track === saved.track ? saved.time || 0 : 0);
}
export function pauseMusic() {
  if (!audio || audio.paused) return;
  const a = audio;
  playing = false; emit();
  fade(a, 0, 250, () => { if (audio === a) a.pause(); persist(); });
}
export function next() { start(pick(mood, track)); }                      // the next track in this mood
export function setVolume(v) { volume = Math.max(0, Math.min(1, v)); saved.volume = volume; if (audio && playing) audio.volume = volume; persist(); emit(); }
// the layout calls this on every page change: another mood -> crossfade into it (only if music is on)
export function setMoodFor(path) {
  const m = moodFor(path);
  if (m === mood) return;
  mood = m;
  if (playing) start(pick(mood, track)); else { track = null; emit(); }
}
export function useMusic() {
  const [s, setS] = useState(snapshot());
  useEffect(() => { listeners.add(setS); return () => listeners.delete(setS); }, []);
  return s;
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", persist);
  document.addEventListener("play", (e) => { if (!e.target.dataset?.siteMusic && !e.target.muted) pauseMusic(); }, true);
  document.addEventListener("click", (e) => { if (e.target.closest?.('a[href*="/wrfm/"], [data-pause-music]')) pauseMusic(); });
  window.addEventListener("blur", () => setTimeout(() => { if (document.activeElement?.tagName === "IFRAME") pauseMusic(); }, 0));
  if (saved.enabled) playMusic();                     // continue after a reload, like the old site
  if (new URLSearchParams(location.search).has("test")) window.__music = { state: snapshot, moodFor };
}

// the cartridge click when a game case is chosen ("Sound effects" setting)
let click = null;
export function cartridgeClick() {
  if (!click) { click = new Audio(`${BASE}media/sounds/cartridge.mp3`); click.volume = 0.6; }
  click.currentTime = 0;
  click.play().catch(() => {});
}
