// Game metadata lives in diorama/data/games.json (copied to public/data). Each entry maps to a
// GAME_Case_XX slot in the crate; adding a game there adds a case panel, a list entry and a route.
let cache = null;
export async function loadGames() {
  if (cache) return cache;
  const res = await fetch(`${import.meta.env.BASE_URL}data/games.json`);
  cache = (await res.json()).games || [];
  return cache;
}
export const slotId = (slot) => `game_slot_${String(slot).padStart(2, "0")}`;
export const gameForSlotId = (games, id) => games.find((g) => slotId(g.slot) === id) || null;
export const isPlaceholder = (text) => !text || /^PLACEHOLDER/i.test(text);

export function gamePanel(game) {
  if (!game) return null;
  const empty = game.status === "empty" || !game.id;
  return {
    id: slotId(game.slot),
    kind: "navigation",
    label: game.title,
    panel: { title: empty ? "Coming soon" : game.title,
             text: empty ? "This slot is waiting for the next game." : isPlaceholder(game.description) ? "Description to come." : game.description },
    links: game.links || [],
    button: empty ? null : { label: "VIEW GAME", route: game.route },
  };
}
