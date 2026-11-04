import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Exhibit from "../exhibit/Exhibit.jsx";
import InfoPanel from "../components/InfoPanel.jsx";
import { loadGames, slotId, gameForSlotId, gamePanel } from "../exhibit/games.js";
import { PAGES } from "../content/site.js";

export default function Games() {
  const page = PAGES.games;
  const [games, setGames] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  useEffect(() => { loadGames().then(setGames).catch(() => setGames([])); }, []);
  const close = useCallback(() => setSelectedId(null), []);
  const item = gamePanel(gameForSlotId(games, selectedId));

  return (
    <div className="page">
      <section className="content">
        <p className="eyebrow">{page.eyebrow}</p>
        <h1 className="title">The Collection<span className="accent">.</span></h1>
        <p className="intro">{page.intro}</p>
        <div className="hotspots">
          <h2 id="games-list">Games</h2>
          <ul aria-labelledby="games-list" className="list">
            {games.map((g) => {
              const id = slotId(g.slot);
              return (
                <li key={id}>
                  <button className={`chip wide${g.status === "empty" ? " dim" : ""}`} aria-pressed={selectedId === id}
                          onClick={() => setSelectedId(selectedId === id ? null : id)}>
                    <span className="num">{String(g.slot).padStart(2, "0")}</span>{g.title}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="ctas"><Link className="btn" to="/">Back to the studio</Link></div>
      </section>
      <Exhibit config={page.exhibit} selectedId={selectedId} onSelect={setSelectedId}>
        <InfoPanel item={item} onClose={close} />
      </Exhibit>
    </div>
  );
}
