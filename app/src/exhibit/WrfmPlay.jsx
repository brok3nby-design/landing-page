// WRFM exhibit: the late-night studio. No physics engine needed.
//
//   - Click the microphone: ON AIR lights up and Vera goes on air with one of the station's real clips
//     (host, sponsor, caller, Mitch from IT; now and then she teases the phone). The VU needles follow her
//     voice (Web Audio analyser). Click again to go off air.
//   - Somewhere in the studio there is a red rotary phone. Find it, click it: it rings, Vera picks up,
//     and you hear about Studio B (and get the "Studio B" Passport stamp).
//   - Click the turntable: it starts / stops the site's background music; the record spins while it plays.
// The clips and their quotes come from data/site_copy.json (wrfm_clips), the same tape as the WRFM page.
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useThree, useFrame } from "@react-three/fiber";
import { useMusic, playMusic, pauseMusic } from "../site/music.js";
import { unlock } from "../site/passport.js";

const BASE = import.meta.env.BASE_URL;
const ROTATION = ["host", "sponsor", "caller", "regular"];
const NEEDLE_AXIS = new THREE.Vector3(0, 0, -1);            // Blender local +Y, in glTF node space

export default function WrfmPlay({ scene }) {
  const camera = useThree((s) => s.camera);
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  const music = useMusic();
  const [clips, setClips] = useState(null);
  useEffect(() => { fetch(`${BASE}data/site_copy.json`).then((r) => r.json()).then((c) => setClips(c.wrfm_clips || [])).catch(() => setClips([])); }, []);

  const N = useMemo(() => {
    const g = (n) => scene.getObjectByName(n);
    const face = g("WR_OnAir_Face");
    return { mic: g("WR_Mic"), phone: g("WR_Phone"), turntable: g("WR_Turntable"), record: g("WR_Record"), face, onair: g("WR_OnAir"),
             needles: [g("WR_VU_Needle_L"), g("WR_VU_Needle_R")].filter(Boolean) };
  }, [scene]);
  const S = useMemo(() => ({
    ctx: null, analyser: null, data: null, audio: null, queue: [], onAir: false, level: 0, next: 0, clicks: 0,
    ring: null, light: null, needleRest: [], needleAngle: [-0.7, -0.7], phoneRest: null, ray: new THREE.Raycaster(), ndc: new THREE.Vector2(),
  }), []);

  // ------------------------------------------------------------ setup: ON AIR light, needle rest poses
  useEffect(() => {
    const light = new THREE.PointLight("#ff3b22", 0, 1.6, 1.6);
    if (N.onair) { light.position.copy(N.onair.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3(0, -0.05, 0.12)); }
    scene.add(light);
    S.light = light;
    if (N.face) {
      N.face.material = N.face.material.clone();
      N.face.userData.ownMat = false;
      N.face.userData.e0 = N.face.material.emissiveIntensity;
      N.face.material.emissiveIntensity = N.face.userData.e0 * 0.12;   // off air: a dim red box
    }
    S.needleRest = N.needles.map((n) => n.quaternion.clone());
    S.phoneRest = N.phone ? N.phone.quaternion.clone() : null;
    invalidate();
    window.__wrfm = { onAir: () => S.onAir, level: () => S.level, needles: () => S.needleAngle.slice(), music: () => S.music };
    return () => {
      scene.remove(light); stop();
      if (N.face) N.face.material.emissiveIntensity = N.face.userData.e0;
      N.needles.forEach((n, i) => n.quaternion.copy(S.needleRest[i]));
      delete window.__wrfm;
    };
  }, [N, S, scene, invalidate]);   // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------------------ audio
  function ensureCtx() {
    try {
      if (!S.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        S.ctx = new AC();
        S.analyser = S.ctx.createAnalyser();
        S.analyser.fftSize = 512;
        S.analyser.connect(S.ctx.destination);
        S.data = new Uint8Array(S.analyser.fftSize);
      }
      if (S.ctx.state === "suspended") S.ctx.resume();
    } catch { S.ctx = null; }
  }
  function air(on, info) {
    S.onAir = on;
    window.dispatchEvent(new CustomEvent("wr-air", { detail: { on, ...(info || {}) } }));
    invalidate();
  }
  function playQueue(items) {                                 // [{ src, title, quote }] one after another
    stop();
    S.queue = items.slice();
    const step = () => {
      const it = S.queue.shift();
      if (!it) { S.audio = null; air(false); return; }
      const a = new Audio(`${BASE}${it.src}`);
      a.preload = "auto";
      try { if (S.ctx) S.ctx.createMediaElementSource(a).connect(S.analyser); } catch { /* plays without the meters */ }
      S.audio = a;
      a.addEventListener("ended", step, { once: true });
      a.addEventListener("error", step, { once: true });
      a.play().catch(step);
      air(true, { title: it.title, quote: it.quote });
    };
    pauseMusic();                                             // the station's voice beats the background music
    step();
  }
  function stop() {
    S.queue = [];
    if (S.audio) { S.audio.pause(); S.audio = null; }
    if (S.ring) { S.ring.forEach((o) => { try { o.stop(); } catch { /* done */ } }); S.ring = null; }
    if (S.onAir) air(false);
  }
  const clip = (id) => clips?.find((c) => c.id === id);
  function micClick() {
    ensureCtx();
    if (S.onAir) { stop(); return; }
    if (!clips?.length) return;
    S.clicks++;
    const secret = clip("secret");
    let found = false;
    try { found = !!localStorage.getItem("b3d-wrfm-phone-found"); } catch { /* storage blocked */ }
    if (secret && S.clicks % 3 === 0 && !found) {             // now and then (until you find it): the tease
      playQueue([{ src: secret.audio[0], title: "Vera Lang", quote: secret.quote }]);
      return;
    }
    const c = clip(ROTATION[S.next++ % ROTATION.length]);
    if (c) playQueue(c.audio.map((src) => ({ src, title: c.title, quote: c.quote })));
  }
  function phoneClick() {
    ensureCtx();
    stop();
    const secret = clip("secret");
    if (!S.ctx) { if (secret) playQueue(secret.audio.slice(1).map((src) => ({ src, title: "Studio B", quote: secret.quote }))); return; }
    // the bell: two rings of the classic 440 + 480 Hz, then Vera picks up
    const t0 = S.ctx.currentTime + 0.02, oscs = [];
    const g = S.ctx.createGain();
    g.gain.value = 0;
    g.connect(S.analyser);
    for (const f of [440, 480]) { const o = S.ctx.createOscillator(); o.frequency.value = f; o.connect(g); o.start(t0); o.stop(t0 + 3.2); oscs.push(o); }
    for (const [a, b] of [[0, 1.0], [1.6, 2.6]]) {
      g.gain.setValueAtTime(0, t0 + a); g.gain.linearRampToValueAtTime(0.08, t0 + a + 0.02);
      g.gain.setValueAtTime(0.08, t0 + b - 0.02); g.gain.linearRampToValueAtTime(0, t0 + b);
    }
    S.ring = oscs;
    S.ringUntil = performance.now() + 2700;
    air(true, { title: "The phone", quote: "Ring… ring…" });
    pauseMusic();
    setTimeout(() => {
      if (!S.ring) return;                                    // hung up meanwhile
      S.ring = null;
      try { localStorage.setItem("b3d-wrfm-phone-found", "1"); } catch { /* fine */ }
      unlock("studio-b");
      if (secret) playQueue(secret.audio.slice(1).map((src) => ({ src, title: "Vera picks up", quote: "You found the phone." })));
      else air(false);
    }, 2800);
  }
  function turntableClick() { if (music.playing) pauseMusic(); else { stop(); playMusic(); } }

  // ------------------------------------------------------------ animation (only while something plays)
  const tmp = useMemo(() => ({ q: new THREE.Quaternion() }), []);
  useFrame((_, dt) => {
    let busy = false;
    const k = Math.min(dt, 0.05);
    // the level: the clip's loudness (RMS), or a lively fake while the background music plays
    let target = 0;
    if (S.onAir && S.analyser) {
      S.analyser.getByteTimeDomainData(S.data);
      let sum = 0;
      for (let i = 0; i < S.data.length; i++) { const v = (S.data[i] - 128) / 128; sum += v * v; }
      target = Math.min(1, Math.sqrt(sum / S.data.length) * 4.5);
    } else if (music.playing) {
      target = 0.45 + 0.25 * Math.sin(performance.now() / 260) * Math.sin(performance.now() / 610);
    }
    S.level += (target - S.level) * (1 - Math.exp(-k * 12));
    N.needles.forEach((n, i) => {
      const goal = -0.7 + 1.4 * Math.min(1, S.level * (i ? 0.95 : 1.05));     // -40° (quiet) .. +40° (loud)
      S.needleAngle[i] += (goal - S.needleAngle[i]) * (1 - Math.exp(-k * 18));
      n.quaternion.copy(S.needleRest[i]).multiply(tmp.q.setFromAxisAngle(NEEDLE_AXIS, S.needleAngle[i] - 0.7));
    });
    if (S.onAir || music.playing || S.level > 0.01) busy = true;
    // the ON AIR sign and its red light
    if (N.face) {
      const want = S.onAir ? 1 : 0.12;
      const cur = N.face.material.emissiveIntensity / N.face.userData.e0;
      const nx = cur + (want - cur) * (1 - Math.exp(-k * 10));
      N.face.material.emissiveIntensity = nx * N.face.userData.e0;
      if (S.light) S.light.intensity = Math.max(0, (nx - 0.12) / 0.88) * 0.9;
      if (Math.abs(want - nx) > 0.005) busy = true;
    }
    if (N.record && music.playing) { N.record.rotateY(-3.5 * k); busy = true; }   // 33 rpm
    if (N.phone && S.ring) {                                 // the phone rattles while it rings
      N.phone.quaternion.copy(S.phoneRest).multiply(tmp.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.sin(performance.now() / 22) * 0.05));
      busy = true;
    } else if (N.phone && S.phoneRest && !N.phone.quaternion.equals(S.phoneRest)) { N.phone.quaternion.copy(S.phoneRest); busy = true; }
    if (busy) invalidate();
  });

  // ------------------------------------------------------------ input (clicks; the info panel opens as usual)
  useEffect(() => {
    const el = gl.domElement.closest(".exhibit-canvas") || gl.domElement.parentElement;
    let downAt = null;
    const hit = (e) => {
      const r = gl.domElement.getBoundingClientRect();
      S.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      S.ray.setFromCamera(S.ndc, camera);
      const h = S.ray.intersectObject(scene, true)[0];
      if (!h) return null;
      for (let o = h.object; o; o = o.parent) {
        if (o === N.mic) return "mic"; if (o === N.phone) return "phone"; if (o === N.turntable) return "turntable"; if (o === N.onair) return "mic";
      }
      return null;
    };
    const down = (e) => { downAt = { x: e.clientX, y: e.clientY }; };
    const click = (e) => {
      if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 6) return;
      const what = hit(e);
      if (what === "mic") micClick(); else if (what === "phone") phoneClick(); else if (what === "turntable") turntableClick();
    };
    const act = (e) => { if (e.detail === "air") micClick(); if (e.detail === "phone") phoneClick(); };
    el.addEventListener("pointerdown", down, { capture: true });
    el.addEventListener("click", click, { capture: true });
    window.addEventListener("wr-act", act);
    return () => { el.removeEventListener("pointerdown", down, { capture: true }); el.removeEventListener("click", click, { capture: true }); window.removeEventListener("wr-act", act); };
  }, [gl, camera, scene, N, S, clips, music.playing]);   // eslint-disable-line react-hooks/exhaustive-deps

  S.music = music.playing;
  useEffect(() => { invalidate(); }, [music.playing, invalidate]);
  return null;
}
