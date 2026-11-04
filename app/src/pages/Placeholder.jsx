import { Link } from "react-router-dom";
import { PAGES } from "../content/site.js";

// Same left/right layout as every page; the right side gets its exhibit in later phases.
export default function Placeholder({ page }) {
  const p = PAGES[page] || { eyebrow: "404", title: "Not found", intro: "This page doesn't exist (yet)." };
  return (
    <div className="page">
      <section className="content">
        <p className="eyebrow">{p.eyebrow}</p>
        <h1 className="title">{p.title}</h1>
        <p className="intro">{p.intro}</p>
        <div className="ctas"><Link viewTransition className="btn" to="/">Back to the studio</Link></div>
      </section>
      <section className="exhibit" aria-hidden={!p.fallback}>
        {p.fallback && (
          <div className="fallback">
            <img src={`${import.meta.env.BASE_URL}${p.fallback}`} alt="Preview render of the upcoming exhibit" />
            <span className="note">Preview render — interactive exhibit in Phase 6</span>
          </div>
        )}
      </section>
    </div>
  );
}
