// Juicebox exhibit: the roadside at sunset. No physics engine needed.
//
//   - Click the bottle (or "Shake the juice"): it rocks on its base and the juice sloshes the other way, glug glug.
//   - Click the road sign (or "Flip the sign"): the board swings over on its bolts and shows its other side
//     ("Some things hit different on the road"). The first flip earns a Passport stamp.
//   - Click the truck (or "Headlights"): a honk, and the headlights come on, throwing light down the road.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { wakeAudio, blip } from "./goldAudio.js";
import { unlock } from "../site/passport.js";

const X = new THREE.Vector3(1, 0, 0);

export default function JuiceboxPlay({ scene }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const N = useMemo(() => {
    const g = (n) => scene.getObjectByName(n);
    return { bottle: g("JB_Bottle"), liquid: g("JB_Bottle_Liquid"), sign: g("JB_Sign"), board: g("JB_Sign_Board"), truck: g("JB_Truck"),
             lamps: [g("JB_Truck_Headlight_L"), g("JB_Truck_Headlight_R")].filter(Boolean) };
  }, [scene]);
  const S = useMemo(() => ({ wob: null, flip: 0, flipT: 0, flipFrom: 0, flips: 0, lights: false, glow: 0, beams: [], ray: new THREE.Raycaster(), ndc: new THREE.Vector2() }), []);
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), v: new THREE.Vector3(), axis: new THREE.Vector3() }), []);

  useEffect(() => {
    if (!N.bottle) return;
    S.rest = { bottle: N.bottle.quaternion.clone(), liquid: N.liquid?.quaternion.clone(), board: N.board?.quaternion.clone() };
    // headlights: the lens materials get their own copy (to glow), and two spot lights that exist from the start
    // (adding lights later would recompile every shader) but stay dark until switched on
    for (const l of N.lamps) l.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.userData.ownMat = false; o.material.emissive = new THREE.Color("#ffe6b0"); o.material.emissiveIntensity = 0; } });
    scene.updateMatrixWorld(true);
    const fwd = N.truck ? new THREE.Vector3(0, 0, 1).applyQuaternion(N.truck.getWorldQuaternion(new THREE.Quaternion())).setY(-0.12).normalize() : new THREE.Vector3(0, 0, -1);
    S.beams = N.lamps.map((l) => {
      const p = l.getWorldPosition(new THREE.Vector3());
      const spot = new THREE.SpotLight("#ffe2a8", 0, 9, 0.5, 0.55, 1.4);
      spot.position.copy(p);
      spot.target.position.copy(p).addScaledVector(fwd, 5);
      scene.add(spot, spot.target);
      return spot;
    });
    window.__juicebox = { wobbling: () => !!S.wob, flips: () => S.flips, lights: () => S.lights, boardAngle: () => S.flip };
    report();
    return () => {
      S.beams.forEach((b) => scene.remove(b, b.target));
      N.bottle.quaternion.copy(S.rest.bottle);
      if (N.liquid) N.liquid.quaternion.copy(S.rest.liquid);
      if (N.board) N.board.quaternion.copy(S.rest.board);
      delete window.__juicebox;
    };
  }, [N, S, scene]);   // eslint-disable-line react-hooks/exhaustive-deps

  function report(extra = {}) { window.dispatchEvent(new CustomEvent("jb-state", { detail: { lights: S.lights, flipped: S.flips % 2 === 1, ...extra } })); }

  function shake() {
    wakeAudio(); blip("glug", 0.8);
    const a = Math.random() * Math.PI * 2;
    S.wob = { t: 0, axis: new THREE.Vector3(Math.cos(a), 0, Math.sin(a)) };
    report({ said: "Some things hit different on the road." });
    invalidate();
  }
  function flipSign() {
    if (!N.board || S.flipT > 0) return;
    wakeAudio(); blip("creak", 0.8);
    S.flipFrom = S.flip;
    S.flipT = 0.0001;
    S.flips++;
    if (S.flips === 1) unlock("strange-places");
    report();
    invalidate();
  }
  function headlights() {
    wakeAudio();
    S.lights = !S.lights;
    if (S.lights) blip("honk", 0.8);
    report();
    invalidate();
  }

  useFrame((_, dt) => {
    const k = Math.min(dt, 0.05);
    let busy = false;
    const w = S.wob;
    if (w && N.bottle) {
      w.t += k;
      const ang = 0.2 * Math.exp(-2.6 * w.t) * Math.sin(w.t * 13);
      N.bottle.quaternion.copy(S.rest.bottle).multiply(tmp.q.setFromAxisAngle(w.axis, ang));
      if (N.liquid) {                                        // the juice lags behind and swings the other way
        const la = -0.35 * Math.exp(-2.0 * w.t) * Math.sin(w.t * 9 - 0.6);
        N.liquid.quaternion.copy(S.rest.liquid).multiply(tmp.q.setFromAxisAngle(w.axis, la));
      }
      if (w.t > 2.4) { S.wob = null; N.bottle.quaternion.copy(S.rest.bottle); if (N.liquid) N.liquid.quaternion.copy(S.rest.liquid); }
      busy = true;
    }
    if (S.flipT > 0 && N.board) {                            // over the top on its bolts, with a little overshoot
      S.flipT = Math.min(1, S.flipT + k / 0.9);
      const f = S.flipT, e = 1 - Math.pow(1 - f, 3) + Math.sin(f * Math.PI) * 0.08;
      S.flip = S.flipFrom + Math.PI * e;
      N.board.quaternion.copy(S.rest.board).multiply(tmp.q.setFromAxisAngle(X, S.flip));
      if (S.flipT >= 1) { S.flipT = 0; S.flip = S.flipFrom + Math.PI; N.board.quaternion.copy(S.rest.board).multiply(tmp.q.setFromAxisAngle(X, S.flip)); }
      busy = true;
    }
    const want = S.lights ? 1 : 0;                           // headlights warm up / fade
    if (Math.abs(S.glow - want) > 0.002) {
      S.glow += (want - S.glow) * (1 - Math.exp(-k * 8));
      for (const l of N.lamps) l.traverse((o) => { if (o.isMesh) o.material.emissiveIntensity = 4 * S.glow; });
      S.beams.forEach((b) => { b.intensity = 18 * S.glow; });
      busy = true;
    }
    if (busy) invalidate();
  });

  useEffect(() => {
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    const isIn = (o, root) => { for (; o; o = o.parent) if (o === root) return true; return false; };
    const pick = (e) => {
      const r = gl.domElement.getBoundingClientRect();
      S.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      S.ray.setFromCamera(S.ndc, camera);
      const h = S.ray.intersectObject(scene, true)[0];
      if (!h) return null;
      return isIn(h.object, N.bottle) ? "bottle" : isIn(h.object, N.sign) ? "sign" : isIn(h.object, N.truck) ? "truck" : null;
    };
    let downAt = null;
    const down = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
    const click = (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
      const what = pick(e);
      if (what === "bottle") shake(); else if (what === "sign") flipSign(); else if (what === "truck") headlights();
    };
    const act = (e) => { if (e.detail === "shake") shake(); if (e.detail === "flip") flipSign(); if (e.detail === "lights") headlights(); };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("click", click, { capture: true });
    window.addEventListener("jb-act", act);
    return () => { el.removeEventListener("pointerdown", down, { capture: true }); el.removeEventListener("click", click, { capture: true }); window.removeEventListener("jb-act", act); };
  }, [N, S, gl, camera, scene]);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
