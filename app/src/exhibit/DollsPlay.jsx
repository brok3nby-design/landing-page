// Macabre Dolls exhibit: the forgotten nursery. No physics engine needed.
//
//   - Click the deck (or "Draw a card"): the top card lifts, turns to face you and shows one of the studio's
//     dolls (the gallery artwork, framed as a MACABRE card), then is laid face up beside the deck. No repeats
//     until the deck is empty; draw them all for a Passport stamp. "Shuffle" gathers them back.
//   - The dolls watch you. While you move the view they hold perfectly still; stop, and their heads slowly
//     turn to find you.
//   - Click the music box: the lid opens and it plays a little waltz that runs down at the end. While it
//     plays, the dolls turn to listen.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { wakeAudio, blip, musicBox } from "./goldAudio.js";
import { unlock } from "../site/passport.js";

const BASE = import.meta.env.BASE_URL;
const ART = `${BASE}media/projects/macabre-dolls/gallery/creepy-dolls_`;
const FACES = [1, 2, 3, 4, 5, 6, 7, 9, 10, 13, 14, 15, 16];        // the portrait-shaped doll pictures
const BACK = 8;                                                    // the MACABRE "Doll Edition" card back
const CW = 0.075, CH = 0.11, SHOWN = 6;
const UP = new THREE.Vector3(0, 1, 0);
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function loadImage(src) {
  return new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
}
// a card face: the portrait in an ornate dark frame with a red MACABRE banner, like the studio's card back
async function faceTexture(n) {
  const c = document.createElement("canvas"); c.width = 360; c.height = 528;
  const g = c.getContext("2d");
  g.fillStyle = "#e7dcc4"; g.fillRect(0, 0, 360, 528);
  g.fillStyle = "#1b1214"; g.fillRect(12, 12, 336, 504);
  g.strokeStyle = "#b9965b"; g.lineWidth = 4; g.strokeRect(24, 24, 312, 480);
  const img = await loadImage(`${ART}${n}.webp`);
  if (img) {
    const w = 288, h = 380, s = Math.max(w / img.width, h / img.height);
    g.save(); g.beginPath(); g.rect(36, 36, w, h); g.clip();
    g.drawImage(img, 36 + (w - img.width * s) / 2, 36 + (h - img.height * s) / 2, img.width * s, img.height * s);
    g.restore();
  }
  g.strokeStyle = "#b9965b"; g.lineWidth = 2; g.strokeRect(36, 36, 288, 380);
  g.fillStyle = "#8f1b20"; g.fillRect(48, 430, 264, 54);
  g.strokeStyle = "#d9b76e"; g.lineWidth = 2; g.strokeRect(52, 434, 256, 46);
  g.fillStyle = "#f1e4c8"; g.font = "700 30px Georgia, 'Times New Roman', serif"; g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText("MACABRE", 180, 458);
  for (const [x, y] of [[30, 30], [330, 30], [30, 498], [330, 498]]) { g.fillStyle = "#8f1b20"; g.beginPath(); g.arc(x, y, 9, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export default function DollsPlay({ scene }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const N = useMemo(() => {
    const g = (n) => scene.getObjectByName(n);
    return { deck: g("MD_Deck"), box: g("MD_MusicBox"), lid: g("MD_MusicBox_Lid"),
             heads: [1, 2, 3].map((k) => g(`MD_Doll_${k}_Head`)).filter(Boolean) };
  }, [scene]);
  const S = useMemo(() => ({ bag: [], drawn: [], anim: null, group: null, back: null, music: null, lidOpen: 0,
    lastMove: performance.now(), lastCam: new THREE.Matrix4(), settled: false, rest: [], ray: new THREE.Raycaster(), ndc: new THREE.Vector2() }), []);
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), w: new THREE.Vector3(), q: new THREE.Quaternion(), d: new THREE.Object3D(), e: new THREE.Euler(0, 0, 0, "YXZ") }), []);

  // ------------------------------------------------------------ setup
  useEffect(() => {
    if (!N.deck) return;
    const group = new THREE.Group(); group.name = "MD_Drawn";
    scene.add(group);
    S.group = group;
    new THREE.TextureLoader().load(`${ART}${BACK}.webp`, (t) => { t.colorSpace = THREE.SRGBColorSpace; S.back = t; });
    S.rest = N.heads.map((h) => h.quaternion.clone());
    S.lidRest = N.lid ? N.lid.quaternion.clone() : null;
    scene.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(N.deck);
    S.deckTop = bb.getCenter(new THREE.Vector3()).setY(bb.max.y + 0.001);
    S.floorY = bb.min.y + 0.0015;
    S.deckYaw = new THREE.Euler().setFromQuaternion(N.deck.getWorldQuaternion(new THREE.Quaternion()), "YXZ").y;
    window.__dolls = { drawn: () => S.drawn.length, busy: () => !!S.anim, music: () => !!S.music, heads: () => N.heads.map((h) => h.quaternion.angleTo(S.rest[N.heads.indexOf(h)])) };
    report();
    return () => { scene.remove(group); S.music?.stop(); N.heads.forEach((h, i) => h.quaternion.copy(S.rest[i])); if (N.lid) N.lid.quaternion.copy(S.lidRest); delete window.__dolls; };
  }, [N, S, scene]);   // eslint-disable-line react-hooks/exhaustive-deps

  function report(extra = {}) {
    window.dispatchEvent(new CustomEvent("md-state", { detail: { drawn: S.drawn.length, total: FACES.length, music: !!S.music, ...extra } }));
  }

  // ------------------------------------------------------------ drawing a card
  function land(a) {                                           // the card reaches its place in the fan
    a.card.position.copy(a.slot); a.card.quaternion.copy(a.qUp);
    S.anim = null;
    S.drawn.push(a.n);
    const older = S.group.children.length - SHOWN;           // keep the fan to the last few cards
    for (let i = 0; i < older; i++) S.group.remove(S.group.children[0]);
    blip("card", 0.4);
    const all = S.drawn.length >= FACES.length;
    if (all) unlock("full-deck");
    report({ drew: true, all });
  }
  async function draw() {
    if (!N.deck) return;
    if (S.anim) land(S.anim);                                 // impatient? the card in the air lands at once
    wakeAudio();
    if (S.drawn.length >= FACES.length) shuffle(true);
    if (!S.bag.length) S.bag = FACES.filter((f) => !S.drawn.includes(f)).sort(() => Math.random() - 0.5);
    const n = S.bag.pop();
    const card = new THREE.Group();
    const geo = new THREE.PlaneGeometry(CW, CH);
    const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: "#2a1a1c", roughness: 0.6 }));
    const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: S.back, roughness: 0.6, emissive: "#ffffff", emissiveMap: S.back, emissiveIntensity: 0.18 }));
    back.rotation.y = Math.PI;
    card.add(front, back);
    faceTexture(n).then((t) => { front.material.map = t; front.material.emissive = new THREE.Color("#ffffff"); front.material.emissiveMap = t;
      front.material.emissiveIntensity = 0.22; front.material.color.set("#ffffff"); front.material.needsUpdate = true; invalidate(); });
    S.group.add(card);
    // poses: face down on the deck -> facing the camera, in front of the dolls -> face up in the fan
    const yaw = new THREE.Quaternion().setFromAxisAngle(UP, S.deckYaw);
    const qDown = yaw.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
    const toCam = tmp.v.copy(camera.position).sub(S.deckTop).setY(0).normalize().clone();
    const side = new THREE.Vector3(-toCam.z, 0, toCam.x);
    const show = S.deckTop.clone().lerp(camera.position, 0.3).setY(S.deckTop.y + 0.16);
    tmp.d.position.copy(show); tmp.d.lookAt(camera.position);
    const qShow = tmp.d.quaternion.clone();
    const k = S.drawn.length % SHOWN;
    const slot = S.deckTop.clone().addScaledVector(toCam, 0.13).addScaledVector(side, (k - (SHOWN - 1) / 2) * 0.062).setY(S.floorY + 0.0004 * k);
    const fan = Math.atan2(toCam.x, toCam.z) + Math.PI + (k - (SHOWN - 1) / 2) * 0.12;
    const qUp = new THREE.Quaternion().setFromAxisAngle(UP, fan).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2));
    card.position.copy(S.deckTop); card.quaternion.copy(qDown);
    S.anim = { t: 0, card, n, from: S.deckTop.clone(), lift: S.deckTop.clone().setY(S.deckTop.y + 0.1), show, slot, qDown, qShow, qUp };
    blip("card", 0.7);
    report({ drawing: true });
    invalidate();
  }
  function shuffle(silent) {
    for (const c of S.group.children.slice()) S.group.remove(c);
    S.drawn = []; S.bag = [];
    if (!silent) { blip("card", 0.5); report({ shuffled: true }); }
    invalidate();
  }

  // ------------------------------------------------------------ the music box
  function playBox() {
    wakeAudio();
    if (S.music) { S.music.stop(); S.music = null; report(); invalidate(); return; }
    const m = musicBox(0.7);
    S.music = m || { stop() {}, duration: 9 };                // no sound: the lid still opens, the dolls still listen
    clearTimeout(S.musicTimer);
    S.musicTimer = setTimeout(() => { S.music = null; report(); invalidate(); }, S.music.duration * 1000);
    report();
    invalidate();
  }

  // ------------------------------------------------------------ per frame (only while something happens)
  useFrame((_, dt) => {
    const k = Math.min(dt, 0.05);
    const now = performance.now();
    let busy = false;
    const a = S.anim;
    if (a) {
      a.t += k;
      const e = (x) => x * x * (3 - 2 * x);
      const c = a.card;
      if (a.t < 0.3) { const f = e(a.t / 0.3); c.position.lerpVectors(a.from, a.lift, f); }
      else if (a.t < 0.8) { const f = e((a.t - 0.3) / 0.5); c.position.lerpVectors(a.lift, a.show, f); c.quaternion.slerpQuaternions(a.qDown, a.qShow, f); }
      else if (a.t < 1.9) { c.position.copy(a.show).setY(a.show.y + Math.sin((a.t - 0.8) * 3) * 0.004); c.quaternion.copy(a.qShow); }
      else if (a.t < 2.45) {
        const f = e((a.t - 1.9) / 0.55);
        c.position.lerpVectors(a.show, a.slot, f); c.position.y += Math.sin(f * Math.PI) * 0.05;
        c.quaternion.slerpQuaternions(a.qShow, a.qUp, f);
      } else land(a);
      busy = true;
    }
    // the lid opens while the music plays
    const want = S.music ? 1 : 0;
    if (N.lid && Math.abs(S.lidOpen - want) > 1e-3) {
      S.lidOpen += (want - S.lidOpen) * (1 - Math.exp(-k * 6));
      N.lid.quaternion.copy(S.lidRest).multiply(tmp.q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -1.7 * S.lidOpen));
      busy = true;
    }
    // the dolls: still while you move; when the view rests, they turn to you (or to the music box)
    if (!reducedMotion() && N.heads.length && now - S.lastMove > 1100) {
      const target = S.music && N.box ? N.box.getWorldPosition(tmp.w) : camera.position;
      let moving = false;
      N.heads.forEach((h, i) => {
        const p = h.parent;
        const local = p.worldToLocal(tmp.v.copy(target)).sub(h.position);
        const yaw = THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.0, 1.0);
        const pitch = THREE.MathUtils.clamp(Math.atan2(local.y, Math.hypot(local.x, local.z)), -0.45, 0.3);
        tmp.e.set(-pitch, yaw, (i - 1) * 0.06);                  // and the faintest tilt
        const goal = S.rest[i].clone().multiply(tmp.q.setFromEuler(tmp.e));
        const ang = h.quaternion.angleTo(goal);
        if (ang > 0.004) {
          const step = Math.min(1, (0.55 * k) / ang);            // slowly: about 30 degrees a second
          h.quaternion.slerp(goal, step);
          moving = true;
        }
      });
      if (moving) busy = true;
    }
    if (busy) invalidate();
  });

  // the view moving freezes the dolls: watch the camera between frames (cheap, and works with on-demand rendering)
  useEffect(() => {
    const id = setInterval(() => {
      camera.updateMatrixWorld();
      if (!S.lastCam.equals(camera.matrixWorld)) { S.lastCam.copy(camera.matrixWorld); S.lastMove = performance.now(); }
      else if (performance.now() - S.lastMove > 1100) invalidate();   // wake the frame loop so they can turn
    }, 250);
    return () => clearInterval(id);
  }, [camera, S, invalidate]);

  // ------------------------------------------------------------ input
  useEffect(() => {
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    const hitOf = (e, obj) => {
      if (!obj) return false;
      const r = gl.domElement.getBoundingClientRect();
      S.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      S.ray.setFromCamera(S.ndc, camera);
      const h = S.ray.intersectObject(scene, true).find((x) => !(S.group && isIn(x.object, S.group)));
      return !!h && isIn(h.object, obj);
    };
    const isIn = (o, root) => { for (; o; o = o.parent) if (o === root) return true; return false; };
    let downAt = null, suppress = false;
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (hitOf(e, N.deck)) { e.stopPropagation(); suppress = true; draw(); return; }   // the deck draws; no orbit, no panel
      downAt = { x: e.clientX, y: e.clientY };
    };
    const click = (e) => {
      if (suppress) { e.stopPropagation(); suppress = false; return; }
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 6 && hitOf(e, N.box)) playBox();
    };
    const act = (e) => { if (e.detail === "draw") draw(); if (e.detail === "shuffle") shuffle(); if (e.detail === "music") playBox(); };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("click", click, { capture: true });
    window.addEventListener("md-act", act);
    return () => { el.removeEventListener("pointerdown", down, { capture: true }); el.removeEventListener("click", click, { capture: true }); window.removeEventListener("md-act", act); };
  }, [N, S, gl, camera, scene]);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
