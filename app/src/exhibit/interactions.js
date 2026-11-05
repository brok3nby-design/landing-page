// Loads data/interactions.json (kept separate from the 3D model) and resolves an interactive_id to
// its panel definition. Discovery keys may be ranges like "book_1..book_6".
let cache = null;
export async function loadInteractions() {
  if (cache) return cache;
  const res = await fetch(`${import.meta.env.BASE_URL}data/interactions.json`);
  cache = await res.json();
  return cache;
}

export function resolveInteraction(data, id) {
  if (!data || !id) return null;
  for (const kind of ["navigation", "discovery"]) {
    const group = data[kind] || {};
    if (group[id]) return { id, kind, ...group[id] };
    for (const [key, v] of Object.entries(group)) {
      const m = key.match(/^([a-z_]+?)(\d+|XX)(\.\.[a-z_]+\d+)?$/);
      if (m && (key.includes("..") || key.endsWith("XX")) && id.startsWith(m[1])) return { id, kind, ...v };
    }
  }
  return { id, kind: "discovery", panel: { title: id.replace(/_/g, " ") } };
}
