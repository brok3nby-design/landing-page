import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";

// Information panel for a selected object. Focus moves to the panel title when it opens; Escape
// or the close button closes it (the exhibit then returns the camera to its default view).
export default function InfoPanel({ item, onClose }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, [item?.id]);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  if (!item) return null;
  const { panel, button, kind } = item;
  return (
    <aside className="panel" role="dialog" aria-modal="false" aria-labelledby="panel-title">
      <button className="close" onClick={onClose} aria-label="Close panel">×</button>
      <span className="kind">{kind === "discovery" ? "Discovery" : "Exhibit"}</span>
      <h2 id="panel-title" tabIndex={-1} ref={ref}>{panel?.title || item.label}</h2>
      {panel?.text && <p>{panel.text}</p>}
      {button && (button.route
        ? <Link className="btn primary" to={button.route}>{button.label}</Link>
        : <span className="btn" aria-disabled="true">{button.label} · soon</span>)}
    </aside>
  );
}
