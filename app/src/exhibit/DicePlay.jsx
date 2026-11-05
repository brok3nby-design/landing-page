// Glass & Fortune exhibit: roll the two glass dice (red and blue) on the fortune-teller's table. Loaded
// only on that page (lazy chunk with the Rapier physics engine, MIT licence).
//
//   - Tap a die (or press "Roll the dice"): both dice are thrown across the velvet.
//   - Press and hold a die: pick it up, carry it, and let go to throw it your own way (flick to throw harder).
//   - The dice are real rigid bodies (rounded cubes): they tumble, knock into each other, the mask, the
//     crystal ball and the hourglass, can fall off the table onto the floor, and settle.
//   - When both stop, the top faces are read from their orientation and announced ("Red 5 · Blue 3 — 8").
//   - Every impact is heard: glass on glass, glass on velvet, on wood, on brass (goldAudio.js, synthesised).
//
// The room, the table and the props come from shapes exported with the model (GF_Physics extras,
// Blender space). The two dice are the GLB's own GF_Die_* nodes, moved by their physics bodies.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { Physics, useRapier, useBeforePhysicsStep, useAfterPhysicsStep } from "@react-three/rapier";
import { wakeAudio, diceHit } from "./goldAudio.js";

const DICE = [{ name: "GF_Die_Red", colour: "Red" }, { name: "GF_Die_Blue", colour: "Blue" }];
const b2t = ([x, y, z]) => [x, z, -y];                    // Blender Z-up -> glTF Y-up
// die face axes, Blender local -> glTF local
const AXIS = { "+Z": [0, 1, 0], "-Z": [0, -1, 0], "-Y": [0, 0, 1], "+Y": [0, 0, -1], "+X": [1, 0, 0], "-X": [-1, 0, 0] };
const SURFACE = { cloth: [0.85, 0.12], floor: [0.5, 0.3], wall: [0.4, 0.3], glass: [0.3, 0.4], soft: [0.9, 0.05], wood: [0.5, 0.3], metal: [0.4, 0.35] };

export default function DicePlay(props) {
  return (
    <Physics timeStep={1 / 120} colliders={false} numSolverIterations={8} allowedLinearError={0.0002}
             predictionDistance={0.001} maxCcdSubsteps={2}>
      <Dice {...props} />
    </Physics>
  );
}

function Dice({ scene }) {
  const { world, rapier } = useRapier();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const S = useMemo(() => ({
    dice: [], tags: new Map(), table: null, hand: new THREE.Vector3(), held: null, rolling: false, still: 0,
    ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    down: null, suppressClick: false, last: null, bounds: null,
  }), []);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), a: new THREE.Vector3(), d: new THREE.Vector3() }), []);

  const info = useMemo(() => {
    const u = scene.getObjectByName("GF_Physics")?.userData || {};
    try { return { shapes: JSON.parse(u.phys_shapes || "[]"), table: JSON.parse(u.table || "null") }; }
    catch { return { shapes: [], table: null }; }
  }, [scene]);

  // ------------------------------------------------------------ world
  useEffect(() => {
    const fixed = world.createRigidBody(rapier.RigidBodyDesc.fixed());
    S.tags = new Map();
    for (const s of info.shapes) {
      const [cx, cy, cz] = b2t(s.c);
      const [fr, re] = SURFACE[s.tag] || SURFACE.wood;
      const desc = s.t === "cyl" ? rapier.ColliderDesc.cylinder(s.hh, s.r) : rapier.ColliderDesc.cuboid(s.h[0], s.h[2], s.h[1]);
      const col = world.createCollider(desc.setTranslation(cx, cy, cz).setFriction(fr).setRestitution(re), fixed);
      S.tags.set(col.handle, s.tag);
    }
    if (info.table) {
      const [x, y, z] = b2t([info.table.x, info.table.y, info.table.h]);
      S.table = { c: new THREE.Vector3(x, y + 0.004, z), r: info.table.r };
    }
    S.dice = DICE.map((d, i) => {
      const node = scene.getObjectByName(d.name);
      if (!node) return null;
      node.updateWorldMatrix(true, false);
      const p = node.getWorldPosition(new THREE.Vector3()), q = node.getWorldQuaternion(new THREE.Quaternion());
      const size = node.userData.size || 0.055, rr = size * 0.16, h = size / 2;
      const body = world.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setRotation(q)
        .setCcdEnabled(true).setLinearDamping(0.05).setAngularDamping(0.12).setCanSleep(true));
      const col = world.createCollider(rapier.ColliderDesc.roundCuboid(h - rr, h - rr, h - rr, rr).setDensity(2500)
        .setFriction(0.4).setRestitution(0.32), body);
      S.tags.set(col.handle, "die");
      let faces = {};
      try { faces = JSON.parse(node.userData.faces || "{}"); } catch { /* none */ }
      return { ...d, i, node, body, col, size, faces, home: { p: p.clone(), q: q.clone() }, prev: new THREE.Vector3(), lastSound: 0 };
    }).filter(Boolean);
    const t = S.table;
    if (t) S.bounds = { c: t.c, r: t.r - 0.05 };
    announce();
    return () => {
      try { for (const d of S.dice) world.removeRigidBody(d.body); world.removeRigidBody(fixed); } catch { /* world gone */ }
      for (const d of S.dice) { d.node.position.copy(d.home.p); d.node.quaternion.copy(d.home.q); }
      S.dice = [];
    };
  }, [world, rapier, info, scene, S]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ reading the dice
  function topFace(d) {
    const q = d.body.rotation();
    tmp.q.set(q.x, q.y, q.z, q.w);
    let best = null, dot = -2;
    for (const [axis, value] of Object.entries(d.faces)) {
      const y = tmp.a.set(...AXIS[axis]).applyQuaternion(tmp.q).y;
      if (y > dot) { dot = y; best = value; }
    }
    return { value: best, flat: dot > 0.9 };
  }
  function announce() {
    if (!S.dice.length) return;
    const r = S.dice.map((d) => ({ colour: d.colour, ...topFace(d) }));
    const total = r.reduce((a, b) => a + (b.value || 0), 0);
    const detail = { dice: r, total, cocked: r.some((x) => !x.flat) };
    window.__dice = detail;
    window.dispatchEvent(new CustomEvent("gf-dice", { detail }));
  }

  // ------------------------------------------------------------ simulation hooks
  useBeforePhysicsStep(() => {
    const d = S.held;
    if (!d) return;
    const p = d.body.translation();
    tmp.d.set(S.hand.x - p.x, S.hand.y - p.y, S.hand.z - p.z).multiplyScalar(16);
    if (tmp.d.length() > 3) tmp.d.setLength(3);
    d.body.setLinvel(tmp.d, true);
    const w = d.body.angvel();                                 // a lazy tumble in the hand
    d.body.setAngvel({ x: w.x * 0.9 + 0.3, y: w.y * 0.9 + 0.2, z: w.z * 0.9 }, true);
  });
  useAfterPhysicsStep(() => {
    const now = performance.now() / 1000;
    let moving = false;
    for (const d of S.dice) {
      const b = d.body;
      const p = b.translation(), q = b.rotation();
      d.node.position.set(p.x, p.y, p.z);
      d.node.quaternion.set(q.x, q.y, q.z, q.w);
      if (p.y < -0.6) { reset(d); continue; }               // off the plinth: back to its spot on the table
      const lv = b.linvel(), av = b.angvel();
      tmp.v.set(lv.x, lv.y, lv.z);
      const dv = tmp.v.distanceTo(d.prev);
      d.prev.copy(tmp.v);
      if (!b.isSleeping() && (tmp.v.length() > 0.02 || Math.hypot(av.x, av.y, av.z) > 0.2)) moving = true;
      if (d !== S.held && dv > 0.22 && now - d.lastSound > 0.035) {
        let surface = "cloth";
        world.contactPairsWith(d.col, (other) => { const t = S.tags.get(other.handle); if (t && t !== "cloth") surface = t === "floor" ? "wood" : t; });
        d.lastSound = now;
        diceHit(surface, Math.min(1, dv / 1.8), pan(tmp.a.set(p.x, p.y, p.z)));
      }
    }
    if (S.rolling && !S.held) {
      S.still = moving ? 0 : S.still + 1;
      if (S.still > 40) { S.rolling = false; announce(); }   // ~1/3 s at rest
    }
  });
  useFrame(() => { if (S.rolling) invalidate(); });

  // ------------------------------------------------------------ actions
  const pan = (p) => Math.max(-1, Math.min(1, tmp.d.copy(p).project(camera).x * 0.7));
  function reset(d) {
    d.body.setTranslation(d.home.p, true);
    d.body.setRotation(d.home.q, true);
    d.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
    d.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }
  const spin = (k = 1) => ({ x: (Math.random() - 0.5) * 40 * k, y: (Math.random() - 0.5) * 30 * k, z: (Math.random() - 0.5) * 40 * k });
  function rollAll() {
    if (!S.table || S.held) return;
    wakeAudio();
    // throw from the side of the table nearest the viewer, toward the middle
    const c = S.table.c, toCam = tmp.a.copy(camera.position).sub(c).setY(0).normalize();
    const side = new THREE.Vector3(-toCam.z, 0, toCam.x);
    S.dice.forEach((d, k) => {
      d.body.setGravityScale(1, true);
      const start = c.clone().addScaledVector(toCam, S.table.r * 0.7).addScaledVector(side, (k - 0.5) * 0.12).setY(c.y + 0.09 + k * 0.02);
      const v = toCam.clone().multiplyScalar(-(0.5 + Math.random() * 0.4)).addScaledVector(side, (Math.random() - 0.5) * 0.45).setY(0.45 + Math.random() * 0.3);
      d.body.setTranslation(start, true);
      d.body.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3)), true);
      d.body.setLinvel(v, true);
      d.body.setAngvel(spin(), true);
      d.prev.copy(v);
    });
    S.rolling = true; S.still = 0;
    window.dispatchEvent(new CustomEvent("gf-dice", { detail: { rolling: true } }));
    invalidate();
  }
  function pick(e) {
    const rect = gl.domElement.getBoundingClientRect();
    S.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    S.ray.setFromCamera(S.ndc, camera);
    for (const hit of S.ray.intersectObjects(S.dice.map((d) => d.node), true)) {
      const d = S.dice.find((x) => { let o = hit.object; while (o) { if (o === x.node) return true; o = o.parent; } return false; });
      if (d) return { d, point: hit.point };
    }
    return null;
  }
  function handTo(e) {
    const rect = gl.domElement.getBoundingClientRect();
    S.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    S.ray.setFromCamera(S.ndc, camera);
    const hit = S.ray.ray.intersectPlane(S.plane, tmp.v);
    if (!hit) return;
    if (S.bounds) {                                           // keep the hand over the table
      const off = tmp.d.copy(hit).sub(S.bounds.c).setY(0);
      if (off.length() > S.bounds.r) off.setLength(S.bounds.r);
      S.hand.set(S.bounds.c.x + off.x, -S.plane.constant, S.bounds.c.z + off.z);
    } else S.hand.copy(hit);
  }

  // ------------------------------------------------------------ pointer input
  useEffect(() => {
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    const move = (e) => {
      if (!S.held) return;
      e.preventDefault();
      handTo(e);
      S.last = { x: e.clientX, y: e.clientY, t: performance.now() };
      invalidate();
    };
    const up = (e) => {
      const d = S.held;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      document.body.style.cursor = "";
      S.suppressClick = true;
      setTimeout(() => { S.suppressClick = false; }, 0);
      if (!d) return;
      S.held = null;
      const tap = S.down && Math.hypot(e.clientX - S.down.x, e.clientY - S.down.y) < 7 && performance.now() - S.down.t < 320;
      if (tap) { rollAll(); return; }                        // a tap rolls both dice
      d.body.setGravityScale(1, true);
      const v = d.body.linvel();
      d.body.setLinvel({ x: v.x * 1.3, y: Math.max(v.y, 0) * 1.3 + 0.3, z: v.z * 1.3 }, true);
      d.body.setAngvel(spin(0.8), true);
      S.rolling = true; S.still = 0;
      window.dispatchEvent(new CustomEvent("gf-dice", { detail: { rolling: true } }));
      invalidate();
    };
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (S.held) return;
      const hit = pick(e);
      if (!hit) return;
      e.stopPropagation();                                    // no orbiting while a die is in hand
      wakeAudio();
      S.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      S.held = hit.d;
      const top = S.table ? S.table.c.y : hit.point.y;
      S.plane.constant = -(top + 0.1);
      S.hand.set(hit.point.x, top + 0.1, hit.point.z);
      hit.d.body.setGravityScale(0, true);
      hit.d.body.wakeUp();
      document.body.style.cursor = "grabbing";
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      invalidate();
    };
    const touch = (e) => { if (S.held && e.cancelable) e.preventDefault(); };
    const click = (e) => { if (S.suppressClick) { e.stopPropagation(); S.suppressClick = false; } };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("touchstart", touch, { passive: false });
    el.addEventListener("touchmove", touch, { passive: false });
    el.addEventListener("click", click, { capture: true });
    const roll = (e) => { if (e.detail === "roll") rollAll(); };
    window.addEventListener("gf-roll", roll);
    return () => {
      el.removeEventListener("pointerdown", down, { capture: true });
      el.removeEventListener("touchstart", touch);
      el.removeEventListener("touchmove", touch);
      el.removeEventListener("click", click, { capture: true });
      window.removeEventListener("gf-roll", roll);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl, camera, S]);   // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
