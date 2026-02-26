import { useEffect, useRef, useState, useCallback } from "react";
import * as d3 from "d3";

const LEVEL_COLORS = {
  Beginner: "#22c55e",
  Intermediate: "#f59e0b",
  Advanced: "#ef4444",
};

const LEVEL_COLORS_LIGHT = {
  Beginner: "#dcfce7",
  Intermediate: "#fef3c7",
  Advanced: "#fee2e2",
};

const NODE_RADIUS = 28;
const ARROW_ID = "arrowhead";

function truncateLabel(label, maxLen = 20) {
  if (!label || label.length <= maxLen) return label;
  return label.slice(0, maxLen - 1) + "…";
}

function wrapText(text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let current = "";
  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (test.length > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default function NetworkGraph({ nodes, edges }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const simulationRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [dimensions, setDimensions] = useState({ width: 900, height: 600 });

  const handleResize = useCallback(() => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({
        width: Math.max(rect.width, 400),
        height: Math.max(Math.min(rect.width * 0.65, 700), 450),
      });
    }
  }, []);

  useEffect(() => {
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  useEffect(() => {
    if (!nodes?.length || !svgRef.current) return;

    const { width, height } = dimensions;
    const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
    const validEdges = edges.filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target));

    const simNodes = nodes.map((n) => ({ ...n }));
    const simEdges = validEdges.map((e) => ({ ...e }));

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const defs = svg.append("defs");
    defs
      .append("marker")
      .attr("id", ARROW_ID)
      .attr("viewBox", "0 0 10 6")
      .attr("refX", NODE_RADIUS + 10)
      .attr("refY", 3)
      .attr("markerWidth", 8)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L10,3 L0,6 Z")
      .attr("fill", "#94a3b8");

    const g = svg.append("g");

    const zoom = d3.zoom().scaleExtent([0.3, 3]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    });
    svg.call(zoom);

    const linkGroup = g
      .append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-width", 2)
      .attr("marker-end", `url(#${ARROW_ID})`)
      .attr("cursor", "pointer")
      .on("mouseenter", (event, d) => {
        const sourceNode = simNodes.find((n) => n.id === (typeof d.source === "object" ? d.source.id : d.source));
        const targetNode = simNodes.find((n) => n.id === (typeof d.target === "object" ? d.target.id : d.target));
        d3.select(event.target).attr("stroke", "#7c3aed").attr("stroke-width", 3);
        setTooltip({
          type: "edge",
          x: event.clientX,
          y: event.clientY,
          data: {
            source: sourceNode?.label || d.source,
            target: targetNode?.label || d.target,
            relationship: d.relationship,
          },
        });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : null));
      })
      .on("mouseleave", (event) => {
        d3.select(event.target).attr("stroke", "#cbd5e1").attr("stroke-width", 2);
        setTooltip(null);
      });

    const nodeGroup = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(simNodes)
      .join("g")
      .attr("cursor", "grab")
      .call(
        d3
          .drag()
          .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      );

    nodeGroup
      .append("circle")
      .attr("r", NODE_RADIUS)
      .attr("fill", (d) => LEVEL_COLORS_LIGHT[d.level] || "#f1f5f9")
      .attr("stroke", (d) => LEVEL_COLORS[d.level] || "#64748b")
      .attr("stroke-width", 2.5);

    nodeGroup.each(function (d) {
      const lines = wrapText(truncateLabel(d.label, 16), 10);
      const sel = d3.select(this);
      lines.forEach((line, i) => {
        sel
          .append("text")
          .text(line)
          .attr("text-anchor", "middle")
          .attr("dy", `${(i - (lines.length - 1) / 2) * 1.15 + 0.35}em`)
          .attr("font-size", lines.length > 2 ? "8px" : "9px")
          .attr("font-weight", 600)
          .attr("fill", "#1e293b")
          .attr("pointer-events", "none");
      });
    });

    nodeGroup
      .on("mouseenter", (event, d) => {
        d3.select(event.currentTarget).select("circle").attr("stroke-width", 4);
        setTooltip({
          type: "node",
          x: event.clientX,
          y: event.clientY,
          data: {
            label: d.label,
            level: d.level,
            summary: d.summary,
            why: d.why,
          },
        });
      })
      .on("mousemove", (event) => {
        setTooltip((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY } : null));
      })
      .on("mouseleave", (event) => {
        d3.select(event.currentTarget).select("circle").attr("stroke-width", 2.5);
        setTooltip(null);
      });

    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink(simEdges)
          .id((d) => d.id)
          .distance(120)
      )
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(NODE_RADIUS + 15))
      .force("x", d3.forceX(width / 2).strength(0.05))
      .force("y", d3.forceY(height / 2).strength(0.05))
      .on("tick", () => {
        linkGroup
          .attr("x1", (d) => d.source.x)
          .attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x)
          .attr("y2", (d) => d.target.y);

        nodeGroup.attr("transform", (d) => `translate(${d.x},${d.y})`);
      });

    simulationRef.current = simulation;

    return () => {
      simulation.stop();
    };
  }, [nodes, edges, dimensions]);

  return (
    <div ref={containerRef} className="network-graph-container">
      <div className="graph-legend">
        {Object.entries(LEVEL_COLORS).map(([level, color]) => (
          <span key={level} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />
            {level}
          </span>
        ))}
      </div>
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="network-graph-svg"
      />
      {tooltip && <GraphTooltip tooltip={tooltip} />}
    </div>
  );
}

function GraphTooltip({ tooltip }) {
  const { type, x, y, data } = tooltip;
  const offsetX = 15;
  const offsetY = 10;

  const style = {
    position: "fixed",
    left: `${x + offsetX}px`,
    top: `${y + offsetY}px`,
    zIndex: 9999,
    pointerEvents: "none",
  };

  if (type === "node") {
    return (
      <div className="graph-tooltip" style={style}>
        <h4>
          <span
            className="level-badge"
            style={{
              background: LEVEL_COLORS_LIGHT[data.level],
              color: LEVEL_COLORS[data.level],
              borderColor: LEVEL_COLORS[data.level],
            }}
          >
            {data.level}
          </span>
          {data.label}
        </h4>
        <div className="tooltip-section">
          <span className="tooltip-label">What it is</span>
          <p>{data.summary}</p>
        </div>
        <div className="tooltip-section">
          <span className="tooltip-label">Why it matters</span>
          <p>{data.why}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="graph-tooltip" style={style}>
      <h4 className="edge-title">
        {data.source} → {data.target}
      </h4>
      <div className="tooltip-section">
        <span className="tooltip-label">Connection</span>
        <p>{data.relationship}</p>
      </div>
    </div>
  );
}
