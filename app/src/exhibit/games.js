// The crate's five cases (diorama/data/games.json: slot -> project) joined with the project copy
// imported from the existing site (projects.json).
export const slotId = (slot) => `game_slot_${String(slot).padStart(2, "0")}`;
export const gameForSlotId = (games, id) => games.find((g) => slotId(g.slot) === id) || null;

export function gamePanel(game, project) {
  if (!game) return null;
  if (!project) return { id: slotId(game.slot), kind: "navigation", panel: { title: "Coming soon", text: "This slot is waiting for the next game." } };
  const pr = project.progress || {};
  return {
    id: slotId(game.slot),
    kind: "navigation",
    label: project.title,
    panel: { eyebrow: project.status, title: project.title, text: `${project.hook} ${project.description}` },
    meta: [pr.testing && pr.testing !== "No ETA" ? `Testing / demo: ${pr.testing}` : null,
           pr.release && pr.release !== "No ETA" ? `Full release: ${pr.release}` : null].filter(Boolean).join(" · ") || null,
    button: { label: "VIEW GAME", route: game.route },
    links: project.trailer ? [{ label: "Watch trailer", route: `${game.route}#trailer` }] : [],
  };
}
