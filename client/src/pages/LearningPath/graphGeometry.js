export const LEVELS = ["Beginner", "Intermediate", "Advanced"];

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

// Sizes for the layered layout. Narrow screens get tighter spacing and smaller
// pills so three columns fit on a phone at 100% zoom.
function metrics(width) {
  const narrow = width < 520;
  const margin = narrow ? 8 : 12;
  const bandPad = narrow ? 8 : 14;
  const gap = narrow ? 8 : 14;
  const minWidth = narrow ? 92 : 132;
  const maxWidth = narrow ? 150 : 188;
  const inner = width - margin * 2 - bandPad * 2;
  const columns = Math.max(
    1,
    Math.min(6, Math.floor((inner + gap) / (minWidth + gap))),
  );
  const pillWidth = Math.min(
    maxWidth,
    (inner - (columns - 1) * gap) / columns,
  );
  const fontSize = narrow ? 12 : 13;
  return {
    margin,
    gap,
    columns,
    pillWidth,
    fontSize,
    lineHeight: narrow ? 15 : 16,
    charLimit: Math.max(6, Math.floor((pillWidth - 22) / (fontSize * 0.54))),
    laneHeader: 30,
    laneBottom: 14,
    laneGap: 12,
    rowGap: narrow ? 26 : 30,
  };
}

// Longest chain of same-lane prerequisites before each concept. Iteration is
// capped by lane size so a cyclic dependency cannot loop forever.
function laneDepths(laneNodes, edges) {
  const ids = new Set(laneNodes.map((node) => node.id));
  const internal = edges.filter(
    (edge) => ids.has(edge.source) && ids.has(edge.target),
  );
  const depth = new Map(laneNodes.map((node) => [node.id, 0]));
  for (let pass = 0; pass < laneNodes.length; pass++) {
    let changed = false;
    for (const edge of internal) {
      const next = Math.min(laneNodes.length - 1, depth.get(edge.source) + 1);
      if (next > depth.get(edge.target)) {
        depth.set(edge.target, next);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return depth;
}

function side(edge, end) {
  const dy = edge.target.y - edge.source.y;
  if (Math.abs(dy) < 1) return "top";
  const down = dy > 0;
  if (end === "source") return down ? "bottom" : "top";
  return down ? "top" : "bottom";
}

// Spread the ends that share one side of a pill so arrows stay distinguishable.
function assignPorts(nodes, edges) {
  const ports = new Map(nodes.map((node) => [node, { top: [], bottom: [] }]));
  edges.forEach((edge) => {
    for (const end of ["source", "target"]) {
      const other = edge[end === "source" ? "target" : "source"];
      ports.get(edge[end])[side(edge, end)].push({ edge, end, x: other.x });
    }
  });
  for (const [node, sides] of ports)
    for (const list of [sides.top, sides.bottom]) {
      list.sort((a, b) => a.x - b.x);
      const spacing = Math.min(
        12,
        (node.width - 28) / Math.max(1, list.length - 1),
      );
      list.forEach((port, index) => {
        port.edge[port.end + "Offset"] =
          (index - (list.length - 1) / 2) * spacing;
      });
    }
}

export function edgePath(edge) {
  const { source, target } = edge;
  const ss = side(edge, "source"),
    ts = side(edge, "target");
  const sx = source.x + (edge.sourceOffset || 0);
  const tx = target.x + (edge.targetOffset || 0);
  const sy = source.y + (ss === "bottom" ? 1 : -1) * (source.height / 2);
  const ty =
    target.y + (ts === "bottom" ? 1 : -1) * (target.height / 2 + 1.5);
  if (ss === "top" && ts === "top") {
    const lift = 26 + Math.abs(tx - sx) * 0.08;
    return `M${sx},${sy} C${sx},${sy - lift} ${tx},${ty - lift} ${tx},${ty}`;
  }
  const bend = Math.max(16, Math.abs(ty - sy) / 2) * (ty > sy ? 1 : -1);
  // An arrow that skips a row and stays near one column would run behind the
  // pills in between, so bow it out past their edges.
  const pillWidth = Math.min(source.width, target.width);
  let bow = 0;
  if (Math.abs(ty - sy) > 100 && Math.abs(tx - sx) < pillWidth) {
    const direction =
      Math.sign((edge.sourceOffset || 0) + (edge.targetOffset || 0)) ||
      Math.sign(tx - sx) ||
      1;
    bow = (direction * (pillWidth / 2 + 14)) / 0.75;
  }
  return (
    `M${sx},${sy} C${sx + bow},${sy + bend} ` +
    `${tx + bow},${ty - bend} ${tx},${ty}`
  );
}

// Top-to-bottom layout: one lane per difficulty level, and inside each lane one
// row per prerequisite depth, wrapped to the columns that fit the width.
export function layeredLayout(nodes, edges, viewportWidth) {
  const width = Math.max(280, viewportWidth || 0);
  const m = metrics(width);
  const extra = [
    ...new Set(
      nodes.map((n) => n.level).filter((level) => !LEVELS.includes(level)),
    ),
  ];
  const known = new Set(nodes.map((node) => node.id));
  const valid = edges.filter(
    (edge) =>
      known.has(edge.source) &&
      known.has(edge.target) &&
      edge.source !== edge.target,
  );
  const placed = new Map();
  const lanes = [];
  let y = m.margin;

  for (const level of [...LEVELS, ...extra]) {
    const laneNodes = nodes.filter((node) => node.level === level);
    if (!laneNodes.length) continue;
    const depth = laneDepths(laneNodes, valid);
    const laneTop = y;
    y += m.laneHeader;
    const maxDepth = Math.max(...depth.values());
    for (let d = 0; d <= maxDepth; d++) {
      const group = laneNodes
        .map((node, index) => {
          const parents = valid
            .filter((edge) => edge.target === node.id && placed.has(edge.source))
            .map((edge) => placed.get(edge.source).x);
          const bary = parents.length
            ? parents.reduce((a, b) => a + b, 0) / parents.length
            : ((index + 0.5) / laneNodes.length) * width;
          return { node, bary };
        })
        .filter(({ node }) => depth.get(node.id) === d)
        .sort((a, b) => a.bary - b.bary);
      for (let start = 0; start < group.length; start += m.columns) {
        const row = group.slice(start, start + m.columns).map(({ node }) => {
          const lines = labelLines(node.label || node.id, m.charLimit);
          return {
            ...node,
            lines,
            width: m.pillWidth,
            height: Math.max(44, lines.length * m.lineHeight + 18),
          };
        });
        const rowHeight = Math.max(...row.map((node) => node.height));
        const rowWidth = row.length * m.pillWidth + (row.length - 1) * m.gap;
        row.forEach((node, index) => {
          node.height = rowHeight;
          node.x =
            (width - rowWidth) / 2 +
            index * (m.pillWidth + m.gap) +
            m.pillWidth / 2;
          node.y = y + rowHeight / 2;
          placed.set(node.id, node);
        });
        y += rowHeight + m.rowGap;
      }
    }
    y += m.laneBottom - m.rowGap;
    lanes.push({
      level,
      count: laneNodes.length,
      x: m.margin,
      y: laneTop,
      width: width - m.margin * 2,
      height: y - laneTop,
    });
    y += m.laneGap;
  }

  const layoutNodes = [...placed.values()];
  const layoutEdges = valid.map((edge) => ({
    ...edge,
    source: placed.get(edge.source),
    target: placed.get(edge.target),
  }));
  assignPorts(layoutNodes, layoutEdges);
  layoutEdges.forEach((edge) => (edge.d = edgePath(edge)));
  return {
    width,
    height: y - m.laneGap + m.margin,
    fontSize: m.fontSize,
    lineHeight: m.lineHeight,
    lanes,
    nodes: layoutNodes,
    edges: layoutEdges,
  };
}

// Scale the whole layout into the viewport, never above 100%.
export function fitLayout(layout, width, height) {
  const k = Math.max(
    0.05,
    Math.min(
      1,
      width / Math.max(1, layout.width),
      height / Math.max(1, layout.height),
    ),
  );
  return {
    x: (width - layout.width * k) / 2,
    y: (height - layout.height * k) / 2,
    k,
  };
}
