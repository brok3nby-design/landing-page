import { NavLink, Link, Outlet, useLocation } from "react-router-dom";
import { BRAND, NAV } from "../content/site.js";

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="site">
      <a className="skip" href="#main">Skip to content</a>
      <header className="header">
        <Link viewTransition to="/" className="wordmark" aria-label={`${BRAND} — home`}>{BRAND}</Link>
        <nav className="nav" aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.to}><NavLink viewTransition to={n.to} end={n.end}>{n.label}</NavLink></li>
            ))}
          </ul>
        </nav>
      </header>
      {/* keyed by route: each page fades in (CSS), and its exhibit starts fresh */}
      <main id="main" key={pathname} className="route"><Outlet /></main>
      <footer className="footer">© {new Date().getFullYear()} {BRAND} · local prototype</footer>
    </div>
  );
}
