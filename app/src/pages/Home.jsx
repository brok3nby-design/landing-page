import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Exhibit from "../exhibit/Exhibit.jsx";
import InfoPanel, { Action } from "../components/InfoPanel.jsx";
import Prose, { YouTube } from "../components/Prose.jsx";
import { resolveInteraction } from "../exhibit/interactions.js";
import { PAGES, HOTSPOT_LABELS } from "../content/site.js";
import { useSiteData, section, media, projectRoute } from "../content/data.js";
import { unlock } from "../site/passport.js";
import { pauseMusic } from "../site/music.js";
import { wakeAudio, blip } from "../exhibit/goldAudio.js";
import * as radio from "../site/radio.js";
import { RadioButtons } from "../components/RadioBar.jsx";

// the rubber duck: a squeak, then WRFM's Rubber Duck Rental ad (one at a time)
let duckAd = null;
function quack() {
  radio.stop();                                  // one voice at a time: the duck interrupts the radio
  wakeAudio(); blip("squeak", 0.8);
  if (duckAd && !duckAd.paused) return;
  duckAd = new Audio(`${import.meta.env.BASE_URL}media/wrfm/audio/02-rubber-duck-rental.ogg`);
  setTimeout(() => { pauseMusic(); duckAd.play().catch(() => {}); }, 380);
}

// Desk discoveries that earn a Studio Passport stamp
const STAMPS = { egg_qa_sticker: "radar", egg_maker_plate: "maker-plate", mug: "coffee", duck: "quack",
                 drawer_1: "door", drawer_2: "door", drawer_3: "door" };

export default function Home() {
  const page = PAGES.home;
  const data = useSiteData();
  const [selectedId, setSelectedId] = useState(null);
  const close = useCallback(() => setSelectedId(null), []);
  const select = useCallback((id) => {
    setSelectedId(id);
    if (!id) return;
    setPicked(true);
    if (STAMPS[id]) unlock(STAMPS[id]);
    if (/^book_/.test(id)) unlock("bookworm");
    if (id === "egg_qa_sticker") unlock("visit-under-the-radar");
    if (id === "duck") quack();
    if (id === "radio") { wakeAudio(); blip("ping", 0.4); }
  }, []);
  const [picked, setPicked] = useState(false);
  const item = selectedId && data ? { label: HOTSPOT_LABELS[selectedId], ...resolveInteraction(data.interactions, selectedId) } : null;
  const copy = data?.copy;
  const hero = section(copy, "home", null).map((i) => i.text);

  return (
    <>
      <div className="page home">
        <section className="content">
          <p className="eyebrow">{hero[1] || "Independent game studio"}</p>
          <h1 className="title hero-logo">
            {copy?.brand.banner_hero
              ? <img src={media(copy.brand.banner_hero)} alt="BROK3N BY DESIGN" width="1668" height="594" fetchpriority="high" />
              : <>BROK3N<br />BY DESIGN<span className="accent">.</span></>}
          </h1>
          {hero[2] && <p className="intro">{hero[2]}<br />{hero[3]}</p>}
          <div className="ctas">
            {page.ctas.map((c) => c.to.includes("#")
              ? <a key={c.to} href={c.to.slice(1)} className="btn">{c.label}</a>
              : <Link viewTransition key={c.to} to={c.to} className={`btn${c.primary ? " primary" : ""}`}>{c.label}</Link>)}
          </div>
          <div className="hotspots">
            <h2 id="explore" className={picked ? "" : "pulse"}><span className="pulse-dot" aria-hidden="true" />Explore the desk</h2>
            <HotspotList ids={page.exhibit.hotspots} selectedId={selectedId} select={select} glinting={!picked} />
            <div id="frame-tool-slot" />
          </div>
        </section>
        <Exhibit config={page.exhibit} selectedId={selectedId} onSelect={select}>
          <InfoPanel item={item} onClose={close}>{selectedId === "radio" && <RadioButtons />}</InfoPanel>
        </Exhibit>
      </div>
      {copy && <HomeMore data={data} />}
    </>
  );
}

// The desk's options as plain buttons. Until the visitor picks one, a random option glints every couple of
// seconds (a red border sweep). The glint state lives here, so it re-renders only this list - never the 3D view.
function HotspotList({ ids, selectedId, select, glinting }) {
  const [glint, setGlint] = useState(-1);
  useEffect(() => {
    if (!glinting) { setGlint(-1); return; }
    let last = -1;
    const t = setInterval(() => {
      if (document.hidden) return;
      let k = Math.floor(Math.random() * ids.length); if (k === last) k = (k + 1) % ids.length;
      last = k; setGlint(k);
    }, 2200);
    return () => clearInterval(t);
  }, [glinting, ids.length]);
  return (
    <ul aria-labelledby="explore">
      {ids.map((id, k) => (
        <li key={id}>
          <button className={`chip${glint === k ? " glint" : ""}`} aria-pressed={selectedId === id}
                  onClick={() => select(selectedId === id ? null : id)}>{HOTSPOT_LABELS[id]}</button>
        </li>
      ))}
    </ul>
  );
}

function HomeMore({ data }) {
  const { copy } = data;
  const launched = section(copy, "home", "Launched.");
  const coming = section(copy, "home", "What’s coming up");
  const about = section(copy, "home", "About the Studio");
  const wrfm = data.project("wrfm");
  const notes = [["glass-and-fortune", 1, 2, 3], ["pocket-wilds", 5, 6, 7], ["speck", 9, 10, 11]];
  return (
    <div className="more">
      <section id="launched" className="band">
        <p className="eyebrow">Finished. Released. Yours to explore.</p>
        <h2>Launched.</h2>
        <p className="lead">{launched[0]?.text}</p>
        <div className="cards two">
          <article className="card">
            <p className="eyebrow">{launched[1]?.text}</p>
            <h3>{launched[2]?.text}</h3>
            <p>{launched[3]?.text}</p>
            <YouTube id={copy.links.brand_film_id} title="the Brok3n by Design brand film" poster={media(copy.brand.brand_film_poster)} />
            <p className="links"><a href={copy.links.brand_film} target="_blank" rel="noopener">Watch on YouTube ↗</a> · <a href={copy.links.brand_film_x} target="_blank" rel="noopener">View on X ↗</a></p>
          </article>
          <article className="card">
            <p className="eyebrow">{launched[6]?.text}</p>
            <h3>{wrfm.title}</h3>
            <img src={media(copy.brand.wrfm_keyart)} alt="WRFM Radio artwork" loading="lazy" width="1536" height="1024" />
            <p>{launched[8]?.text}</p>
            <div className="ctas"><Action a={{ label: "Play WRFM ↗", href: copy.links.wrfm_live }} primary /><Action a={{ label: "Explore WRFM →", route: "/wrfm" }} /></div>
          </article>
        </div>
      </section>
      <section id="coming" className="band">
        <p className="eyebrow">Now on the workbench</p>
        <h2>What’s coming up</h2>
        <p className="lead">{coming[0]?.text}</p>
        <div className="cards three">
          {notes.map(([id, a, b, c]) => (
            <Link viewTransition key={id} to={projectRoute(id)} className="card link-card">
              <p className="eyebrow">{coming[a]?.text}</p><h3>{coming[b]?.text}</h3><p>{coming[c]?.text}</p>
              <span className="more-link">{data.project(id).title} →</span>
            </Link>
          ))}
        </div>
      </section>
      <section className="band split">
        <div>
          <h2>About the Studio</h2>
          <p className="lead">{about[0]?.text}</p>
          <div className="ctas">
            <a className="btn" href={`mailto:${copy.links.email}`}>Email the Studio</a>
            <Link viewTransition className="btn" to="/about">More About the Studio →</Link>
            <Link viewTransition className="btn" to="/about/built-by-design">Built by Design, Not by Budget →</Link>
          </div>
        </div>
        <FieldNotes copy={copy} text={about.find((i) => i.text.startsWith("Get occasional"))?.text} />
      </section>
    </div>
  );
}

export function FieldNotes({ copy, text, title = "Join the Field Notes", level = 3 }) {
  const H = `h${level}`;
  return (
    <form className="newsletter" action={copy.links.newsletter_action} method="post" target="_blank">
      <H className="card-h">{title}</H>
      {text && <p>{text}</p>}
      <label htmlFor="nl-email" className="sr-only">Email address</label>
      <div className="row">
        <input id="nl-email" type="email" name="email" required placeholder="you@example.com" autoComplete="email" />
        <button className="btn primary" type="submit">Subscribe</button>
      </div>
      <small>No spam. Unsubscribe anytime.</small>
    </form>
  );
}
