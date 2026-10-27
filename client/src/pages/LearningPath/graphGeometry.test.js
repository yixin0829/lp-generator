import { describe, expect, it } from "vitest";
import { fitLayout, labelLines, layeredLayout } from "./graphGeometry";

const NODES = [
  ["syntax", "Syntax and Values", "Beginner"],
  ["vars", "Variables and Scope", "Beginner"],
  ["funcs", "Functions", "Beginner"],
  ["arrays", "Arrays and Objects", "Intermediate"],
  ["dom", "The DOM", "Intermediate"],
  ["async", "Async JavaScript", "Intermediate"],
  ["modules", "Modules", "Advanced"],
  ["testing", "Testing", "Advanced"],
  ["arch", "Application Architecture", "Advanced"],
].map(([id, label, level]) => ({ id, label, level }));
const EDGES = [
  ["syntax", "vars"],
  ["syntax", "funcs"],
  ["syntax", "arrays"],
  ["vars", "funcs"],
  ["vars", "dom"],
  ["funcs", "async"],
  ["funcs", "testing"],
  ["funcs", "modules"],
  ["arrays", "arch"],
  ["dom", "arch"],
  ["async", "testing"],
  ["async", "arch"],
  ["modules", "arch"],
].map(([source, target]) => ({ source, target }));

function overlaps(a, b) {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 &&
    Math.abs(a.y - b.y) < (a.height + b.height) / 2
  );
}

describe("layered graph layout", () => {
  for (const width of [320, 390, 760, 1100]) {
    it(`keeps pills apart and inside a ${width}px viewport`, () => {
      const layout = layeredLayout(NODES, EDGES, width);
      expect(layout.nodes).toHaveLength(NODES.length);
      for (const node of layout.nodes) {
        expect(node.x - node.width / 2).toBeGreaterThanOrEqual(0);
        expect(node.x + node.width / 2).toBeLessThanOrEqual(width);
        expect(node.height).toBeGreaterThanOrEqual(44);
      }
      for (let i = 0; i < layout.nodes.length; i++)
        for (let j = i + 1; j < layout.nodes.length; j++)
          expect(overlaps(layout.nodes[i], layout.nodes[j])).toBe(false);
    });
  }

  it("orders lanes by difficulty and places each concept in its lane", () => {
    const layout = layeredLayout(NODES, EDGES, 390);
    expect(layout.lanes.map((lane) => lane.level)).toEqual([
      "Beginner",
      "Intermediate",
      "Advanced",
    ]);
    for (const node of layout.nodes) {
      const lane = layout.lanes.find((l) => l.level === node.level);
      expect(node.y - node.height / 2).toBeGreaterThan(lane.y);
      expect(node.y + node.height / 2).toBeLessThan(lane.y + lane.height);
    }
    expect(layout.height).toBeGreaterThan(
      layout.lanes.at(-1).y + layout.lanes.at(-1).height,
    );
  });

  for (const width of [340, 390, 760]) {
    it(`aligns each lane on one row with prerequisites first at ${width}px`, () => {
      const byId = new Map(
        layeredLayout(NODES, EDGES, width).nodes.map((n) => [n.id, n]),
      );
      for (const lane of [
        ["syntax", "vars", "funcs"],
        ["arrays", "dom", "async"],
        ["modules", "testing", "arch"],
      ])
        for (const id of lane) expect(byId.get(id).y).toBe(byId.get(lane[0]).y);
      expect(byId.get("vars").x).toBeGreaterThan(byId.get("syntax").x);
      expect(byId.get("funcs").x).toBeGreaterThan(byId.get("vars").x);
      expect(byId.get("arch").x).toBeGreaterThan(byId.get("modules").x);
    });
  }

  it("wraps a lane only when its concepts do not fit the width", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: "n" + i,
      label: "Concept " + i,
      level: "Beginner",
    }));
    const rows = (width) =>
      new Set(layeredLayout(many, [], width).nodes.map((n) => n.y)).size;
    expect(rows(390)).toBeGreaterThan(1);
    expect(rows(1600)).toBe(2);
  });

  it("routes arrows down between lanes and sideways between neighbors", () => {
    const layout = layeredLayout(NODES, EDGES, 390);
    for (const edge of layout.edges) {
      const numbers = edge.d.match(/-?[\d.]+/g).map(Number);
      const [sx, sy] = numbers;
      const [tx, ty] = numbers.slice(-2);
      if (edge.source.y === edge.target.y && edge.adjacent) {
        expect(sx).toBeCloseTo(edge.source.x + edge.source.width / 2);
        expect(tx).toBeLessThan(edge.target.x - edge.target.width / 2);
        expect(tx).toBeGreaterThan(sx);
        expect(ty).toBe(sy);
      } else if (edge.source.y === edge.target.y) {
        expect(sy).toBeCloseTo(edge.source.y - edge.source.height / 2);
        expect(ty).toBeLessThan(edge.target.y - edge.target.height / 2);
      } else {
        expect(Math.abs(sx - edge.source.x)).toBeLessThan(
          edge.source.width / 2,
        );
        expect(sy).toBeCloseTo(edge.source.y + edge.source.height / 2);
        expect(Math.abs(tx - edge.target.x)).toBeLessThan(
          edge.target.width / 2,
        );
        expect(ty).toBeLessThan(edge.target.y - edge.target.height / 2);
      }
    }
    expect(layout.edges.some((edge) => edge.adjacent)).toBe(true);
  });

  it("survives cycles, unknown levels, self-links, and dangling edges", () => {
    const layout = layeredLayout(
      [
        { id: "a", label: "A", level: "Beginner" },
        { id: "b", label: "B", level: "Beginner" },
        { id: "c", label: "C" },
      ],
      [
        { source: "a", target: "b" },
        { source: "b", target: "a" },
        { source: "c", target: "c" },
        { source: "a", target: "missing" },
        { source: "c", target: "a" },
      ],
      390,
    );
    expect(layout.lanes.map((lane) => lane.level)).toEqual([
      "Beginner",
      undefined,
    ]);
    expect(layout.edges).toHaveLength(3);
    for (const edge of layout.edges) expect(edge.d).not.toMatch(/NaN/);
  });

  it("preserves full labels, including long unbroken words", () => {
    const label = "Application Architecture";
    expect(labelLines(label).join(" ")).toBe(label);
    const long = "a".repeat(80);
    expect(labelLines(long).join("")).toBe(long);
    expect(labelLines(long).every((line) => line.length <= 14)).toBe(true);
    const node = layeredLayout(
      [{ id: "long", label: long, level: "Advanced" }],
      [],
      390,
    ).nodes[0];
    expect(node.lines.join("")).toBe(long);
    expect(node.height).toBeGreaterThan(44);
  });

  it("fits at 100% when the viewport holds the layout and scales down otherwise", () => {
    const layout = layeredLayout(NODES, EDGES, 390);
    expect(fitLayout(layout, 390, layout.height)).toEqual({ x: 0, y: 0, k: 1 });
    const t = fitLayout(layout, 390, layout.height / 2);
    expect(t.k).toBeCloseTo(0.5);
    expect(t.y).toBeCloseTo(0);
    expect(t.x + layout.width * t.k).toBeLessThanOrEqual(390);
  });
});
