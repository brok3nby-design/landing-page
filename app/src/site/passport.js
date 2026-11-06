// Studio Passport. Same storage key and format as the old site (b3d-passport-v1:
// {version: 1, stamps: {id: ISO date}}), so stamps collected on the old site carry over.
// Old stamps: visit-<project> for every project + 7 secrets. New in the 3D site: discoveries on the desk.
import { useEffect, useState } from "react";

const KEY = "b3d-passport-v1";
export const SECRETS = [
  { id: "about", title: "Curious human", hint: "Read the story behind the studio.", path: "/about", symbol: "◈" },
  { id: "scrolled", title: "The long way down", hint: "A page has more to it than its first screen.", symbol: "↓" },
  { id: "cartridge", title: "Blow on it first", hint: "Pick something from the project shelf.", path: "/games", symbol: "▣" },
  { id: "robot", title: "Robot whisperer", hint: "Someone small is patrolling the footer.", symbol: "▤" },
  { id: "door", title: "Door? What door?", hint: "Look low and right on the homepage.", path: "/", symbol: "⌑" },
  { id: "konami", title: "Absolutely normal website", hint: "An old ten-key code. Two ups, two downs…", symbol: "✦" },
  { id: "random", title: "Trust the strange", hint: "Let the studio choose your next stop.", path: "/games", symbol: "↗" },
  // new with the 3D desk (Phase 10)
  { id: "radar", title: "Under the radar", hint: "Some things are hidden where nobody looks. Try looking underneath.", path: "/", symbol: "✧" },
  { id: "maker-plate", title: "Read the fine print", hint: "Every handmade thing is signed somewhere.", path: "/", symbol: "⚒" },
  { id: "bookworm", title: "Bookworm", hint: "The shelf has more than games on it.", path: "/", symbol: "❡" },
  { id: "coffee", title: "Coffee break", hint: "Somebody left their mug on the desk.", path: "/", symbol: "☕" },
  // new with the WRFM studio exhibit
  { id: "studio-b", title: "Studio B", hint: "There's a phone in this station. Nobody will tell you where.", path: "/wrfm", symbol: "☎" },
  // new with the phase 11 desk
  { id: "quack", title: "Rubber duck debugging", hint: "Someone on the desk listens while you debug.", path: "/", symbol: "◖" },
  { id: "maze-heart", title: "The heart of the maze", hint: "Let the dice lead you all the way in.", path: "/games/labyrinth-fate", symbol: "⌖" },
  { id: "full-deck", title: "Every doll has a past", hint: "Draw every card in the Macabre deck.", path: "/games/macabre-dolls", symbol: "♠" },
];

let stamps = [];
export function setProjects(projects) {
  stamps = projects.map((p) => ({ id: `visit-${p.id}`, title: p.title, hint: `Visit the ${p.title} project page.`,
                                  path: p.id === "wrfm" ? "/wrfm" : p.id === "graffiti" ? "/graffiti" : `/games/${p.id}`,
                                  symbol: "▣", project: true, secret: p.secret }))
    .concat(SECRETS);
  notify();
}
export const allStamps = () => stamps;

let save = { version: 1, stamps: {} };
let durable = true;
function valid(v, strict) {
  if (!v || v.version !== 1 || !v.stamps || typeof v.stamps !== "object" || Array.isArray(v.stamps))
    throw new Error("This is not a version 1 Studio Passport backup.");
  const clean = {};
  for (const [id, date] of Object.entries(v.stamps)) {
    const known = /^visit-[a-z0-9-]+$/.test(id) || SECRETS.some((s) => s.id === id);
    if (!known || typeof date !== "string" || !Number.isFinite(Date.parse(date))) {
      if (strict) throw new Error("The backup contains an unknown stamp or invalid date.");
      continue;
    }
    clean[id] = new Date(date).toISOString();
  }
  return { version: 1, stamps: clean };
}
try { const s = localStorage.getItem(KEY); if (s) save = valid(JSON.parse(s), false); } catch { /* keep empty */ }

const listeners = new Set();
const toasts = new Set();
function notify() { listeners.forEach((f) => f({ save, durable, stamps })); }
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(save)); durable = true; } catch { durable = false; }
  notify();
}
export const hasStamp = (id) => !!save.stamps[id];
export function unlock(id) {
  if (save.stamps[id]) return false;
  if (!/^visit-/.test(id) && !SECRETS.some((s) => s.id === id)) return false;
  save.stamps[id] = new Date().toISOString();
  persist();
  const info = stamps.find((s) => s.id === id) || SECRETS.find((s) => s.id === id);
  if (info && !info.project) toasts.forEach((f) => f(info));
  return true;
}
export const exportSave = () => JSON.stringify(save, null, 2);
export function importSave(text) {
  const imported = valid(JSON.parse(text), true);
  for (const [id, date] of Object.entries(imported.stamps)) if (!save.stamps[id] || date < save.stamps[id]) save.stamps[id] = date;
  persist();
  return durable;
}
export function resetSave() { save = { version: 1, stamps: {} }; persist(); }
export function usePassport() {
  const [s, setS] = useState({ save, durable, stamps });
  useEffect(() => { listeners.add(setS); setS({ save, durable, stamps }); return () => listeners.delete(setS); }, []);
  return s;
}
export function onStamp(f) { toasts.add(f); return () => toasts.delete(f); }
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    try { save = e.newValue ? valid(JSON.parse(e.newValue), false) : { version: 1, stamps: {} }; notify(); } catch { /* ignore */ }
  });
  window.__passport = { unlock, has: hasStamp };      // used by the browser tests
}
