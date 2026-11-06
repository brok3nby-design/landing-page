// Under the Radar exhibit: the CRT is a radar for games nobody has heard of yet ("One more game.").
//
//   - Click the computer (or "Scan"): the amber sweep goes round once. It catches a blip, and one of the four
//     postcards from the cover (the lighthouse, the manor, the night train, the clockwork) flies out of the
//     screen and hangs in the air around it, glowing.
//   - Find all four and the screen reads ONE MORE GAME. (and a Passport stamp). What you found is remembered
//     in this browser (b3d-radar-v1). "Forget them" starts again.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { wakeAudio, blip } from "./goldAudio.js";
import { unlock } from "../site/passport.js";

const KEY = "b3d-radar-v1";
const COVER = `${import.meta.env.BASE_URL}media/projects/under-the-radar/Under_Radar_logo.webp`;
// the postcards as crops of the cover (1024 x 1536), where each blip sits on the radar, and where the card hangs
const CARDS = [
  { id: "lighthouse", title: "The Lighthouse", crop: [272, 800, 462, 962], blip: [0.55, -0.62], slot: [-0.26, 0.16, -8] },
  { id: "manor", title: "The Manor", crop: [520, 846, 724, 992], blip: [0.72, 0.4], slot: [0.27, 0.18, 7] },
  { id: "train", title: "The Night Train", crop: [275, 966, 497, 1112], blip: [-0.6, 0.45], slot: [-0.28, -0.02, 5] },
  { id: "clockwork", title: "The Clockwork", crop: [575, 1025, 770, 1160], blip: [-0.35, -0.7], slot: [0.29, 0.0, -6] },
];
const CW = 0.22, CH = 0.15;
const load = () => { try { const a = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(a) ? a.filter((id) => CARDS.some((c) => c.id === id)) : []; } catch { return []; } };
const save = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* fine */ } };

export default function RadarPlay({ scene }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const N = useMemo(() => ({ screen: scene.getObjectByName("UR_Screen"), pc: scene.getObjectByName("UR_Computer") }), [scene]);
  const S = useMemo(() => ({ found: load(), sweep: -Math.PI / 2, scan: null, fly: null, ctx: null, tex: null, frame: null, cover: null,
    group: null, cards: {}, pings: {}, ray: new THREE.Raycaster(), ndc: new THREE.Vector2() }), []);

  // ------------------------------------------------------------ the radar screen + the card frame in front of it
  useEffect(() => {
    if (!N.screen) return;
    scene.updateMatrixWorld(true);
    const geo = N.screen.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    N.screen.matrixWorld.decompose(pos, quat, scl);
    const size = geo.boundingBox.getSize(new THREE.Vector3()).multiply(scl);
    const centre = N.screen.localToWorld(geo.boundingBox.getCenter(new THREE.Vector3()));
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);
    const c = document.createElement("canvas"); c.width = 320; c.height = 240;
    S.ctx = c.getContext("2d");
    S.tex = new THREE.CanvasTexture(c); S.tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: S.tex, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.98, size.y * 0.98), mat);
    plane.position.copy(centre).addScaledVector(normal, size.z / 2 + 0.001);
    plane.quaternion.copy(quat);
    scene.add(plane);
    S.overlay = plane;
    // a frame in front of the screen, for placing the postcards (x right, y up, z out of the screen)
    const frame = new THREE.Group();
    frame.position.copy(centre); frame.quaternion.copy(quat);
    scene.add(frame);
    S.frame = frame;
    const img = new Image();
    img.onload = () => { S.cover = img; for (const id of S.found) addCard(id, false); invalidate(); };
    img.src = COVER;
    draw();
    report();
    window.__radar = { found: () => S.found.slice(), busy: () => !!(S.scan || S.fly) };
    return () => { scene.remove(plane, frame); mat.dispose(); S.tex.dispose(); delete window.__radar; };
  }, [N, S, scene]);   // eslint-disable-line react-hooks/exhaustive-deps

  function draw() {
    const g = S.ctx, w = 320, h = 240, cx = w / 2, cy = h / 2, R = 108;
    if (!g) return;
    g.fillStyle = "#120a04"; g.fillRect(0, 0, w, h);
    const all = S.found.length === CARDS.length;
    g.strokeStyle = "rgba(255,179,74,0.35)"; g.lineWidth = 1.5;
    for (const r of [R * 0.28, R * 0.56, R * 0.83, R]) { g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(cx - R, cy); g.lineTo(cx + R, cy); g.moveTo(cx, cy - R); g.lineTo(cx, cy + R); g.stroke();
    // the sweep: a bright line and a fading wedge behind it
    for (let k = 0; k < 28; k++) {
      const a = S.sweep - k * 0.045;
      g.strokeStyle = `rgba(255,179,74,${0.55 * (1 - k / 28)})`; g.lineWidth = 3;
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); g.stroke();
    }
    const now = performance.now();
    for (const card of CARDS) {                              // blips: found ones are steady stars, the others flash when swept
      const [bx, by] = card.blip, x = cx + bx * R, y = cy + by * R;
      if (S.found.includes(card.id)) {
        g.fillStyle = "#ffe2a6"; g.beginPath(); g.arc(x, y, 3, 0, 7); g.fill();
      } else if (S.pings[card.id]) {
        const f = Math.max(0, 1 - (now - S.pings[card.id]) / 1400);
        g.fillStyle = `rgba(255,226,166,${f})`; g.beginPath(); g.arc(x, y, 4 + (1 - f) * 8, 0, 7); g.fill();
      }
    }
    if (all) {
      g.fillStyle = "rgba(18,10,4,0.65)"; g.fillRect(20, cy - 26, w - 40, 52);
      g.fillStyle = "#ffcf80"; g.font = "bold 30px 'Courier New', monospace"; g.textAlign = "center"; g.textBaseline = "middle";
      g.fillText("ONE MORE GAME.", cx, cy + 1);
    }
    g.fillStyle = "rgba(0,0,0,0.28)";
    for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
    S.tex.needsUpdate = true;
    invalidate();
  }

  function cardTexture(card) {
    const c = document.createElement("canvas"); c.width = 320; c.height = 220;
    const g = c.getContext("2d");
    g.fillStyle = "#f3e7c9"; g.fillRect(0, 0, 320, 220);
    if (S.cover) {
      const [x0, y0, x1, y1] = card.crop, sw = (x1 - x0) * S.cover.width / 1024, sh = (y1 - y0) * S.cover.height / 1536;
      g.drawImage(S.cover, x0 * S.cover.width / 1024, y0 * S.cover.height / 1536, sw, sh, 10, 10, 300, 200);
    }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  function slotPose(card) {
    const [x, y, rz] = card.slot;
    return { pos: new THREE.Vector3(x, y, 0.16), rot: new THREE.Euler(0, x > 0 ? -0.35 : 0.35, THREE.MathUtils.degToRad(rz)) };
  }
  function addCard(id, fly) {
    const card = CARDS.find((c) => c.id === id);
    if (!card || S.cards[id]) return null;
    const tex = cardTexture(card);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CW, CH), new THREE.MeshStandardMaterial({ map: tex, emissive: "#ffd9a0", emissiveMap: tex, emissiveIntensity: 0.55, roughness: 0.6, side: THREE.DoubleSide }));
    m.name = `UR_Postcard_${id}`;
    const pose = slotPose(card);
    if (fly) { m.position.set(0, 0, 0.01); m.scale.setScalar(0.05); } else { m.position.copy(pose.pos); m.rotation.copy(pose.rot); }
    S.frame.add(m);
    S.cards[id] = m;
    return m;
  }

  // ------------------------------------------------------------ scanning
  function scan() {
    if (S.scan || S.fly || !S.ctx) return;
    wakeAudio();
    if (S.found.length === CARDS.length) { report({ said: "One more game." }); blip("ping", 0.5); return; }
    const next = CARDS.find((c) => !S.found.includes(c.id));
    const target = Math.atan2(next.blip[1], next.blip[0]);
    // one full turn that ends just past the new blip
    let end = target + 0.3; while (end < S.sweep + Math.PI * 2) end += Math.PI * 2;
    S.scan = { from: S.sweep, to: end, t: 0, dur: 2.4, card: next, pinged: {} };
    report({ scanning: true });
    invalidate();
  }
  function forget() {
    for (const id of Object.keys(S.cards)) { S.frame.remove(S.cards[id]); }
    S.cards = {}; S.found = []; S.pings = {}; save([]);
    draw(); report();
  }
  function report(extra = {}) {
    window.dispatchEvent(new CustomEvent("ur-state", { detail: { found: S.found.length, total: CARDS.length,
      last: CARDS.find((c) => c.id === S.found[S.found.length - 1])?.title || null, ...extra } }));
  }

  useFrame((_, dt) => {
    const k = Math.min(dt, 0.05);
    let busy = false;
    const sc = S.scan;
    if (sc) {
      sc.t += k;
      const f = Math.min(1, sc.t / sc.dur), e = 1 - Math.pow(1 - f, 2);
      S.sweep = sc.from + (sc.to - sc.from) * e;
      for (const card of CARDS) {                             // ping every blip the sweep passes
        const a = Math.atan2(card.blip[1], card.blip[0]);
        const passes = Math.floor((S.sweep - a) / (Math.PI * 2)) - Math.floor((sc.from - a) / (Math.PI * 2));
        if (passes > (sc.pinged[card.id] || 0)) {
          sc.pinged[card.id] = passes;
          if (!S.found.includes(card.id)) { S.pings[card.id] = performance.now(); blip("ping", card === sc.card ? 0.7 : 0.3); }
        }
      }
      draw();
      if (f >= 1) {
        S.scan = null;
        const m = addCard(sc.card.id, true);
        if (m) { S.fly = { t: 0, m, card: sc.card }; blip("spin", 0.6); }
      }
      busy = true;
    }
    const fl = S.fly;
    if (fl) {
      fl.t += k;
      const f = Math.min(1, fl.t / 0.9), e = f * f * (3 - 2 * f);
      const pose = slotPose(fl.card);
      fl.m.position.set(0, 0, 0.01).lerp(pose.pos, e);
      fl.m.position.z += Math.sin(f * Math.PI) * 0.06;
      fl.m.rotation.set(pose.rot.x * e, pose.rot.y * e + (1 - e) * Math.PI * 2, pose.rot.z * e);
      fl.m.scale.setScalar(0.05 + 0.95 * e);
      if (f >= 1) {
        S.fly = null;
        S.found.push(fl.card.id);
        save(S.found);
        const all = S.found.length === CARDS.length;
        if (all) unlock("one-more-game");
        draw();
        report({ discovered: fl.card.title, all });
      }
      busy = true;
    }
    if (Object.keys(S.pings).length && !sc) {                // let the last ping fade out
      const live = Object.values(S.pings).some((t) => performance.now() - t < 1400);
      if (live) { draw(); busy = true; } else S.pings = {};
    }
    if (busy) invalidate();
  });

  // ------------------------------------------------------------ input
  useEffect(() => {
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    const isIn = (o, root) => { for (; o; o = o.parent) if (o === root) return true; return false; };
    let downAt = null;
    const down = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
    const click = (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
      const r = gl.domElement.getBoundingClientRect();
      S.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      S.ray.setFromCamera(S.ndc, camera);
      const h = S.ray.intersectObjects([S.frame, scene].filter(Boolean), true)[0];
      if (!h) return;
      const card = CARDS.find((c) => S.cards[c.id] && isIn(h.object, S.cards[c.id]));
      if (card) { report({ said: card.title }); return; }
      if (h.object === S.overlay || isIn(h.object, N.pc)) scan();
    };
    const act = (e) => { if (e.detail === "scan") scan(); if (e.detail === "forget") forget(); };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("click", click, { capture: true });
    window.addEventListener("ur-act", act);
    return () => { el.removeEventListener("pointerdown", down, { capture: true }); el.removeEventListener("click", click, { capture: true }); window.removeEventListener("ur-act", act); };
  }, [N, S, gl, camera, scene]);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
