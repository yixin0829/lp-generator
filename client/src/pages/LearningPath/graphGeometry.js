export function labelLines(label, limit = 14) {
  const words = String(label)
    .trim()
    .split(/\s+/)
    .flatMap((word) => {
      const chunks = [];
      for (let i = 0; i < word.length; i += limit)
        chunks.push(word.slice(i, i + limit));
      return chunks;
    });
  const lines = [];
  for (const word of words) {
    const last = lines.length - 1;
    if (last >= 0 && lines[last].length + word.length + 1 <= limit)
      lines[last] += " " + word;
    else lines.push(word);
  }
  return lines.length ? lines : ["Concept"];
}

export function nodeRadius(lines) {
  return (
    0.9 *
    Math.max(
      50,
      ...lines.map((line, index) =>
        Math.hypot(
          line.length * 3.9 + 6,
          (index - (lines.length - 1) / 2) * 17 + 8,
        ),
      ),
    )
  );
}

export function clippedEdge(source, target) {
  const dx = target.x - source.x,
    dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  if (!length)
    return { x1: source.x, y1: source.y, x2: source.x, y2: source.y };
  const start = Math.min(source.radius + 3, length / 2);
  const end = Math.min(target.radius + 5, length / 2);
  return {
    x1: source.x + (dx * start) / length,
    y1: source.y + (dy * start) / length,
    x2: target.x - (dx * end) / length,
    y2: target.y - (dy * end) / length,
  };
}

export function fitGraph(nodes, width, height, padding = 28) {
  if (!nodes.length) return { x: width / 2, y: height / 2, k: 1 };
  const left = Math.min(...nodes.map((n) => n.x - n.radius - 6));
  const right = Math.max(...nodes.map((n) => n.x + n.radius + 6));
  const top = Math.min(...nodes.map((n) => n.y - n.radius - 6));
  const bottom = Math.max(...nodes.map((n) => n.y + n.radius + 6));
  const k = Math.max(
    0.05,
    Math.min(
      1.2,
      (width - padding * 2) / Math.max(1, right - left),
      (height - padding * 2) / Math.max(1, bottom - top),
    ),
  );
  return {
    x: width / 2 - ((left + right) / 2) * k,
    y: height / 2 - ((top + bottom) / 2) * k,
    k,
  };
}

// Rotate the initial force layout when it uses the viewport more efficiently.
// Distances and connections stay unchanged; later viewport changes never rotate it.
export function orientGraph(nodes, width, height) {
  const rotated = nodes.map((node) => ({ ...node, x: -node.y, y: node.x }));
  if (
    fitGraph(rotated, width, height).k <=
    fitGraph(nodes, width, height).k * 1.05
  )
    return;
  nodes.forEach((node) => {
    const x = node.x;
    node.x = -node.y;
    node.y = x;
    node.vx = 0;
    node.vy = 0;
  });
}
