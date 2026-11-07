// The desk radio's now-playing bar. It lives in the site layout, so the radio keeps playing (and stays
// controllable) on every page: live WRFM 97.1 or a clip, with Stop, volume, and Next for clips.
import { useEffect, useState } from "react";
import * as radio from "../site/radio.js";

export default function RadioBar() {
  const [s, setS] = useState(radio.state());
  useEffect(() => radio.subscribe(setS), []);
  if (!s.mode) return null;
  const live = s.mode === "live";
  return (
    <div className={`radio-bar${live ? " live" : ""}`} role="region" aria-label="WRFM radio">
      <span className="radio-dot" aria-hidden="true" />
      <span className="radio-now" aria-live="polite">
        <small>{live ? "WRFM 97.1 · Live" : "WRFM 97.1 · on the desk radio"}</small>
        <span className="radio-title">{s.title}</span>
        {live && s.detail && <span className="radio-detail">{s.detail}</span>}
      </span>
      <span className="radio-ctl">
        <label className="radio-vol"><span className="sr-only">Radio volume</span>
          <input type="range" min="0" max="1" step="0.05" value={s.volume} onChange={(e) => radio.setVolume(parseFloat(e.target.value))} />
        </label>
        {live
          ? <a className="tool" href="https://brok3nby-design.github.io/wrfm/" target="_blank" rel="noopener" onClick={() => radio.stop()}>Station ↗</a>
          : <button type="button" className="tool" onClick={() => radio.play()}>Next clip</button>}
        <button type="button" className="tool" onClick={() => radio.stop()} aria-label="Stop the radio">■ Stop</button>
      </span>
    </div>
  );
}

// the two buttons in the radio's info panel on the desk
export function RadioButtons() {
  const [s, setS] = useState(radio.state());
  useEffect(() => radio.subscribe(setS), []);
  return (
    <div className="panel-actions radio-actions">
      <button type="button" className={`btn${s.mode === "live" ? "" : " primary"}`} onClick={() => radio.tuneIn()} aria-pressed={s.mode === "live"}>
        {s.mode === "live" ? "● On air" : "Tune in live"}
      </button>
      <button type="button" className="btn" onClick={() => radio.play()}>{s.mode === "clips" ? "Another clip" : "Funny clip"}</button>
    </div>
  );
}
