import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { loadGames, isPlaceholder } from "../exhibit/games.js";
import Placeholder from "./Placeholder.jsx";

// Individual game page: same layout as every page. Content comes from games.json; each game's own
// miniature exhibit is a future modelling phase.
export default function GamePage() {
  const { gameId } = useParams();
  const [games, setGames] = useState(null);
  useEffect(() => { loadGames().then(setGames).catch(() => setGames([])); }, []);
  if (!games) return <div className="page" aria-busy="true" />;
  const g = games.find((x) => x.id === gameId);
  if (!g) return <Placeholder page="notFound" />;
  return (
    <div className="page">
      <section className="content">
        <p className="eyebrow">Game {String(g.slot).padStart(2, "0")} · The collection</p>
        <h1 className="title">{g.title}</h1>
        <p className="intro">{isPlaceholder(g.description) ? "Description to come after the content audit." : g.description}</p>
        <div className="todo">
          <h2>To be added after the audit</h2>
          <ul>
            <li>Screenshots</li><li>Trailer / video</li><li>Release information</li>
            <li>{g.links?.length ? `${g.links.length} link(s)` : "Store and social links"}</li>
          </ul>
        </div>
        <div className="ctas"><Link viewTransition className="btn" to="/games">Back to the collection</Link></div>
      </section>
      <section className="exhibit" aria-label="Game exhibit (future)">
        <div className="fallback">
          <p className="fallback-text">{g.exhibit || "This game's miniature exhibit is a future phase."}</p>
          <span className="note">Miniature exhibit — future phase</span>
        </div>
      </section>
    </div>
  );
}
