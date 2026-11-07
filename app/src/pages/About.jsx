import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Exhibit from "../exhibit/Exhibit.jsx";
import InfoPanel from "../components/InfoPanel.jsx";
import Prose from "../components/Prose.jsx";
import { PAGES, HOTSPOT_LABELS } from "../content/site.js";
import { useSiteData, section, prose } from "../content/data.js";
import { unlock } from "../site/passport.js";

export default function About() {
  const page = PAGES.about;
  const data = useSiteData();
  const [selectedId, setSelectedId] = useState(null);
  const [open, setOpen] = useState(true);              // the notebook animates open on arrival
  useEffect(() => { unlock("about"); }, []);
  const close = useCallback(() => setSelectedId(null), []);
  const select = (id) => { if (id) setOpen(true); setSelectedId(id); };
  const def = selectedId && page.panels[selectedId];
  const items = def ? prose(section(data?.copy, "about", def.heading)) : [];
  const item = def ? { id: selectedId, kind: def.kind || "navigation",
                       panel: { title: def.heading, text: items.map((i) => i.text).join(" ") } } : null;
  const sections = data?.copy.about.sections.filter((s) => s.heading) || [];
  return (
    <>
      <div className="page">
        <section className="content">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1 className="title">About the studio<span className="accent">.</span></h1>
          <p className="intro">Strange games. Dark humor. Worlds worth exploring.</p>
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
            <a className="btn" href="#story">Read the whole story ↓</a>
          </div>
        </section>
        <Exhibit config={page.exhibit} selectedId={selectedId} onSelect={select} animState={{ open }}
                 tools={<button className="tool" aria-pressed={!open} onClick={() => { setSelectedId(null); setOpen(!open); }}>
                          {open ? "Close notebook" : "Open notebook"}</button>}>
          <InfoPanel item={item} onClose={close} />
        </Exhibit>
      </div>
      <div className="more" id="story">
        {sections.map((s) => (
          <section key={s.heading} className="band text">
            <h2>{s.heading}</h2>
            <Prose items={s.items} />
            {s.heading.startsWith("Design. Build.") && <p><Link viewTransition to="/about/built-by-design">More about the creative process →</Link></p>}
            {s.heading.startsWith("Design. Build.") && <p><Link viewTransition to="/about/gaming-history">The games that made me want to make games →</Link></p>}
          </section>
        ))}
        <section className="band">
          <div className="ctas">
            <Link viewTransition className="btn primary" to="/games">Explore the games</Link>
            <Link viewTransition className="btn" to="/follow">Follow the studio</Link>
            <Link viewTransition className="btn" to="/contact">Get in touch</Link>
            {data && <a className="btn" href={data.copy.links.brand_film} target="_blank" rel="noopener">Watch the brand film ↗</a>}
            <Link viewTransition className="btn" to="/press">Press kit</Link>
          </div>
        </section>
      </div>
    </>
  );
}
