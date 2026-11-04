import { useState } from "react";
import { prose } from "../content/data.js";

// Renders imported copy blocks (from the old pages) as plain, accessible HTML.
export default function Prose({ items, headingLevel = 3, raw = false }) {
  const list = raw ? items : prose(items);
  const out = [];
  let ul = null;
  list.forEach((i, n) => {
    if (i.type === "li") { (ul ||= []).push(<li key={n}>{i.text}</li>); return; }
    if (ul) { out.push(<ul key={`u${n}`}>{ul}</ul>); ul = null; }
    if (i.type === "h3" || i.type === "h4") { const H = `h${i.type === "h3" ? headingLevel : headingLevel + 1}`; out.push(<H key={n}>{i.text}</H>); }
    else if (i.type === "blockquote") out.push(<blockquote key={n}>{i.text}</blockquote>);
    else if (/^[A-Z0-9 &·/•—'’.,!?-]{4,}$/.test(i.text) && i.text.length < 40) out.push(<p key={n} className="eyebrow">{i.text}</p>);
    else out.push(<p key={n}>{i.text}</p>);
  });
  if (ul) out.push(<ul key="u-end">{ul}</ul>);
  return <>{out}</>;
}

// Click-to-load YouTube (no request to YouTube until the visitor asks; privacy-enhanced domain)
export function YouTube({ id, title, poster }) {
  const [on, setOn] = useState(false);
  return (
    <div className="video">
      {on ? (
        <iframe src={`https://www.youtube-nocookie.com/embed/${id}?rel=0&autoplay=1`} title={title} loading="lazy"
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen data-pause-music />
      ) : (
        <button type="button" className="video-poster" onClick={() => setOn(true)} data-pause-music
                style={poster ? { backgroundImage: `url(${poster})` } : undefined}>
          <span>▶ Play {title}</span><small>Plays from YouTube</small>
        </button>
      )}
    </div>
  );
}
