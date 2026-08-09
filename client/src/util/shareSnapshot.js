export function createShareSnapshot({ topic, levels, conceptDetails, graph, defaultView }) {
  return {
    topic,
    levels,
    concept_details: conceptDetails,
    graph,
    default_view: defaultView,
  };
}
