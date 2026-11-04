import { Component, Suspense, lazy, useMemo, useRef, useState } from "react";

// The shared exhibit viewer used by every page. This wrapper is tiny; three.js / R3F live in the
// lazily loaded Scene chunk, so the page text renders immediately and the 3D streams in after.
const Scene = lazy(() => import("./Scene.jsx"));

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return !!(window.WebGL2RenderingContext && c.getContext("webgl2"));
  } catch { return false; }
}

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(err) { console.error("Exhibit failed, showing fallback:", err); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Fallback({ config, reason }) {
  return (
    <div className="fallback">
      <img src={`${import.meta.env.BASE_URL}${config.fallback}`} alt={config.fallbackAlt} />
      <span className="note">{reason}</span>
    </div>
  );
}

export default function Exhibit({ config, selectedId, onSelect, children }) {
  const forced2D = useMemo(() => new URLSearchParams(location.search).has("no3d"), []);
  const [canRender] = useState(() => !forced2D && webglAvailable());
  const [imageView, setImageView] = useState(false);
  const [under, setUnder] = useState(false);
  const [touched, setTouched] = useState(false);
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

  const show3D = canRender && !imageView;
  const fallback = <Fallback config={config} reason={canRender ? "Image view" : "Interactive 3D isn't available on this device — showing a render."} />;
  return (
    <section className="exhibit" aria-label="Interactive exhibit">
      {show3D ? (
        <div className="exhibit-canvas" tabIndex={0} onKeyDown={onKey} onPointerDown={() => setTouched(true)}
             aria-label="Interactive 3D model. Drag or use arrow keys to rotate, scroll or plus/minus to zoom, R to reset. The exhibits can also be opened from the list beside it.">
          <Boundary fallback={fallback}>
            <Suspense fallback={<div className="loading">Loading exhibit</div>}>
              <Scene config={config} selectedId={selectedId} onSelect={onSelect} under={under} apiRef={api} />
            </Suspense>
          </Boundary>
          <span className="hint" style={{ opacity: touched ? 0 : 1 }}>
            {coarse ? "Drag to rotate · Pinch to zoom · Tap objects" : "Drag to rotate · Scroll to zoom · Click objects"}
          </span>
        </div>
      ) : fallback}
      {children}
      <div className="exhibit-tools">
        {show3D && config.underView && (
          <button className="tool" aria-pressed={under} onClick={() => setUnder(!under)}
                  title="Allow the camera below the desktop, with an inspection light">Look underneath</button>
        )}
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
