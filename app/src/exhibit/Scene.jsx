// Heavy part of the shared exhibit viewer (lazy chunk): R3F canvas, GLB loading (KTX2 + meshopt),
// runtime lighting for the hybrid-baked assets, camera rig, hover/select, subtle bloom.
import { Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, ContactShadows, useGLTF, useProgress } from "@react-three/drei";
import CC from "camera-controls";
import { EffectComposer, Bloom, ToneMapping, BrightnessContrast, HueSaturation } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const BASE = import.meta.env.BASE_URL;
// per-exhibit toys, loaded only where used (the gold physics brings the Rapier engine with it)
const GoldPlay = lazy(() => import("./GoldPlay.jsx"));
const DicePlay = lazy(() => import("./DicePlay.jsx"));
const SpeckPlay = lazy(() => import("./SpeckPlay.jsx"));
const HIGHLIGHT = new THREE.Color(0.09, 0.008, 0.012);     // subtle deep-red hover / selection glow
// Canvas clear colour chosen so that AFTER AgX tone mapping it lands exactly on the page's #080808
// (measured in the browser; AgX darkens near-black). Override with ?bg=xxxxxx while tuning.
const BG = "#" + (new URLSearchParams(location.search).get("bg") || "111111");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

let ktx2 = null;
function ktx2For(gl) {
  if (!ktx2) ktx2 = new KTX2Loader().setTranscoderPath(`${BASE}basis/`).detectSupport(gl);
  return ktx2;
}

// nearest ancestor that is interactive for this exhibit's scope (the homepage ignores game-case tags)
function tagged(obj, scope) {
  for (let o = obj; o; o = o.parent) {
    const u = o.userData || {};
    if (u.interactive_id && (!u.interactive_scope || u.interactive_scope === scope)) return o;
  }
  return null;
}

function setGlow(node, on) {
  node?.traverse((m) => { if (m.isMesh && m.userData.ownMat) m.material.emissive.copy(on ? HIGHLIGHT : m.userData.emissive0); });
}

// ---------------------------------------------------------------- model
function Model({ url, scope, targets, selectGlow = true, noGlow, selectedId, onSelect, onLoaded }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const { scene } = useGLTF(url, false, true, (loader) => loader.setKTX2Loader(ktx2For(gl)));
  const [hovered, setHovered] = useState(null);

  const index = useMemo(() => {
    const byId = {};
    // anisotropic filtering keeps the rug, planks and desk grain sharp at grazing angles (cheap on GPUs)
    const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy());
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true;
        for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "aoMap", "emissiveMap"]) {
          const t = o.material[k];
          if (t && t.anisotropy !== aniso) { t.anisotropy = aniso; t.needsUpdate = true; }
        }
        if (o.material.name.endsWith("_baked") && !o.material.userData.tuned) {
          o.material.emissiveIntensity *= 0.85;               // baked practical glow, matched to Cycles
          o.material.userData.tuned = true;
        }
      }
      if (targets && targets[o.name]) {                    // page-defined click targets (no re-export needed)
        o.userData.interactive_id = targets[o.name];
        o.userData.interactive_scope = scope;
      }
      const id = o.userData?.interactive_id;
      if (id && (!o.userData.interactive_scope || o.userData.interactive_scope === scope)) {
        byId[id] = byId[id] || o;
        o.traverse((m) => {                                  // own materials -> highlight one object only
          if (m.isMesh && !m.userData.ownMat) {
            m.material = m.material.clone();
            m.userData.ownMat = true;
            m.userData.emissive0 = m.material.emissive.clone();
          }
        });
      }
    });
    return byId;
  }, [scene, scope, targets, gl]);

  useLayoutEffect(() => { onLoaded(scene, index); }, [scene, index, onLoaded]);
  useEffect(() => {
    if (!selectGlow || noGlow?.includes(selectedId)) return;
    setGlow(index[selectedId], true);
    invalidate();
    return () => { setGlow(index[selectedId], false); invalidate(); };
  }, [selectedId, index, selectGlow, noGlow, invalidate]);
  useEffect(() => {
    if (!hovered || hovered === index[selectedId] || noGlow?.includes(hovered.userData.interactive_id)) return;
    setGlow(hovered, true);
    invalidate();
    return () => { setGlow(hovered, false); invalidate(); };
  }, [hovered, selectedId, index, noGlow, invalidate]);

  return (
    <primitive object={scene}
      onPointerMove={(e) => {
        e.stopPropagation();
        const t = tagged(e.object, scope);
        if (t !== hovered) setHovered(t);
        document.body.style.cursor = t ? "pointer" : "grab";
      }}
      onPointerOut={() => { setHovered(null); document.body.style.cursor = ""; }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.delta > 6) return;                              // that was a drag (orbit), not a click
        const t = tagged(e.object, scope);
        if (t) onSelect(t.userData.interactive_id);
      }}
    />
  );
}

// ---------------------------------------------------------------- per-page animations
const damp = (dt, k = 7) => 1 - Math.exp(-k * dt);

// Games page: the selected case lifts out of the crate and turns its label toward the camera;
// every other case eases back to the exact transform it had in the GLB.
function LiftTurn({ index, selectedId, lift = 0.11 }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [selectedId, invalidate]);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, "YXZ") }), []);
  useFrame((_, dt) => {
    let moving = false;
    for (const node of Object.values(index)) {
      const u = node.userData;
      if (!u.home) u.home = { p: node.position.clone(), q: node.quaternion.clone() };
      const active = node.userData.interactive_id === selectedId;
      if (active) {
        const cam = node.parent.worldToLocal(tmp.v.copy(camera.position));
        tmp.e.set(-0.16, Math.atan2(cam.x - u.home.p.x, cam.z - u.home.p.z), 0);
        tmp.q.setFromEuler(tmp.e);
        const toward = new THREE.Vector3(cam.x - u.home.p.x, 0, cam.z - u.home.p.z).setLength(0.03);
        node.position.lerp(tmp.v.copy(u.home.p).add(toward).setY(u.home.p.y + lift), damp(dt));
        node.quaternion.slerp(tmp.q, damp(dt, 6));
      } else {
        node.position.lerp(u.home.p, damp(dt));
        node.quaternion.slerp(u.home.q, damp(dt));
      }
      const goal = active ? lift : 0;
      if (Math.abs(node.position.y - u.home.p.y - goal) > 1e-4 || (!active && node.quaternion.angleTo(u.home.q) > 1e-4)) moving = true;
    }
    if (moving) invalidate();
  });
  return null;
}

// About page: the right-hand side of the notebook (front cover, page block, top page) rotates about
// the spine. Rotating about an axis raised by H keeps the closed book stacked instead of sinking
// through the desk. The pen hides while the book isn't open.
const NOTEBOOK_RIGHT = ["NOTE_Cover_Front", "NOTE_PageBlock_R", "NOTE_Page_R"];
function NotebookOpen({ scene, open }) {
  const parts = useMemo(() => NOTEBOOK_RIGHT.map((n) => scene.getObjectByName(n)).filter(Boolean), [scene]);
  const pen = useMemo(() => ["NOTE_Pen", "NOTE_Pen_Clip"].map((n) => scene.getObjectByName(n)).filter(Boolean), [scene]);
  const angle = useRef(Math.PI);                       // start closed -> animates open on arrival
  const H = 0.0135;
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [open, invalidate]);
  useFrame((_, dt) => {
    const target = open ? 0 : Math.PI;
    angle.current += (target - angle.current) * damp(dt, reducedMotion() ? 60 : 3.2);
    const t = angle.current;
    for (const p of parts) {
      p.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), t);
      p.position.set(H * Math.sin(t), H * (1 - Math.cos(t)), 0);
    }
    for (const p of pen) p.visible = t < 0.05;
    scene.userData.bookAngle = t;
    if (Math.abs(target - t) > 1e-4) invalidate();
    else angle.current = target;
  });
  return null;
}

// ---------------------------------------------------------------- lights (runtime part of the hybrid)
// The runtime rigs mirror the Cycles rigs in diorama/blender/parts/lights.py (positions converted from
// Blender Z-up to glTF Y-up: (x, y, z) -> (x, z, -y)), so the browser pool of light falls off to black
// at the edges of the platform just like the renders. Practical lights (screens, LEDs, lamp) are baked
// into the GLB's glow maps and must not be added here. Spot softness: Blender's spot_blend b fades over
// cos-space, so the full-intensity core is acos(cos(h) + b(1 - cos(h))); three's penumbra = 1 - core/h. ?k= ?fill= ?amb= ?rim= scale them while tuning.
const TUNE = Object.fromEntries(["k", "fill", "amb", "rim", "env"].map((k) => [k, parseFloat(new URLSearchParams(location.search).get(k)) || 1]));
const TUNE_SR = parseFloat(new URLSearchParams(location.search).get("sr")) || 7;   // soft (PCF) shadow radius, like the Cycles area-ish key
function rigFor(kind, box) {
  const c = box.getCenter(new THREE.Vector3());
  if (kind === "desk") {
    return {
      key: { pos: [0.25, 3.6, 1.1], target: [0.05, 0.55, -0.2], angle: 0.42, penumbra: 0.62, intensity: 58, color: "#ffe6c7" },
      fill: { pos: [-1.8, 2.2, 2.0], target: [0, 0.6, -0.2], intensity: 0.12, color: "#ffe1bf" },
      rims: [{ pos: [-1.7, 1.9, -1.9], target: [-0.2, 0.8, -0.4], intensity: 0.85, color: "#9e7bff" },
             { pos: [1.9, 1.5, -1.6], target: [0.5, 0.7, -0.4], intensity: 0.55, color: "#ffae63" }],
      ambient: 0.06,
    };
  }
  // reusable exhibit rig, scaled to the asset (crate, notebook, future game exhibits)
  const r = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 0.05);
  const at = (x, y, z, k) => [c.x + x * r * k, c.y + y * r * k, c.z + z * r * k];
  const d = Math.hypot(0.6, 2.2, 1.0) * r * 2.2;
  return {
    key: { pos: at(0.6, 2.2, 1.0, 2.2), target: c.toArray(), angle: 0.35, penumbra: 0.56, intensity: 1.75 * d * d, color: "#ffecd6" },
    fill: { pos: at(-1.4, 0.6, 0.8, 2.5), target: c.toArray(), intensity: 0.12, color: "#dcd2ff" },
    rims: [{ pos: at(-0.6, 1.0, -1.6, 2.5), target: c.toArray(), intensity: 0.8, color: "#9e7bff" }],
    ambient: 0.03,
  };
}

function Dir({ pos, target, intensity, color }) {
  const t = useMemo(() => { const o = new THREE.Object3D(); o.position.set(...target); return o; }, [target]);
  return (<><primitive object={t} /><directionalLight position={pos} target={t} intensity={intensity} color={color} /></>);
}

function Lights({ box, kind, under, shadows }) {
  const inspect = useRef();
  const camera = useThree((s) => s.camera);
  const rig = useMemo(() => rigFor(kind, box), [kind, box]);
  const keyTarget = useMemo(() => { const o = new THREE.Object3D(); o.position.set(...rig.key.target); return o; }, [rig]);
  useFrame(() => { if (inspect.current) inspect.current.position.copy(camera.position); });
  const k = rig.key;
  return (
    <>
      <primitive object={keyTarget} />
      <spotLight position={k.pos} target={keyTarget} angle={k.angle} penumbra={k.penumbra} decay={2}
                 intensity={k.intensity * TUNE.k} color={k.color} castShadow={shadows}
                 shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.01}
                 shadow-radius={TUNE_SR} />
      <Dir {...rig.fill} intensity={rig.fill.intensity * TUNE.fill} />
      {rig.rims.map((l, i) => <Dir key={i} {...l} intensity={l.intensity * TUNE.rim} />)}
      <hemisphereLight args={["#ffe9d6", "#1a1420", rig.ambient * TUNE.amb]} />
      {/* always mounted: adding a light later would recompile every shader (a visible hitch) */}
      <pointLight ref={inspect} intensity={under ? 2.2 : 0} distance={4} decay={1.5} color="#fff3e6" />
    </>
  );
}

function Reflections() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.08 * TUNE.env;            // reflections (also a little fill); background stays black
    return () => { env.dispose(); pmrem.dispose(); scene.environment = null; };
  }, [gl, scene]);
  return null;
}

// ---------------------------------------------------------------- camera collisions
// The camera slides along invisible keep-out boxes (platform, desktop, cabinet...). camera-controls'
// own raycast colliders snapped the camera to the first hit from the pivot: looking up from under the
// desk the hit was ~0 m away, so the camera teleported onto the pivot and spun ("flipping"). Here each
// frame the camera is clamped to the face of the box it ENTERED through (judged from where it was a
// frame earlier), so it can never jump to the other side or tunnel through a thin slab.
const AXES = ["x", "y", "z"];
function pushOut(p, from, boxes) {
  for (let iter = 0; iter < 3; iter++) {
    let hit = false;
    for (const b of boxes) {
      if (!b.containsPoint(p)) continue;
      hit = true;
      let axis = null, value = 0, bestT = -Infinity;
      for (const k of AXES) {                         // the face crossed last on the way from `from` to `p`
        const d = p[k] - from[k];
        if (from[k] <= b.min[k] && d > 0) { const t = (b.min[k] - from[k]) / d; if (t > bestT) { bestT = t; axis = k; value = b.min[k] - 1e-5; } }
        if (from[k] >= b.max[k] && d < 0) { const t = (b.max[k] - from[k]) / d; if (t > bestT) { bestT = t; axis = k; value = b.max[k] + 1e-5; } }
      }
      if (!axis) {                                    // started inside (e.g. first frame): nearest face
        let pen = Infinity;
        for (const k of AXES) {
          if (p[k] - b.min[k] < pen) { pen = p[k] - b.min[k]; axis = k; value = b.min[k] - 1e-5; }
          if (b.max[k] - p[k] < pen) { pen = b.max[k] - p[k]; axis = k; value = b.max[k] + 1e-5; }
        }
      }
      p[axis] = value;
    }
    if (!hit) return;
  }
}
const inAny = (p, boxes) => boxes.some((b) => b.containsPoint(p));
// keep theta continuous (camera-controls lets it wind past +-pi; a wrapped value would spin the camera)
function setSpherical(s, offset) {
  const theta = s.theta;
  s.setFromVector3(offset);
  s.theta += Math.round((theta - s.theta) / (2 * Math.PI)) * 2 * Math.PI;
}

function useKeepOut(ctl, boxes) {
  const tmp = useMemo(() => ({ pos: new THREE.Vector3(), prev: new THREE.Vector3(), end: new THREE.Vector3(),
                               off: new THREE.Vector3(), has: false }), []);
  useFrame(() => {                                    // runs after CameraControls.update (priority -1)
    const cc = ctl.current;
    if (!cc || !boxes.length) return;
    const { pos, prev, end, off } = tmp;
    pos.setFromSpherical(cc._spherical).add(cc._target);
    if (!tmp.has) { prev.copy(pos); tmp.has = true; }
    let moved = false;
    if (inAny(pos, boxes)) {
      pushOut(pos, prev, boxes);
      setSpherical(cc._spherical, off.copy(pos).sub(cc._target));
      moved = true;
    }
    prev.copy(pos);
    end.setFromSpherical(cc._sphericalEnd).add(cc._targetEnd);   // where the camera is heading
    if (inAny(end, boxes)) {
      pushOut(end, pos, boxes);
      setSpherical(cc._sphericalEnd, off.copy(end).sub(cc._targetEnd));
    }
    if (moved) cc.update(0);                          // re-place the camera for this frame
  }, 0);
}

// ---------------------------------------------------------------- camera rig
const SHIFT = parseFloat(new URLSearchParams(location.search).get("shift")) || 0.05;   // share of the view width
function Rig({ box, view, frame: FRAME, frameOrigin, homeScale = 0.86, onWheelHint, under, underView, selected, apiRef, colliders, focusLift = 0, focusScale = 2.1 }) {
  const ctl = useRef();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const home = useRef(null);
  const intro = useRef(false);
  useKeepOut(ctl, colliders);

  // default view: same direction as the Blender hero camera, distance fitted to the model
  const computeHome = () => {
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const fwd = view ? new THREE.Vector3(...view.forward).normalize() : new THREE.Vector3(-0.3, -0.45, -0.85).normalize();
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    // wide layouts (exhibit beside the text): a little closer, and shifted toward the text so there is
    // no empty band between the copy and the model. Phones/stacked layouts stay centred.
    const beside = size.width > 900 && size.width / size.height > 1.15;
    const d = (r / Math.sin(Math.min(vfov, hfov) / 2)) * (size.width < 600 ? 1.08 : beside ? homeScale : 0.86);
    const ox = beside ? 2 * d * Math.tan(hfov / 2) * SHIFT : 0;     // camera moves right -> model sits left of centre
    return { pos: c.clone().addScaledVector(fwd, -d), target: c, r, d, fwd, ox };
  };

  const goHome = (smooth) => {
    const h = home.current;
    if (!h || !ctl.current || FRAME?.position) return;   // comparison mode keeps the Blender camera
    ctl.current.setFocalOffset(h.ox, 0, 0, smooth);
    ctl.current.setLookAt(h.pos.x, h.pos.y, h.pos.z, h.target.x, h.target.y, h.target.z, smooth);
  };

  useEffect(() => {
    if (!box || !ctl.current) return;
    home.current = computeHome();
    const { r, d } = home.current;
    const cc = ctl.current;
    cc.minDistance = r * 0.12;
    cc.maxDistance = d * 1.6;
    cc.smoothTime = 0.35;
    cc.draggingSmoothTime = 0.12;
    cc.dollyToCursor = true;
    cc.setBoundary(box.clone().expandByScalar(r * 0.1));   // the pivot can't wander off into the void
    if (!FRAME?.position) goHome(false);
    if (!intro.current && !TEST && !FRAME && !reducedMotion()) {   // first load: ease in from a little farther
      const h = home.current, far = h.target.clone().lerp(h.pos, 1.22).add(new THREE.Vector3(0, h.d * 0.06, 0));
      cc.setLookAt(far.x, far.y, far.z, h.target.x, h.target.y, h.target.z, false);
      cc.smoothTime = 0.9;
      const done = () => { cc.smoothTime = 0.35; cc.removeEventListener("rest", done); cc.removeEventListener("controlstart", done); };
      cc.addEventListener("rest", done);
      cc.addEventListener("controlstart", done);
      requestAnimationFrame(() => goHome(true));
    }
    intro.current = true;
    if (FRAME && FRAME.position) {                    // ?frame=CAM_x: the exact Blender camera, for comparisons
      const p = new THREE.Vector3(...FRAME.position), f = new THREE.Vector3(...FRAME.forward);
      if (frameOrigin) p.add(box.getCenter(new THREE.Vector3()).sub(new THREE.Vector3(...frameOrigin)));   // re-rooted asset
      const t = p.clone().addScaledVector(f, p.distanceTo(box.getCenter(new THREE.Vector3())));
      const W = size.width, H = size.height;            // Blender shift is a fraction of the larger side
      camera.fov = FRAME.fov_deg;                       // views.json stores the vertical fov already
      camera.setViewOffset(W, H, FRAME.shift[0] * Math.max(W, H), -FRAME.shift[1] * Math.max(W, H), W, H);
      camera.updateProjectionMatrix();
      cc.maxDistance = Infinity;
      cc.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
      cc.enabled = false;
    }
  }, [box, size.width, size.height]);   // eslint-disable-line react-hooks/exhaustive-deps

  // polar limits: above the horizon normally; under-view orbits a pivot below the desktop and may go
  // down to the floor (the keep-out boxes stop it entering the platform), or below the platform
  const wasUnder = useRef(false);
  useEffect(() => {
    const cc = ctl.current;
    if (!cc) return;
    cc.minPolarAngle = THREE.MathUtils.degToRad(under ? 40 : 8);
    cc.maxPolarAngle = THREE.MathUtils.degToRad(under ? 165 : 84);
    const smooth = !reducedMotion();
    if (under && home.current) {
      const t = new THREE.Vector3(...(underView?.target || box.getCenter(new THREE.Vector3()).toArray()));
      const h = home.current.fwd;
      const flat = new THREE.Vector3(-h.x, 0, -h.z).normalize();           // home azimuth, seen from the front
      const dist = underView?.distance || home.current.r;
      const elev = THREE.MathUtils.degToRad(underView?.elevation ?? -10);   // negative: camera below the pivot
      const p = t.clone().addScaledVector(flat, dist * Math.cos(elev)).add(new THREE.Vector3(0, dist * Math.sin(elev), 0));
      cc.setFocalOffset(0, 0, 0, smooth);
      cc.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, smooth);
    } else if (!under && wasUnder.current) {
      goHome(smooth);
    }
    wasUnder.current = under;
  }, [under]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {                                   // focus the selected object, or go home
    const cc = ctl.current;
    if (!cc || !home.current) return;
    const smooth = !reducedMotion();
    if (selected) {
      const sphere = new THREE.Box3().setFromObject(selected).getBoundingSphere(new THREE.Sphere());
      sphere.center.y += focusLift;                     // frame where the object is going (lifted case)
      const r = Math.max(sphere.radius, focusLift ? 0.06 : 0.1);
      sphere.radius = r * focusScale;                   // keep some context around the object
      cc.fitToSphere(sphere, smooth);
      // shift the framing so the object sits upper-right, clear of the info panel (bottom-left)
      const wide = size.width > 900;
      cc.setFocalOffset(wide ? -r * 0.9 : 0, r * (wide ? 0.55 : 0.9), 0, smooth);
    } else if (!under) {
      goHome(smooth);
    }
  }, [selected]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    apiRef.current = {
      rotate: (az, pol) => ctl.current?.rotate(az, pol, true),
      dolly: (d) => ctl.current?.dolly(d, true),
      reset: () => goHome(!reducedMotion()),
      target: () => ctl.current?.getTarget(new THREE.Vector3(), false).toArray(),
    };
  }, [apiRef]);   // eslint-disable-line react-hooks/exhaustive-deps
  // The mouse wheel scrolls the PAGE; zoom needs Ctrl/⌘ + wheel (a trackpad pinch sends ctrlKey too),
  // the + / − buttons or the keyboard. On touch screens one finger swiping up/down scrolls the page,
  // sideways rotates; two fingers pinch-zoom.
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    const el = gl.domElement, cc = ctl.current;
    if (!cc) return;
    cc.mouseButtons.wheel = CC.ACTION.NONE;
    el.style.touchAction = "pan-y";
    const wheel = (e) => {
      const zoom = e.ctrlKey || e.metaKey;
      cc.mouseButtons.wheel = zoom ? CC.ACTION.DOLLY : CC.ACTION.NONE;   // camera-controls' own listener runs next
      if (!zoom) onWheelHint?.();
    };
    el.addEventListener("wheel", wheel, { capture: true, passive: true });
    const keepPanY = new MutationObserver(() => { if (el.style.touchAction !== "pan-y") el.style.touchAction = "pan-y"; });
    keepPanY.observe(el, { attributes: true, attributeFilter: ["style"] });
    return () => { el.removeEventListener("wheel", wheel, { capture: true }); keepPanY.disconnect(); };
  }, [gl, onWheelHint]);
  return <CameraControls ref={ctl} makeDefault />;
}

// ---------------------------------------------------------------- page-level scene
function Content({ config, selectedId, onSelect, under, apiRef, quality, animState, onReady, onWheelHint }) {
  const [state, setState] = useState(null);           // { scene, index, box }
  const [views, setViews] = useState(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => { fetch(`${BASE}models/views.json`).then((r) => r.json()).then(setViews).catch(() => setViews({})); }, []);

  const onLoaded = useMemo(() => (scene, index) => {
    const box = new THREE.Box3().setFromObject(scene);
    setState({ scene, index, box });
  }, []);

  // invisible keep-out volumes for the camera (expanded by a small margin so the near plane never clips)
  const colliders = useMemo(() => {
    if (!state) return [];
    const { min, max } = state.box;
    const list = config.colliders || [[[-50, min.y - 5, -50], [50, min.y, 50]]];   // default: the floor under the exhibit
    return list.map(([a, b]) => new THREE.Box3(new THREE.Vector3(...a), new THREE.Vector3(...b)).expandByScalar(0.04));
  }, [state, config.colliders]);

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {                                     // tiny API for automated browser tests
    window.__exhibit = {
      ready: !!state, selected: selectedId, invalidate,
      select: (id) => onSelect(id),
      camera: () => ({ p: camera.position.toArray(), q: camera.quaternion.toArray(), t: apiRef.current?.target?.() }),
      nodeWorld: (name) => {
        const o = state?.scene.getObjectByName(name);
        if (!o) return null;
        const p = o.getWorldPosition(new THREE.Vector3());
        return { x: p.x, y: p.y, z: p.z, bookAngle: state.scene.userData.bookAngle };
      },
      project: (name) => {
        const o = state?.scene.getObjectByName(name);
        if (!o) return null;
        const p = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);
        return { x: (p.x + 1) / 2 * size.width, y: (1 - p.y) / 2 * size.height };
      },
    };
  }, [state, selectedId, onSelect, camera, size, apiRef]);

  useEffect(() => {                                     // fade the canvas in once the first full frame exists
    if (!state || !views) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => onReady?.()));
    return () => cancelAnimationFrame(id);
  }, [state, views, onReady]);

  const selected = state && selectedId ? state.index[selectedId] : null;
  const view = typeof config.view === "string" ? views?.cameras?.[config.view] : config.view;
  const lifting = config.animation === "lift-turn";
  return (
    <>
      <Model url={`${BASE}${config.model}`} scope={config.scope} targets={config.targets} selectGlow={config.selectGlow !== false} noGlow={config.noGlow}
             selectedId={selectedId}
             onSelect={onSelect} onLoaded={onLoaded} />
      {state && views && (
        <>
          <Lights box={state.box} kind={config.lights || "exhibit"} under={under} shadows={quality.shadows} />
          <Rig box={state.box} view={view} frame={FRAME_ID && views?.cameras?.[FRAME_ID]} frameOrigin={config.frameOrigin} homeScale={config.homeScale} onWheelHint={onWheelHint} under={under} underView={config.underView} selected={selected} apiRef={apiRef} colliders={colliders}
               focusLift={lifting ? 0.07 : 0} focusScale={config.focusScale} />
          {lifting && <LiftTurn index={state.index} selectedId={selectedId} />}
          {config.animation === "notebook" && <NotebookOpen scene={state.scene} open={animState?.open ?? true} />}
          {config.play === "gold" && <Suspense fallback={null}><GoldPlay scene={state.scene} onSelect={onSelect} /></Suspense>}
          {config.play === "dice" && <Suspense fallback={null}><DicePlay scene={state.scene} /></Suspense>}
          {config.play === "speck" && <Suspense fallback={null}><SpeckPlay scene={state.scene} selectedId={selectedId} /></Suspense>}
          {config.contactShadow && (() => {
            const c = state.box.getCenter(new THREE.Vector3()), sz = state.box.getSize(new THREE.Vector3());
            return <ContactShadows position={[c.x, state.box.min.y + 0.0005, c.z]} scale={Math.max(sz.x, sz.z) * 2.2}
                                   far={sz.y * 1.5 + 0.05} blur={2.6} opacity={0.6} resolution={512} color="#000000" />;
          })()}
        </>
      )}
    </>
  );
}

function Loading() {
  const { active, progress } = useProgress();
  if (!active && progress >= 100) return null;
  return (
    <div className="loading" role="status">
      <div>Loading exhibit<div className="bar"><i style={{ transform: `scaleX(${progress / 100})` }} /></div></div>
    </div>
  );
}

// Adaptive quality. Rendering is on demand (nothing is drawn while the view is still), so only frames
// that follow each other closely count as "busy" frames. If those average under ~40 fps, step down:
// first fewer pixels, then no shadows/bloom. Never steps back up during a visit (avoids oscillation).
function Adaptive({ onStep }) {
  const acc = useRef({ n: 0, sum: 0, cool: 0 });
  useFrame((_, dt) => {
    const a = acc.current;
    if (dt > 0.2) return;                                 // first frame after an idle gap
    if (a.cool > 0) { a.cool--; return; }
    a.n++; a.sum += dt;
    if (a.n >= 90) {
      if (a.sum / a.n > 1 / 40) { onStep(); a.cool = 120; }
      a.n = 0; a.sum = 0;
    }
  });
  return null;
}

// ?fps: small overlay with the frame rate while moving, draw calls, triangles and pixel ratio
const SHOW_FPS = new URLSearchParams(location.search).has("fps");
function Stats({ el, level }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ t: performance.now(), n: 0, fps: 0 });
  useFrame(() => {
    const a = acc.current, now = performance.now();
    a.n++;
    if (now - a.t > 500) { a.fps = Math.round(a.n * 1000 / (now - a.t)); a.n = 0; a.t = now; }
    if (el.current) {
      const i = gl.info.render;
      el.current.textContent = `${a.fps} fps (while moving) · ${i.calls} draws · ${Math.round(i.triangles / 1000)}k tris · ` +
        `dpr ${gl.getPixelRatio().toFixed(2)} · quality ${["high", "medium", "low"][level]}`;
    }
  });
  return null;
}

const GQ = new URLSearchParams(location.search);
const GRADE = { c: parseFloat(GQ.get("con") ?? 0), s: parseFloat(GQ.get("sat") ?? 0.14), b: parseFloat(GQ.get("bri") ?? 0) };

// ?frame=CAM_x (test only): full-window canvas through the exact Blender camera, for comparison sheets
const FRAME_ID = new URLSearchParams(location.search).get("frame");
if (FRAME_ID) document.documentElement.classList.add("frame-only");

// ?test: render on demand + readable canvas, for automated (software-GL) browser tests
const TEST = new URLSearchParams(location.search).has("test");

export default function Scene({ config, selectedId, onSelect, under, apiRef, safe = false, onContextLost, animState, onWheelHint }) {
  // R3F deliberately drops the GL context when the canvas unmounts (leaving the page): that is not a
  // crash. The flag is set in a layout-effect cleanup, which runs before the canvas tears down.
  const leaving = useRef(false);
  useLayoutEffect(() => () => { leaving.current = true; }, []);
  // quality levels: 0 high, 1 fewer pixels, 2 no shadows/bloom. Safe mode (after a lost GPU context,
  // or ?quality=low) also drops post-processing.
  const maxDpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const [level, setLevel] = useState(0);
  const quality = safe
    ? { dpr: 1, shadows: false, bloom: false, post: false }
    : TEST ? { dpr: 1, shadows: true, bloom: true, post: true }
    : [{ dpr: maxDpr, shadows: true, bloom: true, post: true },
       { dpr: Math.min(maxDpr, 1.25), shadows: true, bloom: true, post: true },
       { dpr: 1, shadows: false, bloom: false, post: true }][level];
  const [ready, setReady] = useState(false);
  const onReady = useMemo(() => () => setReady(true), []);
  const stats = useRef(null);
  return (
    <>
      <Canvas flat={quality.post} shadows={quality.shadows ? "percentage" : false} dpr={quality.dpr}
              camera={{ fov: 30, near: 0.01, far: 100 }} frameloop="demand"
              style={{ opacity: ready || TEST ? 1 : 0, transition: "opacity .9s ease" }}
              gl={{ antialias: true, powerPreference: "high-performance", preserveDrawingBuffer: TEST }}
              onCreated={({ gl }) => {
                if (!quality.post) { gl.toneMapping = THREE.AgXToneMapping; gl.toneMappingExposure = 0.92; }
                gl.domElement.addEventListener("webglcontextlost", (e) => {
                  if (leaving.current) return;
                  e.preventDefault();
                  console.error("WebGL context lost - showing the image fallback");
                  onContextLost?.();
                }, { once: true });
              }}>
        {/* background is tone-mapped only through the post-processing chain, hence the compensated value */}
        <color attach="background" args={[quality.post ? BG : "#080808"]} />
        {!TEST && !safe && level < 2 && <Adaptive onStep={() => setLevel((l) => Math.min(l + 1, 2))} />}
        {SHOW_FPS && <Stats el={stats} level={level} />}
        <Reflections />
        <Suspense fallback={null}>
          <Content config={config} selectedId={selectedId} onSelect={onSelect} under={under} apiRef={apiRef} quality={quality}
                   animState={animState} onReady={onReady} onWheelHint={onWheelHint} />
        </Suspense>
        {quality.post && (
          <EffectComposer multisampling={4}>
            {/* subtle: only the LEDs, lamp filament and screens should glow */}
            <Bloom mipmapBlur intensity={quality.bloom ? 0.32 : 0} luminanceThreshold={0.92} luminanceSmoothing={0.08} />
            <ToneMapping mode={ToneMappingMode.AGX} />
            {/* closer to the saturation of the Cycles "Medium High Contrast" look. Neutral greys (the
                background) are untouched; contrast stays 0 because it would crush #080808 to black */}
            {(GRADE.c !== 0 || GRADE.b !== 0) && <BrightnessContrast brightness={GRADE.b} contrast={GRADE.c} />}
            <HueSaturation saturation={GRADE.s} />
          </EffectComposer>
        )}
      </Canvas>
      <Loading />
      {SHOW_FPS && <div ref={stats} className="fps" aria-hidden="true" />}
    </>
  );
}
