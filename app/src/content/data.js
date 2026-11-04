// All site content comes from data files imported from the existing website
// (diorama/tools/import_site.py -> diorama/data/*.json, copied to public/data by prepare-assets).
import { useEffect, useState } from "react";

const BASE = import.meta.env.BASE_URL;
let cache = null;
export function loadSiteData() {
  if (!cache) {
    const get = (f) => fetch(`${BASE}data/${f}`).then((r) => r.json());
    cache = Promise.all([get("projects.json"), get("site_copy.json"), get("games.json"), get("interactions.json")])
      .then(([projects, copy, games, interactions]) => ({
        projects: projects.projects, copy, games: games.games, interactions,
        project: (id) => projects.projects.find((p) => p.id === id) || null,
      }));
  }
  return cache;
}
export function useSiteData() {
  const [data, setData] = useState(null);
  useEffect(() => { let live = true; loadSiteData().then((d) => live && setData(d)); return () => { live = false; }; }, []);
  return data;
}

export const media = (p) => (p ? `${BASE}${p}` : null);
// the public project route (WRFM and Graffiti keep short top-level URLs)
export const projectRoute = (id) => (id === "wrfm" ? "/wrfm" : id === "graffiti" ? "/graffiti" : `/games/${id}`);

// imported page copy: items of the section with this heading (null heading = text before the first h2)
export function section(copy, page, heading) {
  return copy?.[page]?.sections.find((s) => s.heading === heading)?.items || [];
}
// prose only: drop button/link labels and decorative symbols the old pages had inline
const CTA = /(→|↗|↓)$|^(Subscribe|No spam\.|Explore|Watch|View|Play|Email the Studio|Back to|See the Games|About the Studio|Download|Contact the studio|Project details|· )/;
export const prose = (items) => items.filter((i) => !(i.type === "p" && (CTA.test(i.text) || i.text.length < 3)));
