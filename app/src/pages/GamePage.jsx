import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Prose, { YouTube } from "../components/Prose.jsx";
import { Action } from "../components/InfoPanel.jsx";
import { useSiteData, media } from "../content/data.js";
import { EXHIBITS } from "../content/site.js";
import Exhibit from "../exhibit/Exhibit.jsx";
import InfoPanel from "../components/InfoPanel.jsx";
import { unlock } from "../site/passport.js";
import NotFound from "./NotFound.jsx";
import { goldSoundOn, setGoldSound, onGoldSound } from "../exhibit/goldAudio.js";

// One page per project (imported from the old site): status, hook, about / how it plays, progress
// report, trailer, gallery. The right column shows the cover art until each game gets its own
// miniature exhibit (future modelling phase).
export default function GamePage({ id: fixedId }) {
  const params = useParams();
  const id = fixedId || params.gameId;
  const data = useSiteData();
  useEffect(() => { if (data?.project(id)) unlock(`visit-${id}`); }, [data, id]);
  const [selectedId, setSelectedId] = useState(null);
  const close = useCallback(() => setSelectedId(null), []);
  if (!data) return <div className="page" aria-busy="true" />;
  const p = data.project(id);
  if (!p) return <NotFound />;
  const pg = p.page, pr = p.progress || {};
  const slot = data.games.find((g) => g.id === id);
  const ex = EXHIBITS[id];
  return (
    <>
      <div className={`page project${ex ? " has-exhibit" : ""}`} style={{ "--accent": p.accent }}>
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
          {ex && (
            <div className="hotspots">
              <h2 id="finds">{ex.findsTitle || "Take a closer look"}</h2>
              <ul aria-labelledby="finds">
                {Object.entries(ex.finds).map(([fid, f]) => (
                  <li key={fid}><button className="chip" aria-pressed={selectedId === fid}
                                        onClick={() => setSelectedId(selectedId === fid ? null : fid)}>{f.title}</button></li>
                ))}
              </ul>
            </div>
          )}
          <div className="ctas"><Link viewTransition className="btn ghost" to="/games">← Back to the shelf</Link></div>
        </section>
        {ex ? (
          <Exhibit config={ex} selectedId={selectedId} onSelect={setSelectedId} tools={ex.play === "gold" ? <GoldTools /> : ex.play === "dice" ? <DiceTools /> : ex.play === "speck" ? <SpeckTools /> : ex.play === "doqi" ? <DoqiTools /> : ex.play === "wrfm" ? <WrfmTools /> : null}>
            <InfoPanel item={selectedId && ex.finds[selectedId] ? { id: selectedId, kind: "discovery", panel: ex.finds[selectedId] } : null}
                       onClose={close} />
          </Exhibit>
        ) : (
          <section className="exhibit cover-exhibit" aria-label={`${p.title} artwork`}>
            {(p.cover || p.logo) && <img src={media(p.cover || p.logo)} alt={`${p.title} artwork`}
                                         {...(p.cover ? { width: 1024, height: 1536, className: "is-cover" } : {})} fetchpriority="high" />}
            <span className="note">Miniature exhibit — coming soon</span>
          </section>
        )}
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

// Pocket Wilds: a keyboard/touch-friendly way to play with the gold, and the sound switch
function GoldTools() {
  const [on, setOn] = useState(goldSoundOn());
  useEffect(() => onGoldSound(setOn), []);
  return (
    <>
      <button className="tool" onClick={() => window.dispatchEvent(new CustomEvent("pw-gold", { detail: "toss" }))}
              title="Scoop a handful of coins out of the chest and toss them onto the floor">Toss a handful</button>
      <button className="tool" aria-pressed={on} onClick={() => setGoldSound(!on)}
              title="Coin sounds">{on ? "Gold sounds: on" : "Gold sounds: off"}</button>
    </>
  );
}

// Glass & Fortune: roll button, the result of the last roll (announced to screen readers) and the sound switch
function DiceTools() {
  const [on, setOn] = useState(goldSoundOn());
  const [roll, setRoll] = useState(null);
  useEffect(() => onGoldSound(setOn), []);
  useEffect(() => {
    const f = (e) => setRoll(e.detail);
    addEventListener("gf-dice", f);
    return () => removeEventListener("gf-dice", f);
  }, []);
  const text = !roll ? "" : roll.rolling ? "Rolling…"
    : roll.dice.map((d) => `${d.colour} ${d.value}`).join(" · ") + ` — ${roll.total}` + (roll.cocked ? " (one is cocked: roll again)" : "");
  return (
    <>
      <output className="dice-result" aria-live="polite">{text}</output>
      <button className="tool" onClick={() => window.dispatchEvent(new CustomEvent("gf-roll", { detail: "roll" }))}>Roll the dice</button>
      <button className="tool" aria-pressed={on} onClick={() => setGoldSound(!on)} title="Dice sounds">{on ? "Sounds: on" : "Sounds: off"}</button>
    </>
  );
}

// Speck: spin the planet, leave something where you are looking (keyboard / touch alternative), clear yours
function SpeckTools() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    const f = (e) => {
      const d = e.detail;
      setMsg(d.cleared ? "Cleared. The planet is as you found it."
        : `You left ${d.name}. ${d.saved ? "It will still be here next time." : "(Your browser won't save it.)"}`);
    };
    addEventListener("sp-mark", f);
    return () => removeEventListener("sp-mark", f);
  }, []);
  const act = (a) => window.dispatchEvent(new CustomEvent("sp-act", { detail: a }));
  return (
    <>
      <output className="dice-result" aria-live="polite">{msg}</output>
      <button className="tool" onClick={() => act("spin")}>Spin</button>
      <button className="tool" onClick={() => act("leave")} title="Leave something on the planet where you're looking">Leave something</button>
      <button className="tool" onClick={() => act("clear")} title="Remove everything you left (saved in this browser)">Clear mine</button>
    </>
  );
}

// DOQI: stamp a form (keyboard / touch alternative), the running count and J.E.F.F.'s last ruling
function DoqiTools() {
  const [count, setCount] = useState(null);
  const [said, setSaid] = useState("");
  useEffect(() => {
    const f = (e) => setCount(e.detail.count);
    const j = (e) => setSaid(e.detail.text);
    addEventListener("dq-filed", f); addEventListener("dq-jeff", j);
    return () => { removeEventListener("dq-filed", f); removeEventListener("dq-jeff", j); };
  }, []);
  return (
    <>
      <output className="dice-result" aria-live="polite">{said ? `J.E.F.F.: ${said}` : ""}{count ? `${said ? " · " : ""}Forms filed: ${count}` : ""}</output>
      <button className="tool" onClick={() => window.dispatchEvent(new CustomEvent("dq-act", { detail: "stamp" }))}>Stamp it</button>
    </>
  );
}

// WRFM: on air / off air (keyboard / touch alternative to clicking the mic) and what's on the air now
function WrfmTools() {
  const [air, setAir] = useState({ on: false });
  useEffect(() => {
    const f = (e) => setAir(e.detail);
    addEventListener("wr-air", f);
    return () => removeEventListener("wr-air", f);
  }, []);
  return (
    <>
      <output className="dice-result" aria-live="polite">{air.on ? `On air · ${air.title}${air.quote ? `: ${air.quote}` : ""}` : ""}</output>
      <button className="tool" aria-pressed={air.on} data-pause-music
              onClick={() => window.dispatchEvent(new CustomEvent("wr-act", { detail: "air" }))}>{air.on ? "Off air" : "On air"}</button>
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
