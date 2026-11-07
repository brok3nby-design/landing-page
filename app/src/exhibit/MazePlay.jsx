// The Maze exhibit: roll the bone die and the wanderer walks into the maze. No physics engine needed.
//
//   - Click the die (or "Roll"): it hops and tumbles off its stone and lands on a number.
//   - The pawn with the lantern walks that many steps along the path toward the heart of the maze.
//   - "The world remembers the roll": where the pawn got to (and how many rolls it took) is remembered in
//     this browser (b3d-maze-v1). Reach the heart and the keyhole flares, and you earn a Passport stamp.
//   - The crow caws when you click it.
// The path (the spot before the gate, then every cell to the heart) comes from MZ_Path, Blender world space.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { wakeAudio, blip, diceHit } from "./goldAudio.js";
import { unlock } from "../site/passport.js";

const KEY = "b3d-maze-v1";
const b2t = ([x, y, z]) => new THREE.Vector3(x, z, -y);
const AXIS = { "+Z": [0, 1, 0], "-Z": [0, -1, 0], "-Y": [0, 0, 1], "+Y": [0, 0, -1], "+X": [1, 0, 0], "-X": [-1, 0, 0] };
const UP = new THREE.Vector3(0, 1, 0);
const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Number.isFinite(s.pos)) return s; } catch { /* none */ } return { pos: 0, rolls: 0, done: false }; };
const save = (s) => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* fine */ } };

export default function MazePlay({ scene }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const N = useMemo(() => {
    const g = (n) => scene.getObjectByName(n);
    let path = [];
    try { path = JSON.parse(g("MZ_Path")?.userData?.path || "[]").map(b2t); } catch { /* none */ }
    return { die: g("MZ_Die"), pawn: g("MZ_Pawn"), crow: g("MZ_Crow"), keyhole: g("MZ_Altar_Keyhole"), path };
  }, [scene]);
  const S = useMemo(() => ({ state: load(), anim: null, walk: null, glow: 0, light: null, ray: new THREE.Raycaster(), ndc: new THREE.Vector2() }), []);
  const last = () => N.path.length - 1;

  // ------------------------------------------------------------ setup: rest poses, the pawn's lantern, restore progress
  useEffect(() => {
    if (!N.die || !N.pawn || N.path.length < 2) return;
    scene.updateMatrixWorld(true);
    S.dieHome = { p: N.die.position.clone(), q: N.die.quaternion.clone() };
    // the pawn node's origin (optimised meshes carry an offset): keep it relative to the path point
    // the pawn is drawn larger than true scale, so it can be followed from the default view; its origin
    // offset above the path scales with it so it still stands on the cobbles
    const K = 1.7;
    S.scale0 = N.pawn.scale.clone();
    N.pawn.scale.multiplyScalar(K);
    S.pawnOffset = N.pawn.position.clone().sub(N.path[0]).multiplyScalar(K);
    S.pawnHome = N.pawn.quaternion.clone();
    try { S.faces = JSON.parse(N.die.userData.faces || "{}"); } catch { S.faces = {}; }
    const light = new THREE.PointLight("#ffb45a", 0.6, 0.5, 1.5);
    scene.add(light);
    S.light = light;
    if (N.keyhole) { N.keyhole.material = N.keyhole.material.clone(); N.keyhole.userData.e0 = N.keyhole.material.emissiveIntensity; }
    S.state.pos = Math.min(S.state.pos, last());
    place(S.state.pos);
    announce();
    window.__maze = { state: () => ({ ...S.state }), steps: () => last(), busy: () => !!(S.anim || S.walk) };
    return () => { scene.remove(light); N.die.position.copy(S.dieHome.p); N.die.quaternion.copy(S.dieHome.q); place(0); N.pawn.scale.copy(S.scale0); delete window.__maze; };
  }, [N, S, scene]);   // eslint-disable-line react-hooks/exhaustive-deps

  function place(i, hop = 0) {
    const p = N.path[Math.max(0, Math.min(i, last()))];
    N.pawn.position.copy(p).add(S.pawnOffset).setY(p.y + S.pawnOffset.y + hop);
    if (S.light) S.light.position.copy(N.pawn.position).add(new THREE.Vector3(0.027, 0.04, 0));
  }
  function announce(extra = {}) {
    window.dispatchEvent(new CustomEvent("mz-state", { detail: { ...S.state, total: last(), ...extra } }));
  }

  // ------------------------------------------------------------ rolling
  function roll() {
    if (S.anim || S.walk || !N.die) return;
    wakeAudio();
    if (S.state.done) { reset(); }
    const value = 1 + Math.floor(Math.random() * 6);
    const axisKey = Object.keys(S.faces).find((k) => S.faces[k] === value) || "+Z";
    const local = new THREE.Vector3(...AXIS[axisKey]);
    const final = new THREE.Quaternion().setFromAxisAngle(UP, Math.random() * Math.PI * 2).multiply(new THREE.Quaternion().setFromUnitVectors(local, UP));
    const spinAxis = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.3, Math.random() - 0.5).normalize();
    S.anim = { t: 0, value, final, spinAxis, turns: 2 + Math.random() * 1.5, hit1: false, hit2: false };
    announce({ rolling: true });
    invalidate();
  }
  function reset() {
    S.state = { pos: 0, rolls: 0, done: false };
    save(S.state);
    place(0);
    N.pawn.quaternion.copy(S.pawnHome);
    announce({ reset: true });
    invalidate();
  }

  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), v: new THREE.Vector3() }), []);
  useFrame((_, dt) => {
    const k = Math.min(dt, 0.05);
    let busy = false;
    const a = S.anim;
    if (a) {
      a.t += k;
      const D = 0.75, t = Math.min(a.t / D, 1);
      // up off the stone, a tumble, a landing and one small bounce
      const hop = t < 0.75 ? Math.sin((t / 0.75) * Math.PI) * 0.09 : Math.sin(((t - 0.75) / 0.25) * Math.PI) * 0.012;
      N.die.position.copy(S.dieHome.p).add(tmp.v.set(0, hop, 0));
      const left = (1 - t) * a.turns * Math.PI * 2;
      N.die.quaternion.copy(tmp.q.setFromAxisAngle(a.spinAxis, left)).multiply(a.final);
      if (!a.hit1 && t >= 0.75) { a.hit1 = true; diceHit("wood", 0.7); diceHit("die", 0.35); }
      if (!a.hit2 && t >= 0.999) { a.hit2 = true; diceHit("wood", 0.25); }
      if (t >= 1) {
        S.anim = null;
        S.state.rolls++;
        announce({ rolled: a.value });
        S.walk = { from: S.state.pos, to: Math.min(S.state.pos + a.value, last()), t: 0, value: a.value };
      }
      busy = true;
    }
    const w = S.walk;
    if (w) {
      w.t += k / 0.3;                                         // one step every 0.3 s
      const i = Math.min(w.from + Math.floor(w.t), w.to);
      const f = w.t - Math.floor(w.t);
      if (i < w.to) {
        const p0 = N.path[i], p1 = N.path[i + 1];
        const hop = Math.sin(f * Math.PI) * 0.012;
        N.pawn.position.copy(p0).lerp(p1, f).add(S.pawnOffset).setY(p0.y + S.pawnOffset.y + hop);
        const dir = tmp.v.copy(p1).sub(p0).setY(0);
        if (dir.lengthSq() > 1e-8) N.pawn.quaternion.slerp(tmp.q.setFromAxisAngle(UP, Math.atan2(dir.x, dir.z)).multiply(S.pawnHome), 1 - Math.exp(-k * 14));
        if (S.light) S.light.position.copy(N.pawn.position).add(new THREE.Vector3(0.027, 0.04, 0));
        if (Math.floor(w.t) !== w.lastStep) { w.lastStep = Math.floor(w.t); blip("step", 0.6); }
      } else {
        place(w.to);
        S.walk = null;
        S.state.pos = w.to;
        if (w.to >= last()) {
          S.state.done = true;
          S.glow = 1;
          unlock("maze-heart");
          blip("plant", 0.6);
        }
        save(S.state);
        announce({ rolled: w.value, arrived: true });
      }
      busy = true;
    }
    if (N.keyhole && S.glow > 0) {                            // the keyhole flares at the heart
      S.glow = Math.max(0, S.glow - k * 0.35);
      N.keyhole.material.emissiveIntensity = N.keyhole.userData.e0 * (1 + 4 * S.glow * (0.6 + 0.4 * Math.sin(performance.now() / 90)));
      busy = true;
    }
    if (busy) invalidate();
  });

  // ------------------------------------------------------------ input
  useEffect(() => {
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    const hitOf = (e, obj) => {
      if (!obj) return false;
      const r = gl.domElement.getBoundingClientRect();
      S.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      S.ray.setFromCamera(S.ndc, camera);
      const h = S.ray.intersectObject(scene, true)[0];
      if (!h) return false;
      for (let o = h.object; o; o = o.parent) if (o === obj) return true;
      return false;
    };
    let downAt = null, suppress = false;
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (hitOf(e, N.die)) { e.stopPropagation(); suppress = true; roll(); return; }   // the die rolls; no orbit, no panel
      downAt = { x: e.clientX, y: e.clientY };
    };
    const click = (e) => {
      if (suppress) { e.stopPropagation(); suppress = false; return; }
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && hitOf(e, N.crow)) { wakeAudio(); blip("caw", 0.7); }
    };
    const act = (e) => { if (e.detail === "roll") roll(); if (e.detail === "reset") reset(); };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("click", click, { capture: true });
    window.addEventListener("mz-act", act);
    return () => { el.removeEventListener("pointerdown", down, { capture: true }); el.removeEventListener("click", click, { capture: true }); window.removeEventListener("mz-act", act); };
  }, [N, S, gl, camera, scene]);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
