import { test, expect } from "@playwright/test";
import {
  animationLog,
  collectErrors,
  expectSettled,
  hideOnboarding,
  longestAnimation,
  mockApi,
  recordAnimations,
  waitForMotion,
} from "./motion-helpers";

// Two concepts per lane, so the reveal has three lanes to stagger.
function laneCompletion() {
  const concepts = [
    ["data", "Python for Data", "Beginner"],
    ["algebra", "Linear Algebra", "Beginner"],
    ["supervised", "Supervised Learning", "Intermediate"],
    ["gradient", "Gradient Descent", "Intermediate"],
    ["deep", "Deep Learning", "Advanced"],
    ["deploy", "Model Deployment", "Advanced"],
  ];
  const nodes = concepts.map(([id, label, level]) => ({
    id,
    label,
    level,
    summary: `${label} summary.`,
    why: `${label} matters.`,
  }));
  const edges = [
    ["data", "algebra"],
    ["data", "supervised"],
    ["algebra", "gradient"],
    ["supervised", "gradient"],
    ["gradient", "deep"],
    ["supervised", "deploy"],
  ].map(([source, target]) => ({
    source,
    target,
    relationship: `${source} leads to ${target}.`,
  }));
  const level = (name) =>
    nodes
      .filter((node) => node.level === name)
      .map((node) => ({
        name: node.label,
        summary: node.summary,
        why: node.why,
        connection: "",
      }));
  return {
    nodes,
    edges,
    Beginner: level("Beginner"),
    Intermediate: level("Intermediate"),
    Advanced: level("Advanced"),
  };
}

// Records the link pass order and whether a path still had its marker when its draw started.
async function recordLinkPasses(page) {
  await page.addInitScript(() => {
    const events = [];
    window.__graphEvents = events;
    const length = SVGGeometryElement.prototype.getTotalLength;
    SVGGeometryElement.prototype.getTotalLength = function () {
      if (this.closest?.(".graph-links")) events.push("length");
      return length.call(this);
    };
    const remove = Element.prototype.removeAttribute;
    Element.prototype.removeAttribute = function (name) {
      if (name === "marker-end") events.push("unmark");
      return remove.call(this, name);
    };
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.closest?.(".graph-links")) {
        events.push(this.hasAttribute("marker-end") ? "draw-marked" : "draw");
      }
      return animate.call(this, keyframes, options);
    };
  });
}

async function prepare(page, reducedMotion) {
  const errors = collectErrors(page);
  await hideOnboarding(page);
  await recordAnimations(page);
  await page.emulateMedia({ reducedMotion });
  await mockApi(page, { completion: laneCompletion() });
  return errors;
}

async function generate(page) {
  await page.goto("/learningpath?term=Machine%20learning");
  await expect(page.locator(".graph-node")).toHaveCount(6);
}

async function openLearnGraph(page) {
  await page.goto("/learn/programming-fundamentals");
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(
    page.locator(".view-swap-item:not(.is-leaving) .graph-node"),
  ).toHaveCount(9);
  await waitForMotion(page);
}

const logged = async (page, className) =>
  (await animationLog(page)).filter((entry) =>
    entry.target.classes.includes(className),
  );

// Under reduce nothing moves: only opacity, and nothing over 150 ms.
function expectGentle(log) {
  for (const entry of log) {
    if (entry.target.classes.includes("preparing-progress-fill")) continue;
    if ((entry.options.duration ?? 0) + (entry.options.delay ?? 0) <= 0)
      continue;
    for (const frame of [].concat(entry.keyframes ?? [])) {
      for (const property of [
        "translate",
        "scale",
        "transform",
        "filter",
        "clipPath",
      ])
        expect(frame?.[property], JSON.stringify(entry)).toBeUndefined();
    }
    expect(entry.options.duration + (entry.options.delay ?? 0)).toBeLessThan(
      151,
    );
  }
}

test.describe("motion", () => {
  test("a generated graph reveals its lanes, nodes and links once", async ({
    page,
  }) => {
    const errors = await prepare(page, "no-preference");
    await recordLinkPasses(page);
    await generate(page);
    await waitForMotion(page);

    const lanes = await logged(page, "graph-lane");
    const labels = await logged(page, "graph-lane-label");
    for (const list of [lanes, labels]) {
      expect(list.map((entry) => entry.options.delay)).toEqual([170, 240, 310]);
      for (const entry of list) {
        expect(entry.options.duration).toBe(360);
        expect(entry.options.fill).toBe("backwards");
        expect(entry.keyframes[0].clipPath).toBe("inset(0 100% 0 0)");
      }
    }

    const places = await page
      .locator(".graph-node")
      .evaluateAll((nodes) =>
        nodes.map((node) =>
          node
            .getAttribute("transform")
            .replace(/translate\(([^,]+),([^)]+)\)/, "translate($1px, $2px)"),
        ),
      );
    const pops = await logged(page, "graph-node");
    expect(pops).toHaveLength(6);
    for (const entry of pops) {
      expect(entry.options.duration).toBe(260);
      const place = entry.keyframes[0].transform.replace(/ scale\(.*$/, "");
      expect(places).toContain(place);
      expect(entry.keyframes[0].transform).toMatch(/scale\(0\.96\)$/);
    }
    // Lane by lane, 90 ms after the lane, 20 ms apart.
    expect(pops.map((entry) => entry.options.delay).sort((a, b) => a - b)).toEqual([
      260, 280, 330, 350, 400, 420,
    ]);

    const draws = (await animationLog(page)).filter(
      (entry) => entry.target.tag === "path" && entry.keyframes[0]?.strokeDasharray,
    );
    expect(draws).toHaveLength(6);
    for (const entry of draws) expect(entry.options.duration).toBe(320);

    const events = await page.evaluate(() => window.__graphEvents);
    const firstUnmark = events.indexOf("unmark");
    expect(events.lastIndexOf("length")).toBeLessThan(firstUnmark);
    expect(events).not.toContain("draw-marked");
    await expect(page.locator(".graph-links path:not([marker-end])")).toHaveCount(0);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("the reveal never replays on List to Graph, on /learn, or late resizes", async ({
    page,
  }) => {
    const errors = await prepare(page, "no-preference");
    await generate(page);
    await waitForMotion(page);
    const revealCount = (await logged(page, "graph-lane")).length;
    // The last link ends about 50 ms before the 900 ms reveal window closes, and a
    // width change inside the window continues the reveal. Resize once it has closed.
    await page.waitForTimeout(200);
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.getByRole("button", { name: "Graph", exact: true }).click();
    await waitForMotion(page);
    expect((await logged(page, "graph-lane")).length).toBe(revealCount);
    await expectSettled(page);

    // A full load starts a new log.
    await openLearnGraph(page);
    expect(await logged(page, "graph-lane")).toHaveLength(0);
    expect(errors()).toEqual([]);
  });

  test("a width rebuild inside the reveal continues it on the new elements", async ({
    page,
  }) => {
    const errors = await prepare(page, "no-preference");
    await page.addInitScript(() => {
      const animate = Element.prototype.animate;
      Element.prototype.animate = function (keyframes, options) {
        if (this.classList?.contains("graph-lane") && !window.__revealStart)
          window.__revealStart = document.timeline.currentTime;
        return animate.call(this, keyframes, options);
      };
    });
    await page.goto("/learningpath?term=Machine%20learning");
    await page.waitForFunction(() => window.__revealStart);
    const first = await page.evaluateHandle(() =>
      document.querySelector(".graph-node"),
    );
    await page.waitForTimeout(100);
    await page.setViewportSize({ width: 900, height: 720 });
    await page.waitForFunction((node) => !node.isConnected, first);
    const drift = await page.evaluate(() => {
      const elapsed = document.timeline.currentTime - window.__revealStart;
      return [...document.querySelectorAll(".graph-node")].map((node) => {
        const animation = node.getAnimations()[0];
        return animation ? Math.abs(animation.currentTime - elapsed) : null;
      });
    });
    expect(drift.length).toBe(6);
    expect(drift.filter((value) => value !== null).length).toBeGreaterThan(0);
    for (const value of drift) {
      // A finished pop has nothing left to continue; a running one is in step.
      if (value !== null) expect(value).toBeLessThan(40);
    }
    await page.waitForTimeout(1000);
    await expect(page.locator(".graph-links path:not([marker-end])")).toHaveCount(0);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("hovering a node lifts it 1 px with a shadow", async ({ page }) => {
    const errors = await prepare(page, "no-preference");
    await openLearnGraph(page);
    const node = page.locator('[data-node-id="functions"]');
    await node.hover();
    await page.waitForTimeout(250);
    const style = await node.evaluate((element) => ({
      translate: getComputedStyle(element).translate,
      filter: getComputedStyle(element.querySelector(".graph-node-pill")).filter,
    }));
    expect(style.translate).toBe("0px -1px");
    expect(style.filter).toContain("drop-shadow");
    await page.mouse.move(0, 0);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("selection springs the ring and raises the inspector content", async ({
    page,
  }) => {
    const errors = await prepare(page, "no-preference");
    await openLearnGraph(page);
    await page.locator('[data-node-id="algorithms"]').click();
    const ring = await logged(page, "graph-node-ring");
    expect(ring).toHaveLength(1);
    expect(ring[0].keyframes[0]).toMatchObject({ scale: "0.86", opacity: 0 });
    expect(ring[0].options.duration).toBe(600);
    const rows = (await animationLog(page)).filter(
      (entry) => entry.target.tag === "li",
    );
    expect(rows.length).toBeGreaterThan(1);
    rows.forEach((entry, index) => {
      expect(entry.options.delay).toBe(60 + 30 * index);
      expect(entry.options.duration).toBe(200);
    });
    const heading = (await logged(page, "graph-detail-heading"))[0];
    expect(heading.keyframes[0]).toMatchObject({ opacity: 0, translate: "0 8px" });

    for (const id of [
      "functions",
      "control_flow",
      "data_structures",
      "algorithms",
      "functions",
    ])
      await page.locator(`[data-node-id="${id}"]`).click({ delay: 0 });
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("zoom, Fit and refits glide while the state applies at once", async ({
    page,
  }) => {
    const errors = await prepare(page, "no-preference");
    await openLearnGraph(page);
    const svg = page.locator(".network-graph-svg");
    const glides = async () => (await logged(page, "graph-scene")).length;
    const state = () =>
      svg.evaluate((element) => {
        const scene = element.querySelector(".graph-scene");
        return {
          k: element.__zoom.k,
          attributeMatches:
            scene.getAttribute("transform") === element.__zoom.toString(),
          shown: getComputedStyle(scene).transform,
          running: scene.getAnimations().length,
        };
      });

    await page.getByRole("button", { name: "Zoom in" }).click();
    const zoomed = await state();
    expect(zoomed.k).toBeCloseTo(1.2);
    expect(zoomed.attributeMatches).toBe(true);
    expect(zoomed.shown).not.toBe("matrix(1.2, 0, 0, 1.2, 0, 0)");
    await expect(page.locator(".graph-tools output")).toHaveText("120%");
    const glide = (await logged(page, "graph-scene"))[0];
    expect(glide.options.duration).toBe(220);
    expect(glide.options.fill).toBeUndefined();

    for (let i = 0; i < 4; i++)
      await page.getByRole("button", { name: "Zoom in" }).click({ delay: 0 });
    const spammed = await state();
    expect(spammed.k).toBeCloseTo(1.2 ** 5);
    expect(spammed.running).toBeLessThanOrEqual(1);
    await waitForMotion(page);

    let before = await glides();
    await page.getByRole("button", { name: "Fit" }).click();
    expect(await glides()).toBe(before + 1);
    await waitForMotion(page);

    // A height-only change while the graph fits refits with a glide (SPEC E4).
    before = await glides();
    await page.locator(".graph-viewport").evaluate((element) => {
      element.style.height = "600px";
    });
    await expect.poll(glides).toBe(before + 1);
    await page.locator(".graph-viewport").evaluate((element) => {
      element.style.height = "";
    });
    await waitForMotion(page);

    before = await glides();
    const box = await svg.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -200);
    await page.keyboard.up("Control");
    await page.setViewportSize({ width: 1100, height: 720 });
    await expect.poll(async () => (await state()).attributeMatches).toBe(true);
    await page.waitForTimeout(200);
    expect(await glides()).toBe(before);
    expect((await state()).attributeMatches).toBe(true);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("the toggle pill slides, retargets and re-places on resize", async ({
    page,
  }) => {
    const errors = await prepare(page, "no-preference");
    await generate(page);
    await waitForMotion(page);
    await expectSettled(page);
    await expect(page.getByRole("button", { name: "Graph", exact: true })).toHaveCount(1);
    await expect(page.getByRole("button", { name: "List", exact: true })).toHaveCount(1);

    await page.getByRole("button", { name: "List", exact: true }).click();
    await page.waitForTimeout(100);
    const midway = await page.locator(".view-toggle").evaluate((toggle) => {
      const surface = toggle.querySelector(".view-toggle-pill-surface");
      const [graph, list] = toggle.querySelectorAll(":scope > button");
      const left = parseFloat(
        getComputedStyle(surface).clipPath.match(/inset\(([^)]*)\)/)[1].split(/\s+/)[3],
      );
      return {
        running: surface.getAnimations().length,
        left,
        from: graph.offsetLeft,
        to: list.offsetLeft,
      };
    });
    expect(midway.running).toBe(1);
    expect(midway.left).toBeGreaterThan(midway.from);
    expect(midway.left).toBeLessThan(midway.to);

    for (const name of ["Graph", "List", "Graph", "List"])
      await page.getByRole("button", { name, exact: true }).click({ delay: 0 });
    await expectSettled(page);

    // Phones restyle the buttons; the pill follows without sliding.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => {
      const surface = document.querySelector(".view-toggle-pill-surface");
      const active = document.querySelector('.view-toggle > button[aria-pressed="true"]');
      const left = parseFloat(
        getComputedStyle(surface).clipPath.match(/inset\(([^)]*)\)/)[1].split(/\s+/)[3],
      );
      return Math.abs(left - active.offsetLeft) < 0.5 && !surface.getAnimations().length;
    });
    await expectSettled(page, { phone: true });
    expect(errors()).toEqual([]);
  });

  for (const route of ["generated", "learn"]) {
    test(`views crossfade on the ${route} page and the new graph builds once`, async ({
      page,
    }) => {
      const errors = await prepare(page, "no-preference");
      if (route === "generated") {
        await generate(page);
        await waitForMotion(page);
        await page.getByRole("button", { name: "List", exact: true }).click();
        await waitForMotion(page);
      } else {
        await page.goto("/learn/programming-fundamentals");
      }
      const before = (await animationLog(page)).length;
      await page.getByRole("button", { name: "Graph", exact: true }).click();
      const leaving = page.locator(".view-swap-item.is-leaving");
      await expect(leaving).toHaveCount(1);
      expect(await leaving.getAttribute("inert")).not.toBeNull();
      expect(await leaving.getAttribute("aria-hidden")).toBe("true");
      await page
        .locator(".view-swap-item:not(.is-leaving) .graph-node")
        .first()
        .evaluate((node) => (window.__firstNode = node));
      const swap = (await animationLog(page))
        .slice(before)
        .filter((entry) => entry.target.classes.includes("view-swap-item"));
      const exit = swap.find((entry) => entry.target.classes.includes("is-leaving"));
      const entrance = swap.find((entry) => !entry.target.classes.includes("is-leaving"));
      expect(exit.options).toMatchObject({ duration: 130, fill: "forwards" });
      expect(exit.keyframes[1]).toMatchObject({ opacity: 0, filter: "blur(2px)" });
      expect(entrance.options).toMatchObject({ duration: 240, delay: 80 });
      expect(entrance.keyframes[0]).toMatchObject({ opacity: 0, scale: "0.99" });
      await page.waitForTimeout(400);
      await expect(page.locator(".view-swap-item")).toHaveCount(1);
      expect(await page.evaluate(() => window.__firstNode.isConnected)).toBe(true);

      // A second toggle drops the view that is still leaving at once.
      // Separate tasks, as two real clicks are; React batches clicks in one task.
      const count = await page.evaluate(async () => {
        const [graph, list] = document.querySelectorAll(".view-toggle > button");
        const nextTask = () => new Promise((resolve) => setTimeout(resolve));
        list.click();
        await nextTask();
        graph.click();
        await nextTask();
        return document.querySelectorAll(".view-swap-item").length;
      });
      expect(count).toBe(2);
      await expectSettled(page);
      expect(errors()).toEqual([]);
    });
  }
});

test.describe("reduced motion", () => {
  test("the graph and views only fade, briefly", async ({ page }) => {
    const errors = await prepare(page, "reduce");
    await generate(page);
    await waitForMotion(page);
    expect(await logged(page, "graph-lane")).toHaveLength(0);
    expect(await logged(page, "graph-node")).toHaveLength(0);

    const node = page.locator('[data-node-id="gradient"]');
    await node.hover();
    expect(await node.evaluate((element) => getComputedStyle(element).translate)).toBe(
      "none",
    );
    const selection = await longestAnimation(page, () => node.click());
    expect(selection).toBeLessThanOrEqual(150);
    expect(await logged(page, "graph-node-ring")).toHaveLength(0);
    const heading = (await logged(page, "graph-detail-heading"))[0];
    expect(heading.options.duration).toBe(120);

    const zoom = await longestAnimation(page, () =>
      page.getByRole("button", { name: "Zoom in" }).click(),
    );
    expect(zoom).toBeLessThanOrEqual(150);
    expect(await logged(page, "graph-scene")).toHaveLength(0);

    const before = (await animationLog(page)).length;
    const swap = await longestAnimation(page, () =>
      page.getByRole("button", { name: "List", exact: true }).click(),
    );
    expect(swap).toBeLessThanOrEqual(150);
    const views = (await animationLog(page))
      .slice(before)
      .filter((entry) => entry.target.classes.includes("view-swap-item"))
      .map((entry) => entry.options.duration);
    expect(views.sort()).toEqual([100, 120]);
    expectGentle(await animationLog(page));
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });
});
