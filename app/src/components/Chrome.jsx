// Site-wide pieces ported from the old website: background-music control, stamp toast (Studio
// Passport), J.E.F.F. the footer robot, the "long way down" scroll secret and the studio entrance.
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMusic, playMusic, pauseMusic, setVolume } from "../site/music.js";
import { onStamp, unlock } from "../site/passport.js";
import { getPref, setPref } from "../site/prefs.js";
import { media } from "../content/data.js";

export function MusicControl() {
  const m = useMusic();
  return (
    <div className="music" role="group" aria-label="Background music">
      <button type="button" aria-pressed={m.playing} onClick={() => (m.playing ? pauseMusic() : playMusic())} title={m.playing && m.title ? `Now playing: ${m.title}` : undefined}>
        {m.playing ? "Ⅱ Pause music" : "♫ Play music"}
      </button>
      <label><span className="sr-only">Music volume</span>
        <input type="range" min="0" max="100" step="1" value={Math.round(m.volume * 100)}
               onChange={(e) => setVolume(Number(e.target.value) / 100)} aria-label="Music volume" />
      </label>
    </div>
  );
}

export function StampToast() {
  const [s, setS] = useState(null);
  useEffect(() => onStamp((info) => { setS(info); setTimeout(() => setS(null), 3600); }), []);
  if (!s) return null;
  return (
    <div className="toast" role="status">
      <span className="stamp-icon" aria-hidden="true">{s.symbol}</span>
      <div><small>Stamp collected</small><strong>{s.title}</strong></div>
    </div>
  );
}

// J.E.F.F. - deliberately uncommon (18 % of page loads), quips verbatim from the old site.
const JEFF = [
  "You found me. Congratulations on winning absolutely nothing.", "I was testing the footer. It failed the vibe check.",
  "You click tiny robots. I catalogue bold life choices.", "This site has a lot of detail. You noticed the robot. Respect.",
  "I am J.E.F.F. Please pretend that stands for something impressive.", "I have reviewed your browsing technique. It is aggressively human.",
  "Do not worry. I only report the funny parts.", "I was built for quality assurance. Then I saw the internet.",
  "You seem lost. That is a valid navigation style.", "The games are evolving. Unlike my pay grade.",
  "I have no hands, yet somehow I am carrying this whole footer.", "Good click. Strong click. Almost professional.",
  "I was told to be helpful. Nobody defined helpful.", "Please enjoy the details. They were made on purpose.",
  "A hidden robot is still more available than most customer support.", "I patrol this footer for bugs. The metaphorical kind. Mostly.",
  "You have excellent taste in obscure clickable objects.", "I am not judging. I am recording. There is a difference.",
  "This is an easter egg. Try not to make it weird.", "J.E.F.F. online. Expectations carefully lowered.",
];
export function Robot() {
  const { pathname } = useLocation();
  const show = useMemo(() => new URLSearchParams(location.search).has("jeff") || Math.random() <= 0.18, [pathname]);   // eslint-disable-line
  const [line, setLine] = useState(null);
  if (!show) return null;
  return (
    <span className="jeff-wrap">
      <button type="button" className="jeff" aria-label="J.E.F.F., a tiny wandering robot"
              onClick={() => { setLine(JEFF[Math.floor(Math.random() * JEFF.length)]); unlock("robot"); }}>▤</button>
      {line && <span className="jeff-line" role="status">{line}</span>}
    </span>
  );
}

export function useScrollSecret() {
  const { pathname } = useLocation();
  useEffect(() => {
    const f = () => {
      const long = document.documentElement.scrollHeight > innerHeight * 1.6;
      if (long && innerHeight + scrollY >= document.documentElement.scrollHeight - 4) unlock("scrolled");
    };
    addEventListener("scroll", f, { passive: true });
    return () => removeEventListener("scroll", f);
  }, [pathname]);
}

// Studio entrance (old index.html): shown when the site is opened at "/" - unless the visitor chose
// "Go straight to the games next time" - and always with ?intro=1. Never on in-site navigation.
const firstPath = typeof location !== "undefined" ? location.pathname : "/";
export function Entrance({ wordmark }) {
  const base = import.meta.env.BASE_URL;
  const atRoot = firstPath === base || firstPath === base.replace(/\/$/, "") || firstPath === base + "index.html";
  const forced = new URLSearchParams(location.search).has("intro");
  const [open, setOpen] = useState(() => (forced || (atRoot && !getPref("skipIntro"))) && !new URLSearchParams(location.search).has("test"));
  const [skip, setSkip] = useState(getPref("skipIntro"));
  const [note, setNote] = useState("");
  useEffect(() => { document.documentElement.classList.toggle("entrance-open", open); }, [open]);
  if (!open) return null;
  return (
    <div className="entrance" role="dialog" aria-modal="true" aria-labelledby="entrance-title">
      <h1 id="entrance-title" className="sr-only">Brok3n by Design — Independent Game Studio</h1>
      {wordmark && <img className="entrance-mark" src={media(wordmark)} alt="Brok3n by Design" width="1040" height="406" />}
      <button type="button" className="btn primary entrance-enter" autoFocus onClick={() => setOpen(false)}>ENTER THE STUDIO</button>
      <label className="entrance-skip">
        <input type="checkbox" checked={skip}
               onChange={(e) => { setSkip(e.target.checked); setNote(setPref("skipIntro", e.target.checked) ? "Preference saved." : "Your browser is blocking saved preferences."); }} />
        Go straight to the games next time
      </label>
      <p className="entrance-note" role="status">{note}</p>
      <p className="entrance-credit">Independently created by Brok3n by Design.</p>
      <MusicControl />
    </div>
  );
}
