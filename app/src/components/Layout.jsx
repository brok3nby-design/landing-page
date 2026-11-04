import { NavLink, Link, Outlet } from "react-router-dom";
import { BRAND, NAV } from "../content/site.js";

export default function Layout() {
  return (
    <div className="site">
      <a className="skip" href="#main">Skip to content</a>
      <header className="header">
        <Link to="/" className="wordmark" aria-label={`${BRAND} — home`}>{BRAND}</Link>
        <nav className="nav" aria-label="Main">
          <ul>
            {NAV.map((n) => (
              <li key={n.to}><NavLink to={n.to} end={n.end}>{n.label}</NavLink></li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main"><Outlet /></main>
      <footer className="footer">© {new Date().getFullYear()} {BRAND} · local prototype</footer>
    </div>
  );
}
