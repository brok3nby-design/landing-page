// The desk radio, one player for the whole site (it keeps playing when you change pages):
//
//   - "clips": a WRFM clip - callers, sponsors, Vera - a different one each time (shuffle, never the same twice
//     in a row); Next skips. Five different clips heard earns the "tuned-in" Passport stamp.
//   - "live":  WRFM 97.1 itself, in sync with the real station. WRFM has no server stream: every listener works
//     out what is on air from the clock with the station's own schedule (site/wrfm/broadcastSchedule.js, synced
//     from wrfm-source by scripts/sync-wrfm.mjs), so this plays the same song or segment, at the same second,
//     as someone listening on the WRFM site. Files come from WRFM's CloudFront copy, then its IPFS gateways.
//
// Site music pauses while the radio plays; any other sound or video starting (a trailer, a WRFM page clip, the
// duck's ad) stops the radio. Subscribers get { playing, mode, title, detail } for the now-playing bar.
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
const HEARD = "b3d-radio-heard-v1", VOL = "b3d-radio-volume-v1";
let audio = null, mode = null, title = "", detail = "", current = -1, bag = [];
let volume = 0.8;
try { const v = parseFloat(localStorage.getItem(VOL)); if (Number.isFinite(v)) volume = Math.max(0, Math.min(1, v)); } catch { /* default */ }
const subs = new Set();
export const state = () => ({ playing: !!audio && !audio.paused, loading: !!audio && audio.paused && !!mode, mode, title, detail, volume });
const emit = () => { const s = state(); subs.forEach((f) => f(s)); };
export function subscribe(f) { subs.add(f); f(state()); return () => subs.delete(f); }

function newDeck() {
  stop(false);
  audio = new Audio();
  audio.dataset.pauseMusic = "1";
  audio.volume = volume;
  audio.addEventListener("pause", emit);
  audio.addEventListener("playing", emit);
  return audio;
}
export function stop(notify = true) {
  clearInterval(liveTimer); liveTimer = 0;
  if (audio) { const a = audio; audio = null; a.pause(); a.removeAttribute("src"); a.load(); }
  mode = null; title = ""; detail = "";
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "none";
  if (notify) emit();
}
export function setVolume(v) {
  volume = Math.max(0, Math.min(1, v));
  if (audio) audio.volume = volume;
  try { localStorage.setItem(VOL, String(volume)); } catch { /* not saved */ }
  emit();
}

// ---------------------------------------------------------------- clips
function nextClip() {                         // shuffle-bag: every clip once before any repeats, never twice in a row
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
export function play() {                      // a funny clip (the "Funny clip" button / Next clip)
  const a = newDeck();
  mode = "clips";
  current = nextClip();
  title = CLIPS[current][1]; detail = "WRFM 97.1 · clips";
  a.src = `${import.meta.env.BASE_URL}media/wrfm/audio/${CLIPS[current][0]}.ogg`;
  a.addEventListener("ended", () => { if (audio === a) stop(); });
  pauseMusic();
  const i = current;
  a.play().then(() => { heard(i); emit(); }).catch(() => { if (audio === a) stop(); });
  media("WRFM 97.1", title);
  emit();
}

// ---------------------------------------------------------------- live
let sched = null, liveTimer = 0;
async function schedule() {
  if (!sched) {
    const [mod, songs, gw] = await Promise.all([import("./wrfm/broadcastSchedule.js"), import("./wrfm/wrfm_songs.json"),
                                                import("./wrfm/gateways.json")]);
    sched = { ...mod, songs: new Map(songs.default.map((s) => [s.id, s])), hosts: gw.default.audio };
  }
  return sched;
}
function describe(seg) {                      // what the bar says for a song, a Vera segment or a sponsor spot
  if (seg.type === "song") { const s = sched.songs.get(seg.id); return [s?.title || "WRFM", s?.artist ? `${s.artist}${s.year ? ` · ${s.year}` : ""}` : ""]; }
  const c = seg.clip || {};
  if (seg.category === "commercial") return [c.sponsor ? `A word from ${c.sponsor}` : "A word from our sponsors", "Station break"];
  if (seg.category === "caller") return ["On the line with Vera", "Caller"];
  return ["Vera Lang", "Between the records"];
}
function playLive(a) {                        // put the segment that is on air now on the deck, at the right second
  const now = sched.getLiveNow(Date.now(), "main");
  if (!now) { stop(); return; }
  const seg = now.segment;
  [title, detail] = describe(seg);
  media(title, detail);
  emit();
  let host = 0;
  const load = () => {
    a.src = sched.hosts[host] + seg.cid;
    a.addEventListener("loadedmetadata", () => {
      const off = (Date.now() - now.startedAt) / 1000;   // time has moved on while it loaded
      if (off < (a.duration || seg.dur) - 0.5) a.currentTime = Math.max(0, off);
      a.play().catch(() => { if (audio === a) stop(); });
    }, { once: true });
  };
  a.onerror = () => { if (audio !== a) return; if (++host < sched.hosts.length) load(); else stop(); };   // next host
  a.onended = () => { if (audio === a) playLive(a); };                                                   // whatever is on next
  load();
}
export async function tuneIn() {             // WRFM 97.1 live, as it is on air right now
  const a = newDeck();
  mode = "live"; title = "Tuning in…"; detail = "WRFM 97.1 · live";
  pauseMusic();
  emit();
  try { await schedule(); } catch { if (audio === a) stop(); return; }
  if (audio !== a) return;                    // stopped while loading
  playLive(a);
  // stay in step with the station: if playback drifts more than a few seconds, catch up
  liveTimer = setInterval(() => {
    if (audio !== a || a.paused || !a.duration) return;
    const now = sched.getLiveNow(Date.now(), "main");
    if (!now || !a.currentSrc.endsWith(now.segment.cid)) return;
    if (Math.abs(a.currentTime - now.offset) > 4) a.currentTime = now.offset;
  }, 20000);
}
export const isLive = () => mode === "live";

// lock screen / media keys
function media(t, artist) {
  if (!("mediaSession" in navigator) || typeof MediaMetadata === "undefined") return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({ title: t, artist, album: "WRFM 97.1 — Workplace Relief Frequency" });
    navigator.mediaSession.playbackState = "playing";
    navigator.mediaSession.setActionHandler("pause", () => stop());
    navigator.mediaSession.setActionHandler("stop", () => stop());
  } catch { /* optional */ }
}

// one voice at a time: any other sound or video starting stops the radio (music.js already yields to us),
// and so does the site music being switched on
if (typeof document !== "undefined") {
  window.addEventListener("b3d-music-start", () => { if (audio) stop(); });
  document.addEventListener("play", (e) => {
    const t = e.target;
    if (audio && t !== audio && !t.muted && !t.dataset?.siteMusic) stop();
  }, true);
}

// browser tests: what the deck is playing, and what the station schedule says is on air
if (typeof window !== "undefined" && new URLSearchParams(location.search).has("test")) {
  window.__radio = { state, src: () => audio?.currentSrc || "", time: () => audio?.currentTime ?? null,
                     onAir: async () => { await schedule(); const n = sched.getLiveNow(Date.now(), "main"); return { cid: n.segment.cid, offset: n.offset, id: n.segment.id }; } };
}
