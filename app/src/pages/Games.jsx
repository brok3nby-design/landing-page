import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Exhibit from "../exhibit/Exhibit.jsx";
import InfoPanel from "../components/InfoPanel.jsx";
import { slotId, gameForSlotId, gamePanel } from "../exhibit/games.js";
import { PAGES } from "../content/site.js";
import { useSiteData, section, media, projectRoute } from "../content/data.js";
import { unlock } from "../site/passport.js";
import { getPref } from "../site/prefs.js";
import { cartridgeClick } from "../site/music.js";

export default function Games() {
  const page = PAGES.games;
  const data = useSiteData();
  const navigate = useNavigate();
  const [selectedId, setSelectedId] = useState(null);
  const select = useCallback((id) => {
    setSelectedId(id);
    if (id) { unlock("cartridge"); if (getPref("sound")) cartridgeClick(); }
  }, []);
  const close = useCallback(() => setSelectedId(null), []);
  useEffect(() => { if (location.hash === "#all") document.getElementById("all")?.scrollIntoView(); }, [data]);
  if (!data) return <div className="page" aria-busy="true" />;
  const games = data.games;
  const g = gameForSlotId(games, selectedId);
  const item = gamePanel(g, g && data.project(g.id));
  const intro = section(data.copy, "home", "Choose your next world.")[0]?.text;
  const inCrate = new Set(games.map((x) => x.id));
  const others = data.projects.filter((p) => !p.secret && !inCrate.has(p.id));
  const random = () => {
    const pool = data.projects.filter((p) => !p.secret);
    unlock("random");
    navigate(projectRoute(pool[Math.floor(Math.random() * pool.length)].id), { viewTransition: true });
  };

  return (
    <>
      <div className="page">
        <section className="content">
          <p className="eyebrow">{page.eyebrow}</p>
          <h1 className="title">Choose your next world<span className="accent">.</span></h1>
          <p className="intro">{intro}</p>
          <div className="hotspots">
            <h2 id="games-list">In the crate</h2>
            <ul aria-labelledby="games-list" className="list">
              {games.map((x) => {
                const id = slotId(x.slot), p = data.project(x.id);
                return (
                  <li key={id}>
                    <button className="chip wide" aria-pressed={selectedId === id} onClick={() => select(selectedId === id ? null : id)}>
                      <span className="num">{String(x.slot).padStart(2, "0")}</span>{p.title}<span className="dim"> · {p.status}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="ctas">
            <a className="btn" href="#all">All projects</a>
            <button type="button" className="btn" onClick={random}>Take me somewhere strange ↗</button>
          </div>
        </section>
        <Exhibit config={page.exhibit} selectedId={selectedId} onSelect={select}>
          <InfoPanel item={item} onClose={close} />
        </Exhibit>
      </div>
      <div className="more">
        <section id="all" className="band">
          <p className="eyebrow">The whole shelf</p>
          <h2>Every project</h2>
          <div className="cards grid">
            {[...games.map((x) => data.project(x.id)), ...others].map((p) => (
              <Link viewTransition key={p.id} to={projectRoute(p.id)} className="card project-card" style={{ "--accent": p.accent }}>
                {p.cover && <img src={media(p.cover)} alt={`${p.title} artwork`} loading="lazy" width="1024" height="1536" />}
                <div>
                  <p className="eyebrow">{p.status}</p>
                  <h3>{p.title}</h3>
                  <p className="hook">{p.hook}</p>
                  <p>{p.description}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
