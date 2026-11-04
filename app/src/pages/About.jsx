import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import Exhibit from "../exhibit/Exhibit.jsx";
import InfoPanel from "../components/InfoPanel.jsx";
import { PAGES, HOTSPOT_LABELS } from "../content/site.js";

export default function About() {
  const page = PAGES.about;
  const [selectedId, setSelectedId] = useState(null);
  const [open, setOpen] = useState(true);              // the notebook animates open on arrival
  const close = useCallback(() => setSelectedId(null), []);
  const p = selectedId && page.panels[selectedId];
  const item = p ? { id: selectedId, kind: p.kind || "navigation", panel: p } : null;
  const select = (id) => { if (id) setOpen(true); setSelectedId(id); };

  return (
    <div className="page">
      <section className="content">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1 className="title">About the studio<span className="accent">.</span></h1>
        <p className="intro">{page.intro}</p>
        <div className="hotspots">
          <h2 id="nb">In the notebook</h2>
          <ul aria-labelledby="nb">
            {Object.keys(page.panels).map((id) => (
              <li key={id}>
                <button className="chip" aria-pressed={selectedId === id} onClick={() => select(selectedId === id ? null : id)}>
                  {HOTSPOT_LABELS[id]}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="ctas">
          <Link viewTransition className="btn" to="/contact">Get in touch</Link>
          <Link viewTransition className="btn" to="/">Back to the studio</Link>
        </div>
      </section>
      <Exhibit config={page.exhibit} selectedId={selectedId} onSelect={select} animState={{ open }}
               tools={<button className="tool" aria-pressed={!open} onClick={() => { setSelectedId(null); setOpen(!open); }}>
                        {open ? "Close notebook" : "Open notebook"}</button>}>
        <InfoPanel item={item} onClose={close} />
      </Exhibit>
    </div>
  );
}
