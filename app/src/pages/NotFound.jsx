import { Link } from "react-router-dom";
export default function NotFound() {
  return (
    <div className="textpage">
      <header className="textpage-head">
        <p className="eyebrow">404</p>
        <h1 className="title">Not found<span className="accent">.</span></h1>
        <p className="intro">This page doesn’t exist (or wandered off).</p>
        <div className="ctas"><Link viewTransition className="btn primary" to="/games">Explore the games</Link><Link viewTransition className="btn" to="/">Back to the studio</Link></div>
      </header>
    </div>
  );
}
