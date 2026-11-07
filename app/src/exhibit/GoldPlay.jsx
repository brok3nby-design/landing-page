// Pocket Wilds treasure exhibit: play with the gold. Loaded only on that page (lazy chunk with the
// Rapier physics engine, MIT licence).
//
//   - Move the mouse over the gold: it jingles.
//   - Press on the gold (in the chest or on the floor, or on coins you dropped): you scoop up a handful.
//     Each coin is a real rigid body; while you hold them they swirl around your hand and knock together.
//   - Move to carry them, let go to drop them: they fall, bounce, roll and settle on the flagstones,
//     back into the chest, or off the edge of the plinth. Every impact makes a clink, as loud as the hit.
//   - A quick tap tosses a few coins up and lets them rain back down.
//
// The static room (floor, walls, chest walls, the open lid) comes from boxes exported with the model
// (PW_Physics extras, Blender space); the heap surfaces are triangle-mesh colliders built from the
// visible gold meshes, so coins land exactly on the gold you see. Nothing simulates while all coins
// are asleep, so the page stays idle (on-demand rendering).
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { Physics, useRapier, useBeforePhysicsStep, useAfterPhysicsStep } from "@react-three/rapier";
import { wakeAudio, clink, jingle, scoop } from "./goldAudio.js";

const POOL = 84;          // coins that can be in play at once
const HAND = 12;          // coins per handful
const PILES = ["PW_GoldPile", "PW_FloorGold"];
const b2t = ([x, y, z]) => [x, z, -y];                    // Blender Z-up -> glTF Y-up

export default function GoldPlay(props) {
  return (
    <Physics timeStep={1 / 120} colliders={false} numSolverIterations={8} allowedLinearError={0.0002}
             predictionDistance={0.001} maxCcdSubsteps={2}>
      <Gold {...props} />
    </Physics>
  );
}

function coinGeometry(r, t) {
  // a coin with a raised rim (catches the light like the real thing)
  const h = t / 2;
  const pts = [[0, -h], [r * 0.97, -h], [r, -h + t * 0.18], [r, h - t * 0.18], [r * 0.97, h], [r * 0.84, h],
               [r * 0.8, h - t * 0.22], [0, h - t * 0.22]].map(([x, y]) => new THREE.Vector2(x, y));
  const top = new THREE.LatheGeometry(pts, 22);
  top.computeVertexNormals();
  return top;
}

function Gold({ scene, onSelect }) {
  const { world, rapier } = useRapier();
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const three = useThree((s) => s.scene);
  const mesh = useRef();
  const S = useMemo(() => ({
    coins: [], held: [], holding: false, hand: new THREE.Vector3(), holdY: 0.3, bounds: null,
    pickables: [], ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    down: null, lastMove: null, lastJingle: 0, lastHover: 0, suppressClick: false, top: new THREE.Vector3(),
  }), []);

  const info = useMemo(() => {
    const u = scene.getObjectByName("PW_Physics")?.userData || {};
    let boxes = [], coin = { r: 0.0135, t: 0.0032 };
    try { boxes = JSON.parse(u.phys_boxes || "[]"); coin = { ...coin, ...JSON.parse(u.coin || "{}") }; } catch { /* defaults */ }
    return { boxes, coin };
  }, [scene]);
  const geometry = useMemo(() => coinGeometry(info.coin.r, info.coin.t), [info]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: "#ffbf45", metalness: 1, roughness: 0.27, emissive: "#5a3600", emissiveIntensity: 0.35, envMapIntensity: 0.9,
  }), []);

  // ------------------------------------------------------------ world: static colliders + coin pool
  useEffect(() => {
    const fixed = world.createRigidBody(rapier.RigidBodyDesc.fixed());
    const lo = new THREE.Vector3(-Infinity, -Infinity, -Infinity), hi = new THREE.Vector3(Infinity, Infinity, Infinity);
    info.boxes.forEach((b, i) => {
      const [cx, cy, cz] = b2t(b.c), [hx, hy, hz] = [b.h[0], b.h[2], b.h[1]];
      const [w, x, y, z] = b.q;
      world.createCollider(rapier.ColliderDesc.cuboid(hx, hy, hz).setTranslation(cx, cy, cz)
        .setRotation({ x, y: z, z: -y, w }).setFriction(0.75).setRestitution(0.18), fixed);
      // where the hand may go: above the floor (0), in front of the back wall (1), right of the left wall (2)
      if (i === 0) { lo.set(cx - hx, cy + hy, cz - hz); hi.set(cx + hx, 2, cz + hz); }
      if (i === 1) lo.z = Math.max(lo.z, cz + hz);
      if (i === 2) lo.x = Math.max(lo.x, cx + hx);
    });
    S.bounds = { lo: lo.addScalar(0.035), hi: hi.addScalar(-0.035) };
    scene.updateMatrixWorld(true);
    S.pickables = [];
    const top = new THREE.Box3();
    for (const name of PILES) {
      const node = scene.getObjectByName(name);
      if (!node) continue;
      node.traverse((m) => { if (m.isMesh) S.pickables.push(m); });   // the heap and the coins/gems on it
      const surface = node.isMesh ? [node] : node.children.filter((c) => c.isMesh && !/Coins|Gem/.test(c.name));
      for (const m of surface) {
        const pos = m.geometry.attributes.position, p = new THREE.Vector3();
        const v = new Float32Array(pos.count * 3);
        for (let k = 0; k < pos.count; k++) { p.fromBufferAttribute(pos, k).applyMatrix4(m.matrixWorld); v[k * 3] = p.x; v[k * 3 + 1] = p.y; v[k * 3 + 2] = p.z; }
        const idx = m.geometry.index ? Uint32Array.from(m.geometry.index.array) : Uint32Array.from({ length: pos.count }, (_, k) => k);
        world.createCollider(rapier.ColliderDesc.trimesh(v, idx).setFriction(0.9).setRestitution(0.08), fixed);
        if (name === "PW_GoldPile") top.expandByObject(m);
      }
    }
    if (!top.isEmpty()) top.getCenter(S.top).setY(top.max.y);
    const { r, t } = info.coin;
    S.coins = Array.from({ length: POOL }, (_, i) => {
      const body = world.createRigidBody(rapier.RigidBodyDesc.dynamic().setTranslation(0, -30 - i, 0)
        .setCcdEnabled(true).setLinearDamping(0.08).setAngularDamping(0.5).setCanSleep(true));
      world.createCollider(rapier.ColliderDesc.cylinder(t / 2, r).setDensity(19300).setFriction(0.45).setRestitution(0.32), body);
      body.setEnabled(false);
      return { i, body, state: "parked", shown: true, prev: new THREE.Vector3(), lastSound: 0, pitch: 0.9 + Math.random() * 0.22,
               offR: 0, offA: 0, offY: 0, since: 0 };
    });
    return () => {
      try { for (const c of S.coins) world.removeRigidBody(c.body); world.removeRigidBody(fixed); } catch { /* world already gone */ }
      S.coins = []; S.held = []; S.holding = false;
    };
  }, [world, rapier, info, scene, S]);

  // ------------------------------------------------------------ simulation hooks
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), m: new THREE.Matrix4(), one: new THREE.Vector3(1, 1, 1),
                               zero: new THREE.Matrix4().makeScale(0, 0, 0), vel: new THREE.Vector3(), d: new THREE.Vector3() }), []);
  useBeforePhysicsStep(() => {
    if (!S.holding) return;
    const now = performance.now() / 1000;
    for (const c of S.held) {
      const b = c.body, p = b.translation();
      const a = c.offA + now * 2.1;                        // the handful swirls slowly around the hand
      tmp.d.set(S.hand.x + Math.cos(a) * c.offR - p.x, S.hand.y + c.offY - p.y, S.hand.z + Math.sin(a) * c.offR - p.z).multiplyScalar(18);
      if (tmp.d.length() > 3.2) tmp.d.setLength(3.2);
      b.setLinvel(tmp.d, true);
      const w = b.angvel();
      b.setAngvel({ x: w.x * 0.94, y: w.y * 0.94, z: w.z * 0.94 }, true);
    }
  });
  useAfterPhysicsStep(() => {
    const im = mesh.current;
    if (!im) return;
    const now = performance.now() / 1000;
    let dirty = false;
    for (const c of S.coins) {
      if (c.state === "parked") {
        if (c.shown) { im.setMatrixAt(c.i, tmp.zero); c.shown = false; dirty = true; }
        continue;
      }
      const b = c.body;
      if (b.isSleeping() && c.shown) continue;
      const p = b.translation(), q = b.rotation();
      if (p.y < -0.8) { park(c); continue; }               // fell off the plinth into the dark
      im.setMatrixAt(c.i, tmp.m.compose(tmp.v.set(p.x, p.y, p.z), tmp.q.set(q.x, q.y, q.z, q.w), tmp.one));
      c.shown = true; dirty = true;
      const lv = b.linvel();
      tmp.vel.set(lv.x, lv.y, lv.z);
      const dv = tmp.vel.distanceTo(c.prev);
      c.prev.copy(tmp.vel);
      if (c.state === "free" && dv > 0.28 && now - c.lastSound > 0.045 && now - c.since > 0.03) {
        c.lastSound = now;
        clink(Math.min(1, dv / 2.2), c.pitch, panOf(tmp.v));
      }
    }
    if (dirty) { im.instanceMatrix.needsUpdate = true; im.boundingSphere = null; }
  });

  // ------------------------------------------------------------ helpers
  const panOf = (p) => Math.max(-1, Math.min(1, tmp.d.copy(p).project(camera).x * 0.7));
  function park(c) {
    c.state = "parked";
    c.body.setEnabled(false);
    c.body.setTranslation({ x: 0, y: -30 - c.i, z: 0 }, false);
  }
  function pick(e) {
    const rect = gl.domElement.getBoundingClientRect();
    S.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    S.ray.setFromCamera(S.ndc, camera);
    if (mesh.current && !mesh.current.boundingSphere) mesh.current.computeBoundingSphere();
    const targets = mesh.current ? [...S.pickables, mesh.current] : S.pickables;
    return S.ray.intersectObjects(targets, false)[0] || null;
  }
  function handTo(e) {
    const rect = gl.domElement.getBoundingClientRect();
    S.ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    S.ray.setFromCamera(S.ndc, camera);
    S.plane.constant = -S.holdY;
    const hit = S.ray.ray.intersectPlane(S.plane, tmp.v.set(0, 0, 0));
    if (hit && S.bounds) S.hand.copy(hit).clamp(S.bounds.lo, S.bounds.hi).setY(S.holdY);
  }
  function grab(point) {
    const now = performance.now() / 1000;
    S.holdY = Math.min(Math.max(point.y + 0.11, 0.1), 0.62);
    S.hand.set(point.x, S.holdY, point.z);
    if (S.bounds) S.hand.clamp(S.bounds.lo, S.bounds.hi).setY(S.holdY);
    const near = S.coins.filter((c) => c.state === "free" && tmp.v.copy(c.body.translation()).distanceTo(point) < 0.05).slice(0, HAND);
    const picks = [...near];
    const parked = S.coins.filter((c) => c.state === "parked");
    const free = S.coins.filter((c) => c.state === "free" && !near.includes(c)).sort((a, b) => a.since - b.since);
    while (picks.length < HAND) {
      const c = parked.pop() || free.shift();               // pool full: the oldest dropped coin is reused
      if (!c) break;
      const k = picks.length, a = k * 2.4, rr = 0.03 * Math.sqrt(k / HAND);
      const b = c.body;
      b.setEnabled(true);
      b.setTranslation({ x: point.x + Math.cos(a) * rr, y: point.y + 0.007 + k * 0.0045, z: point.z + Math.sin(a) * rr }, true);
      b.setRotation(tmp.q.setFromEuler(new THREE.Euler((Math.random() - 0.5) * 0.6, Math.random() * 6.3, (Math.random() - 0.5) * 0.6)), true);
      b.setLinvel({ x: 0, y: 0.5, z: 0 }, true);
      b.setAngvel({ x: (Math.random() - 0.5) * 6, y: (Math.random() - 0.5) * 6, z: (Math.random() - 0.5) * 6 }, true);
      c.prev.set(0, 0.5, 0);
      picks.push(c);
    }
    picks.forEach((c, k) => {
      c.state = "held"; c.since = now;
      c.offR = 0.006 + 0.024 * Math.sqrt((k + 0.5) / HAND); c.offA = k * 2.4; c.offY = ((k % 3) - 1) * 0.007;
      c.body.setGravityScale(0, true);
      c.body.wakeUp();
    });
    S.held = picks;
    S.holding = picks.length > 0;
    scoop(0.85, panOf(point));
    invalidate();
  }
  function release(throwBoost = 1) {
    const now = performance.now() / 1000;
    for (const c of S.held) {
      const b = c.body, v = b.linvel();
      b.setGravityScale(1, true);
      b.setLinvel({ x: v.x * throwBoost, y: v.y * throwBoost, z: v.z * throwBoost }, true);
      b.setAngvel({ x: (Math.random() - 0.5) * 14, y: (Math.random() - 0.5) * 14, z: (Math.random() - 0.5) * 14 }, true);
      c.state = "free"; c.since = now;
    }
    S.held = []; S.holding = false;
    invalidate();
  }

  // ------------------------------------------------------------ pointer input
  useEffect(() => {
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    const move = (e) => {
      if (!S.holding) return;
      e.preventDefault();
      handTo(e);
      const now = performance.now() / 1000, last = S.lastMove;
      if (last) {
        const speed = Math.hypot(e.clientX - last.x, e.clientY - last.y) / Math.max(now - last.t, 1e-3);
        if (speed > 260 && now - S.lastJingle > 0.09) { S.lastJingle = now; jingle(2, Math.min(0.5, speed / 2600), panOf(S.hand)); }
      }
      S.lastMove = { x: e.clientX, y: e.clientY, t: now };
      invalidate();
    };
    const up = (e) => {
      if (!S.holding) return;
      const d = S.down;
      const tap = d && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 7 && performance.now() - d.t < 320;
      release(tap ? 1 : 1.15);
      S.suppressClick = true;
      setTimeout(() => { S.suppressClick = false; }, 0);
      if (tap) onSelect?.("pw_gold");
      document.body.style.cursor = "";
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (S.holding) return;
      const hit = pick(e);
      if (!hit) return;
      e.stopPropagation();                                  // the camera doesn't orbit while you hold gold
      wakeAudio();
      S.down = { x: e.clientX, y: e.clientY, t: performance.now() };
      S.lastMove = { x: e.clientX, y: e.clientY, t: performance.now() / 1000 };
      grab(hit.point);
      document.body.style.cursor = "grabbing";
      window.addEventListener("pointermove", move, { passive: false });
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    };
    const touch = (e) => { if (S.holding && e.cancelable) e.preventDefault(); };   // no page scroll while carrying
    const click = (e) => { if (S.suppressClick) { e.stopPropagation(); S.suppressClick = false; } };
    const hover = (e) => {                                  // brushing the mouse over the gold jingles it
      if (e.pointerType !== "mouse" || S.holding || e.buttons) return;
      const now = performance.now() / 1000;
      if (now - S.lastHover < 0.05) return;
      const last = S.hoverAt;
      S.hoverAt = { x: e.clientX, y: e.clientY, t: now };
      if (!last) return;
      const speed = Math.hypot(e.clientX - last.x, e.clientY - last.y) / Math.max(now - last.t, 1e-3);
      if (speed < 120) return;
      const hit = pick(e);
      if (!hit) return;
      S.lastHover = now + 0.04;
      wakeAudio();
      jingle(speed > 900 ? 3 : 2, Math.min(0.45, 0.1 + speed / 3000), panOf(hit.point), 0.08);
    };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("touchstart", touch, { passive: false });
    el.addEventListener("touchmove", touch, { passive: false });
    el.addEventListener("click", click, { capture: true });
    el.addEventListener("pointermove", hover, { passive: true });
    return () => {
      el.removeEventListener("pointerdown", down, { capture: true });
      el.removeEventListener("touchstart", touch);
      el.removeEventListener("touchmove", touch);
      el.removeEventListener("click", click, { capture: true });
      el.removeEventListener("pointermove", hover);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
  }, [gl, camera, S, onSelect]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ the "Toss a handful" button / keyboard
  useEffect(() => {
    const f = (e) => {
      if (e.detail !== "toss" || S.holding || S.top.lengthSq() === 0) return;
      wakeAudio();
      grab(S.top.clone());
      const goal = new THREE.Vector3(S.top.x + 0.05, S.holdY + 0.05, S.top.z + 0.42);
      if (S.bounds) goal.clamp(S.bounds.lo, S.bounds.hi);
      setTimeout(() => { S.hand.copy(goal); invalidate(); }, 260);
      setTimeout(() => release(1.1), 620);
    };
    window.addEventListener("pw-gold", f);
    return () => window.removeEventListener("pw-gold", f);
  }, [S]);   // eslint-disable-line react-hooks/exhaustive-deps

  // the coins use the room's reflections more strongly than the baked set (they are the bright, new gold)
  useEffect(() => { if (three.environment) { material.envMap = three.environment; material.needsUpdate = true; } }, [three.environment, material]);

  useEffect(() => {                                       // tiny read-only API for the automated browser test
    window.__gold = {
      stats: () => ({
        held: S.coins.filter((c) => c.state === "held").length,
        free: S.coins.filter((c) => c.state === "free").length,
        asleep: S.coins.filter((c) => c.state === "free" && c.body.isSleeping()).length,
        ys: S.coins.filter((c) => c.state !== "parked").map((c) => +c.body.translation().y.toFixed(3)),
        colliders: world.colliders?.len?.() ?? null,
      }),
    };
    return () => { delete window.__gold; };
  }, [S, world]);

  useLayoutEffect(() => {                                 // every coin starts hidden (parked)
    const im = mesh.current;
    for (let i = 0; i < POOL; i++) im.setMatrixAt(i, tmp.zero);
    im.instanceMatrix.needsUpdate = true;
    S.coins.forEach((c) => { c.shown = false; });
  }, [tmp, S]);

  return <instancedMesh ref={mesh} args={[geometry, material, POOL]} frustumCulled={false} castShadow receiveShadow />;
}
