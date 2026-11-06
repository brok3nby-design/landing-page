import { Component, Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";

// The shared exhibit viewer used by every page. This wrapper is tiny; three.js / R3F live in the
// lazily loaded Scene chunk, so the page text renders immediately and the 3D streams in after.
const Scene = lazy(() => import("./Scene.jsx"));

// One check per visit (cached), with the probe context released straight away: can this browser draw 3D at
// all, and is it drawing it on the graphics card? Browsers with hardware acceleration off (or a blocked
// driver) fall back to software drawing (SwiftShader / llvmpipe / "Microsoft Basic Render"): everything
// then runs on the CPU and the 3D scenes become very slow - each one even takes many seconds to shut down
// when you leave its page. Those browsers get the still image first, with a "Try 3D anyway" button.
let GL_PROBE = null;
export function probeGL() {
  if (GL_PROBE) return GL_PROBE;
  let ok = false, software = false, renderer = "";
  try {
    const c = document.createElement("canvas"); c.width = c.height = 1;
    const gl = window.WebGL2RenderingContext && c.getContext("webgl2");
    if (gl) {
      ok = true;
      const info = gl.getExtension("WEBGL_debug_renderer_info");
      renderer = String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER) || "");
      software = /swiftshader|llvmpipe|softpipe|software rasterizer|basic render/i.test(renderer);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch { /* no WebGL */ }
  return (GL_PROBE = { ok, software, renderer });
}
const FORCE3D = "b3d-force-3d";
const forced3D = () => { try { return sessionStorage.getItem(FORCE3D) === "1"; } catch { return false; } };

class Boundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(err) { console.error("Exhibit failed, showing fallback:", err); }
  render() { return this.state.error ? this.props.fallback(this.state.error) : this.props.children; }
}

function Fallback({ config, reason, detail, onRetry, retryLabel = "Retry 3D" }) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <div className="fallback">
      {imgOk
        ? <img src={`${import.meta.env.BASE_URL}${config.fallback}`} alt={config.fallbackAlt} onError={() => setImgOk(false)} />
        : <p className="fallback-text">{config.fallbackAlt}</p>}
      <span className="note">
        {reason}{detail ? ` (${detail})` : ""}
        {onRetry && <> · <button className="linkbtn" onClick={onRetry}>{retryLabel}</button></>}
      </span>
    </div>
  );
}

export default function Exhibit({ config, selectedId, onSelect, animState, tools, children }) {
  const params = useMemo(() => new URLSearchParams(location.search), []);
  const forced2D = params.has("no3d");
  const [safe, setSafe] = useState(params.get("quality") === "low");
  const [lost, setLost] = useState(0);          // number of lost GPU contexts this visit
  const [mountKey, setMountKey] = useState(0);
  const [canRender] = useState(() => !forced2D && probeGL().ok);
  // software-drawn 3D (no graphics card): start on the still image (tests, ?test, run on purpose without a GPU)
  const [slowGL] = useState(() => probeGL().software && !params.has("test") && !params.has("force3d") && !forced3D());
  const [imageView, setImageView] = useState(slowGL);
  const [under, setUnder] = useState(false);
  const [touched, setTouched] = useState(false);
  const [wheelHint, setWheelHint] = useState(false);
  const hintTimer = useRef(0);
  const onWheelHint = useCallback(() => {
    setWheelHint(true); clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setWheelHint(false), 1600);
  }, []);
  const mac = useMemo(() => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent), []);
  const api = useRef(null);            // { rotate, dolly, reset } provided by the Scene's camera rig
  const coarse = useMemo(() => window.matchMedia("(pointer: coarse)").matches, []);

  const onKey = (e) => {
    const a = api.current;
    if (!a) return;
    const map = { ArrowLeft: () => a.rotate(-0.2, 0), ArrowRight: () => a.rotate(0.2, 0), ArrowUp: () => a.rotate(0, -0.12),
                  ArrowDown: () => a.rotate(0, 0.12), "+": () => a.dolly(0.25), "=": () => a.dolly(0.25), "-": () => a.dolly(-0.25),
                  r: () => { onSelect(null); a.reset(); }, R: () => { onSelect(null); a.reset(); } };
    if (map[e.key]) { e.preventDefault(); map[e.key](); setTouched(true); }
  };

  // the info panel always sits above the tool buttons (however many rows they wrap to), never over them
  const sectionRef = useRef(null), toolsRef = useRef(null);
  useEffect(() => {
    const t = toolsRef.current, sec = sectionRef.current;
    if (!t || !sec || typeof ResizeObserver === "undefined") return;
    const set = () => sec.style.setProperty("--tools-h", `${Math.ceil(t.getBoundingClientRect().height)}px`);
    const ro = new ResizeObserver(set); ro.observe(t); set();
    return () => ro.disconnect();
  }, []);

  const retry = () => { setSafe(true); setLost(0); setMountKey((k) => k + 1); };
  const show3D = canRender && !imageView && !lost;
  const fallback = lost
    ? <Fallback config={config} reason="The 3D view stopped (the graphics driver reset)" onRetry={retry} />
    : slowGL && imageView
      ? <Fallback config={config} reason="Your browser is drawing 3D without the graphics card (hardware acceleration looks switched off), so this is a still picture"
                  retryLabel="Try 3D anyway" onRetry={() => { try { sessionStorage.setItem(FORCE3D, "1"); } catch { /* */ } setImageView(false); }} />
      : <Fallback config={config} reason={canRender ? "Image view" : "Interactive 3D isn't available on this device — showing a render."} />;
  const crashed = (err) => <Fallback config={config} reason="The 3D view couldn't start" detail={String(err?.message || err).slice(0, 120)} onRetry={retry} />;
  return (
    <section className="exhibit" aria-label="Interactive exhibit" ref={sectionRef}>
      {show3D ? (
        <div className="exhibit-canvas" tabIndex={0} onKeyDown={onKey} onPointerDown={() => setTouched(true)}
             aria-label="Interactive 3D model. Drag or use arrow keys to rotate, scroll or plus/minus to zoom, R to reset. The exhibits can also be opened from the list beside it.">
          <Boundary key={mountKey} fallback={crashed}>
            <Suspense fallback={<div className="loading">Loading exhibit</div>}>
              <Scene config={config} selectedId={selectedId} onSelect={onSelect} under={under} apiRef={api}
                     safe={safe} onContextLost={() => setLost((n) => n + 1)} animState={animState} onWheelHint={onWheelHint} />
            </Suspense>
          </Boundary>
          <span className="hint" style={{ opacity: touched ? 0 : 1 }}>
            {coarse ? "Swipe sideways to rotate · Pinch to zoom · Tap objects" : `Drag to rotate · ${mac ? "⌘" : "Ctrl"} + scroll to zoom · Click objects`}
          </span>
          <span className="wheel-hint" aria-hidden="true" style={{ opacity: wheelHint ? 1 : 0 }}>
            Hold {mac ? "⌘" : "Ctrl"} and scroll to zoom
          </span>
        </div>
      ) : fallback}
      {children}
      <div className="exhibit-tools" ref={toolsRef}>
        {show3D && tools}
        {show3D && config.underView && (
          <button className="tool" aria-pressed={under} onClick={() => setUnder(!under)}
                  title="Allow the camera below the desktop, with an inspection light">Look underneath</button>
        )}
        {show3D && (<>
          <button className="tool icon" onClick={() => api.current?.dolly(0.35)} aria-label="Zoom in" title="Zoom in">+</button>
          <button className="tool icon" onClick={() => api.current?.dolly(-0.35)} aria-label="Zoom out" title="Zoom out">−</button>
        </>)}
        {show3D && <button className="tool" onClick={() => { onSelect(null); api.current?.reset(); setUnder(false); }}>Reset view</button>}
        {canRender && (
          <button className="tool" aria-pressed={imageView} onClick={() => setImageView(!imageView)}>
            {imageView ? "3D view" : "Image view"}
          </button>
        )}
      </div>
    </section>
  );
}
