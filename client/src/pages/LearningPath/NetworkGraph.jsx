import { useEffect, useId, useRef, useState } from "react";
import * as d3 from "d3";
import { LEVELS, fitLayout, layeredLayout } from "./graphGeometry";
import "./NetworkGraph.scss";

const EMPTY = [];

// Rounded on the left only, so the level accent follows the pill's corners.
function accentPath(node, radius) {
  const x = -node.width / 2,
    y = -node.height / 2,
    h = node.height;
  return (
    `M${x + radius},${y} H${x + 6} V${y + h} H${x + radius}` +
    ` A${radius},${radius} 0 0 1 ${x},${y + h - radius} V${y + radius}` +
    ` A${radius},${radius} 0 0 1 ${x + radius},${y} Z`
  );
}

export default function NetworkGraph({ nodes = EMPTY, edges = EMPTY }) {
  const svgRef = useRef(null);
  const viewportRef = useRef(null);
  const inspectorRef = useRef(null);
  const controllerRef = useRef(null);
  const selectedRef = useRef(null);
  const dragEnabledRef = useRef(false);
  const [selectedId, setSelectedId] = useState(null);
  const [dragEnabled, setDragEnabled] = useState(false);
  const [zoomPercent, setZoomPercent] = useState(100);
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const markerId = "graph-arrow-" + id;
  const selected = nodes.find((node) => node.id === selectedId);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const connections = selected
    ? edges.filter(
        (edge) =>
          (edge.source === selected.id || edge.target === selected.id) &&
          byId.has(edge.source) &&
          byId.has(edge.target),
      )
    : [];
  selectedRef.current = selectedId;
  dragEnabledRef.current = dragEnabled;

  function selectNode(nodeId, reveal = false) {
    setSelectedId(nodeId);
    if (reveal) controllerRef.current?.reveal(nodeId);
  }

  function closeDetails() {
    svgRef.current?.querySelector('[aria-pressed="true"]')?.focus();
    setSelectedId(null);
  }

  useEffect(() => {
    controllerRef.current?.select(selectedId);
    if (inspectorRef.current) inspectorRef.current.scrollTop = 0;
  }, [selectedId]);

  // The layout rebuilds for new data or a new width. Theme is CSS only.
  useEffect(() => {
    if (!svgRef.current || !viewportRef.current) return;
    const svg = d3.select(svgRef.current);
    const viewport = viewportRef.current;
    let size = { width: 0, height: 0 };
    let layout = null;
    let fitOnResize = true;
    let disposed = false;
    const coarse = () => window.matchMedia("(pointer: coarse)").matches;
    const canPan = () => !coarse() || dragEnabledRef.current;
    svg.selectAll("*").remove();
    svg
      .append("defs")
      .append("marker")
      .attr("id", markerId)
      .attr("viewBox", "0 0 10 8")
      .attr("refX", 9)
      .attr("refY", 4)
      .attr("markerWidth", 9)
      .attr("markerHeight", 8)
      .attr("markerUnits", "userSpaceOnUse")
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,0 L9,4 L0,8 Z")
      .attr("fill", "context-stroke");
    const scene = svg.append("g").attr("class", "graph-scene");
    let groups = scene.selectAll(".graph-node");
    let links = scene.selectAll(".graph-links path");
    const zoom = d3
      .zoom()
      .scaleExtent([0.05, 2.5])
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.type === "dblclick") return false;
        return !event.button && canPan();
      })
      .on("zoom", (event) => {
        scene.attr("transform", event.transform);
        setZoomPercent(Math.round(event.transform.k * 100));
        if (event.sourceEvent) fitOnResize = false;
      });
    svg.call(zoom).on("dblclick.zoom", null);

    function build() {
      layout = layeredLayout(nodes, edges, size.width);
      scene.selectAll("*").remove();
      const lanes = scene
        .append("g")
        .attr("class", "graph-lanes")
        .attr("aria-hidden", "true")
        .selectAll("g")
        .data(layout.lanes)
        .join("g")
        .attr("data-level", (lane) => lane.level);
      lanes
        .append("rect")
        .attr("class", "graph-lane")
        .attr("x", (lane) => lane.x)
        .attr("y", (lane) => lane.y)
        .attr("width", (lane) => lane.width)
        .attr("height", (lane) => lane.height)
        .attr("rx", 14);
      links = scene
        .append("g")
        .attr("class", "graph-links")
        .selectAll("path")
        .data(layout.edges)
        .join("path")
        .attr("data-level", (edge) => edge.source.level)
        .attr("d", (edge) => edge.d)
        .attr("marker-end", "url(#" + markerId + ")");
      // Labels sit above the arrows so a crossing arrow never hides them.
      scene
        .append("g")
        .attr("aria-hidden", "true")
        .selectAll("text")
        .data(layout.lanes)
        .join("text")
        .attr("class", "graph-lane-label")
        .attr("data-level", (lane) => lane.level)
        .attr("x", (lane) => lane.x + 14)
        .attr("y", (lane) => lane.y + 20)
        .text(
          (lane) =>
            (lane.level || "Other").toUpperCase() + " · " + lane.count,
        );
      groups = scene
        .append("g")
        .attr("class", "graph-nodes")
        .selectAll("g")
        .data(
          [...layout.nodes].sort((a, b) => a.y - b.y || a.x - b.x),
          (node) => node.id,
        )
        .join("g")
        .attr("class", "graph-node")
        .attr("data-node-id", (node) => node.id)
        .attr("data-level", (node) => node.level)
        .attr("transform", (node) => `translate(${node.x},${node.y})`)
        .attr("tabindex", 0)
        .attr("role", "button")
        .attr(
          "aria-label",
          (node) =>
            node.label + ", " + (node.level || "Concept") + ". Show details",
        )
        .attr("aria-controls", "graph-details-" + id)
        .on("click", (event, node) => {
          if (!event.defaultPrevented) setSelectedId(node.id);
        })
        .on("keydown", (event, node) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedId(node.id);
          }
        })
        .on("focus", (event, node) => reveal(node.id, true));
      groups
        .append("rect")
        .attr("class", "graph-node-ring")
        .attr("x", (node) => -node.width / 2 - 4)
        .attr("y", (node) => -node.height / 2 - 4)
        .attr("width", (node) => node.width + 8)
        .attr("height", (node) => node.height + 8)
        .attr("rx", 15);
      groups
        .append("rect")
        .attr("class", "graph-node-pill")
        .attr("x", (node) => -node.width / 2)
        .attr("y", (node) => -node.height / 2)
        .attr("width", (node) => node.width)
        .attr("height", (node) => node.height)
        .attr("rx", 11);
      groups
        .append("path")
        .attr("class", "graph-node-accent")
        .attr("d", (node) => accentPath(node, 11));
      groups.each(function (node) {
        const text = d3
          .select(this)
          .append("text")
          .attr("class", "graph-node-label")
          .attr("text-anchor", "middle")
          .attr("font-size", layout.fontSize)
          .attr("aria-hidden", "true");
        node.lines.forEach((line, index) =>
          text
            .append("tspan")
            .attr("x", 3)
            .attr(
              "y",
              (index - (node.lines.length - 1) / 2) * layout.lineHeight +
                layout.fontSize * 0.36,
            )
            .text(line),
        );
      });
      // Let CSS clamp the viewport around the layout's natural height.
      viewport.style.setProperty(
        "--graph-layout-height",
        Math.ceil(layout.height) + "px",
      );
      size.height = viewport.getBoundingClientRect().height;
      select(selectedRef.current);
    }
    function fit() {
      const t = fitLayout(layout, size.width, size.height);
      svg.call(zoom.transform, d3.zoomIdentity.translate(t.x, t.y).scale(t.k));
    }
    function reveal(nodeId, onlyIfOutside = false) {
      const node = layout.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const transform = d3.zoomTransform(svg.node());
      const [x, y] = transform.apply([node.x, node.y]);
      const w = (node.width / 2) * transform.k,
        h = (node.height / 2) * transform.k;
      if (
        onlyIfOutside &&
        x - w > 8 &&
        x + w < size.width - 8 &&
        y - h > 8 &&
        y + h < size.height - 8
      )
        return;
      fitOnResize = false;
      const scale = onlyIfOutside ? transform.k : Math.max(transform.k, 1);
      svg.call(
        zoom.transform,
        d3.zoomIdentity
          .translate(
            size.width / 2 - node.x * scale,
            size.height / 2 - node.y * scale,
          )
          .scale(scale),
      );
    }
    function select(nodeId) {
      const neighbors = new Set([nodeId]);
      layout.edges.forEach((edge) => {
        if (edge.source.id === nodeId || edge.target.id === nodeId) {
          neighbors.add(edge.source.id);
          neighbors.add(edge.target.id);
        }
      });
      groups
        .attr("aria-pressed", (node) => (node.id === nodeId ? "true" : "false"))
        .classed("is-selected", (node) => node.id === nodeId)
        .classed("is-muted", (node) => !!nodeId && !neighbors.has(node.id));
      links
        .classed(
          "is-connected",
          (edge) => edge.source.id === nodeId || edge.target.id === nodeId,
        )
        .classed("is-incoming", (edge) => edge.target.id === nodeId)
        .classed("is-outgoing", (edge) => edge.source.id === nodeId)
        .classed(
          "is-muted",
          (edge) =>
            !!nodeId && edge.source.id !== nodeId && edge.target.id !== nodeId,
        );
      // Draw the selected concept's connections above the others.
      links.filter(".is-connected").raise();
    }

    size.width = viewport.getBoundingClientRect().width;
    const known = new Set(nodes.map((node) => node.id));
    if (!known.has(selectedRef.current)) {
      selectedRef.current = null;
      setSelectedId(null);
    }
    build();
    fit();
    const resize = new ResizeObserver((entries) => {
      if (disposed) return;
      const { width: nextWidth, height: nextHeight } = entries[0].contentRect;
      if (!nextWidth || !nextHeight) return;
      if (Math.abs(nextWidth - size.width) >= 1) {
        // A new width reflows the lanes, so earlier pan and zoom no longer apply.
        size = { width: nextWidth, height: nextHeight };
        fitOnResize = true;
        build();
        fit();
      } else if (Math.abs(nextHeight - size.height) >= 1) {
        size.height = nextHeight;
        if (fitOnResize) fit();
      }
    });
    resize.observe(viewport);
    controllerRef.current = {
      select,
      reveal,
      fit: () => {
        fitOnResize = true;
        fit();
      },
      zoomBy: (factor) => {
        fitOnResize = false;
        svg.call(zoom.scaleBy, factor, [size.width / 2, size.height / 2]);
      },
    };
    return () => {
      disposed = true;
      resize.disconnect();
      svg.on(".zoom", null);
      controllerRef.current = null;
    };
  }, [nodes, edges, id, markerId]);

  if (!nodes.length)
    return <p className="graph-empty">No concepts to show yet.</p>;

  return (
    <section
      className="network-graph-container"
      aria-label="Concept graph"
      onKeyDown={(event) => {
        if (event.key === "Escape" && selectedId) {
          event.preventDefault();
          closeDetails();
        }
      }}
    >
      <div className="graph-toolbar">
        <div className="graph-legend" aria-label="Learning stages">
          {LEVELS.map((level) => (
            <span className="legend-item" key={level}>
              <span className="legend-dot" data-level={level} />
              {level}
            </span>
          ))}
        </div>
        <div
          className="graph-tools"
          role="group"
          aria-label="Graph view controls"
        >
          <button
            type="button"
            onClick={() => controllerRef.current?.zoomBy(1 / 1.2)}
            aria-label="Zoom out"
            disabled={zoomPercent <= 5}
          >
            −
          </button>
          <output aria-label="Zoom level" aria-live="off">
            {zoomPercent}%
          </output>
          <button
            type="button"
            onClick={() => controllerRef.current?.zoomBy(1.2)}
            aria-label="Zoom in"
            disabled={zoomPercent >= 250}
          >
            +
          </button>
          <button
            type="button"
            className="graph-fit"
            onClick={() => controllerRef.current?.fit()}
          >
            Fit
          </button>
          <button
            type="button"
            className="graph-drag-toggle"
            aria-pressed={dragEnabled}
            onClick={() => setDragEnabled((value) => !value)}
          >
            Drag graph
          </button>
        </div>
      </div>
      <div className="graph-workspace">
        <div className="graph-canvas">
          <p className="graph-guidance">
            <span className="graph-desktop-help">
              Concepts flow top to bottom by difficulty. Select one for details.
            </span>
            <span className="graph-touch-help">
              Tap a concept for details. Turn on Drag graph to pan and zoom.
            </span>
          </p>
          <div
            className={"graph-viewport" + (dragEnabled ? " is-draggable" : "")}
            ref={viewportRef}
          >
            <svg
              ref={svgRef}
              className="network-graph-svg"
              role="group"
              aria-label="Connected learning concepts"
            />
          </div>
          <div className="graph-details-slot">
            {selected && (
              <button
                type="button"
                className="graph-details-link"
                aria-controls={"graph-details-" + id}
                onClick={() => {
                  inspectorRef.current?.scrollIntoView({
                    block: "nearest",
                    behavior: "instant",
                  });
                  inspectorRef.current
                    ?.querySelector("button")
                    ?.focus({ preventScroll: true });
                }}
              >
                View {selected.label} details ↓
              </button>
            )}
          </div>
          <p className="graph-scroll-help">
            Arrows show what each concept unlocks next.
            <span className="graph-desktop-help">
              {" "}
              Ctrl or ⌘ + scroll to zoom.
            </span>
          </p>
        </div>
        <aside
          ref={inspectorRef}
          className="graph-inspector"
          id={"graph-details-" + id}
          tabIndex={0}
          aria-label="Concept details"
          aria-live="polite"
        >
          {selected ? (
            <>
              <div className="graph-detail-heading">
                <span className="graph-stage-label">{selected.level}</span>
                <button
                  type="button"
                  onClick={closeDetails}
                  aria-label="Close concept details"
                >
                  ×
                </button>
              </div>
              <h3>{selected.label}</h3>
              {selected.summary && <p>{selected.summary}</p>}
              {selected.why && (
                <>
                  <h4>Why it matters</h4>
                  <p>{selected.why}</p>
                </>
              )}
              {connections.length > 0 && (
                <>
                  <h4>Connected concepts</h4>
                  <div
                    className="graph-edge-legend"
                    aria-label="Connection directions"
                  >
                    <span data-direction="incoming">
                      <span aria-hidden="true">→</span> Incoming · prerequisite
                    </span>
                    <span data-direction="outgoing">
                      <span aria-hidden="true">→</span> Outgoing · dependent
                    </span>
                  </div>
                  <ul className="graph-connections">
                    {connections.map((edge, index) => {
                      const incoming = edge.target === selected.id;
                      const neighbor = byId.get(
                        incoming ? edge.source : edge.target,
                      );
                      return (
                        <li
                          key={neighbor.id + index}
                          data-direction={incoming ? "incoming" : "outgoing"}
                        >
                          <button
                            type="button"
                            onClick={() => selectNode(neighbor.id, true)}
                          >
                            <span>
                              {incoming ? "Prerequisite" : "Dependent concept"}
                            </span>
                            {neighbor.label}
                          </button>
                          {edge.relationship && <p>{edge.relationship}</p>}
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </>
          ) : (
            <div className="graph-empty-details">
              <span className="graph-stage-label">{nodes.length} concepts</span>
              <h3>Explore the connections</h3>
              <p>
                Select any concept to read about it and see what comes before
                and after.
              </p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
