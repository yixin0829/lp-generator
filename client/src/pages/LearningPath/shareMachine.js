// The share link of a generated path:
//
//   idle      nothing shared yet
//   creating  the snapshot is being saved
//   shared    `url` opens a copy of the path as it is now; sharing again only
//             copies the link
//   stale     the list was reordered since, so `url` opens the earlier order

export const initialShare = { phase: "idle", url: "" };

export function shareReducer(state, action) {
  switch (action.type) {
    case "requested":
      return state.phase === "idle" || state.phase === "stale"
        ? { phase: "creating", url: state.url, edited: false }
        : state;
    case "created":
      if (state.phase !== "creating") return state;
      return { phase: state.edited ? "stale" : "shared", url: action.url };
    case "failed":
      if (state.phase !== "creating") return state;
      // A failed re-share leaves the earlier link in place.
      return { phase: state.url ? "stale" : "idle", url: state.url };
    case "edited":
      if (state.phase === "shared") return { phase: "stale", url: state.url };
      // The snapshot being saved already has the earlier order.
      if (state.phase === "creating") return { ...state, edited: true };
      return state;
    case "reset":
      return initialShare;
    default:
      return state;
  }
}
