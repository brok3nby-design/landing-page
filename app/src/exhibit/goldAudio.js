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

// ---------------------------------------------------------------- glass dice (Glass & Fortune)
function voice(fn) {
  if (!enabled || !ctx || ctx.state !== "running" || voices >= MAX_VOICES) return;
  voices++;
  const life = fn(ctx.currentTime + 0.004) || 0.2;
  setTimeout(() => { voices--; }, life * 1000 + 40);
}
function partials(t, f0, ratios, amps, decay, vol, bus) {
  let end = 0;
  ratios.forEach((r, k) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = f0 * r * (1 + (Math.random() - 0.5) * 0.01);
    const d = decay / (1 + k * 0.6) * (0.8 + Math.random() * 0.4);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * amps[k] + 0.0002, t + 0.0015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + 0.02);
    end = Math.max(end, d);
  });
  return end;
}
function noiseHit(t, type, freq, q, vol, dur, bus) {
  const n = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  n.buffer = noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random() * 0.3, dur + 0.02);
}
function panned(pan) {
  if (!ctx.createStereoPanner) return out;
  const p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(out); return p;
}
// what the die hit: "die" (glass on glass), "cloth" (velvet), "wood", "glass" (crystal ball, hourglass), "metal", "soft"
export function diceHit(surface, vol = 0.5, pan = 0) {
  const v = Math.min(1, vol) ** 1.3;
  if (v < 0.015) return;
  voice((t) => {
    const bus = panned(pan);
    switch (surface) {
      case "die":   noiseHit(t, "highpass", 3000, 0.7, v * 0.25, 0.008, bus);
                    return partials(t, 2700 + Math.random() * 800, [1, 2.43, 4.1], [1, 0.5, 0.3], 0.075, v * 0.3, bus);
      case "glass": noiseHit(t, "highpass", 3500, 0.7, v * 0.15, 0.006, bus);
                    return partials(t, 3600 + Math.random() * 500, [1, 2.76], [1, 0.4], 0.3, v * 0.2, bus);
      case "metal": noiseHit(t, "bandpass", 2500, 1.5, v * 0.2, 0.01, bus);
                    return partials(t, 1700 + Math.random() * 300, [1, 2.71, 5.2], [1, 0.55, 0.3], 0.22, v * 0.18, bus);
      case "wood":  noiseHit(t, "bandpass", 1300, 2.2, v * 0.5, 0.035, bus);
                    return partials(t, 480 + Math.random() * 120, [1, 2.3], [1, 0.3], 0.06, v * 0.22, bus);
      case "soft":  noiseHit(t, "lowpass", 420, 0.7, v * 0.35, 0.04, bus); return 0.06;
      default:      noiseHit(t, "lowpass", 650, 0.8, v * 0.55, 0.05, bus);          // velvet: a muffled thud
                    noiseHit(t, "bandpass", 2600, 1.2, v * 0.05, 0.012, bus);       // ...with a hint of glass
                    return partials(t, 150 + Math.random() * 40, [1], [1], 0.05, v * 0.25, bus);
    }
  });
}

// ---------------------------------------------------------------- Speck: little 8-bit blips
// "plant": a rising pop (something left on the planet); "sup": two quick chirps (the speck says hi);
// "spin": a soft whoosh
export function blip(kind = "plant", vol = 0.5) {
  voice((t) => {
    const bus = out;
    const tone = (f0, f1, start, dur, type = "triangle", v = vol) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t + start);
      o.frequency.exponentialRampToValueAtTime(f1, t + start + dur);
      g.gain.setValueAtTime(0.0001, t + start);
      g.gain.exponentialRampToValueAtTime(0.16 * v, t + start + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g); g.connect(bus); o.start(t + start); o.stop(t + start + dur + 0.02);
    };
    if (kind === "sup") { tone(820, 900, 0, 0.07, "square", vol * 0.5); tone(1240, 1500, 0.085, 0.09, "square", vol * 0.5); return 0.2; }
    if (kind === "jeff") { tone(660, 640, 0, 0.08, "square", vol * 0.45); tone(440, 430, 0.1, 0.12, "square", vol * 0.45); return 0.25; }
    if (kind === "thunk") {                                  // a rubber stamp hitting paper on a wooden desk
      noiseHit(t, "lowpass", 260, 0.8, vol * 0.9, 0.09, bus);
      noiseHit(t, "bandpass", 1400, 2, vol * 0.25, 0.03, bus);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(55, t + 0.12);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35 * vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.16);
      return 0.2;
    }
    if (kind === "squeak") {                                 // a rubber duck being squeezed: a wobbling, rising squeal
      const o = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(700, t); o.frequency.linearRampToValueAtTime(1350, t + 0.12); o.frequency.linearRampToValueAtTime(1100, t + 0.26);
      lfo.frequency.value = 32; lg.gain.value = 60; lfo.connect(lg); lg.connect(o.frequency);
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1500; f.Q.value = 1.2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22 * vol, t + 0.02);
      g.gain.setValueAtTime(0.22 * vol, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(f); f.connect(g); g.connect(bus);
      o.start(t); lfo.start(t); o.stop(t + 0.32); lfo.stop(t + 0.32);
      return 0.35;
    }
    if (kind === "caw") {                                    // a crow: two harsh, falling caws
      for (const [st, f0] of [[0, 560], [0.32, 520]]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = "sawtooth";
        o.frequency.setValueAtTime(f0, t + st); o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + st + 0.24);
        f.type = "bandpass"; f.frequency.value = 1300; f.Q.value = 2.5;
        g.gain.setValueAtTime(0.0001, t + st); g.gain.exponentialRampToValueAtTime(0.3 * vol, t + st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + st + 0.26);
        o.connect(f); f.connect(g); g.connect(bus); o.start(t + st); o.stop(t + st + 0.28);
      }
      return 0.65;
    }
    if (kind === "glug") {                                   // liquid sloshing in a bottle: a few bubbly gulps
      for (let i = 0; i < 4; i++) {
        const st = i * 0.11 + Math.random() * 0.04;
        tone(170 + Math.random() * 60, 380 + Math.random() * 160, st, 0.08, "sine", vol * 0.9);
        noiseHit(t + st, "lowpass", 500, 1.2, vol * 0.15, 0.06, bus);
      }
      return 0.6;
    }
    if (kind === "creak") {                                  // a metal sign swinging on its bolts
      const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
      o.type = "sawtooth"; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(62, t + 0.5);
      f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 3;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12 * vol, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
      o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.6);
      noiseHit(t + 0.5, "bandpass", 900, 2, vol * 0.3, 0.04, bus);
      return 0.7;
    }
    if (kind === "honk") {                                   // an old truck horn: two flat, slightly sour notes
      for (const f0 of [392, 466]) {
        const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
        o.type = "square"; o.frequency.value = f0;
        f.type = "lowpass"; f.frequency.value = 1400;
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07 * vol, t + 0.02);
        g.gain.setValueAtTime(0.07 * vol, t + 0.32); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
        o.connect(f); f.connect(g); g.connect(bus); o.start(t); o.stop(t + 0.42);
      }
      return 0.45;
    }
    if (kind === "ping") {                                   // a radar contact: a clean ping with a soft echo
      tone(1180, 1160, 0, 0.35, "sine", vol * 0.8);
      tone(1180, 1160, 0.22, 0.3, "sine", vol * 0.25);
      return 0.6;
    }
    if (kind === "spray") {                                  // a short hiss from a spray can
      noiseHit(t, "highpass", 2600, 0.6, vol * 0.22, 0.16, bus);
      noiseHit(t, "bandpass", 6500, 0.8, vol * 0.12, 0.12, bus);
      return 0.2;
    }
    if (kind === "rattle") {                                 // shaking a can: the ball inside
      for (let i = 0; i < 4; i++) noiseHit(t + i * 0.07, "bandpass", 3400, 6, vol * 0.3, 0.02, bus);
      return 0.35;
    }
    if (kind === "card") { noiseHit(t, "bandpass", 3200, 0.8, vol * 0.22, 0.07, bus); noiseHit(t + 0.05, "highpass", 5000, 0.7, vol * 0.08, 0.03, bus); return 0.12; }
    if (kind === "step") { noiseHit(t, "bandpass", 900, 1.5, vol * 0.18, 0.03, bus); return 0.05; }
    if (kind === "spin") { noiseHit(t, "bandpass", 900, 0.8, vol * 0.12, 0.35, bus); return 0.4; }
    tone(520, 1180, 0, 0.11); noiseHit(t, "highpass", 4000, 0.7, vol * 0.05, 0.01, bus);
    return 0.15;
  });
}


// ---------------------------------------------------------------- Macabre Dolls: the music box
// An original little waltz in A minor on a music-box comb (bright sine partials, a fast pluck and a long
// ring, a tick of the mechanism). In the last two bars the spring runs down: the tempo drags and the
// pitch sags. Returns { stop(), duration } or null when sound is off / not started.
const TUNE = [[81, 1], [76, 1], [72, 1], [71, 1], [72, 1], [76, 1], [81, 1], [79, 1], [76, 1], [77, 2], [74, 1],
              [72, 1], [76, 1], [81, 1], [80, 1], [83, 1], [76, 1], [81, 2], [76, 1], [69, 3]];
const BASS = [57, 52, 57, 50, 57, 52, 57, 45];
const hz = (m) => 440 * 2 ** ((m - 69) / 12);
export function musicBox(vol = 0.6) {
  if (!enabled || !ctx || ctx.state !== "running") return null;
  const master = ctx.createGain();
  master.gain.value = vol;
  master.connect(out);
  const nodes = [];
  const pluck = (t, f, v, cents) => {
    [[1, 1], [3.0, 0.22], [5.4, 0.08]].forEach(([r, a], k) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f * r;
      o.detune.value = cents + (Math.random() - 0.5) * 6;
      const dec = 1.5 / (1 + k * 1.4);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.16 * v * a, t + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dec + 0.05);
      nodes.push(o);
    });
    noiseHit(t, "highpass", 6000, 0.7, 0.02 * v, 0.006, master);
  };
  let t = ctx.currentTime + 0.08, beat = 0;
  const total = TUNE.reduce((a, [, b]) => a + b, 0);
  for (const [m, beats] of TUNE) {
    const slow = beat > total - 6 ? 1 + ((beat - (total - 6)) / 6) * 0.9 : 1;          // the spring running down
    const sag = beat > total - 4 ? -30 * ((beat - (total - 4)) / 4) : 0;
    if (beat % 3 === 0) pluck(t, hz(BASS[Math.floor(beat / 3)] || 45), 0.55, sag);
    pluck(t, hz(m), 0.9, sag);
    t += 0.36 * beats * slow;
    beat += beats;
  }
  const duration = t - ctx.currentTime + 1.2;
  return {
    duration,
    stop: () => {
      try { master.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05); setTimeout(() => { nodes.forEach((o) => { try { o.stop(); } catch { /* done */ } }); master.disconnect(); }, 300); }
      catch { /* gone */ }
    },
  };
}
