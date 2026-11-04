// Heavy part of the shared exhibit viewer (lazy chunk): R3F canvas, GLB loading (KTX2 + meshopt),
// runtime lighting for the hybrid-baked assets, camera rig, hover/select, subtle bloom.
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls, ContactShadows, PerformanceMonitor, useGLTF, useProgress } from "@react-three/drei";
import { EffectComposer, Bloom, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const BASE = import.meta.env.BASE_URL;
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
function Model({ url, scope, targets, selectGlow = true, selectedId, onSelect, onLoaded }) {
  const gl = useThree((s) => s.gl);
  const { scene } = useGLTF(url, false, true, (loader) => loader.setKTX2Loader(ktx2For(gl)));
  const [hovered, setHovered] = useState(null);

  const index = useMemo(() => {
    const byId = {};
    scene.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true;
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
  }, [scene, scope, targets]);

  useLayoutEffect(() => { onLoaded(scene, index); }, [scene, index, onLoaded]);
  useEffect(() => {
    if (!selectGlow) return;
    setGlow(index[selectedId], true);
    return () => setGlow(index[selectedId], false);
  }, [selectedId, index, selectGlow]);
  useEffect(() => {
    if (!hovered || hovered === index[selectedId]) return;
    setGlow(hovered, true);
    return () => setGlow(hovered, false);
  }, [hovered, selectedId, index]);

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
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, "YXZ") }), []);
  useFrame((_, dt) => {
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
    }
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
  });
  return null;
}

// ---------------------------------------------------------------- lights (runtime part of the hybrid)
function Lights({ box, under, shadows }) {
  const inspect = useRef();
  const camera = useThree((s) => s.camera);
  const { c, s, target } = useMemo(() => {
    const c = box.getCenter(new THREE.Vector3());
    const t = new THREE.Object3D();
    t.position.copy(c);
    return { c, s: box.getSize(new THREE.Vector3()).length(), target: t };
  }, [box]);
  useFrame(() => { if (inspect.current) inspect.current.position.copy(camera.position); });
  return (
    <>
      {/* practical lights (screens, LEDs, lamp) are baked into the GLB's glow maps: don't add them here */}
      <primitive object={target} />
      <spotLight position={[c.x + 0.07 * s, c.y + 1.2 * s, c.z + 0.45 * s]} target={target} angle={0.52} penumbra={0.85}
                 decay={0} intensity={2.0} color="#ffe6c7" castShadow={shadows}
                 shadow-mapSize={[2048, 2048]} shadow-bias={-0.0002} shadow-normalBias={0.01} />
      <hemisphereLight args={["#ffe9d6", "#1a1420", 0.32]} />
      <directionalLight position={[c.x - s, c.y + 0.6 * s, c.z - s]} target={target} intensity={0.85} color="#9e7bff" />
      <directionalLight position={[c.x + s, c.y + 0.45 * s, c.z - 0.8 * s]} target={target} intensity={0.55} color="#ffae63" />
      {under && <pointLight ref={inspect} intensity={1.6} distance={1.6} decay={1.5} color="#fff3e6" />}
    </>
  );
}

function Reflections() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.16;                       // reflections only; background stays black
    return () => { env.dispose(); pmrem.dispose(); scene.environment = null; };
  }, [gl, scene]);
  return null;
}

// ---------------------------------------------------------------- camera rig
function Rig({ box, view, under, selected, apiRef, colliders, focusLift = 0, focusScale = 2.1 }) {
  const ctl = useRef();
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const home = useRef(null);

  // default view: same direction as the Blender hero camera, distance fitted to the model
  const computeHome = () => {
    const c = box.getCenter(new THREE.Vector3());
    const r = box.getSize(new THREE.Vector3()).length() / 2;
    const fwd = view ? new THREE.Vector3(...view.forward).normalize() : new THREE.Vector3(-0.3, -0.45, -0.85).normalize();
    const vfov = THREE.MathUtils.degToRad(camera.fov);
    const hfov = 2 * Math.atan(Math.tan(vfov / 2) * (size.width / size.height));
    const d = (r / Math.sin(Math.min(vfov, hfov) / 2)) * (size.width < 600 ? 1.08 : 0.86);   // more margin on phones
    return { pos: c.clone().addScaledVector(fwd, -d), target: c, r, d };
  };

  useEffect(() => {
    if (!box || !ctl.current) return;
    home.current = computeHome();
    const { pos, target, r, d } = home.current;
    const cc = ctl.current;
    cc.minDistance = r * 0.12;
    cc.maxDistance = d * 1.6;
    cc.smoothTime = 0.35;
    cc.draggingSmoothTime = 0.12;
    cc.dollyToCursor = true;
    cc.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, false);
    cc.colliderMeshes = colliders;
  }, [box, size.width, size.height]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {                                   // polar limits: above the horizon unless under-view
    if (!ctl.current) return;
    ctl.current.minPolarAngle = THREE.MathUtils.degToRad(under ? 25 : 8);
    ctl.current.maxPolarAngle = THREE.MathUtils.degToRad(under ? 160 : 84);
  }, [under]);

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
    } else {
      const { pos, target } = home.current;
      cc.setFocalOffset(0, 0, 0, smooth);
      cc.setLookAt(pos.x, pos.y, pos.z, target.x, target.y, target.z, smooth);
    }
  }, [selected]);

  useEffect(() => {
    apiRef.current = {
      rotate: (az, pol) => ctl.current?.rotate(az, pol, true),
      dolly: (d) => ctl.current?.dolly(d, true),
      reset: () => {
        const h = home.current;
        if (!h) return;
        ctl.current?.setFocalOffset(0, 0, 0, !reducedMotion());
        ctl.current?.setLookAt(h.pos.x, h.pos.y, h.pos.z, h.target.x, h.target.y, h.target.z, !reducedMotion());
      },
    };
  }, [apiRef]);
  return <CameraControls ref={ctl} makeDefault />;
}

// ---------------------------------------------------------------- page-level scene
function Content({ config, selectedId, onSelect, under, apiRef, quality, animState }) {
  const [state, setState] = useState(null);           // { scene, index, box }
  const [views, setViews] = useState(null);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => { fetch(`${BASE}models/views.json`).then((r) => r.json()).then(setViews).catch(() => setViews({})); }, []);

  const onLoaded = useMemo(() => (scene, index) => {
    const box = new THREE.Box3().setFromObject(scene);
    setState({ scene, index, box });
  }, []);

  // invisible collision volumes keep the camera out of the platform and the desktop
  const colliders = useMemo(() => {
    if (!state) return [];
    const m = new THREE.MeshBasicMaterial({ visible: false });
    const mk = (min, max) => {
      const b = new THREE.Box3(new THREE.Vector3(...min), new THREE.Vector3(...max));
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...b.getSize(new THREE.Vector3()).toArray()), m);
      mesh.position.copy(b.getCenter(new THREE.Vector3()));
      mesh.updateMatrixWorld();
      return mesh;
    };
    const { min, max } = state.box;
    return (config.colliders || [[[min.x, min.y, min.z], [max.x, 0.0, max.z]]]).map(([a, b]) => mk(a, b));
  }, [state, config.colliders]);

  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {                                     // tiny API for automated browser tests
    window.__exhibit = {
      ready: !!state, selected: selectedId, invalidate,
      select: (id) => onSelect(id),
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
  }, [state, selectedId, onSelect, camera, size]);

  const selected = state && selectedId ? state.index[selectedId] : null;
  const view = typeof config.view === "string" ? views?.cameras?.[config.view] : config.view;
  const lifting = config.animation === "lift-turn";
  return (
    <>
      <Model url={`${BASE}${config.model}`} scope={config.scope} targets={config.targets} selectGlow={config.selectGlow !== false}
             selectedId={selectedId}
             onSelect={onSelect} onLoaded={onLoaded} />
      {state && views && (
        <>
          <Lights box={state.box} under={under} shadows={quality.shadows} />
          <Rig box={state.box} view={view} under={under} selected={selected} apiRef={apiRef} colliders={colliders}
               focusLift={lifting ? 0.07 : 0} focusScale={config.focusScale} />
          {lifting && <LiftTurn index={state.index} selectedId={selectedId} />}
          {config.animation === "notebook" && <NotebookOpen scene={state.scene} open={animState?.open ?? true} />}
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

// ?test: render on demand + readable canvas, for automated (software-GL) browser tests
const TEST = new URLSearchParams(location.search).has("test");

export default function Scene({ config, selectedId, onSelect, under, apiRef, safe = false, onContextLost, animState }) {
  // R3F deliberately drops the GL context when the canvas unmounts (leaving the page): that is not a
  // crash. The flag is set in a layout-effect cleanup, which runs before the canvas tears down.
  const leaving = useRef(false);
  useLayoutEffect(() => () => { leaving.current = true; }, []);
  // safe mode (after a lost GPU context, or ?quality=low): no post-processing, no shadows, 1x pixels
  const [quality, setQuality] = useState(safe
    ? { dpr: 1, shadows: false, bloom: false, post: false }
    : { dpr: TEST ? 1 : [1, 2], shadows: true, bloom: true, post: true });
  return (
    <>
      <Canvas flat={quality.post} shadows={quality.shadows ? "percentage" : false} dpr={quality.dpr}
              camera={{ fov: 30, near: 0.01, far: 100 }} frameloop={TEST ? "demand" : "always"}
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
        {!TEST && !safe && <PerformanceMonitor onDecline={() => setQuality((q) => ({ ...q, dpr: [1, 1.25], shadows: false, bloom: false }))} />}
        <Reflections />
        <Suspense fallback={null}>
          <Content config={config} selectedId={selectedId} onSelect={onSelect} under={under} apiRef={apiRef} quality={quality}
                   animState={animState} />
        </Suspense>
        {quality.post && (
          <EffectComposer multisampling={4}>
            {/* subtle: only the LEDs, lamp filament and screens should glow */}
            <Bloom mipmapBlur intensity={quality.bloom ? 0.32 : 0} luminanceThreshold={0.92} luminanceSmoothing={0.08} />
            <ToneMapping mode={ToneMappingMode.AGX} />
          </EffectComposer>
        )}
      </Canvas>
      <Loading />
    </>
  );
}
