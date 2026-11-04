// Phase 4 technical preview — NOT the website. Loads one exported GLB, recreates the runtime part of
// the hybrid lighting, and exposes a small API (window.viewer) used by the screenshot script.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
if (params.has("shot")) document.body.classList.add("shot");

// ---------------------------------------------------------------- renderer / scene
const canvas = $("c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.info.autoReset = false;      // count every pass of the composer, reset once per frame

const scene = new THREE.Scene();
scene.background = new THREE.Color("#080808");
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;   // reflections only
scene.environmentIntensity = 0.18;

const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.08;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.38, 0.55, 0.96);   // strength, radius, threshold
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- runtime lights (not baked)
// Mirrors the Phase 3 key / fill / rims. Practical lights (screens, LEDs, lamp) are baked into
// the GLOW maps of the desk and must not be added again here.
const runtime = new THREE.Group();
scene.add(runtime);
const key = new THREE.SpotLight("#ffe6c7", 60, 0, THREE.MathUtils.degToRad(30), 0.85, 0);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.bias = -0.0002;
key.shadow.normalBias = 0.01;
key.shadow.radius = 4;
const fill = new THREE.HemisphereLight("#ffe9d6", "#1a1420", 0.35);
const rimL = new THREE.DirectionalLight("#9e7bff", 0.9);
const rimR = new THREE.DirectionalLight("#ffae63", 0.6);
runtime.add(key, key.target, fill, rimL, rimR);

function placeLights(box) {
  const c = box.getCenter(new THREE.Vector3());
  const s = box.getSize(new THREE.Vector3()).length();
  key.position.set(c.x + 0.07 * s, c.y + 1.2 * s, c.z + 0.45 * s);
  key.target.position.copy(c);
  key.distance = 0;
  // decay 0 = no distance falloff, so intensity is the brightness at the target directly
  key.intensity = 2.2;
  key.shadow.camera.near = 0.2 * s;
  key.shadow.camera.far = 3 * s;
  rimL.position.set(c.x - s, c.y + 0.6 * s, c.z - s);
  rimR.position.set(c.x + s, c.y + 0.45 * s, c.z - 0.8 * s);
  rimL.target.position.copy(c);
  rimR.target.position.copy(c);
}

// ---------------------------------------------------------------- loading
const ktx2 = new KTX2Loader().setTranscoderPath("./basis/").detectSupport(renderer);
const loader = new GLTFLoader().setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder);
let model = null, views = null, report = null, box = null, loadMs = 0;
const state = { model: params.get("model") || "studio_desk", variant: params.get("variant") || "" };

async function loadJSON(url) { try { return await (await fetch(url)).json(); } catch { return null; } }

async function load(name, variant = "") {
  $("loading").style.display = "grid";
  $("loading").textContent = "loading…";
  if (model) { scene.remove(model); model.traverse((o) => o.geometry && o.geometry.dispose()); }
  views = views || await loadJSON("./models/views.json");
  const avail = await loadJSON("./models/available.json");
  const rawOpt = $("variant").querySelector('option[value="raw/"]');
  if (avail && !avail.raw) { rawOpt.disabled = true; rawOpt.textContent = "raw export (not downloaded)"; }
  if (rawOpt.disabled && variant === "raw/") variant = "";
  report = report || await loadJSON("./models/report.json");
  const t0 = performance.now();
  try {
    const file = variant === "webp" ? `${name}_webp.glb` : `${variant}${name}.glb`;
    const gltf = await loader.loadAsync(`./models/${file}`);
    loadMs = performance.now() - t0;
    model = gltf.scene;
  } catch (e) {
    $("loading").textContent = `failed to load ${variant}${name}.glb — ${e.message}`;
    throw e;
  }
  model.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const m = o.material;
    if (m.name.endsWith("_baked")) {                            // AO + glow live on UV set 1
      m.userData.baked = true;
      m.emissiveIntensity *= 0.85;                              // baked glow sits a touch under Cycles
    }
    m.userData.emissive0 = m.emissiveIntensity;
  });
  scene.add(model);
  box = new THREE.Box3().setFromObject(model);
  placeLights(box);
  state.model = name;
  state.variant = variant;
  $("model").value = name;
  $("variant").value = variant;
  applyToggles();
  reset();
  $("loading").style.display = "none";
  window.viewer.ready = true;
}

// ---------------------------------------------------------------- camera
const tmp = new THREE.Vector3();
function frame(az, el, distMul = 1) {
  const c = box.getCenter(new THREE.Vector3());
  const r = box.getSize(new THREE.Vector3()).length() / 2;
  const d = (r / Math.sin(THREE.MathUtils.degToRad(camera.fov / 2))) * 0.82 * distMul;
  const a = THREE.MathUtils.degToRad(az), e = THREE.MathUtils.degToRad(el);
  camera.position.set(c.x + Math.sin(a) * Math.cos(e) * d, c.y + Math.sin(e) * d, c.z + Math.cos(a) * Math.cos(e) * d);
  controls.target.copy(c);
  controls.minDistance = r * 0.25;
  controls.maxDistance = d * 1.8;
  controls.update();
}

function reset() {
  const hero = views && views.cameras && views.cameras.CAM_Hero;
  camera.fov = hero && state.model === "studio_desk" ? hero.fov_deg : 30;
  camera.updateProjectionMatrix();
  if (state.model === "studio_desk" && hero) {
    // same direction as the Blender hero camera (glTF space), distance auto-framed
    const f = new THREE.Vector3(...hero.forward).normalize();
    const az = THREE.MathUtils.radToDeg(Math.atan2(-f.x, -f.z)), el = THREE.MathUtils.radToDeg(Math.asin(-f.y));
    frame(az, el, 0.92);
  } else {
    frame(28, 26, 1);
  }
  setUnder($("under").checked);
}

function setUnder(on) {
  // normal: stay above the horizon; under-view: allow looking up from below the desktop
  controls.maxPolarAngle = on ? THREE.MathUtils.degToRad(150) : THREE.MathUtils.degToRad(84);
  controls.minPolarAngle = THREE.MathUtils.degToRad(on ? 20 : 8);
}

function keepOutOfModel() {
  // crude collision guard for the desk: never let the camera sink into the platform
  if (!box || state.model !== "studio_desk") return;
  const p = camera.position;
  const inside = p.x > box.min.x && p.x < box.max.x && p.z > box.min.z && p.z < box.max.z;
  if (inside && p.y < 0.06) p.y = 0.06;          // just above the floor inside the footprint
  if (!inside && p.y < box.min.y - 0.4) p.y = box.min.y - 0.4;
}

// ---------------------------------------------------------------- toggles
function applyToggles() {
  if (!model) return;
  const ao = $("ao").checked, glow = $("glow").checked;
  model.traverse((o) => {
    if (!o.isMesh || !o.material.userData.baked) return;
    o.material.aoMapIntensity = ao ? 1 : 0;
    o.material.emissiveIntensity = glow ? o.material.userData.emissive0 : 0;
  });
  runtime.visible = $("runtime").checked;
  key.castShadow = $("shadows").checked;
  bloom.enabled = $("bloom").checked;
}
for (const id of ["ao", "glow", "runtime", "shadows", "bloom"]) $(id).addEventListener("change", applyToggles);
$("under").addEventListener("change", (e) => setUnder(e.target.checked));
$("reset").addEventListener("click", reset);
$("model").addEventListener("change", (e) => load(e.target.value, state.variant));
$("variant").addEventListener("change", (e) => load(state.model, e.target.value));

// ---------------------------------------------------------------- picking (click vs drag)
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let down = null, hovered = null;

// Each exhibit listens to its own scope: the desk homepage ignores Games-page tags (game cases), so a
// click on a case inside the crate selects the crate. Standalone assets accept their own tags.
const SCOPE = { studio_desk: "home", games_collection: "games", studio_notebook: "home" };
function tagged(obj) {
  const scope = SCOPE[state.model];
  for (let o = obj; o; o = o.parent) {
    const u = o.userData || {};
    if (u.egg_id && !u.interactive_id) return o;
    if (u.interactive_id && (!u.interactive_scope || u.interactive_scope === scope)) return o;
  }
  return null;
}
function pick(ev) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = model && ray.intersectObject(model, true)[0];
  return hit ? { hit, target: tagged(hit.object) } : null;
}
function highlight(group, on) {
  if (!group) return;
  group.traverse((o) => {
    if (!o.isMesh) return;
    if (on && !o.userData.ownMat) { o.material = o.material.clone(); o.userData.ownMat = true; }
    if (o.userData.ownMat) o.material.emissive.setRGB(on ? 0.22 : 0, on ? 0.03 : 0, on ? 0.04 : 0);
  });
}
canvas.addEventListener("pointerdown", (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
canvas.addEventListener("pointerup", (e) => {
  if (!down) return;
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y), dt = performance.now() - down.t;
  down = null;
  if (moved > 6 || dt > 450) return;                  // that was a drag/orbit, not a click
  const p = pick(e);
  const el = $("pick");
  if (!p || !p.target) { el.style.display = "none"; return; }
  const u = p.target.userData;
  el.style.display = "block";
  el.textContent = `${u.interactive_id || u.egg_id}  [${u.interactive_kind || "discovery"} · ${u.interactive_scope || "home"}]\n` +
    `${u.interactive_label || u.egg_note || ""}\nnode: ${p.target.name}   mesh: ${p.hit.object.name}` +
    (u.game_slot ? `\ngame_slot: ${u.game_slot}` : "");
  window.viewer.lastPick = { id: u.interactive_id || u.egg_id, node: p.target.name };
});
canvas.addEventListener("pointermove", (e) => {
  if (down || !model) return;
  const p = pick(e);
  const t = p && p.target;
  if (t !== hovered) { highlight(hovered, false); highlight(t, true); hovered = t; canvas.style.cursor = t ? "pointer" : "grab"; }
});

// ---------------------------------------------------------------- artwork swap test
function testTexture(text, bg) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 512;
  const g = c.getContext("2d");
  g.fillStyle = bg; g.fillRect(0, 0, 1024, 512);
  g.fillStyle = "#080808"; g.font = "bold 120px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, 768, 256);   // 75% across = the side facing the viewer on mug wraps
  g.fillText(text, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;                                    // glTF UV convention
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function swapArtwork(slot, texture) {
  let n = 0;
  model.traverse((o) => {
    if (o.userData.artwork_slot !== slot) return;
    o.traverse((m) => {
      if (!m.isMesh || /ceramic/i.test(m.material.name)) return;
      const slot = m.material.map ? "map" : m.material.emissiveMap ? "emissiveMap" : null;   // screens glow
      if (!slot) return;
      m.material = m.material.clone();
      m.material[slot] = texture;
      m.material.needsUpdate = true;
      n++;
    });
  });
  return n;
}
$("swap").addEventListener("click", () => {
  const n1 = swapArtwork("mug_wrap", testTexture("SWAPPED", "#f4f4f4"));
  const n2 = swapArtwork("game_label_01", testTexture("GAME 1", "#c0262d"));
  const n3 = swapArtwork("screen_left", testTexture("RUNTIME", "#3a2a6a"));
  window.viewer.swapped = { mug_wrap: n1, game_label_01: n2, screen_left: n3 };
});

// ---------------------------------------------------------------- loop + stats
let frames = 0, last = performance.now(), fps = 0;
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();
const SHOT = params.has("shot");   // screenshot mode: render only on request (software GL is slow)
function loop() {
  if (!SHOT) requestAnimationFrame(loop);
  controls.update();
  keepOutOfModel();
  renderer.info.reset();
  composer.render();
  frames++;
  const now = performance.now();
  if (now - last > 500) {
    fps = (frames * 1000) / (now - last); frames = 0; last = now;
    const info = renderer.info;
    const rep = report && report.find((r) => r.file === (state.variant === "webp" ? `${state.model}_webp.glb` : `${state.variant}${state.model}.glb`));
    $("stats").textContent =
      `fps            ${fps.toFixed(0)}\ndraw calls     ${info.render.calls}\ntriangles      ${info.render.triangles}\n` +
      `textures       ${info.memory.textures}\nload           ${loadMs.toFixed(0)} ms\n` +
      (rep ? `file           ${rep.mb} MB\nGPU tex (est)  ${rep.gpu_texture_mb} MB` : "");
    window.viewer.stats = { fps, calls: info.render.calls, triangles: info.render.triangles, loadMs };
  }
}
if (!SHOT) loop();

// ---------------------------------------------------------------- API for scripts
window.viewer = {
  ready: false,
  load,
  view(az, el, dist = 1, opts = {}) {
    $("under").checked = !!opts.under;
    setUnder(!!opts.under);
    frame(az, el, dist);
    if (opts.target) { controls.target.set(...opts.target); controls.update(); }
    if (opts.position) { camera.position.set(...opts.position); controls.update(); }
  },
  set(toggles) { for (const [k, v] of Object.entries(toggles)) $(k).checked = v; applyToggles(); },
  swap() { $("swap").click(); return window.viewer.swapped; },
  pickAt(x, y) {
    const p = pick({ clientX: x, clientY: y });
    return p && p.target ? { id: p.target.userData.interactive_id || p.target.userData.egg_id, node: p.target.name } : null;
  },
  pickGrid(name, n = 5) {     // click-test a grid of points over a node's screen-space bounding box
    const o = model.getObjectByName(name);
    if (!o) return null;
    const b = new THREE.Box3().setFromObject(o), pts = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z])
      pts.push(new THREE.Vector3(x, y, z).project(camera));
    const xs = pts.map((p) => (p.x + 1) / 2 * window.innerWidth), ys = pts.map((p) => (1 - p.y) / 2 * window.innerHeight);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const ids = {};
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const p = pick({ clientX: x0 + (x1 - x0) * (i + 0.5) / n, clientY: y0 + (y1 - y0) * (j + 0.5) / n });
      const id = p && p.target ? (p.target.userData.interactive_id || p.target.userData.egg_id) : "-";
      ids[id] = (ids[id] || 0) + 1;
    }
    return ids;
  },
  projectNode(name) {
    const o = model.getObjectByName(name);
    if (!o) return null;
    const b = new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3()).project(camera);
    return { x: (b.x + 1) / 2 * window.innerWidth, y: (1 - b.y) / 2 * window.innerHeight };
  },
  reset,
  capture() {                 // render one frame and return it as a PNG data URL
    controls.update();
    keepOutOfModel();
    const t = performance.now();
    renderer.info.reset();
    composer.render();
    const info = renderer.info;
    window.viewer.stats = { frameMs: performance.now() - t, calls: info.render.calls,
                            triangles: info.render.triangles, textures: info.memory.textures, loadMs };
    return canvas.toDataURL("image/png");
  },
};
load(state.model, state.variant);
