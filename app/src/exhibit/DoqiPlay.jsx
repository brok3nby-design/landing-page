// DOQI exhibit: J.E.F.F. watches you, and the stamp files your forms. No physics engine needed.
//
//   - J.E.F.F.'s screen is drawn live: his grumpy eyes follow the mouse around the page and he blinks.
//     Click him and he delivers a ruling on his screen (and the info panel opens, as for any object).
//   - Click the stamp, the ink pad or the form (or press "Stamp it"): the stamp lifts off the pad, thunks
//     down on Form 27-B and leaves a red mark - FILED, mostly. Marks pile up and are remembered in this
//     browser (b3d-doqi-filed-v1), with a running count.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { wakeAudio, blip, goldSoundOn } from "./goldAudio.js";

const KEY = "b3d-doqi-filed-v1";
const MAX_MARKS = 24;
const FALLBACK_LINES = ["YOUR ANSWERS HAVE BEEN FILED.", "NOTED.", "PLEASE HOLD."];   // used if the page gives none
const MARKS = ["FILED", "FILED", "FILED", "APPROVED?", "FILED", "DENIED", "FILED", "PENDING"];

function loadSave() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.marks)) return s; } catch { /* none */ } return { count: 0, marks: [] }; }
function store(s) { try { localStorage.setItem(KEY, JSON.stringify({ count: s.count, marks: s.marks.slice(-MAX_MARKS) })); return true; } catch { return false; } }

// ------------------------------------------------------------ J.E.F.F.'s face
function drawFace(g, w, h, st) {
  const grd = g.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7);
  grd.addColorStop(0, "#1f5a3a"); grd.addColorStop(1, "#0b2318");
  g.fillStyle = grd; g.fillRect(0, 0, w, h);
  if (st.text) {
    g.fillStyle = "#9cf5b4"; g.textAlign = "center"; g.textBaseline = "middle";
    // the biggest type that fits the screen (long lines get smaller text, up to 6 rows)
    const text = st.text.toUpperCase();
    let size = 28, lines = [];
    for (; size >= 14; size -= 2) {
      g.font = `bold ${size}px 'Courier New', monospace`;
      lines = []; let line = "";
      for (const wd of text.split(" ")) { if (g.measureText(line + " " + wd).width > w - 32 && line) { lines.push(line); line = wd; } else line = line ? line + " " + wd : wd; }
      lines.push(line);
      if (lines.length * size * 1.2 <= h - 30) break;
    }
    lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * size * 1.2));
  } else {
    for (const sx of [-1, 1]) {
      const ex = w / 2 + sx * 66, ey = h * 0.56;
      g.fillStyle = "#bff7c8"; g.beginPath(); g.arc(ex, ey, 40, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#5fdc84"; g.beginPath(); g.arc(ex, ey, 34, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#0b2416"; g.beginPath(); g.arc(ex + st.px * 16, ey + 4 + st.py * 12, 13, 0, Math.PI * 2); g.fill();
      // heavy lids + angry brows (inner ends down); blinking closes the lids
      const lid = 30 + st.blink * 46;
      g.fillStyle = "#0d2a1c";
      g.beginPath(); g.moveTo(ex - 52, ey - 44 + sx * 16 + lid); g.lineTo(ex + 52, ey - 44 - sx * 16 + lid);
      g.lineTo(ex + 52, ey - 80); g.lineTo(ex - 52, ey - 80); g.closePath(); g.fill();
      if (st.blink > 0.6) { g.fillRect(ex - 52, ey - 10, 104, 60); }
      g.strokeStyle = "#071810"; g.lineWidth = 10;
      g.beginPath(); g.moveTo(ex - 48, ey - 46 + sx * 16 + lid); g.lineTo(ex + 48, ey - 46 - sx * 16 + lid); g.stroke();
    }
  }
  g.fillStyle = "rgba(0,0,0,0.28)";
  for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1.5);
}

// ------------------------------------------------------------ the stamp mark
function markTexture(word) {
  const c = document.createElement("canvas"); c.width = 320; c.height = 140;
  const g = c.getContext("2d");
  g.strokeStyle = g.fillStyle = word === "DENIED" ? "#8f1b14" : "#b3221c";
  g.lineWidth = 9; g.strokeRect(10, 10, 300, 120);
  g.lineWidth = 3; g.strokeRect(22, 22, 276, 96);
  g.font = `900 ${word.length > 6 ? 50 : 64}px Impact, 'Arial Black', sans-serif`; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(word, 160, 74);
  g.globalCompositeOperation = "destination-out";              // worn rubber: speckles where ink didn't take
  for (let i = 0; i < 900; i++) { g.globalAlpha = Math.random() * 0.8; g.fillRect(Math.random() * 320, Math.random() * 140, 1 + Math.random() * 3, 1 + Math.random() * 2); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const MARK_GEO = new THREE.PlaneGeometry(0.075, 0.033).rotateX(-Math.PI / 2);

export default function DoqiPlay({ scene, selectedId, lines }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const N = useMemo(() => {
    const get = (n) => scene.getObjectByName(n);
    return { screen: get("DQ_Jeff_Screen"), jeff: get("DQ_Jeff"), stamp: get("DQ_Stamp"), form: get("DQ_Form"), pad: get("DQ_InkPad") };
  }, [scene]);
  const S = useMemo(() => ({
    face: { px: 0, py: 0, blink: 0, text: "" }, canvas: null, ctx: null, tex: null, bag: [], voice: null, textUntil: 0,
    anim: null, save: loadSave(), marksGroup: null, ray: new THREE.Raycaster(), ndc: new THREE.Vector2(), home: null,
  }), []);

  // ------------------------------------------------------------ the live screen
  useEffect(() => {
    if (!N.screen) return;
    const c = document.createElement("canvas"); c.width = 320; c.height = 240;
    S.canvas = c; S.ctx = c.getContext("2d");
    S.tex = new THREE.CanvasTexture(c);
    S.tex.flipY = false;                                       // glTF UV convention
    S.tex.colorSpace = THREE.SRGBColorSpace;
    const old = N.screen.material;
    N.screen.material = new THREE.MeshStandardMaterial({ color: "#000000", emissive: "#ffffff", emissiveMap: S.tex, emissiveIntensity: 1.6, roughness: 0.15 });
    const own = N.screen.userData.ownMat;
    N.screen.userData.ownMat = false;                          // the red hover/selection glow must not tint his face
    redraw();
    return () => { N.screen.material.dispose(); N.screen.material = old; N.screen.userData.ownMat = own; S.tex.dispose(); };
  }, [N, S]);   // eslint-disable-line react-hooks/exhaustive-deps
  function redraw() {
    if (!S.ctx) return;
    drawFace(S.ctx, S.canvas.width, S.canvas.height, S.face);
    S.tex.needsUpdate = true;
    invalidate();
  }
  function say(text, ms = 2600) {
    S.face.text = text; S.textUntil = performance.now() + ms; redraw();
    window.dispatchEvent(new CustomEvent("dq-jeff", { detail: { text } }));
  }

  // J.E.F.F. speaks: the next line from a shuffled bag (no repeats until every line has been said)
  function speak() {
    const all = (lines && lines.length ? lines : FALLBACK_LINES).map((l) => (typeof l === "string" ? { text: l } : l));
    if (!S.bag.length) S.bag = all.slice().sort(() => Math.random() - 0.5);
    const line = S.bag.pop();
    wakeAudio();
    S.voice?.pause();
    if (line.audio && goldSoundOn()) {
      S.voice = new Audio(`${import.meta.env.BASE_URL}${line.audio}`);
      S.voice.play().catch(() => blip("jeff", 0.6));
    } else blip("jeff", 0.6);
    say(line.text, Math.min(9000, 1600 + line.text.length * 55));
  }
  useEffect(() => () => S.voice?.pause(), [S]);

  // eyes follow the pointer anywhere on the page; he blinks now and then
  useEffect(() => {
    if (!N.screen) return;
    const p = new THREE.Vector3();
    let pending = false;
    const look = (e) => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => {
        pending = false;
        const r = gl.domElement.getBoundingClientRect();
        N.screen.getWorldPosition(p).project(camera);
        const sx = r.left + (p.x + 1) / 2 * r.width, sy = r.top + (1 - p.y) / 2 * r.height;
        const px = Math.max(-1, Math.min(1, (e.clientX - sx) / 420)), py = Math.max(-1, Math.min(1, (e.clientY - sy) / 320));
        if (Math.abs(px - S.face.px) + Math.abs(py - S.face.py) > 0.04 && !S.face.text) { S.face.px = px; S.face.py = py; redraw(); }
      });
    };
    window.addEventListener("pointermove", look, { passive: true });
    let timer;
    const blink = () => {
      timer = setTimeout(() => {
        if (document.visibilityState === "visible" && !S.face.text) {
          S.face.blink = 1; redraw();
          setTimeout(() => { S.face.blink = 0; redraw(); }, 140);
        }
        blink();
      }, 2800 + Math.random() * 3500);
    };
    blink();
    return () => { window.removeEventListener("pointermove", look); clearTimeout(timer); };
  }, [N, S, gl, camera]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ stamping
  useEffect(() => {
    if (!N.form || !N.stamp) return;
    // An unscaled frame on the form's surface: the optimised GLB stores quantised meshes whose nodes carry
    // a de-quantising scale/offset, so marks must not be children of the form mesh itself.
    scene.updateMatrixWorld(true);
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    N.form.matrixWorld.decompose(pos, quat, scl);
    const geo = N.form.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const size = geo.boundingBox.getSize(new THREE.Vector3()).multiply(scl);
    const top = N.form.localToWorld(geo.boundingBox.getCenter(new THREE.Vector3()).setY(geo.boundingBox.max.y));
    const g = new THREE.Group(); g.name = "DQ_Marks";
    g.position.copy(top); g.quaternion.copy(quat);
    scene.worldToLocal(g.position);
    scene.add(g);
    S.marksGroup = g;
    S.formSize = size;
    // the stamp's rubber face, relative to its node origin (in world space, at rest)
    S.home = { p: N.stamp.position.clone(), q: N.stamp.quaternion.clone() };
    const sb = new THREE.Box3().setFromObject(N.stamp);
    const nodeW = N.stamp.getWorldPosition(new THREE.Vector3());
    S.stampOffset = nodeW.sub(sb.getCenter(new THREE.Vector3()).setY(sb.min.y));
    for (const mk of S.save.marks) addMark(mk);
    window.dispatchEvent(new CustomEvent("dq-filed", { detail: { count: S.save.count } }));
    window.__doqi = { count: () => S.save.count, marks: () => g.children.length, face: () => ({ ...S.face }) };
    return () => { scene.remove(g); N.stamp.position.copy(S.home.p); N.stamp.quaternion.copy(S.home.q); delete window.__doqi; };
  }, [N, S, scene]);   // eslint-disable-line react-hooks/exhaustive-deps

  function addMark(mk) {
    const mesh = new THREE.Mesh(MARK_GEO, new THREE.MeshStandardMaterial({ map: markTexture(mk.w), transparent: true, roughness: 0.9,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    mesh.position.set(mk.x, 0.0004, mk.z);
    mesh.rotation.y = mk.r;
    mesh.renderOrder = 2;
    S.marksGroup.add(mesh);
    while (S.marksGroup.children.length > MAX_MARKS) S.marksGroup.remove(S.marksGroup.children[0]);
    return mesh;
  }
  function stampIt() {
    if (S.anim || !N.stamp || !N.form) return;
    wakeAudio();
    const sz = S.formSize;
    const mk = { x: +((Math.random() - 0.5) * sz.x * 0.45).toFixed(4), z: +((Math.random() - 0.5) * sz.z * 0.5).toFixed(4),
                 r: +((Math.random() - 0.5) * 0.7).toFixed(2), w: MARKS[S.save.count % MARKS.length] };
    // where the stamp's node has to go (rubber face on the form), in its parent's space
    const target = S.marksGroup.localToWorld(new THREE.Vector3(mk.x, 0, mk.z)).add(S.stampOffset);
    N.stamp.parent.worldToLocal(target);
    const lift = 0.09;
    S.anim = { t: 0, home: S.home.p.clone(), target, lift, mk, hit: false };
    invalidate();
  }
  useFrame((_, dt) => {
    const a = S.anim;
    if (a) {
      a.t += Math.min(dt, 0.05);
      const T = [0.16, 0.42, 0.52, 0.64, 0.8, 1.04, 1.18];           // lift, travel, press, hold, up, travel back, down
      const ease = (x) => x * x * (3 - 2 * x);
      const H = a.home, P = a.target, up = (v, k) => v.clone().setY(v.y + a.lift * k);
      let pos;
      const seg = (t0, t1) => ease(Math.min(1, Math.max(0, (a.t - t0) / (t1 - t0))));
      if (a.t < T[0]) pos = H.clone().lerp(up(H, 1), seg(0, T[0]));
      else if (a.t < T[1]) pos = up(H, 1).lerp(up(P, 1), seg(T[0], T[1]));
      else if (a.t < T[2]) pos = up(P, 1).lerp(P, Math.pow(seg(T[1], T[2]), 2));
      else if (a.t < T[3]) pos = P.clone();
      else if (a.t < T[4]) pos = P.clone().lerp(up(P, 1), seg(T[3], T[4]));
      else if (a.t < T[5]) pos = up(P, 1).lerp(up(H, 1), seg(T[4], T[5]));
      else pos = up(H, 1).lerp(H, seg(T[5], T[6]));
      N.stamp.position.copy(pos);
      if (!a.hit && a.t >= T[2]) {
        a.hit = true;
        blip("thunk", 0.9);
        addMark(a.mk);
        S.save.count++; S.save.marks.push(a.mk);
        const saved = store(S.save);
        window.dispatchEvent(new CustomEvent("dq-filed", { detail: { count: S.save.count, word: a.mk.w, saved } }));
        if (a.mk.w === "FILED") say("YOUR ANSWERS HAVE BEEN FILED.", 2200);
        else if (a.mk.w === "DENIED") say("DENIED. FILE ANYWAY.", 2200);
        else say(a.mk.w === "PENDING" ? "PENDING. PLEASE HOLD." : "APPROVED? APPROVED.", 2200);
      }
      if (a.t >= T[6]) { N.stamp.position.copy(S.home.p); N.stamp.quaternion.copy(S.home.q); S.anim = null; }
      invalidate();
    }
    if (S.face.text && performance.now() > S.textUntil) { S.face.text = ""; redraw(); }
    else if (S.face.text) invalidate();
  });

  // ------------------------------------------------------------ input
  useEffect(() => {
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    const targets = [N.stamp, N.pad, N.form].filter(Boolean);
    const hitOf = (e, objs) => {
      const r = gl.domElement.getBoundingClientRect();
      S.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      S.ray.setFromCamera(S.ndc, camera);
      return S.ray.intersectObjects(objs, true)[0] || null;
    };
    let downAt = null, suppress = false;
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const first = hitOf(e, [scene])?.object;
      const onStamp = first && targets.some((t) => { for (let o = first; o; o = o.parent) if (o === t) return true; return false; });
      if (!onStamp) { downAt = { x: e.clientX, y: e.clientY }; return; }
      e.stopPropagation();                                      // the stamp, not the camera, gets this press
      suppress = true;
      stampIt();
    };
    const click = (e) => {
      if (suppress) { e.stopPropagation(); suppress = false; return; }
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
      const h = hitOf(e, [N.jeff].filter(Boolean));                // clicking J.E.F.F.: a ruling (the panel opens too)
      if (h) speak();
    };
    const act = (e) => { if (e.detail === "stamp") stampIt(); };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("click", click, { capture: true });
    window.addEventListener("dq-act", act);
    return () => {
      el.removeEventListener("pointerdown", down, { capture: true });
      el.removeEventListener("click", click, { capture: true });
      window.removeEventListener("dq-act", act);
    };
  }, [N, S, gl, camera, scene]);   // eslint-disable-line react-hooks/exhaustive-deps

  // choosing "The Stamp" / "Form 27-B" from the list also stamps
  useEffect(() => { if (selectedId === "dq_stamp" || selectedId === "dq_form") stampIt(); }, [selectedId]);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
