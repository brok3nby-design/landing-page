// "My Gaming History": the creator's own story, reached from the hooded-sniper figurine on the desk shelf.
// The text lives in content/gaming-history.md exactly as written (edit it there); this page only lays it out:
// a reading-progress bar, a sticky contents list grouped into three eras (adventures, shooters, systems), game
// titles set as headings, the short one-line beats given room, the closing "I remember..." lines as a list of
// memories, and an index of every game named. Reading to the end earns a Passport stamp.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import md from "../content/gaming-history.md?raw";
import { unlock } from "../site/passport.js";

// which era each chapter (## heading) belongs to: colour + label in the contents and on the page
const ERAS = [
  { id: "start", label: "Where it started", tone: "neutral", match: /^Where It All Started/ },
  { id: "adventure", label: "Point & click", tone: "gold", match: /Point-and-Click/ },
  { id: "shooters", label: "Shooters", tone: "red", match: /First-Person Shooters|Unreal|Wolfenstein|Call of Duty|Battlefield|Soldier of Fortune|Multiplayer Shooters/ },
  { id: "systems", label: "Building systems", tone: "teal", match: /Management|Automation/ },
  { id: "stay", label: "The ones that stay", tone: "neutral", match: /Stay With You/ },
];
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// ---------------------------------------------------------------- a tiny markdown reader for this text
function inline(text) {
  // **bold** (game names) and *italic*; nothing else is used in the text
  const out = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0, m, k = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] ? <strong key={k++} className="gh-game">{m[1]}</strong> : <em key={k++}>{m[2]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}
function parse(src) {
  const lines = src.split(/\r?\n/);
  const doc = { title: "", subtitle: "", chapters: [], outro: "" };
  let ch = null, sub = null;
  const push = (block) => { (sub ? sub.blocks : ch ? ch.blocks : (doc.pre ||= [])).push(block); };
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("# ")) { doc.title = line.slice(2); continue; }
    if (line.startsWith("## ")) {
      const title = line.slice(3);
      ch = { title, id: slug(title), era: (ERAS.find((e) => e.match.test(title)) || ERAS[0]).id, blocks: [], subs: [] };
      doc.chapters.push(ch); sub = null; continue;
    }
    if (line.startsWith("### ")) {
      const title = line.slice(4);
      sub = { title, id: slug(title), blocks: [] }; ch.subs.push(sub); ch.blocks.push({ sub }); continue;
    }
    if (!ch && /^\*[^*].*\*$/.test(line)) { doc.subtitle = line.slice(1, -1); continue; }
    if (/^\*To be continued/.test(line)) { doc.outro = line.replace(/^\*|\*$/g, ""); continue; }
    push({ p: line });
  }
  return doc;
}
// games named in bold, in order of appearance, each with the chapter (or game section) it is in
function gamesIndex(doc) {
  const seen = new Map();
  for (const ch of doc.chapters) {
    const scan = (blocks, anchor) => blocks.forEach((b) => {
      if (b.sub) return scan(b.sub.blocks, b.sub.id);
      for (const m of (b.p || "").matchAll(/\*\*(.+?)\*\*/g)) if (!seen.has(m[1])) seen.set(m[1], { name: m[1], anchor, era: ch.era });
    });
    scan(ch.blocks, ch.id);
  }
  return [...seen.values()];
}

// short lines ("A lot.", "And I liked that.") are the rhythm of the piece: give them their own beat
const isBeat = (p) => p.length <= 44 && !p.includes("**") && /[.!?]$/.test(p) && !/^(I remember|Then|But|And then)\b.{30,}/.test(p);

function Blocks({ blocks, memories }) {
  const out = [];
  let run = [];
  const flush = () => { if (run.length) { out.push(<ul key={`m${out.length}`} className="gh-memories">{run.map((t, i) => <li key={i}>{inline(t)}</li>)}</ul>); run = []; } };
  blocks.forEach((b, i) => {
    if (b.sub) { flush(); out.push(<Sub key={b.sub.id} sub={b.sub} />); return; }
    if (memories && /^(And )?I remember /.test(b.p)) { run.push(b.p); return; }
    flush();
    out.push(<p key={i} className={isBeat(b.p) ? "gh-beat" : undefined}>{inline(b.p)}</p>);
  });
  flush();
  return out;
}
function Sub({ sub }) {
  return (
    <section className="gh-sub" id={sub.id} aria-labelledby={`${sub.id}-h`}>
      <h3 id={`${sub.id}-h`}><span className="gh-sub-kicker" aria-hidden="true">▸</span>{inline(sub.title)}</h3>
      <Blocks blocks={sub.blocks} />
    </section>
  );
}

export default function GamingHistory() {
  const doc = useMemo(() => parse(md), []);
  const games = useMemo(() => gamesIndex(doc), [doc]);
  const [active, setActive] = useState(doc.chapters[0]?.id);
  const [progress, setProgress] = useState(0);
  const end = useRef(null);

  useEffect(() => {                                   // which chapter is on screen (for the contents list)
    const els = doc.chapters.map((c) => document.getElementById(c.id)).filter(Boolean);
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) setActive(vis[0].target.id);
    }, { rootMargin: "-20% 0px -65% 0px" });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [doc]);
  useEffect(() => {                                   // reading progress
    const on = () => {
      const art = document.querySelector(".gh-article");
      if (!art) return;
      const r = art.getBoundingClientRect(), total = r.height - innerHeight * 0.6;
      setProgress(Math.max(0, Math.min(1, -r.top / Math.max(total, 1))));
    };
    on(); addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); };
  }, []);
  useEffect(() => {                                   // read to the end -> Passport stamp
    if (!end.current) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) unlock("player-one"); });
    io.observe(end.current);
    return () => io.disconnect();
  }, []);

  const go = (id) => (e) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", `#${id}`);
  };
  const eraOf = (id) => ERAS.find((e) => e.id === id);
  const counts = Object.fromEntries(ERAS.map((e) => [e.id, games.filter((g) => g.era === e.id).length]));

  return (
    <div className="gh">
      <div className="gh-progress" aria-hidden="true"><i style={{ transform: `scaleX(${progress})` }} /></div>
      <header className="gh-hero">
        <p className="eyebrow">From the shelf · The person behind the studio</p>
        <h1 className="title">{doc.title}<span className="accent">.</span></h1>
        {doc.subtitle && <p className="intro gh-subtitle">{doc.subtitle}</p>}
        <ul className="gh-eras" aria-label="Three kinds of games run through this story">
          {ERAS.filter((e) => e.tone !== "neutral").map((e) => {
            const first = doc.chapters.find((c) => c.era === e.id);
            return (
              <li key={e.id}>
                <a href={`#${first?.id}`} onClick={go(first?.id)} className={`gh-era tone-${e.tone}`}>
                  <span className="gh-era-label">{e.label}</span>
                  <span className="gh-era-count">{counts[e.id]} games</span>
                </a>
              </li>
            );
          })}
        </ul>
      </header>

      <div className="gh-layout">
        <nav className="gh-toc" aria-label="Chapters">
          <p className="gh-toc-h">Chapters</p>
          <ol>
            {doc.chapters.map((c) => (
              <li key={c.id} className={`tone-${eraOf(c.era).tone}${active === c.id ? " on" : ""}`}>
                <a href={`#${c.id}`} onClick={go(c.id)} aria-current={active === c.id ? "true" : undefined}>{c.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="gh-article">
          {doc.chapters.map((c, i) => {
            const era = eraOf(c.era);
            const prev = doc.chapters[i - 1];
            const newEra = !prev || prev.era !== c.era;
            return (
              <Fragment key={c.id}>
                {newEra && era.tone !== "neutral" && <p className={`gh-era-mark tone-${era.tone}`} aria-hidden="true">{era.label}</p>}
                <section id={c.id} className={`gh-chapter tone-${era.tone}${newEra ? " first" : ""}`} aria-labelledby={`${c.id}-h`}>
                  <h2 id={`${c.id}-h`}>{c.title}</h2>
                  <Blocks blocks={c.blocks} memories={c.era === "stay"} />
                </section>
              </Fragment>
            );
          })}
          <p className="gh-outro" ref={end}>{doc.outro}</p>

          <section className="gh-index" aria-labelledby="gh-index-h">
            <h2 id="gh-index-h">Every game in this story</h2>
            {ERAS.filter((e) => counts[e.id]).map((e) => (
              <div key={e.id} className={`gh-index-group tone-${e.tone}`}>
                <p className="gh-index-label">{e.label}</p>
                <ul>
                  {games.filter((g) => g.era === e.id).map((g) => (
                    <li key={g.name}><a href={`#${g.anchor}`} onClick={go(g.anchor)}>{g.name}</a></li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <div className="ctas gh-ctas">
            <Link viewTransition className="btn primary" to="/games">See the games I'm making</Link>
            <Link viewTransition className="btn" to="/">Back to the desk</Link>
            <Link viewTransition className="btn" to="/about">About the studio</Link>
          </div>
        </article>
      </div>
    </div>
  );
}
