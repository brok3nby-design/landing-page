import { useEffect, useState } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { BRAND, NAV } from "../content/site.js";
import { useSiteData, media } from "../content/data.js";
import { setProjects } from "../site/passport.js";
import { startEffects } from "../site/effects.js";
import { Entrance, MusicControl, Robot, StampToast, useScrollSecret } from "./Chrome.jsx";
import RadioBar from "./RadioBar.jsx";
import { setMoodFor } from "../site/music.js";

export default function Layout() {
  const { pathname } = useLocation();
  const data = useSiteData();
  useEffect(() => { if (data) setProjects(data.projects); }, [data]);
  useEffect(() => { startEffects(); }, []);
  const [menu, setMenu] = useState(false);              // phone menu (the nav collapses below 700 px)
  useEffect(() => { window.scrollTo(0, 0); setMenu(false); setMoodFor(pathname); }, [pathname]);   // music follows the page's mood
  useEffect(() => {
    if (!menu) return;
    const k = (e) => e.key === "Escape" && setMenu(false);
    addEventListener("keydown", k); return () => removeEventListener("keydown", k);
  }, [menu]);
  useScrollSecret();
  return (
    <div className="site">
      <a className="skip" href="#main">Skip to content</a>
      <header className="header">
        <Link viewTransition to="/" className="wordmark" aria-label={`${BRAND} — home`}>
          {BRAND}<sup>™</sup>
        </Link>
        <button type="button" className="menu-toggle" aria-expanded={menu} aria-controls="site-menu" onClick={() => setMenu(!menu)}>
          {menu ? "Close" : "Menu"}
        </button>
        <div id="site-menu" className={`menu${menu ? " open" : ""}`}>
          <nav className="nav" aria-label="Main">
            <ul>
              {NAV.map((n) => (
                <li key={n.to}><NavLink viewTransition to={n.to} end={n.end}>{n.label}</NavLink></li>
              ))}
            </ul>
          </nav>
          <MusicControl />
        </div>
      </header>
      {/* keyed by route: each page fades in (CSS), and its exhibit starts fresh */}
      <main id="main" key={pathname} className="route"><Outlet /></main>
      <footer className="footer">
        <div className="footer-main">
          {data?.copy.brand.mark && <img className="footer-mark" src={media(data.copy.brand.mark)} alt="B3 — Brok3n by Design" width="72" height="72" loading="lazy" />}
          <p className="eyebrow">Independent game studio</p>
          <p>Independently created by Brok3n by Design.</p>
          <p><a href="https://x.com/brok3nbydesign" target="_blank" rel="noopener">@brok3nbydesign on X</a></p>
          <p className="dim">© {new Date().getFullYear()} Brok3n by Design™. All rights reserved.</p>
        </div>
        <ul className="footer-links">
          <li><Link viewTransition to="/passport">Studio Passport</Link></li>
          <li><Link viewTransition to="/settings">Effects &amp; sound</Link></li>
          <li><Link viewTransition to="/press">Press kit</Link></li>
          <li><a href={`${import.meta.env.BASE_URL}?intro=1`}>Studio entrance</a></li>
        </ul>
        <Robot />
      </footer>
      <StampToast />
      <RadioBar />
      <BackToTop />{/* no key: a second sibling keyed by pathname would collide with <main key={pathname}> */}
      {__BUILD__.staging && (
        <aside aria-label="Staging notice">
          <a className="staging-badge" href={`${import.meta.env.BASE_URL}version.json`} title={`Build ${__BUILD__.commit} · ${__BUILD__.date}`}>
            Staging · not the live site
          </a>
        </aside>
      )}
      <Entrance wordmark={data?.copy.brand.wordmark} />
    </div>
  );
}

// "Back to top": appears bottom-right once the page has been scrolled down a screen or so (only on pages long
// enough to scroll); smooth unless reduced motion. Focus moves to the top of the page for keyboard users.
function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const on = () => setShow(window.scrollY > Math.min(600, window.innerHeight * 0.8));
    on();
    addEventListener("scroll", on, { passive: true }); addEventListener("resize", on);
    return () => { removeEventListener("scroll", on); removeEventListener("resize", on); };
  }, []);
  const up = () => {
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches || document.documentElement.classList.contains("b3d-still");
    window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
    document.querySelector(".wordmark")?.focus({ preventScroll: true });
  };
  return (
    <button type="button" className={`to-top${show ? " show" : ""}`} onClick={up} aria-hidden={!show} tabIndex={show ? 0 : -1}>
      <span aria-hidden="true">↑</span> Back to top
    </button>
  );
}
