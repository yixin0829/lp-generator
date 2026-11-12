import { canRetry } from "./generationFailure";

// The learning path page is in exactly one phase for its topic:
//
//   idle        no topic in the URL
//   loading     the request is in flight
//   completing  the path has arrived and the loading bar is filling to its end
//   ready       the path is on screen; its list can be reordered
//   failed      the request failed for `reason`
//
// `path` is { levels, details, graph } and exists while completing and ready.
// `attempt` counts retries, so each one gets a fresh loading bar.

export function initialGeneration(topic) {
  return { topic, phase: topic ? "loading" : "idle", attempt: 0 };
}

export function generationReducer(state, action) {
  const { topic, attempt } = state;
  switch (action.type) {
    case "topicChanged":
      return initialGeneration(action.topic);
    case "succeeded":
      return state.phase === "loading"
        ? { topic, attempt, phase: "completing", path: action.path }
        : state;
    case "failed":
      return state.phase === "loading"
        ? { topic, attempt, phase: "failed", reason: action.reason }
        : state;
    case "revealed":
      return state.phase === "completing" ? { ...state, phase: "ready" } : state;
    case "reordered":
      return state.phase === "ready"
        ? { ...state, path: { ...state.path, levels: action.levels } }
        : state;
    case "retried":
      return state.phase === "failed" && canRetry(state.reason)
        ? { topic, attempt: attempt + 1, phase: "loading" }
        : state;
    default:
      return state;
  }
}
