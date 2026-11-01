// Where the typed topic was last seen, so the route transition can fly it into
// the learning path heading. source is the search form or the chip link.

let last = null;

export function rememberTopicMorph(topic, source) {
  last = { topic, source, at: performance.now() };
}

// Always consumes the record; returns it only while it is fresh.
export function takeTopicMorph(maxAgeMs = 3000) {
  const record = last;
  last = null;
  if (!record || performance.now() - record.at > maxAgeMs) return null;
  return { topic: record.topic, source: record.source };
}
