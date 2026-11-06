// Speck exhibit: the little planet you can spin and leave something on ("Start small. Leave something
// behind."). No physics engine needed.
//
//   - Drag the planet to spin it (it keeps turning a little after you let go).
//   - Tap the planet to leave something there: a sapling, a flag, a flower or a lantern on land, a little
//     boat on the sea. It stays where you put it and is still there next visit (saved in this browser
//     only, b3d-speck-marks-v1; the planet in the game is shared, this one is yours).
//   - Tap the speck: its "sup" bubble pops (and the info panel opens, as for any object).
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { wakeAudio, blip } from "./goldAudio.js";

const KEY = "b3d-speck-marks-v1";
const MAX = 40;
const LAND = ["sapling", "flag", "flower", "lantern"];
const NAMES = { sapling: "a sapling", flag: "a flag", flower: "a flower", lantern: "a lantern", boat: "a little boat" };

function load() { try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a.slice(-MAX) : []; } catch { return []; } }
function save(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX))); return true; } catch { return false; } }

// tiny voxel things, built Y-up (local +Y = away from the planet)
const MATS = {};
const m = (hex, emissive) => (MATS[hex + (emissive || "")] ||= new THREE.MeshStandardMaterial({ color: hex, roughness: 0.7, ...(emissive ? { emissive, emissiveIntensity: 1.6 } : {}) }));
const BOX = new THREE.BoxGeometry(1, 1, 1);
function cube(g, mat, w, h, d, x, y, z) { const b = new THREE.Mesh(BOX, mat); b.scale.set(w, h, d); b.position.set(x, y + h / 2, z); b.castShadow = true; g.add(b); return b; }
function makeThing(type) {
  const g = new THREE.Group();
  if (type === "sapling") { cube(g, m("#6b4a2a"), 0.003, 0.012, 0.003, 0, 0, 0); cube(g, m("#3f8f35"), 0.009, 0.007, 0.009, 0, 0.011, 0); cube(g, m("#57a845"), 0.006, 0.005, 0.006, 0.002, 0.017, -0.001); }
  else if (type === "flag") { cube(g, m("#d6d6d6"), 0.0016, 0.028, 0.0016, 0, 0, 0); cube(g, m("#c8202a"), 0.012, 0.008, 0.0012, 0.0066, 0.019, 0); }
  else if (type === "flower") { cube(g, m("#3f8f35"), 0.0015, 0.009, 0.0015, 0, 0, 0); cube(g, m("#ff6fb0"), 0.007, 0.004, 0.007, 0, 0.009, 0); cube(g, m("#ffe066"), 0.0028, 0.0045, 0.0028, 0, 0.0095, 0); }
  else if (type === "lantern") { cube(g, m("#4a3420"), 0.002, 0.02, 0.002, 0, 0, 0); cube(g, m("#ffd27a", "#ffb84a"), 0.006, 0.006, 0.006, 0, 0.02, 0); }
  else { cube(g, m("#7a5232"), 0.02, 0.005, 0.009, 0, -0.002, 0); cube(g, m("#e9e4d8"), 0.001, 0.016, 0.009, 0.002, 0.003, 0); }   // boat
  return g;
}

export default function SpeckPlay({ scene, selectedId }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const planet = useMemo(() => scene.getObjectByName("SP_Planet"), [scene]);
  const S = useMemo(() => ({
    vel: new THREE.Vector3(), drag: null, ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), marks: [], group: null,
    next: 0, suppressClick: false, bubble: null, pop: 0, q: new THREE.Quaternion(), qa: new THREE.Quaternion(), qb: new THREE.Quaternion(),
  }), []);

  // markers you left: children of the planet, so they spin with it; restored from this browser
  useEffect(() => {
    if (!planet) return;
    const group = new THREE.Group();
    group.name = "SP_Marks";
    planet.add(group);
    S.group = group;
    S.marks = load();
    for (const mk of S.marks) place(mk);
    S.next = S.marks.length;
    S.bubble = scene.getObjectByName("SP_Bubble");
    invalidate();
    window.__speck = { marks: () => S.marks.length, angle: () => planet.quaternion.toArray() };
    return () => { planet.remove(group); delete window.__speck; };
  }, [planet, scene, S, invalidate]);   // eslint-disable-line react-hooks/exhaustive-deps

  function place(mk) {
    const thing = makeThing(mk.t);
    const p = new THREE.Vector3(...mk.p);
    thing.position.copy(p);
    thing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), p.clone().normalize());
    thing.rotateY(mk.r || 0);
    S.group.add(thing);
    return thing;
  }
  function leave(hit) {
    const local = planet.worldToLocal(hit.point.clone());
    const water = /Water/.test(hit.object.name);
    const t = water ? "boat" : LAND[S.next++ % LAND.length];
    const mk = { p: local.toArray().map((v) => +v.toFixed(4)), t, r: +(Math.random() * 6.28).toFixed(2) };
    const thing = place(mk);
    thing.scale.setScalar(0.01);
    thing.userData.grow = 0;                                 // pops up out of the ground
    S.marks.push(mk);
    if (S.marks.length > MAX) { S.marks.shift(); S.group.remove(S.group.children[0]); }
    const saved = save(S.marks);
    blip("plant", 0.6);
    window.dispatchEvent(new CustomEvent("sp-mark", { detail: { name: NAMES[t], count: S.marks.length, saved } }));
    invalidate();
  }
  const isMark = (o) => { for (; o; o = o.parent) if (o === S.group) return true; return false; };
  function hitPlanet(e) {
    const rect = gl.domElement.getBoundingClientRect();
    S.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    S.ray.setFromCamera(S.ndc, camera);
    // the first hit on the ground or sea (clouds and things you left don't count)
    const hit = S.ray.intersectObject(planet, true).find((h) => !/Cloud/.test(h.object.name) && !isMark(h.object));
    if (!hit) return null;
    for (let o = hit.object; o && o !== planet; o = o.parent) {
      const id = o.userData?.interactive_id;
      if (id && id !== "sp_planet") return { other: id, hit };   // the speck / the hut: a normal click
    }
    return { hit };
  }

  // ------------------------------------------------------------ input
  useEffect(() => {
    if (!planet) return;
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    const right = new THREE.Vector3(), up = new THREE.Vector3();
    const move = (e) => {
      const d = S.drag;
      if (!d) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 6) return;
      d.moved = true;
      e.preventDefault();
      const now = performance.now(), dt = Math.max((now - d.t) / 1000, 1 / 240);
      right.set(1, 0, 0).applyQuaternion(camera.quaternion);
      up.set(0, 1, 0).applyQuaternion(camera.quaternion);
      const k = 0.0075;
      S.qa.setFromAxisAngle(up, dx * k);
      S.qb.setFromAxisAngle(right, dy * k);
      planet.quaternion.premultiply(S.qa).premultiply(S.qb);
      // angular velocity (world axis * rad/s) for the spin that carries on after letting go
      S.vel.copy(up).multiplyScalar(dx * k / dt).addScaledVector(right, dy * k / dt).clampLength(0, 9);
      d.x = e.clientX; d.y = e.clientY; d.t = now;
      invalidate();
    };
    const up_ = (e) => {
      const d = S.drag;
      S.drag = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up_);
      window.removeEventListener("pointercancel", up_);
      document.body.style.cursor = "";
      S.suppressClick = true;
      setTimeout(() => { S.suppressClick = false; }, 0);
      if (!d) return;
      if (!d.moved) { S.vel.set(0, 0, 0); leave(d.hit); return; }
      if (performance.now() - d.t > 90) S.vel.set(0, 0, 0);   // held still before letting go: no fling
      invalidate();
    };
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const r = hitPlanet(e);
      if (!r || r.other) return;                               // background: orbit; speck/hut: normal click
      e.stopPropagation();
      wakeAudio();
      S.vel.set(0, 0, 0);
      S.drag = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), moved: false, hit: r.hit };
      document.body.style.cursor = "grabbing";
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up_);
      window.addEventListener("pointercancel", up_);
    };
    const touch = (e) => { if (S.drag?.moved && e.cancelable) e.preventDefault(); };
    const click = (e) => { if (S.suppressClick) { e.stopPropagation(); S.suppressClick = false; } };
    const act = (e) => {
      if (e.detail === "spin") { wakeAudio(); blip("spin", 0.6); S.vel.set(0, 1, 0).applyQuaternion(camera.quaternion).multiplyScalar(5); invalidate(); }
      if (e.detail === "leave") {                              // keyboard: leave something where you're looking
        wakeAudio();
        const r = hitPlanet({ clientX: gl.domElement.getBoundingClientRect().left + gl.domElement.clientWidth * 0.5,
                              clientY: gl.domElement.getBoundingClientRect().top + gl.domElement.clientHeight * 0.42 });
        if (r) leave(r.hit);
      }
      if (e.detail === "clear") { S.marks = []; save([]); S.group.clear(); S.next = 0; invalidate();
        window.dispatchEvent(new CustomEvent("sp-mark", { detail: { cleared: true, count: 0 } })); }
    };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("touchmove", touch, { passive: false });
    el.addEventListener("click", click, { capture: true });
    window.addEventListener("sp-act", act);
    return () => {
      el.removeEventListener("pointerdown", down, { capture: true });
      el.removeEventListener("touchmove", touch);
      el.removeEventListener("click", click, { capture: true });
      window.removeEventListener("sp-act", act);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up_);
      window.removeEventListener("pointercancel", up_);
    };
  }, [planet, gl, camera, S, invalidate]);   // eslint-disable-line react-hooks/exhaustive-deps

  // the speck says hi when you tap it
  useEffect(() => {
    if (selectedId !== "sp_speck") return;
    wakeAudio(); blip("sup", 0.7);
    S.pop = 1; invalidate();
  }, [selectedId, S, invalidate]);

  // ------------------------------------------------------------ animation (only while something moves)
  const axis = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (!planet) return;
    let busy = false;
    const w = S.vel.length();
    if (!S.drag && w > 0.02) {
      axis.copy(S.vel).divideScalar(w);
      S.q.setFromAxisAngle(axis, w * Math.min(dt, 0.05));
      planet.quaternion.premultiply(S.q);
      S.vel.multiplyScalar(Math.exp(-1.6 * dt));
      busy = true;
    }
    for (const t of S.group?.children || []) {
      if (t.userData.grow == null) continue;
      t.userData.grow = Math.min(1, t.userData.grow + dt * 4);
      const g = t.userData.grow, s = g < 1 ? 1 + Math.sin(g * Math.PI) * 0.35 * (1 - g) : 1;
      t.scale.setScalar(Math.max(0.01, g * s));
      if (g >= 1) delete t.userData.grow; else busy = true;
    }
    if (S.bubble && S.pop > 0) {
      S.pop = Math.max(0, S.pop - dt * 2.2);
      const s = 1 + Math.sin((1 - S.pop) * Math.PI * 2) * 0.25 * S.pop;
      S.bubble.scale.setScalar(s);
      busy = true;
    }
    if (busy) invalidate();
  });
  return null;
}
