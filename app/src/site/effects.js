// Cursor particles, ported from the old site (site-effects.js) and recoloured to the new identity:
// a short spray of small square pixels in the accent red and soft grey, only for fine pointers,
// only when "Animations" and "Cursor particles" are on and reduced motion is not requested.
// Plus the konami code ("forbidden debug disco") from the old site.
import { getPref, motionAllowed } from "./prefs.js";
import { unlock } from "./passport.js";

export function startEffects() {
  if (typeof window === "undefined" || window.__b3dFx) return;
  window.__b3dFx = true;
  const canvas = document.createElement("canvas");
  canvas.className = "fx-canvas";
  canvas.setAttribute("aria-hidden", "true");
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const parts = [];
  let frame = 0, lastX = 0, lastY = 0, lastT = 0;
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); canvas.width = innerWidth * d; canvas.height = innerHeight * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  size();
  addEventListener("resize", size);
  const tick = () => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (!motionAllowed() || !getPref("particles") || document.hidden) parts.length = 0;
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.vx *= 0.975; p.vy = p.vy * 0.975 + 0.012; p.life -= 0.028;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.globalAlpha = p.life * 0.72;
      ctx.fillStyle = p.color;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
    }
    frame = parts.length ? requestAnimationFrame(tick) : 0;
  };
  addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !motionAllowed() || !getPref("particles") || document.hidden) return;
    if (e.target.closest?.(".exhibit-canvas, input, textarea")) return;          // never over the 3D view or forms
    const now = performance.now(), dist = Math.hypot(e.clientX - lastX, e.clientY - lastY);
    if (now - lastT < 24 || dist < 3) return;
    lastT = now; lastX = e.clientX; lastY = e.clientY;
    for (let i = 0, n = Math.min(4, 1 + Math.floor(dist / 12)); i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 0.45 + Math.random() * 1.15;
      parts.push({ x: e.clientX + Math.cos(a) * 5, y: e.clientY + Math.sin(a) * 5, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
                   size: Math.random() > 0.72 ? 3 : 2, life: 0.72 + Math.random() * 0.28,
                   color: Math.random() > 0.28 ? "#b3121b" : "#d7d7dc" });
    }
    if (!frame) frame = requestAnimationFrame(tick);
  }, { passive: true });

  // ↑ ↑ ↓ ↓ ← → ← → B A
  const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
  let pos = 0;
  addEventListener("keydown", (e) => {
    if (e.target.closest?.("input, textarea, .exhibit-canvas")) return;
    pos = e.key.toLowerCase() === code[pos].toLowerCase() ? pos + 1 : (e.key === code[0] ? 1 : 0);
    if (pos < code.length) return;
    pos = 0;
    const on = document.documentElement.classList.toggle("debug-disco");
    if (on) {
      const b = document.createElement("div");
      b.className = "disco-banner"; b.textContent = "FORBIDDEN DEBUG DISCO";
      document.body.appendChild(b);
      setTimeout(() => b.remove(), 2300);
      unlock("konami");
    }
  });
}
