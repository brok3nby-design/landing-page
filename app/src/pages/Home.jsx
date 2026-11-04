import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Exhibit from "../exhibit/Exhibit.jsx";
import InfoPanel from "../components/InfoPanel.jsx";
import { loadInteractions, resolveInteraction } from "../exhibit/interactions.js";
import { PAGES, HOTSPOT_LABELS } from "../content/site.js";

export default function Home() {
  const page = PAGES.home;
  const [data, setData] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => { loadInteractions().then(setData).catch(() => setData({})); }, []);
  const close = useCallback(() => setSelectedId(null), []);
  const item = selectedId ? { label: HOTSPOT_LABELS[selectedId], ...resolveInteraction(data, selectedId) } : null;

  return (
    <div className="page">
      <section className="content">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1 className="title">BROK3N<br />BY DESIGN<span className="accent">.</span></h1>
        <p className="intro">{page.intro}</p>
        <div className="ctas">
          {page.ctas.map((c) => <Link viewTransition key={c.to} to={c.to} className={`btn${c.primary ? " primary" : ""}`}>{c.label}</Link>)}
        </div>
        <div className="hotspots">
          <h2 id="explore">Explore the desk</h2>
          <ul aria-labelledby="explore">
            {page.exhibit.hotspots.map((id) => (
              <li key={id}>
                <button className="chip" aria-pressed={selectedId === id}
                        onClick={() => setSelectedId(selectedId === id ? null : id)}>{HOTSPOT_LABELS[id]}</button>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <Exhibit config={page.exhibit} selectedId={selectedId} onSelect={setSelectedId}>
        <InfoPanel item={item} onClose={close} />
      </Exhibit>
    </div>
  );
}
