import { describe, expect, it } from "vitest";
import {
  clippedEdge,
  fitGraph,
  labelLines,
  nodeRadius,
  orientGraph,
} from "./graphGeometry";

describe("graph geometry", () => {
  it("uses a wide viewport without changing distances between concepts", () => {
    const nodes = [
      { x: 0, y: -250, radius: 50 },
      { x: 0, y: 250, radius: 50 },
    ];
    const before = fitGraph(nodes, 800, 400).k;
    orientGraph(nodes, 800, 400);
    expect(fitGraph(nodes, 800, 400).k).toBeGreaterThan(before);
    expect(Math.hypot(nodes[1].x - nodes[0].x, nodes[1].y - nodes[0].y)).toBe(
      500,
    );
  });
  it("preserves full labels, including long unbroken words", () => {
    const label = "Application Architecture";
    expect(labelLines(label).join(" ")).toBe(label);
    const long = "a".repeat(80);
    expect(labelLines(long).join("")).toBe(long);
    expect(labelLines(long).every((line) => line.length <= 14)).toBe(true);
    expect(nodeRadius(labelLines(long))).toBeGreaterThan(50);
  });

  it("ends connections outside each node instead of pointing at its center", () => {
    const source = { x: 10, y: 20, radius: 50 };
    const target = { x: 210, y: 20, radius: 60 };
    const line = clippedEdge(source, target);
    expect(line).toEqual({ x1: 63, y1: 20, x2: 145, y2: 20 });
  });

  it("handles overlapping and coincident nodes without reversed or invalid lines", () => {
    const a = { x: 0, y: 0, radius: 50 },
      b = { x: 10, y: 0, radius: 50 };
    expect(clippedEdge(a, b).x1).toBeLessThanOrEqual(clippedEdge(a, b).x2);
    expect(Object.values(clippedEdge(a, a)).every(Number.isFinite)).toBe(true);
  });

  it("fits circles and their selection rings inside a phone viewport", () => {
    const nodes = [
      { x: -180, y: -220, radius: 50 },
      { x: 210, y: 250, radius: 70 },
    ];
    const t = fitGraph(nodes, 348, 520);
    for (const node of nodes) {
      expect(t.x + (node.x - node.radius - 6) * t.k).toBeGreaterThanOrEqual(
        27.9,
      );
      expect(t.x + (node.x + node.radius + 6) * t.k).toBeLessThanOrEqual(320.1);
      expect(t.y + (node.y - node.radius - 6) * t.k).toBeGreaterThanOrEqual(
        27.9,
      );
      expect(t.y + (node.y + node.radius + 6) * t.k).toBeLessThanOrEqual(492.1);
    }
    expect(Object.values(fitGraph([], 348, 520)).every(Number.isFinite)).toBe(
      true,
    );
  });
});
