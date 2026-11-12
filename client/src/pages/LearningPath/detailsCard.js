// How a concept's details card opens and closes in List view.
//
//   closed     shut
//   peek       open while a pointer hovers the concept
//   pinned     open until it is closed
//   dismissed  shut by a click or Escape while the pointer is still over the
//              concept; hovering does not reopen it until the pointer leaves
const TRANSITIONS = {
  closed: { enter: "peek", toggle: "pinned" },
  peek: { leave: "closed", toggle: "pinned", escape: "dismissed" },
  pinned: { toggle: "dismissed", escape: "dismissed" },
  // A pointer can only enter from outside, so this card was shut from the keyboard.
  dismissed: { leave: "closed", enter: "peek", toggle: "pinned" },
};

// transition is "enter", "leave", "toggle" or "escape".
export function nextDetails(mode, transition) {
  return TRANSITIONS[mode]?.[transition] ?? mode;
}

export function isDetailsOpen(mode) {
  return mode === "peek" || mode === "pinned";
}
