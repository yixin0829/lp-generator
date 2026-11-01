export function createShareSnapshot({ topic, levels, conceptDetails, graph, defaultView }) {
  return {
    topic,
    levels,
    concept_details: conceptDetails,
    graph,
    default_view: defaultView,
  };
}

// The share endpoint rejects content with 400 (moderation), 413 or 422. FastAPI
// sends 422 details as a list and slowapi sends 429s as { error }, so only
// other string details are shown as they are.
export function shareErrorMessage(status, body) {
  if (status === 400 || status === 413 || status === 422) {
    return "This path can't be shared. Use Copy to save it instead.";
  }
  if (status === 429) {
    return "Too many share links in a short time. Wait a minute and try again.";
  }
  return typeof body?.detail === "string" && body.detail
    ? body.detail
    : "Unable to create share.";
}
