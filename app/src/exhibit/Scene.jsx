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
const DoqiPlay = lazy(() => import("./DoqiPlay.jsx"));
const WrfmPlay = lazy(() => import("./WrfmPlay.jsx"));
const MazePlay = lazy(() => import("./MazePlay.jsx"));
const DollsPlay = lazy(() => import("./DollsPlay.jsx"));
const JuiceboxPlay = lazy(() => import("./JuiceboxPlay.jsx"));
const GraffitiPlay = lazy(() => import("./GraffitiPlay.jsx"));
const RadarPlay = lazy(() => import("./RadarPlay.jsx"));
const HIGHLIGHT = new THREE.Color(0.09, 0.008, 0.012);     // subtle deep-red hover / selection glow
// Canvas clear colour chosen so that AFTER AgX tone mapping it lands exactly on the page's #080808
// (measured in the browser; AgX darkens near-black). Override with ?bg=xxxxxx while tuning.
const BG = "#" + (new URLSearchParams(location.search).get("bg") || "111111");
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
// Phones load the lighter "_m" model (smaller textures, ~half the download; diorama/tools/optimize.mjs --mobile):
// touch screens up to small-tablet size, or devices reporting 4 GB of memory or less. ?model=m / ?model=full overrides.
const MODEL_PICK = new URLSearchParams(location.search).get("model");
const PHONE_MODELS = MODEL_PICK ? MODEL_PICK === "m"
  : (window.matchMedia("(pointer: coarse)").matches && Math.min(screen.width, screen.height) <= 820) || (navigator.deviceMemory || 8) <= 4;
const modelUrl = (m) => (PHONE_MODELS ? m.replace(/\.glb$/, "_m.glb") : m);

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

// Games page: the selected case lifts straight up out of the crate first, and only once it is clear of the
// cases in front does it come forward and turn its label toward the camera (on the way back: turn back,
// then sink straight down), so it never passes through its neighbours. Every other case eases back to the
// exact transform it had in the GLB.
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function LiftTurn({ index, selectedId, lift = 0.13 }) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => invalidate(), [selectedId, invalidate]);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, "YXZ") }), []);
  useFrame((_, dt) => {
    let moving = false;
    const step = Math.min(dt, 0.05) * (reducedMotion() ? 99 : 1.9);   // progress per frame (0..1 over ~0.5 s)
    for (const node of Object.values(index)) {
      const u = node.userData;
      if (!u.home) u.home = { p: node.position.clone(), q: node.quaternion.clone() };
      const target = node.userData.interactive_id === selectedId ? 1 : 0;
      u.t = u.t ?? 0;
      if (u.t !== target) { u.t = target > u.t ? Math.min(1, u.t + step) : Math.max(0, u.t - step); moving = true; }
      const up = smoothstep(0, 0.55, u.t), turn = smoothstep(0.55, 1, u.t);   // rise first, then forward + turn
      const cam = node.parent.worldToLocal(tmp.v.copy(camera.position));
      const yaw = Math.atan2(cam.x - u.home.p.x, cam.z - u.home.p.z);
      const toward = new THREE.Vector3(cam.x - u.home.p.x, 0, cam.z - u.home.p.z).setLength(0.035 * turn);
      node.position.copy(u.home.p).add(toward).setY(u.home.p.y + lift * up);
      tmp.e.set(-0.16, yaw, 0);
      tmp.q.setFromEuler(tmp.e);
      node.quaternion.copy(u.home.q).slerp(tmp.q, turn);
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
function Rig({ box, model, fit, intro: introMove, view, frame: FRAME, frameOrigin, homeScale = 0.86, onWheelHint, under, underView, selected, apiRef, colliders, focusLift = 0, focusScale = 2.1, smartFocus = false, focusViews = null }) {
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
    if (fit && points.length) return { ...fitView(c, fwd), target: c, r, fwd };
    const d = (r / Math.sin(Math.min(vfov, hfov) / 2)) * (size.width < 600 ? 1.08 : beside ? homeScale : 0.86);
    const ox = beside ? 2 * d * Math.tan(hfov / 2) * SHIFT : 0;     // camera moves right -> model sits left of centre
    return { pos: c.clone().addScaledVector(fwd, -d), target: c, r, d, fwd, ox, oy: 0 };
  };

  // fitted framing (config.fit): the whole model, as it is actually drawn (its vertices, not its bounding
  // sphere), fits inside the free area of the view: below the hint line, above the tool buttons and
  // clear of the sides, with some breathing room. Then it is centred in that area.
  const gl = useThree((s) => s.gl);
  const points = useMemo(() => {
    if (!fit || !model) return [];
    model.updateMatrixWorld(true);
    const out = [], v = new THREE.Vector3();
    let total = 0;
    model.traverse((o) => { if (o.isMesh && o.visible && o.geometry?.attributes.position) total += o.geometry.attributes.position.count; });
    const step = Math.max(1, Math.ceil(total / 12000));
    model.traverse((o) => {
      if (!o.isMesh || !o.visible || !o.geometry?.attributes.position) return;
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i += step) out.push(v.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld).clone());
    });
    return out;
  }, [fit, model]);
  const fitView = (c, fwd) => {
    const W = size.width, H = size.height;
    const wrap = gl.domElement.closest(".exhibit");
    const px = (sel) => wrap?.querySelector(sel)?.getBoundingClientRect();
    const top0 = wrap?.getBoundingClientRect().top ?? 0;
    const hint = px(".hint"), tools = px(".exhibit-tools");
    const padTop = Math.max(fit.top ?? 24, hint ? hint.bottom - top0 + 14 : 0);
    const padBottom = Math.max(fit.bottom ?? 24, tools ? H - (tools.top - top0) + 14 : 0);
    const padSide = Math.max(16, W * (fit.side ?? 0.04));
    const nl = -1 + 2 * padSide / W, nr = 1 - 2 * padSide / W, nb = -1 + 2 * padBottom / H, nt = 1 - 2 * padTop / H;
    const fill = fit.fill ?? 0.9;                         // share of the free area the model may use
    const cam = new THREE.PerspectiveCamera(camera.fov, W / H, camera.near, camera.far);
    const right = new THREE.Vector3(), up = new THREE.Vector3(), q = new THREE.Vector3();
    const extents = (d, ox = 0, oy = 0) => {
      cam.position.copy(c).addScaledVector(fwd, -d);
      cam.lookAt(c); cam.updateMatrixWorld();
      right.setFromMatrixColumn(cam.matrixWorld, 0); up.setFromMatrixColumn(cam.matrixWorld, 1);
      cam.position.addScaledVector(right, ox).addScaledVector(up, oy); cam.updateMatrixWorld();
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      for (const p of points) { q.copy(p).project(cam); if (q.z > 1) continue; x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      return { x0, x1, y0, y1 };
    };
    let lo = 0.05, hi = 60;                                // distance search: the closest view that still fits
    for (let i = 0; i < 40; i++) {
      const d = (lo + hi) / 2, e = extents(d);
      if (e.x1 - e.x0 <= (nr - nl) * fill && e.y1 - e.y0 <= (nt - nb) * fill) hi = d; else lo = d;
    }
    const d = hi;
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), tanH = tanV * (W / H);
    let ox = 0, oy = 0;
    for (let k = 0; k < 3; k++) {                          // centre it (focal offset: camera slides sideways)
      const e = extents(d, ox, oy);
      ox += ((e.x0 + e.x1) / 2 - (nl + nr) / 2) * d * tanH;
      oy += ((e.y0 + e.y1) / 2 - (nb + nt) / 2) * d * tanV;
    }
    return { pos: c.clone().addScaledVector(fwd, -d), d, ox, oy };
  };

  const goHome = (smooth) => {
    const h = home.current;
    if (!h || !ctl.current || FRAME?.position) return;   // comparison mode keeps the Blender camera
    ctl.current.setFocalOffset(h.ox, -(h.oy || 0), 0, smooth);
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
      const h = home.current;
      let far;
      if (introMove) {                                 // swing in: start further round, higher and farther out
        const off = h.pos.clone().sub(h.target);
        const sph = new THREE.Spherical().setFromVector3(off);
        sph.theta += THREE.MathUtils.degToRad(introMove.azimuth ?? 0);
        sph.phi = Math.max(0.15, sph.phi - THREE.MathUtils.degToRad(introMove.elevation ?? 0));
        sph.radius *= introMove.distance ?? 1.2;
        far = h.target.clone().add(new THREE.Vector3().setFromSpherical(sph));
      } else far = h.target.clone().lerp(h.pos, 1.22).add(new THREE.Vector3(0, h.d * 0.06, 0));
      cc.setFocalOffset(h.ox, -(h.oy || 0), 0, false);
      cc.setLookAt(far.x, far.y, far.z, h.target.x, h.target.y, h.target.z, false);
      cc.smoothTime = introMove?.time ?? 0.9;
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

  // smartFocus: choose the angle to look at the selected object from. Candidate directions around the hero
  // angle are scored by how much of the object is hidden behind other parts of the scene (rays from points
  // on the object to the camera), whether the camera would sit inside a keep-out box or under the floor, and
  // how far they turn away from the hero angle. The clearest, most natural view wins.
  const bestView = (obj, sphere, back = 1) => {
    const c = sphere.center, ray = new THREE.Raycaster();
    const dist = ctl.current.getDistanceToFitSphere(sphere.radius) * back;
    const own = new Set(); obj.traverse((o) => own.add(o));
    const meshes = []; model.traverse((o) => { if (o.isMesh && o.visible && !own.has(o)) meshes.push(o); });
    const ob = new THREE.Box3().setFromObject(obj), os = ob.getSize(new THREE.Vector3()).multiplyScalar(0.3);
    const pts = [c.clone(), ...[[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, b]) => c.clone().add(new THREE.Vector3(a * os.x, os.y, b * os.z)))];
    const homeDir = home.current.fwd.clone().negate();                // object -> camera, as in the hero view
    const az0 = Math.atan2(homeDir.x, homeDir.z);
    let best = null;
    for (const dAz of [0, -20, 20, -40, 40, -60, 60, -85, 85]) for (const el of [22, 34, 48, 62]) {
      const az = az0 + THREE.MathUtils.degToRad(dAz), e = THREE.MathUtils.degToRad(el);
      const dir = new THREE.Vector3(Math.sin(az) * Math.cos(e), Math.sin(e), Math.cos(az) * Math.cos(e));
      const cam = c.clone().addScaledVector(dir, dist);
      if (cam.y < box.min.y + 0.05 || colliders.some((b) => b.containsPoint(cam))) continue;
      let hidden = 0;
      for (const p of pts) {
        const to = cam.clone().sub(p), len = to.length();
        ray.set(p, to.normalize()); ray.far = len; ray.near = 0.002;
        if (ray.intersectObjects(meshes, false).length) hidden++;
      }
      const score = (hidden / pts.length) * 10 + Math.abs(dAz) / 90 + Math.abs(el - 34) / 70;
      if (!best || score < best.score) best = { score, cam, dist };
    }
    return best || { cam: c.clone().addScaledVector(homeDir, dist), dist };
  };

  useEffect(() => {                                   // focus the selected object, or go home
    const cc = ctl.current;
    if (!cc || !home.current) return;
    const smooth = !reducedMotion();
    if (selected) {
      const sphere = new THREE.Box3().setFromObject(selected).getBoundingSphere(new THREE.Sphere());
      sphere.center.y += focusLift;                     // frame where the object is going (lifted case)
      const r = Math.max(sphere.radius, focusLift ? 0.06 : 0.1);
      sphere.radius = r * focusScale;                   // keep some context around the object
      if (smartFocus && model) {
        // place the object in the clear part of the view: right of the info panel on wide screens (the panel
        // is ~400 px wide, bottom-left), above it on phones (full-width panel at the bottom); and back off a
        // little so it fits that smaller area with some context
        const W = size.width, H = size.height, wideP = W > 700;
        const freeL = wideP ? Math.min(W * 0.55, 420) : 0;
        const tx = wideP ? ((freeL + W) / 2) / W * 2 - 1 : 0;            // NDC x of the free area's centre
        const ty = wideP ? 0.12 : 0.42;                                     // NDC y (up is +)
        const frac = wideP ? (W - freeL) / W : 0.55;
        const back = THREE.MathUtils.clamp(0.65 / frac, 1, 1.5);
        // the clearest angle onto each item is worked out ahead of time (scripts/focus-views.mjs ->
        // data/focus_views.json) so a click never stalls the page; without one, look from the hero angle
        const dist = cc.getDistanceToFitSphere(sphere.radius) * back;
        const dir = focusViews?.[selected.userData.interactive_id];
        const toCam = dir ? new THREE.Vector3(...dir).normalize() : home.current.fwd.clone().negate();
        const best = { cam: sphere.center.clone().addScaledVector(toCam, dist), dist };
        const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), tanH = tanV * (W / H);
        cc.setLookAt(best.cam.x, best.cam.y, best.cam.z, sphere.center.x, sphere.center.y, sphere.center.z, smooth);
        cc.setFocalOffset(-tx * best.dist * tanH, ty * best.dist * tanV, 0, smooth);
        return;
      }
      cc.fitToSphere(sphere, smooth);
      // shift the framing so the object sits upper-right, clear of the info panel (bottom-left)
      const wide = size.width > 900;
      cc.setFocalOffset(wide ? -r * 0.9 : 0, r * (wide ? (focusLift ? 0.2 : 0.55) : (focusLift ? 0.6 : 0.9)), 0, smooth);   // a lifted case is already high: shift it less
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
      // offline only (scripts/focus-views.mjs): the clearest viewing direction (object -> camera) for each item
      computeFocusViews: (index) => {
        const out = {};
        for (const [id, obj] of Object.entries(index)) {
          const sphere = new THREE.Box3().setFromObject(obj).getBoundingSphere(new THREE.Sphere());
          sphere.radius = Math.max(sphere.radius, 0.1) * focusScale;
          const b = bestView(obj, sphere, 1.4);
          out[id] = b.cam.clone().sub(sphere.center).normalize().toArray().map((v) => +v.toFixed(4));
        }
        return out;
      },
    };
  }, [apiRef]);   // eslint-disable-line react-hooks/exhaustive-deps
  // The mouse wheel scrolls the PAGE; zoom needs Ctrl/⌘ + wheel (a trackpad pinch sends ctrlKey too),
  // the + / − buttons or the keyboard. On touch screens one finger swiping up/down scrolls the page,
  // sideways rotates; two fingers pinch-zoom.
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
  const [focusViews, setFocusViews] = useState(null);
  useEffect(() => {
    if (!config.smartFocus) return;
    fetch(`${BASE}data/focus_views.json`).then((r) => r.json())
      .then((all) => setFocusViews(all[config.model.split("/").pop().replace(/\.glb$/, "")] || null)).catch(() => {});
  }, [config.smartFocus, config.model]);

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
      // the selected object's on-screen box (canvas pixels) - tests check it is in view and clear of the panel
      computeFocusViews: () => (state ? apiRef.current?.computeFocusViews?.(state.index) : null),
      selectedRect: () => {
        const o = state && selectedId ? state.index[selectedId] : null;
        if (!o) return null;
        const b = new THREE.Box3().setFromObject(o), v = new THREE.Vector3();
        let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          v.set(x, y, z).project(camera);
          const px = (v.x + 1) / 2 * size.width, py = (1 - v.y) / 2 * size.height;
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py);
        }
        return { x0, x1, y0, y1, w: size.width, h: size.height };
      },
      box: (name) => {                                // a node's world-space box (tests: cartridges must not overlap)
        const o = state?.scene.getObjectByName(name);
        if (!o) return null;
        const b = new THREE.Box3().setFromObject(o);
        return [...b.min.toArray(), ...b.max.toArray()];
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
      <Model url={`${BASE}${modelUrl(config.model)}`} scope={config.scope} targets={config.targets} selectGlow={config.selectGlow !== false} noGlow={config.noGlow}
             selectedId={selectedId}
             onSelect={onSelect} onLoaded={onLoaded} />
      {state && views && (
        <>
          <Lights box={state.box} kind={config.lights || "exhibit"} under={under} shadows={quality.shadows} />
          <Rig box={state.box} model={state.scene} fit={config.fit} intro={config.intro} view={view} frame={FRAME_ID && views?.cameras?.[FRAME_ID]} frameOrigin={config.frameOrigin} homeScale={config.homeScale} onWheelHint={onWheelHint} under={under} underView={config.underView} selected={selected} apiRef={apiRef} colliders={colliders}
               focusLift={lifting ? 0.13 : 0} focusScale={config.focusScale} smartFocus={config.smartFocus} focusViews={focusViews} />
          {lifting && <LiftTurn index={state.index} selectedId={selectedId} />}
          {config.animation === "notebook" && <NotebookOpen scene={state.scene} open={animState?.open ?? true} />}
          {config.play === "gold" && <Suspense fallback={null}><GoldPlay scene={state.scene} onSelect={onSelect} /></Suspense>}
          {config.play === "dice" && <Suspense fallback={null}><DicePlay scene={state.scene} /></Suspense>}
          {config.play === "speck" && <Suspense fallback={null}><SpeckPlay scene={state.scene} selectedId={selectedId} /></Suspense>}
          {config.play === "doqi" && <Suspense fallback={null}><DoqiPlay scene={state.scene} selectedId={selectedId} lines={config.jeffLines} /></Suspense>}
          {config.play === "wrfm" && <Suspense fallback={null}><WrfmPlay scene={state.scene} /></Suspense>}
          {config.play === "maze" && <Suspense fallback={null}><MazePlay scene={state.scene} /></Suspense>}
          {config.play === "dolls" && <Suspense fallback={null}><DollsPlay scene={state.scene} /></Suspense>}
          {config.play === "juicebox" && <Suspense fallback={null}><JuiceboxPlay scene={state.scene} /></Suspense>}
          {config.play === "graffiti" && <Suspense fallback={null}><GraffitiPlay scene={state.scene} /></Suspense>}
          {config.play === "radar" && <Suspense fallback={null}><RadarPlay scene={state.scene} /></Suspense>}
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
                // leaving the page: R3F releases the GPU context with forceContextLoss() while React swaps
                // the page, and some drivers take a long time over it - so release it just after the new
                // page is on screen instead of holding the navigation up
                const lose = gl.forceContextLoss.bind(gl);
                gl.forceContextLoss = () => { setTimeout(lose, 1200); };
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
