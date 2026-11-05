import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Prose, { YouTube } from "../components/Prose.jsx";
import { Action } from "../components/InfoPanel.jsx";
import { useSiteData, media } from "../content/data.js";
import { unlock } from "../site/passport.js";
import NotFound from "./NotFound.jsx";

// One page per project (imported from the old site): status, hook, about / how it plays, progress
// report, trailer, gallery. The right column shows the cover art until each game gets its own
// miniature exhibit (future modelling phase).
export default function GamePage({ id: fixedId }) {
  const params = useParams();
  const id = fixedId || params.gameId;
  const data = useSiteData();
  useEffect(() => { if (data?.project(id)) unlock(`visit-${id}`); }, [data, id]);
  if (!data) return <div className="page" aria-busy="true" />;
  const p = data.project(id);
  if (!p) return <NotFound />;
  const pg = p.page, pr = p.progress || {};
  const slot = data.games.find((g) => g.id === id);
  return (
    <>
      <div className="page project" style={{ "--accent": p.accent }}>
        <section className="content">
          <p className="eyebrow">{p.status}{slot ? ` · Case ${String(slot.slot).padStart(2, "0")}` : ""}</p>
          <h1 className="title">{p.title}<sup>™</sup></h1>
          {pg.genres && <p className="genres">{pg.genres}</p>}
          <p className="hook">{p.hook}</p>
          <p className="intro">{pg.lead || p.description}</p>
          <div className="ctas">
            {p.live_url && <Action a={{ label: id === "wrfm" ? "Listen live ↗" : "Sign the guestbook ↗", href: p.live_url }} primary />}
            {p.trailer && <a className="btn" href="#trailer">Watch the trailer ↓</a>}
            <Link viewTransition className="btn" to="/follow">Follow development</Link>
          </div>
          <Progress p={p} pr={pr} />
          <div className="ctas"><Link viewTransition className="btn ghost" to="/games">← Back to the shelf</Link></div>
        </section>
        <section className="exhibit cover-exhibit" aria-label={`${p.title} artwork`}>
          {(p.cover || p.logo) && <img src={media(p.cover || p.logo)} alt={`${p.title} artwork`}
                                       {...(p.cover ? { width: 1024, height: 1536, className: "is-cover" } : {})} fetchpriority="high" />}
          <span className="note">Miniature exhibit — future phase</span>
        </section>
      </div>
      <div className="more project-more" style={{ "--accent": p.accent }}>
        {p.trailer && (
          <section id="trailer" className="band">
            <h2>Trailer</h2>
            {p.trailer.type === "youtube"
              ? <YouTube id={p.trailer.id} title={`the ${p.title} trailer`} poster={media(p.logo || p.gallery[0])} />
              : <div className="video"><video controls preload="none" playsInline poster={media(p.trailer.poster || p.cover)}
                                              src={media(p.trailer.file)}>Your browser does not support HTML video.</video></div>}
          </section>
        )}
        {pg.sections.map((s) => (
          <section key={s.heading} className="band text">
            <h2>{s.heading}</h2>
            <Prose items={s.items} />
          </section>
        ))}
        {id === "wrfm" && <WrfmClips clips={data.copy.wrfm_clips} live={p.live_url} />}
        {id === "pocket-wilds" && (
          <section className="band"><Link viewTransition className="btn" to="/games/pocket-wilds/updates">Browse the Pocket Wilds update log →</Link></section>
        )}
        {p.gallery.length > 0 && <Gallery items={p.gallery} title={p.title} />}
      </div>
    </>
  );
}

function Progress({ p, pr }) {
  if (!pr || (pr.remaining == null && pr.testing === "No ETA" && pr.release === "No ETA")) return null;
  return (
    <div className="progress-report" aria-label="Progress report">
      <h2>Progress report</h2>
      <dl>
        <dt>Status</dt><dd>{p.status}</dd>
        {pr.remaining != null && (<><dt>Content remaining</dt>
          <dd><span className="bar" style={{ "--v": `${pr.remaining}%` }} aria-hidden="true" /> {pr.remaining}%<small>Images, audio, music, voice, and other content.</small></dd></>)}
        <dt>Testing / demo ETA</dt><dd>{pr.testing}</dd>
        <dt>Full release ETA</dt><dd>{pr.release}</dd>
      </dl>
      <small>Estimates may change; content remaining is not overall game completion.</small>
    </div>
  );
}

function Gallery({ items, title }) {
  const [open, setOpen] = useState(-1);
  useEffect(() => {
    if (open < 0) return;
    const k = (e) => { if (e.key === "Escape") setOpen(-1); if (e.key === "ArrowRight") setOpen((i) => (i + 1) % items.length); if (e.key === "ArrowLeft") setOpen((i) => (i - 1 + items.length) % items.length); };
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [open, items.length]);
  return (
    <section className="band">
      <h2>Gallery</h2>
      <ul className="gallery">
        {items.map((src, i) => (
          <li key={src}><button type="button" onClick={() => setOpen(i)} aria-label={`Open ${title} image ${i + 1} of ${items.length}`}>
            <img src={media(src)} alt="" loading="lazy" /></button></li>
        ))}
      </ul>
      {open >= 0 && (
        <div className="lightbox" role="dialog" aria-modal="true" aria-label={`${title} image ${open + 1} of ${items.length}`} onClick={() => setOpen(-1)}>
          <img src={media(items[open])} alt={`${title} image ${open + 1}`} onClick={(e) => e.stopPropagation()} />
          <button type="button" className="lb-prev" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + items.length) % items.length); }} aria-label="Previous image">❮</button>
          <button type="button" className="lb-next" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % items.length); }} aria-label="Next image">❯</button>
          <button type="button" className="lb-close" autoFocus onClick={() => setOpen(-1)} aria-label="Close">×</button>
        </div>
      )}
    </section>
  );
}

function WrfmClips({ clips, live }) {
  return (
    <section className="band">
      <p className="eyebrow">Tune in · 97.1</p>
      <h2>Meet the Station</h2>
      <p className="lead">The host, a sponsor that shouldn’t exist, a late-night caller, an office regular, and the phone nobody tells you about. It’s the same tape that plays on air.</p>
      <ol className="clips">
        {clips.map((c, n) => (
          <li key={c.id} className="clip">
            <span className="num">{String(n + 1).padStart(2, "0")}</span>
            <h3>{c.title}</h3>
            <blockquote>{c.quote}</blockquote>
            <p>{c.blurb}</p>
            {c.audio.map((a) => <audio key={a} controls preload="none" src={media(a)} />)}
            <details><summary>Transcript</summary>{c.transcript.map((t, i) => <p key={i} className={/^[A-Z ,.]+$/.test(t) ? "speaker" : ""}>{t}</p>)}</details>
          </li>
        ))}
      </ol>
      <div className="ctas"><a className="btn primary" href={live} target="_blank" rel="noopener">Open the radio in a new tab ↗</a></div>
    </section>
  );
}
