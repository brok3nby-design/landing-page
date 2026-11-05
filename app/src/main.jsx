import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { loadSiteData } from "./content/data.js";
import "./styles/global.css";

// the page copy (~30 KB gzipped) is loaded before the first render, so text never shifts into place
const render = () => createRoot(document.getElementById("root")).render(<React.StrictMode><App /></React.StrictMode>);
loadSiteData().then(render, render);
