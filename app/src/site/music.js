// Background music, ported from the old site's site-music.js: off until the visitor presses play,
// volume 25 %, remembered for this browser session only (b3d-site-music-v1). It yields to trailers,
// radio clips, the live WRFM station and embedded video.
import { useEffect, useState } from "react";

const KEY = "b3d-site-music-v1";
const BASE = import.meta.env.BASE_URL;
let saved = {};
try { saved = JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { /* none */ }
let audio = null;
let playing = false;
const listeners = new Set();
const emit = () => listeners.forEach((f) => f({ playing, volume: audio ? audio.volume : vol() }));
const vol = () => (Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : 0.25);

function deck() {
  if (audio) return audio;
  audio = new Audio();
  const ogg = audio.canPlayType("audio/ogg; codecs=vorbis");
  audio.src = `${BASE}media/sounds/site_music_1.${ogg ? "ogg" : "mp3"}`;
  audio.loop = true;
  audio.preload = "none";
  audio.volume = vol();
  audio.addEventListener("loadedmetadata", () => {
    if (saved.time && audio.duration > 0) audio.currentTime = saved.time % audio.duration;
  }, { once: true });
  audio.addEventListener("play", () => { playing = true; emit(); });
  audio.addEventListener("pause", () => { playing = false; emit(); });
  return audio;
}
function persist() {
  try { sessionStorage.setItem(KEY, JSON.stringify({ enabled: playing, volume: audio ? audio.volume : vol(), time: audio?.currentTime || 0 })); } catch { /* ignore */ }
}
export async function playMusic() { try { await deck().play(); } catch { /* blocked: button stays usable */ } persist(); }
export function pauseMusic() { audio?.pause(); persist(); }
export function setVolume(v) { deck().volume = v; saved.volume = v; persist(); emit(); }
export function useMusic() {
  const [s, setS] = useState({ playing, volume: audio ? audio.volume : vol() });
  useEffect(() => { listeners.add(setS); return () => listeners.delete(setS); }, []);
  return s;
}
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", persist);
  document.addEventListener("play", (e) => { if (e.target !== audio && !e.target.muted) pauseMusic(); }, true);
  document.addEventListener("click", (e) => { if (e.target.closest?.('a[href*="/wrfm/"], [data-pause-music]')) pauseMusic(); });
  window.addEventListener("blur", () => setTimeout(() => { if (document.activeElement?.tagName === "IFRAME") pauseMusic(); }, 0));
  if (saved.enabled) playMusic();                     // continue after a reload, like the old site
}

// the cartridge click when a game case is chosen (off unless "Cartridge sound effects" is on)
let click = null;
export function cartridgeClick() {
  if (!click) { click = new Audio(`${BASE}media/sounds/cartridge.mp3`); click.volume = 0.6; }
  click.currentTime = 0;
  click.play().catch(() => {});
}
