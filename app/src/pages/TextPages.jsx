// Plain text pages (same layout, no 3D exhibit): Built by Design essay, Follow, Subscribed, Contact,
// Press kit, Settings, Pocket Wilds update log, Studio Passport. All copy imported from the old site.
import { useState } from "react";
import { Link } from "react-router-dom";
import Prose from "../components/Prose.jsx";
import { FieldNotes } from "./Home.jsx";
import { useSiteData, section, media, projectRoute } from "../content/data.js";
import { usePrefs, setPref } from "../site/prefs.js";
import { usePassport, exportSave, importSave, resetSave, unlock, SECRETS } from "../site/passport.js";
import { useNavigate } from "react-router-dom";

function Shell({ eyebrow, title, lead, children, aside }) {
  return (
    <div className="textpage">
      <header className="textpage-head">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="title">{title}</h1>
        {lead && <p className="intro">{lead}</p>}
      </header>
      <div className={`textpage-body${aside ? " with-aside" : ""}`}>
        <div>{children}</div>
        {aside && <aside>{aside}</aside>}
      </div>
    </div>
  );
}
const useData = () => useSiteData();
const Busy = () => <div className="textpage" aria-busy="true" />;

export function Essay() {
  const d = useData(); if (!d) return <Busy />;
  const c = d.copy.built_by_design;
  return (
    <Shell eyebrow="From the studio" title={<>Built by Design,<br />Not by Budget<span className="accent">.</span></>}
           lead="Why one person uses AI to make games, and why that should not be controversial.">
      <p className="dim">A note from the creator of Brok3n by Design</p>
      {c.sections.filter((s) => s.heading).map((s) => (
        <section key={s.heading} className="text"><h2>{s.heading}</h2><Prose items={s.items} /></section>
      ))}
      <div className="ctas">
        <Link viewTransition className="btn primary" to="/games">See the Games</Link>
        <Link viewTransition className="btn" to="/about">About the Studio</Link>
        <a className="btn" href={`mailto:${d.copy.links.email}`}>Email the Studio</a>
      </div>
    </Shell>
  );
}

export function Follow() {
  const d = useData(); if (!d) return <Busy />;
  const join = section(d.copy, "follow", "Join the Field Notes");
  return (
    <Shell eyebrow="Stay in the loop" title={<>Follow development<span className="accent">.</span></>}
           lead="Choose the kind of updates you want. Get occasional studio notes by email, follow the day-to-day work on X, or check back as more channels open.">
      <div className="cards two">
        <div className="card"><FieldNotes copy={d.copy} text={join[0]?.text} level={2} /></div>
        <div className="card">
          <h2 className="card-h">Follow on X</h2>
          <p>{join.find((i) => i.text.startsWith("Short updates"))?.text}</p>
          <div className="ctas"><a className="btn primary" href={d.copy.links.x} target="_blank" rel="noopener">@brok3nbydesign ↗</a></div>
        </div>
      </div>
      <section className="text">
        <p className="eyebrow">Before you subscribe</p>
        <h2>A taste of the Field Notes</h2>
        <p>{section(d.copy, "follow", "A taste of the Field Notes")[0]?.text}</p>
        <div className="ctas">
          <Link viewTransition className="btn" to="/games/glass-and-fortune">Explore Glass &amp; Fortune →</Link>
          <Link viewTransition className="btn" to="/games/pocket-wilds/updates">Browse the Pocket Wilds update log →</Link>
        </div>
      </section>
    </Shell>
  );
}

export function Subscribed() {
  const d = useData(); if (!d) return <Busy />;
  const items = section(d.copy, "subscribed", null).filter((i) => i.text.length > 30 && !i.text.includes("|"));
  return (
    <Shell eyebrow="Field Notes" title={<>Check your inbox<span className="accent">.</span></>}>
      <Prose items={items} />
      <div className="ctas"><Link viewTransition className="btn" to="/games/pocket-wilds">About Pocket Wilds</Link><Link viewTransition className="btn" to="/">Back to Home</Link></div>
    </Shell>
  );
}

export function Contact() {
  const d = useData(); if (!d) return <Busy />;
  const L = d.copy.links;
  return (
    <Shell eyebrow="Get in touch" title={<>Contact<span className="accent">.</span></>}
           lead="Explore the games, follow what's taking shape, or drop a line about games, feedback, or a collaboration.">
      <div className="cards three">
        <div className="card"><h2 className="card-h">Email</h2><p><a href={`mailto:${L.email}`}>{L.email}</a></p></div>
        <div className="card"><h2 className="card-h">X</h2><p><a href={L.x} target="_blank" rel="noopener">@brok3nbydesign ↗</a></p></div>
        <div className="card"><h2 className="card-h">YouTube</h2><p><a href={L.youtube} target="_blank" rel="noopener">Trailers ↗</a></p></div>
      </div>
      <div className="card"><FieldNotes copy={d.copy} level={2} text="Get occasional updates on new builds, playable previews, and experiments still finding their shape." /></div>
      <p className="dim">Writing about the studio? The <Link viewTransition to="/press">press kit</Link> has the studio description, artwork and logos.</p>
    </Shell>
  );
}

export function Press() {
  const d = useData();
  const [msg, setMsg] = useState("");
  if (!d) return <Busy />;
  const about = section(d.copy, "press", "About the studio")[0]?.text;
  const B = d.copy.brand;
  const copyIt = async () => { try { await navigator.clipboard.writeText(about); setMsg("Studio description copied."); } catch { setMsg("Select and copy the studio description above."); } };
  const factsHref = URL.createObjectURL(new Blob([d.copy.facts], { type: "text/plain" }));
  return (
    <Shell eyebrow="For writers, streamers & curious people" title={<>Press kit<span className="accent">.</span></>}
           lead="The studio, in its own words. Project artwork, useful links, and a direct line for questions.">
      <section className="text">
        <h2>About the studio</h2>
        <p id="studio-description">{about}</p>
        <div className="ctas">
          <button type="button" className="btn" onClick={copyIt}>Copy studio description</button>
          <a className="btn" href={factsHref} download="brok3n-by-design-studio-facts.txt">Download factsheet</a>
          <a className="btn" href={`mailto:${d.copy.links.email}`}>Contact the studio</a>
        </div>
        <p role="status" className="dim">{msg}</p>
      </section>
      <section className="text">
        <h2>Brand film &amp; trailers</h2>
        <p>{section(d.copy, "press", "Brand film & trailers")[0]?.text}</p>
        <div className="ctas">
          <a className="btn" href={d.copy.links.brand_film} target="_blank" rel="noopener">Watch the brand film ↗</a>
          <a className="btn" href={d.copy.links.brand_film_x} target="_blank" rel="noopener">View on X ↗</a>
          <a className="btn" href={d.copy.links.youtube} target="_blank" rel="noopener">YouTube trailers ↗</a>
        </div>
      </section>
      <section className="text">
        <h2>Studio marks</h2>
        <p>{section(d.copy, "press", "Studio marks")[0]?.text}</p>
        <div className="marks">
          <figure><img src={media(B.thumb)} alt="Brok3n by Design B3 thumbnail" /><figcaption><a href={media(B.thumb)} download>Download B3 thumbnail</a></figcaption></figure>
          <figure><img src={media(B.wordmark)} alt="Brok3n by Design wordmark" /><figcaption><a href={media(B.logo_png)} download>Download studio logo</a></figcaption></figure>
          <figure><img src={media(B.mark_svg)} alt="B3 studio mark" /><figcaption><a href={media(B.mark_svg)} download>Download B3 mark (SVG)</a></figcaption></figure>
        </div>
      </section>
      <section className="text">
        <h2>Projects &amp; selected artwork</h2>
        <p>{section(d.copy, "press", "Projects & selected artwork")[0]?.text}</p>
        <ul className="press-projects">
          {d.projects.filter((p) => !p.secret).map((p) => (
            <li key={p.id}><p className="eyebrow">{p.status}</p><h3>{p.title}</h3><p>{p.description}</p>
              <p><Link viewTransition to={projectRoute(p.id)}>Project details</Link>{p.cover && <> · <a href={media(p.cover)} download>Download artwork</a></>}</p></li>
          ))}
        </ul>
      </section>
    </Shell>
  );
}

export function Settings() {
  const prefs = usePrefs();
  const [msg, setMsg] = useState("");
  const row = (k, label) => (
    <label className="setting"><input type="checkbox" checked={prefs[k]} onChange={(e) => setMsg(setPref(k, e.target.checked) ? "Settings saved." : "Applied for this page. Your browser is blocking storage.")} /> {label}</label>
  );
  return (
    <Shell eyebrow="Set the atmosphere" title={<>Make yourself comfortable<span className="accent">.</span></>} lead="Keep the strange. Choose how much it moves.">
      <fieldset className="settings">
        <legend>Website preferences</legend>
        {row("effects", "Animations and hover effects")}
        {row("particles", "Cursor particles")}
        {row("sfx", "Sound effects (clicking desk items, cartridges, the notebook)")}
        {row("skipIntro", "Go straight to the games next time")}
      </fieldset>
      <p role="status">{msg}</p>
      <p className="dim">Your device’s reduced-motion setting takes priority. Sound effects are on unless you turn them off. These settings control the website; the radio and games have their own controls.</p>
    </Shell>
  );
}

export function PocketWildsLog() {
  const d = useData();
  const [q, setQ] = useState("");
  if (!d) return <Busy />;
  const builds = d.copy.pocket_wilds_log.builds;
  const shown = builds.filter((b) => !q || (b.build + " " + b.items.join(" ")).toLowerCase().includes(q.toLowerCase()));
  return (
    <Shell eyebrow="Pocket Wilds" title={<>Update log<span className="accent">.</span></>} lead="Update Log — by Brok3n By Design">
      <label className="search">Search updates <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Dice, controls, crafting…" /></label>
      <p role="status" className="dim">{shown.length} updates</p>
      {shown.map((b) => (
        <section key={b.build} className="build text"><h2>{b.build}</h2>{b.date && <time>{b.date}</time>}<ul>{b.items.map((t, i) => <li key={i}>{t}</li>)}</ul></section>
      ))}
      <div className="ctas"><Link viewTransition className="btn" to="/games/pocket-wilds">← Pocket Wilds</Link></div>
    </Shell>
  );
}

export function Passport() {
  const d = useData();
  const { save, durable, stamps } = usePassport();
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [out, setOut] = useState("Commands: games, shelf, radio, about, passport, random, secrets, help.");
  const navigate = useNavigate();
  if (!d || !stamps.length) return <Busy />;
  const list = stamps.filter((s) => !s.secret || save.stamps[s.id]);       // the secret project shows once found
  const count = list.filter((s) => save.stamps[s.id]).length;
  const download = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([exportSave()], { type: "application/json" }));
    a.download = "brok3n-studio-passport.json"; a.click();
    setMsg("Backup downloaded. It contains only stamp names and discovery dates.");
  };
  const restore = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { if (f.size > 65536) throw new Error("Choose a passport backup smaller than 64 KB.");
      setMsg(importSave(await f.text()) ? "Backup restored. Your existing discoveries were kept." : "Restored for this page. Browser storage is unavailable; keep your backup.");
    } catch (err) { setMsg("Could not restore: " + err.message); }
    e.target.value = "";
  };
  const run = (e) => {
    e.preventDefault();
    const c = new FormData(e.target).get("cmd").trim().toLowerCase();
    const routes = { games: "/games", shelf: "/games#all", radio: "/wrfm", about: "/about", passport: "/passport" };
    if (c === "random") { const pool = d.projects.filter((p) => !p.secret); unlock("random"); navigate(projectRoute(pool[Math.floor(Math.random() * pool.length)].id)); return; }
    if (routes[c]) { navigate(routes[c]); return; }
    setOut(c === "secrets" ? "Start at the bottom of the homepage. Watch for someone very small. And look under the desk." : "Commands: games, shelf, radio, about, passport, random, secrets, help.");
  };
  return (
    <Shell eyebrow="Brok3n by Design / visitor record" title={<>Studio Passport<span className="accent">.</span></>}
           lead="A little proof that you were here. Visit the projects, take the long way around, and keep an eye out for things that don’t quite belong.">
      <p className="passport-count"><strong>{count} / {list.length}</strong> discoveries collected</p>
      <progress max={list.length} value={count} />
      <p className="dim">{durable ? "Saved in this browser. Back up your passport to keep it or move it to another device." : "Your browser is blocking saves. Discoveries last for this page only; download a backup before leaving."}</p>
      <ul className="stamps">
        {list.map((s) => {
          const at = save.stamps[s.id];
          return (
            <li key={s.id} className={`stamp${at ? " earned" : ""}`}>
              <span className="stamp-icon" aria-hidden="true">{at ? s.symbol : "?"}</span>
              <p className="eyebrow">{at ? "Stamp collected" : s.project ? "World to visit" : "Undiscovered"}</p>
              <h2>{s.title}</h2>
              <p>{at ? `Collected ${new Date(at).toLocaleDateString()}` : s.hint}</p>
              {s.path && !at && <Link viewTransition to={s.path}>{s.project ? "Visit project →" : "Explore →"}</Link>}
            </li>
          );
        })}
      </ul>
      <section className="text">
        <h2>Keep your discoveries</h2>
        <p>No account or paid service. Your stamps stay on this website in this browser. Clearing site data or leaving a private session can erase them. A backup lets you move them to another device or browser.</p>
        <div className="ctas">
          <button type="button" className="btn" onClick={download}>Download backup</button>
          <label className="btn">Restore a passport backup<input type="file" accept="application/json,.json" onChange={restore} className="sr-only" /></label>
          <button type="button" className="btn ghost" onClick={() => setConfirm(true)}>Reset passport</button>
        </div>
        {confirm && (<div className="confirm"><p>Reset the discoveries in this browser? Download a backup first if you want to keep them.</p>
          <button type="button" className="btn" autoFocus onClick={() => setConfirm(false)}>Keep my passport</button>
          <button type="button" className="btn primary" onClick={() => { resetSave(); setConfirm(false); setMsg("Passport reset. Your display settings are unchanged."); }}>Reset discoveries</button></div>)}
        <p role="status" className="dim">{msg}</p>
      </section>
      <section className="text terminal">
        <p className="eyebrow">An unattended terminal</p>
        <h2>Where to next?</h2>
        <form onSubmit={run}><label htmlFor="cmd">Enter a command. Try help or secrets.</label>
          <div className="row"><span aria-hidden="true">&gt;</span><input id="cmd" name="cmd" autoComplete="off" spellCheck="false" /><button className="btn" type="submit">Run command ↵</button></div></form>
        <p className="terminal-out" role="status">{out}</p>
        <p className="dim">games · shelf · radio · about · passport · random · secrets</p>
      </section>
    </Shell>
  );
}
export const SECRET_COUNT = SECRETS.length;
