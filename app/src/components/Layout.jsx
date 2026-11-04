import { useEffect } from "react";
import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { BRAND, NAV } from "../content/site.js";
import { useSiteData } from "../content/data.js";
import { setProjects } from "../site/passport.js";
import { startEffects } from "../site/effects.js";
import { Entrance, MusicControl, Robot, StampToast, useScrollSecret } from "./Chrome.jsx";

export default function Layout() {
  const { pathname } = useLocation();
  const data = useSiteData();
  useEffect(() => { if (data) setProjects(data.projects); }, [data]);
  useEffect(() => { startEffects(); }, []);
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useScrollSecret();
  return (
    <div className="site">
      <a className="skip" href="#main">Skip to content</a>
      <header className="header">
        <Link viewTransition to="/" className="wordmark" aria-label={`${BRAND} — home`}>{BRAND}<sup>™</sup></Link>
        <nav className="nav" aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.to}><NavLink viewTransition to={n.to} end={n.end}>{n.label}</NavLink></li>
            ))}
          </ul>
        </nav>
        <MusicControl />
      </header>
      {/* keyed by route: each page fades in (CSS), and its exhibit starts fresh */}
      <main id="main" key={pathname} className="route"><Outlet /></main>
      <footer className="footer">
        <div className="footer-main">
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
      <Entrance wordmark={data?.copy.brand.wordmark} />
    </div>
  );
}
