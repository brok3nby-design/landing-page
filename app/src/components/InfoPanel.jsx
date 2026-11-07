import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

// Information panel for a selected object. Focus moves to the panel title when it opens; Escape
// or the close button closes it (the exhibit then returns the camera to its default view).
// A button/link has either an internal `route` or an external `href` (opens in a new tab).
export function Action({ a, primary }) {
  const cls = `btn${primary ? " primary" : ""}`;
  if (a.route) return <Link viewTransition className={cls} to={a.route}>{a.label}</Link>;
  if (a.href) {
    const ext = /^https?:/.test(a.href);
    return <a className={cls} href={a.href} {...(ext ? { target: "_blank", rel: "noopener" } : {})}>{a.label}</a>;
  }
  return <span className="btn" aria-disabled="true">{a.label} · soon</span>;
}

export default function InfoPanel({ item, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, [item?.id]);
  useEffect(() => {
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  // phones / small tablets: a compact panel (name + main button) that leaves the item in view; "Details"
  // opens the full text. Desktop always shows everything (the Details button is hidden there).
  const [more, setMore] = useState(false);
  useEffect(() => { setMore(false); }, [item?.id]);
  if (!item) return null;
  const { panel, button, kind, links } = item;
  const hasMore = !!(panel?.text || item.meta || links?.length);
  return (
    <aside className={`panel${more ? " more" : ""}`} role="dialog" aria-modal="false" aria-labelledby="panel-title">
      <button className="close" onClick={onClose} aria-label="Close panel">×</button>
      <span className="kind">{panel?.eyebrow || (kind === "discovery" ? "Discovery" : "Exhibit")}</span>
      <h2 id="panel-title" tabIndex={-1} ref={ref}>{panel?.title || item.label}</h2>
      {panel?.text && <p>{panel.text}</p>}
      {item.meta && <p className="meta">{item.meta}</p>}
      {children}
      {hasMore && (
        <button type="button" className="panel-more" aria-expanded={more} onClick={() => setMore(!more)}>
          {more ? "Less ▴" : "Details ▾"}
        </button>
      )}
      {(button || links?.length) && (
        <div className="panel-actions">
          {button && <Action a={button} primary />}
          {links?.map((l) => <Action key={l.label} a={l} />)}
        </div>
      )}
    </aside>
  );
}
