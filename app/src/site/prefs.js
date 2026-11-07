// Website preferences. Same storage key and format as the old site (b3d-preferences-v1), so a
// returning visitor keeps their choices: {effects, particles, sound, skipIntro}. Music has its own
// session-only state (site/music.js), like before.
import { useEffect, useState } from "react";

const KEY = "b3d-preferences-v1";
// sfx: item and cartridge sounds (on unless turned off). "sound" is the old site's cartridge-only setting,
// kept so a stored value still parses; it no longer does anything.
const DEFAULTS = { effects: true, particles: true, sound: false, sfx: true, skipIntro: false };
const motion = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
let prefs = { ...DEFAULTS };
try {
  const s = JSON.parse(localStorage.getItem(KEY));
  for (const k of Object.keys(DEFAULTS)) if (typeof s?.[k] === "boolean") prefs[k] = s[k];
} catch { /* storage blocked: defaults */ }

const listeners = new Set();
function apply() {
  const root = document.documentElement;
  root.classList.toggle("b3d-still", !!motion?.matches || !prefs.effects);
  root.classList.toggle("b3d-no-particles", !prefs.particles);
  listeners.forEach((f) => f({ ...prefs }));
}
export const getPref = (k) => prefs[k];
export const motionAllowed = () => prefs.effects && !motion?.matches;
export function setPref(k, v) {
  if (!(k in DEFAULTS) || typeof v !== "boolean") return false;
  prefs[k] = v;
  let saved = true;
  try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch { saved = false; }
  apply();
  return saved;
}
export function usePrefs() {
  const [p, setP] = useState({ ...prefs });
  useEffect(() => { listeners.add(setP); return () => listeners.delete(setP); }, []);
  return p;
}
if (typeof window !== "undefined") {
  motion?.addEventListener("change", apply);
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try { const v = JSON.parse(e.newValue) || DEFAULTS; for (const k of Object.keys(DEFAULTS)) prefs[k] = typeof v[k] === "boolean" ? v[k] : DEFAULTS[k]; } catch { /* ignore */ }
    apply();
  });
  apply();
}
