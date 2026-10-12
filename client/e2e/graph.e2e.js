import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("learnanything.onboarding.hidden.v1", "true"),
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/v1/stats", (route) =>
    route.fulfill({ json: { learning_paths_generated: 42 } }),
  );
  await page.route("https://**", (route) => route.abort());
});

async function openGraph(page) {
  await page.goto("/learn/programming-fundamentals");
  await page.getByRole("button", { name: "Graph", exact: true }).click();
  await expect(page.locator(".graph-node")).toHaveCount(9);
}

test("graph keeps multiple prerequisites, 100% zoom, and smaller nodes", async ({
  page,
}) => {
  await openGraph(page);
  await expect(page.locator(".graph-tools output")).toHaveText("100%");
  const geometry = await page.locator(".network-graph-svg").evaluate((svg) => ({
    radius: Number(
      svg
        .querySelector('[data-node-id="functions"] .graph-node-disc')
        .getAttribute("r"),
    ),
    prerequisites: [...svg.querySelectorAll(".graph-links line")]
      .filter((line) => line.__data__.target.id === "algorithms")
      .map((line) => line.__data__.source.id),
  }));
  expect(geometry.radius).toBe(45);
  expect(geometry.prerequisites).toEqual(
    expect.arrayContaining(["control_flow", "data_structures"]),
  );
  await page.locator('[data-node-id="algorithms"]').click();
  await expect(page.locator(".graph-inspector")).toContainText("Control Flow");
  await expect(page.locator(".graph-inspector")).toContainText(
    "Data Structures",
  );
});

test("drag tracks the pointer under reduced motion and releases the node", async ({
  page,
}) => {
  await openGraph(page);
  const node = page.locator('[data-node-id="functions"]');
  await node.scrollIntoViewIfNeeded();
  const rect = await node.boundingBox();
  const start = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 60, start.y - 30, { steps: 12 });
  const error = await node.evaluate(
    (el, target) => {
      const r = el.getBoundingClientRect();
      return Math.hypot(
        r.x + r.width / 2 - target.x,
        r.y + r.height / 2 - target.y,
      );
    },
    { x: start.x + 60, y: start.y - 30 },
  );
  expect(error).toBeLessThan(1);
  await page.mouse.up();
  expect(
    await node.evaluate(
      (el) => el.__data__.fx == null && el.__data__.fy == null,
    ),
  ).toBe(true);
});

test("selection colors incoming and outgoing edges separately in both themes", async ({
  page,
}) => {
  await openGraph(page);
  const viewport = await page.locator(".graph-viewport").boundingBox();
  for (const selected of ["functions", "algorithms"]) {
    await page.locator(`[data-node-id="${selected}"]`).click();
    for (let theme = 0; theme < 2; theme++) {
      const lines = await page
        .locator(".graph-links line")
        .evaluateAll((elements) =>
          elements.map((line) => ({
            source: line.__data__.source.id,
            target: line.__data__.target.id,
            incoming: line.classList.contains("is-incoming"),
            outgoing: line.classList.contains("is-outgoing"),
            stroke: getComputedStyle(line).stroke,
          })),
        );
      for (const line of lines) {
        expect(line.incoming).toBe(line.target === selected);
        expect(line.outgoing).toBe(line.source === selected);
      }
      const incoming = lines.find((line) => line.incoming);
      const outgoing = lines.find((line) => line.outgoing);
      expect(incoming).toBeTruthy();
      expect(outgoing).toBeTruthy();
      expect(incoming.stroke).not.toBe(outgoing.stroke);
      await expect(page.locator(".graph-edge-legend")).toContainText(
        "Incoming · prerequisite",
      );
      await expect(page.locator(".graph-edge-legend")).toContainText(
        "Outgoing · dependent",
      );
      expect((await page.locator(".graph-viewport").boundingBox()).height).toBe(
        viewport.height,
      );
      await page.getByRole("button", { name: /Switch to .* mode/ }).click();
    }
  }
  await page.getByRole("button", { name: "Close concept details" }).click();
  await expect(
    page.locator(".graph-links .is-incoming, .graph-links .is-outgoing"),
  ).toHaveCount(0);
  await expect(page.locator(".graph-edge-legend")).toHaveCount(0);
});

test("theme and resize preserve zoom and graph positions", async ({ page }) => {
  await openGraph(page);
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  const read = () =>
    page.locator(".network-graph-svg").evaluate((svg) => ({
      zoom: svg.__zoom.k,
      positions: [...svg.querySelectorAll(".graph-node")].map((node) =>
        node.getAttribute("transform"),
      ),
      rendered: svg.querySelector(".graph-scene").getAttribute("transform"),
      stored: svg.__zoom.toString(),
    }));
  const before = await read();
  await page.getByRole("button", { name: /Switch to .* mode/ }).click();
  await page.setViewportSize({ width: 1180, height: 900 });
  const after = await read();
  expect(after.zoom).toBe(before.zoom);
  expect(after.positions).toEqual(before.positions);
  expect(after.rendered).toBe(after.stored);
});

test("generated paths retain Graph as the default; topic length matches the API", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("textbox", { name: "What do you want to learn?" }),
  ).toHaveAttribute("maxlength", "120");
  await page.route("**/v1/lp/**", (route) =>
    route.fulfill({
      json: {
        completion: {
          Beginner: ["First", "Second"],
          Intermediate: ["Together"],
          Advanced: [],
          nodes: [
            {
              id: "first",
              label: "First",
              level: "Beginner",
              summary: "First foundation.",
              why: "A prerequisite.",
            },
            {
              id: "second",
              label: "Second",
              level: "Beginner",
              summary: "Second foundation.",
              why: "Another prerequisite.",
            },
            {
              id: "together",
              label: "Together",
              level: "Intermediate",
              summary: "Use both.",
              why: "Combines both foundations.",
            },
          ],
          edges: [
            {
              source: "first",
              target: "together",
              relationship: "Uses the first foundation.",
            },
            {
              source: "second",
              target: "together",
              relationship: "Also uses the second foundation.",
            },
          ],
        },
      },
    }),
  );
  await page.goto("/learningpath?term=Graph%20test");
  await expect(page.locator(".graph-node")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Graph", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.route("**/v1/lp/**", (route) =>
    route.fulfill({
      status: 400,
      json: {
        detail:
          "Input path parameter exceeds maximum length allowed (120 characters).",
      },
    }),
  );
  await page.goto("/learningpath?term=" + "x".repeat(121));
  await expect(page.getByRole("alert")).toContainText(
    "Try a shorter topic or a different phrase.",
  );
  await expect(
    page.getByRole("button", { name: "Try again", exact: true }),
  ).toHaveCount(0);
});

test.describe("mobile", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  test("swiping a node scrolls the page until Drag graph is enabled", async ({
    page,
    context,
  }) => {
    await openGraph(page);
    const node = page.locator('[data-node-id="functions"]');
    await node.evaluate((el) => {
      const r = el.getBoundingClientRect();
      window.scrollBy({ top: r.y + r.height / 2 - 400, behavior: "instant" });
    });
    const rect = await node.boundingBox();
    expect(await node.evaluate((el) => getComputedStyle(el).touchAction)).toBe(
      "pan-y pinch-zoom",
    );
    const initialScroll = await page.evaluate(() => window.scrollY);
    const cdp = await context.newCDPSession(page);
    const x = rect.x + rect.width / 2,
      y = rect.y + rect.height / 2;
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [{ x, y }],
    });
    for (let step = 1; step <= 8; step++) {
      await cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [{ x, y: y - step * 16 }],
      });
      await page.waitForTimeout(20);
    }
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(initialScroll + 50);
    await page.getByRole("button", { name: "Drag graph", exact: true }).click();
    expect(await node.evaluate((el) => getComputedStyle(el).touchAction)).toBe(
      "none",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
  });
});
