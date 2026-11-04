import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import Home from "./pages/Home.jsx";
import Games from "./pages/Games.jsx";
import About from "./pages/About.jsx";
import GamePage from "./pages/GamePage.jsx";
import NotFound from "./pages/NotFound.jsx";
import { Essay, Follow, Subscribed, Contact, Press, Settings, PocketWildsLog, Passport } from "./pages/TextPages.jsx";

// basename follows Vite's base so the same build works at "/" or a GitHub Pages sub-path.
const basename = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

export default function App() {
  return (
    <BrowserRouter basename={basename}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="games" element={<Games />} />
          <Route path="games/pocket-wilds/updates" element={<PocketWildsLog />} />
          <Route path="games/:gameId" element={<GamePage />} />
          <Route path="wrfm" element={<GamePage id="wrfm" />} />
          <Route path="graffiti" element={<GamePage id="graffiti" />} />
          <Route path="about" element={<About />} />
          <Route path="about/built-by-design" element={<Essay />} />
          <Route path="follow" element={<Follow />} />
          <Route path="follow/subscribed" element={<Subscribed />} />
          <Route path="contact" element={<Contact />} />
          <Route path="press" element={<Press />} />
          <Route path="passport" element={<Passport />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
