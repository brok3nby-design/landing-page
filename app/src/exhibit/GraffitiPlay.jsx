// Graffiti exhibit: spray your own tiny pixel tag on the wall ("Draw something small. Leave it behind.").
//
//   - Click a spray can to pick its colour (it rattles). The colours are the cans in the alley.
//   - Press and drag on the primed tile on the back wall to spray pixels (16 x 16). Painting the same pixel
//     with the same colour again wipes it, so mistakes are easy to undo.
//   - The tile is remembered in this browser only (b3d-graffiti-tile-v1). The real, shared wall is the live
//     Graffiti guestbook (the "Sign the guestbook" button on the page). Spray 25 pixels for a Passport stamp.
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { wakeAudio, blip } from "./goldAudio.js";
import { unlock } from "../site/passport.js";

const KEY = "b3d-graffiti-tile-v1";
const G = 16;
export const PALETTE = [["orange", "#ff6b0f"], ["pink", "#ff3f8c"], ["cyan", "#1fc7e6"], ["green", "#40d940"], ["purple", "#8c4dff"], ["yellow", "#ffcc26"]];
const HEART = ["..XX...XX..", ".XXXX.XXXX.", "XXXXXXXXXXX", "XXXXXXXXXXX", ".XXXXXXXXX.", "..XXXXXXX..", "...XXXXX...", "....XXX....", ".....X....."];

function load() { try { const a = JSON.parse(localStorage.getItem(KEY)); if (Array.isArray(a) && a.length === G * G) return a; } catch { /* none */ } return new Array(G * G).fill(-1); }
function save(px) { try { localStorage.setItem(KEY, JSON.stringify(px)); return true; } catch { return false; } }

export default function GraffitiPlay({ scene }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const N = useMemo(() => ({
    tile: scene.getObjectByName("GF_Tile_Paint"),
    cans: PALETTE.map(([n]) => scene.getObjectByName(`GF_Can_${n}`)),
  }), [scene]);
  const S = useMemo(() => ({ px: load(), colour: 0, overlay: null, ctx: null, tex: null, painting: false, mode: 1, last: -1,
    lastHiss: 0, ray: new THREE.Raycaster(), ndc: new THREE.Vector2() }), []);

  // ------------------------------------------------------------ the paintable overlay on the tile's face
  useEffect(() => {
    if (!N.tile) return;
    scene.updateMatrixWorld(true);
    const geo = N.tile.geometry;
    if (!geo.boundingBox) geo.computeBoundingBox();
    const pos = new THREE.Vector3(), quat = new THREE.Quaternion(), scl = new THREE.Vector3();
    N.tile.matrixWorld.decompose(pos, quat, scl);
    const size = geo.boundingBox.getSize(new THREE.Vector3()).multiply(scl);
    const centre = N.tile.localToWorld(geo.boundingBox.getCenter(new THREE.Vector3()));
    const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(quat);       // the face toward the alley (Blender -Y)
    const c = document.createElement("canvas"); c.width = G; c.height = G;
    S.ctx = c.getContext("2d");
    S.tex = new THREE.CanvasTexture(c);
    S.tex.magFilter = THREE.NearestFilter; S.tex.minFilter = THREE.NearestFilter; S.tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: S.tex, transparent: true, roughness: 0.55, emissive: "#ffffff", emissiveMap: S.tex, emissiveIntensity: 0.25,
                                                 polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(size.x * 0.96, size.y * 0.96), mat);
    plane.position.copy(centre).addScaledVector(normal, size.z / 2 + 0.0015);
    plane.quaternion.copy(quat);
    plane.renderOrder = 3;
    scene.add(plane);
    S.overlay = plane;
    redraw();
    report();
    window.__graffiti = { count: () => S.px.filter((v) => v >= 0).length, colour: () => PALETTE[S.colour][0], pixel: (i) => S.px[i] };
    return () => { scene.remove(plane); plane.geometry.dispose(); mat.dispose(); S.tex.dispose(); delete window.__graffiti; };
  }, [N, S, scene]);   // eslint-disable-line react-hooks/exhaustive-deps

  function redraw() {
    const g = S.ctx;
    g.clearRect(0, 0, G, G);
    S.px.forEach((v, i) => { if (v >= 0) { g.fillStyle = PALETTE[v][1]; g.fillRect(i % G, Math.floor(i / G), 1, 1); } });
    S.tex.needsUpdate = true;
    invalidate();
  }
  function report(extra = {}) {
    window.dispatchEvent(new CustomEvent("gf-state", { detail: { colour: PALETTE[S.colour][0], hex: PALETTE[S.colour][1], count: S.px.filter((v) => v >= 0).length, ...extra } }));
  }
  function commit() {
    const saved = save(S.px);
    const count = S.px.filter((v) => v >= 0).length;
    if (count >= 25) unlock("tagger");
    report({ saved });
  }
  function pickColour(k) {
    S.colour = k;
    wakeAudio(); blip("rattle", 0.7);
    report();
  }

  // ------------------------------------------------------------ painting
  function cellAt(e) {
    if (!S.overlay) return -1;
    const r = gl.domElement.getBoundingClientRect();
    S.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    S.ray.setFromCamera(S.ndc, camera);
    const h = S.ray.intersectObject(S.overlay, false)[0];
    if (!h || !h.uv) return -1;
    const x = Math.min(G - 1, Math.floor(h.uv.x * G)), y = Math.min(G - 1, Math.floor((1 - h.uv.y) * G));
    return y * G + x;
  }
  function paint(i, first) {
    if (i < 0 || i === S.last) return;
    S.last = i;
    if (first) S.mode = S.px[i] === S.colour ? -1 : 1;     // starting on your own colour: this stroke wipes
    S.px[i] = S.mode > 0 ? S.colour : -1;
    redraw();
    const now = performance.now();
    if (now - S.lastHiss > 90) { S.lastHiss = now; blip("spray", 0.6); }
  }
  function heart() {
    wakeAudio(); blip("spray", 0.8);
    HEART.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === "X") S.px[(y + 3) * G + (x + 2)] = S.colour; }));
    redraw(); commit();
  }
  function clear() { S.px.fill(-1); redraw(); commit(); }

  useEffect(() => {
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    const isIn = (o, root) => { for (; o; o = o.parent) if (o === root) return true; return false; };
    let suppress = false, downAt = null;
    const move = (e) => { if (!S.painting) return; e.preventDefault(); paint(cellAt(e), false); };
    const up = () => {
      if (!S.painting) return;
      S.painting = false; S.last = -1;
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
      commit();
    };
    const down = (e) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      const i = cellAt(e);
      if (i >= 0) {                                           // on the tile: spray (no orbit, no panel)
        e.stopPropagation(); suppress = true;
        wakeAudio();
        S.painting = true; S.last = -1;
        paint(i, true);
        window.addEventListener("pointermove", move, { passive: false });
        window.addEventListener("pointerup", up); window.addEventListener("pointercancel", up);
        return;
      }
      downAt = { x: e.clientX, y: e.clientY };
    };
    const click = (e) => {
      if (suppress) { e.stopPropagation(); suppress = false; return; }
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
      const r = gl.domElement.getBoundingClientRect();
      S.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      S.ray.setFromCamera(S.ndc, camera);
      const h = S.ray.intersectObject(scene, true).find((x) => x.object !== S.overlay);
      if (!h) return;
      const k = N.cans.findIndex((c) => c && isIn(h.object, c));
      if (k >= 0) pickColour(k);
    };
    const touch = (e) => { if (S.painting && e.cancelable) e.preventDefault(); };
    const act = (e) => {
      const d = e.detail;
      if (d === "heart") heart();
      else if (d === "clear") clear();
      else if (d === "next") pickColour((S.colour + 1) % PALETTE.length);
    };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("click", click, { capture: true });
    el.addEventListener("touchmove", touch, { passive: false });
    window.addEventListener("gf-act", act);
    return () => {
      el.removeEventListener("pointerdown", down, { capture: true }); el.removeEventListener("click", click, { capture: true });
      el.removeEventListener("touchmove", touch); window.removeEventListener("gf-act", act);
      window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up);
    };
  }, [N, S, gl, camera, scene]);   // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
