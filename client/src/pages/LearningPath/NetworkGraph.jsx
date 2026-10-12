import { useEffect, useId, useRef, useState } from "react";
import * as d3 from "d3";
import {
  clippedEdge,
  fitGraph,
  labelLines,
  nodeRadius,
  orientGraph,
} from "./graphGeometry";
import "./NetworkGraph.scss";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const EMPTY = [];

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

  useEffect(() => {
    controllerRef.current?.setDragMode(dragEnabled);
  }, [dragEnabled]);

  // The graph only rebuilds for new data. Theme is CSS; resize changes the viewport.
  useEffect(() => {
    if (!svgRef.current || !viewportRef.current) return;
    const svg = d3.select(svgRef.current);
    const viewport = viewportRef.current;
    const { width, height } = viewport.getBoundingClientRect();
    let size = { width, height };
    let fitOnResize = false;
    let disposed = false;
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = () => window.matchMedia("(pointer: coarse)").matches;
    const canDrag = () => !coarse() || dragEnabledRef.current;
    const simNodes = nodes.map((node, index) => {
      const lines = labelLines(node.label || node.id);
      const radius = nodeRadius(lines);
      const angle = index * Math.PI * (3 - Math.sqrt(5));
      const distance = Math.sqrt(index) * (radius * 2 + 20);
      return {
        ...node,
        lines,
        radius,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
        fx: null,
        fy: null,
      };
    });
    const nodeMap = new Map(simNodes.map((node) => [node.id, node]));
    const simEdges = edges
      .filter(
        (edge) =>
          nodeMap.has(edge.source) &&
          nodeMap.has(edge.target) &&
          edge.source !== edge.target,
      )
      .map((edge) => ({ ...edge }));
    const degree = new Map(simNodes.map((node) => [node.id, 0]));
    simEdges.forEach((edge) => {
      degree.set(edge.source, degree.get(edge.source) + 1);
      degree.set(edge.target, degree.get(edge.target) + 1);
    });
    svg.selectAll("*").remove();
    const defs = svg.append("defs");
    defs
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
    const links = scene
      .append("g")
      .attr("class", "graph-links")
      .selectAll("line")
      .data(simEdges)
      .join("line")
      .attr("marker-end", "url(#" + markerId + ")");
    const groups = scene
      .append("g")
      .attr("class", "graph-nodes")
      .selectAll("g")
      .data(simNodes, (node) => node.id)
      .join("g")
      .attr("class", "graph-node")
      .attr("data-node-id", (node) => node.id)
      .attr("data-level", (node) => node.level)
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
      .append("circle")
      .attr("class", "graph-node-ring")
      .attr("r", (node) => node.radius + 5);
    groups
      .append("circle")
      .attr("class", "graph-node-disc")
      .attr("r", (node) => node.radius);
    groups.each(function (node) {
      const text = d3
        .select(this)
        .append("text")
        .attr("class", "graph-node-label")
        .attr("text-anchor", "middle")
        .attr("aria-hidden", "true");
      node.lines.forEach((line, index) =>
        text
          .append("tspan")
          .attr("x", 0)
          .attr("y", (index - (node.lines.length - 1) / 2) * 17 + 5)
          .text(line),
      );
    });
    const zoom = d3
      .zoom()
      .scaleExtent([0.05, 2.5])
      .filter((event) => {
        if (event.type === "wheel") return event.ctrlKey || event.metaKey;
        if (event.type === "dblclick") return false;
        return !event.button && canDrag();
      })
      .on("zoom", (event) => {
        scene.attr("transform", event.transform);
        setZoomPercent(Math.round(event.transform.k * 100));
        if (event.sourceEvent) fitOnResize = false;
      });
    svg.call(zoom).on("dblclick.zoom", null);
    function draw() {
      links.each(function (edge) {
        const end = clippedEdge(edge.source, edge.target);
        d3.select(this)
          .attr("x1", end.x1)
          .attr("y1", end.y1)
          .attr("x2", end.x2)
          .attr("y2", end.y2);
      });
      groups.attr(
        "transform",
        (node) => "translate(" + node.x + "," + node.y + ")",
      );
    }
    function fit() {
      const transform = fitGraph(
        simNodes,
        size.width,
        size.height,
        size.width < 500 ? 16 : 28,
      );
      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(transform.x, transform.y).scale(transform.k),
      );
    }
    function reveal(nodeId, onlyIfOutside = false) {
      const node = nodeMap.get(nodeId);
      if (!node) return;
      const transform = d3.zoomTransform(svg.node());
      const [x, y] = transform.apply([node.x, node.y]);
      const r = node.radius * transform.k;
      if (
        onlyIfOutside &&
        x - r > 8 &&
        x + r < size.width - 8 &&
        y - r > 8 &&
        y + r < size.height - 8
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
      simEdges.forEach((edge) => {
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
        .classed(
          "is-muted",
          (edge) =>
            !!nodeId && edge.source.id !== nodeId && edge.target.id !== nodeId,
        );
    }
    const simulation = d3
      .forceSimulation(simNodes)
      .force(
        "link",
        d3
          .forceLink(simEdges)
          .id((node) => node.id)
          .strength(
            (edge) =>
              0.3 /
              Math.min(degree.get(edge.source.id), degree.get(edge.target.id)),
          )
          .distance(
            (edge) =>
              edge.source.radius + edge.target.radius + (width < 500 ? 36 : 48),
          ),
      )
      .force("charge", d3.forceManyBody().strength(-240))
      .force(
        "collision",
        d3.forceCollide((node) => node.radius + (width < 500 ? 6 : 18)),
      )
      .force("center", d3.forceCenter(0, 0))
      .force("x", d3.forceX(0).strength(width < 500 ? 0.16 : 0.045))
      .force("y", d3.forceY(0).strength(width < 500 ? 0.1 : 0.06))
      .on("tick", draw);
    function settleWithoutMotion() {
      simulation.stop().alpha(1).alphaTarget(0);
      for (let tick = 0; tick < 300; tick++) simulation.tick();
      draw();
      if (fitOnResize) fit();
    }
    if (media.matches) {
      settleWithoutMotion();
      orientGraph(simNodes, size.width, size.height);
    }
    draw();
    svg.call(
      zoom.transform,
      d3.zoomIdentity.translate(size.width / 2, size.height / 2),
    );
    const currentSelection = nodeMap.has(selectedRef.current)
      ? selectedRef.current
      : null;
    if (currentSelection !== selectedRef.current)
      setSelectedId(currentSelection);
    select(currentSelection);
    groups.call(
      d3
        .drag()
        .filter((event) => !event.button && canDrag())
        .clickDistance(5)
        .on("start", (event, node) => {
          fitOnResize = false;
          node.fx = node.x;
          node.fy = node.y;
          if (!event.active)
            simulation
              .alphaDecay(media.matches ? 0.08 : 0.0228)
              .alpha(0.3)
              .alphaTarget(0.3)
              .restart();
        })
        .on("drag", function (event, node) {
          node.fx = node.x = event.x;
          node.fy = node.y = event.y;
          // Track the pointer immediately; the simulation draws the rest once per frame.
          d3.select(this).attr(
            "transform",
            "translate(" + node.x + "," + node.y + ")",
          );
        })
        .on("end", (event, node) => {
          node.fx = null;
          node.fy = null;
          if (!event.active) {
            simulation.alphaTarget(0);
          }
        }),
    );
    // D3 drag sets inline touch-action:none, even when its event filter rejects
    // dragging. Remove that restriction while page scrolling is enabled.
    function setDragMode(enabled) {
      groups.style("touch-action", enabled ? "none" : "pan-y pinch-zoom");
    }
    setDragMode(dragEnabledRef.current);
    const updateMotion = () => {
      if (media.matches) {
        settleWithoutMotion();
      } else {
        simulation.alpha(0.3).restart();
      }
    };
    media.addEventListener("change", updateMotion);
    const resize = new ResizeObserver((entries) => {
      if (disposed) return;
      const { width: nextWidth, height: nextHeight } = entries[0].contentRect;
      if (
        !nextWidth ||
        !nextHeight ||
        (nextWidth === size.width && nextHeight === size.height)
      )
        return;
      const old = size;
      size = { width: nextWidth, height: nextHeight };
      if (fitOnResize) fit();
      else {
        const t = d3.zoomTransform(svg.node());
        svg.call(
          zoom.transform,
          d3.zoomIdentity
            .translate(
              t.x + (size.width - old.width) / 2,
              t.y + (size.height - old.height) / 2,
            )
            .scale(t.k),
        );
      }
    });
    resize.observe(viewport);
    controllerRef.current = {
      select,
      reveal,
      setDragMode,
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
      simulation.stop();
      media.removeEventListener("change", updateMotion);
      svg.on(".zoom", null);
      groups.on(".drag", null);
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
              Select a concept for details. Drag nodes to arrange them.
            </span>
            <span className="graph-touch-help">
              Tap a concept for details. Turn on Drag graph to move around.
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
            Arrows point from a prerequisite to what depends on it.
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
                  <ul className="graph-connections">
                    {connections.map((edge, index) => {
                      const incoming = edge.target === selected.id;
                      const neighbor = byId.get(
                        incoming ? edge.source : edge.target,
                      );
                      return (
                        <li key={neighbor.id + index}>
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
