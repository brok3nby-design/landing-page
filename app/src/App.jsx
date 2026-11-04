import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Placeholder from "./pages/Placeholder.jsx";
import Games from "./pages/Games.jsx";
import About from "./pages/About.jsx";
import GamePage from "./pages/GamePage.jsx";

// basename follows Vite's base so the same build works at "/" or a GitHub Pages sub-path.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="games" element={<Games />} />
          <Route path="games/:gameId" element={<GamePage />} />
          <Route path="about" element={<About />} />
          {["projects", "wrfm", "contact"].map((p) => (
            <Route key={p} path={p} element={<Placeholder page={p} />} />
          ))}
          <Route path="*" element={<Placeholder page="notFound" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
