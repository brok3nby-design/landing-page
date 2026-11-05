// Gold sounds for the Pocket Wilds treasure exhibit, synthesised in the browser (Web Audio): no sound
// files are downloaded. A coin "clink" is a handful of short, inharmonic sine partials (how a small metal
// disc rings) plus a tiny click of filtered noise; a "jingle" is several clinks a few ms apart; a
// "scoop" adds a rustle of coins sliding over each other. Volume follows the impact strength.
//
// The audio context starts on the visitor's first press (browsers require a gesture). The on/off
// choice is remembered per browser (b3d-gold-sound-v1); default on, because the sound only ever
// plays in response to the visitor touching the gold.
const KEY = "b3d-gold-sound-v1";
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== "off"; } catch { /* storage blocked: on */ }
const listeners = new Set();

let ctx = null, out = null, noise = null;
let voices = 0, lastAt = 0, burst = 0;
const MAX_VOICES = 22;

export function goldSoundOn() { return enabled; }
export function setGoldSound(on) {
  enabled = !!on;
  try { localStorage.setItem(KEY, enabled ? "on" : "off"); } catch { /* ignore */ }
  listeners.forEach((f) => f(enabled));
}
export function onGoldSound(f) { listeners.add(f); return () => listeners.delete(f); }

// call from a pointer/keyboard handler: creates or resumes the context inside the user gesture
export function wakeAudio() {
  if (!enabled) return null;
  try {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();          // many coins at once never clip
      comp.threshold.value = -14; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.12;
      out = ctx.createGain();
      out.gain.value = 0.55;
      out.connect(comp); comp.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 0.4);
      noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === "suspended") ctx.resume();
  } catch { return null; }
  return ctx;
}

const RATIOS = [1, 1.59, 2.14, 2.92, 3.96, 5.2];    // free circular plate modes, roughly
const AMPS = [1, 0.7, 0.5, 0.42, 0.25, 0.16];

// one coin ringing. vol 0..1, pitch ~1 (smaller/thinner coins higher), pan -1..1, delay in seconds
export function clink(vol = 0.5, pitch = 1, pan = 0, delay = 0) {
  if (!enabled || !ctx || ctx.state !== "running" || vol < 0.02) return;
  const now = ctx.currentTime;
  if (voices >= MAX_VOICES) return;
  if (now - lastAt < 0.012 && burst++ > 6) return;        // a storm of contacts in one instant: thin it out
  if (now - lastAt >= 0.012) burst = 0;
  lastAt = now;
  const t = now + delay + 0.005;
  const v = Math.min(1, vol) ** 1.4 * 0.32;
  const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
  if (p) { p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(out); }
  const bus = p || out;
  const f0 = (2350 + Math.random() * 1500) * pitch;
  const ring = 0.12 + Math.random() * 0.22;
  let end = t;
  voices++;
  RATIOS.forEach((r, k) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = f0 * r * (1 + (Math.random() - 0.5) * 0.012);
    const dec = ring / (1 + k * 0.55) * (0.75 + Math.random() * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(v * AMPS[k] + 0.0002, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + dec + 0.02);
    end = Math.max(end, t + dec + 0.02);
  });
  const n = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), ng = ctx.createGain();
  n.buffer = noise;
  hp.type = "highpass"; hp.frequency.value = 3800;
  ng.gain.setValueAtTime(v * 0.9, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
  n.connect(hp); hp.connect(ng); ng.connect(bus);
  n.start(t, Math.random() * 0.3, 0.02);
  setTimeout(() => { voices--; }, (end - now) * 1000 + 30);
}

// several coins knocking together over `spread` seconds
export function jingle(count = 4, vol = 0.4, pan = 0, spread = 0.12) {
  for (let i = 0; i < count; i++) clink(vol * (0.45 + Math.random() * 0.55), 0.9 + Math.random() * 0.25, pan + (Math.random() - 0.5) * 0.3, Math.random() * spread);
}

// a hand digging into the pile: a soft metallic rustle plus a shower of clinks
export function scoop(vol = 0.7, pan = 0) {
  if (!enabled || !ctx || ctx.state !== "running") return;
  const t = ctx.currentTime + 0.005;
  const n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noise;
  bp.type = "bandpass"; bp.frequency.value = 5200; bp.Q.value = 0.9;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.09 * vol, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  n.connect(bp); bp.connect(g); g.connect(out);
  n.start(t, 0, 0.32);
  jingle(9, vol * 0.8, pan, 0.28);
}
