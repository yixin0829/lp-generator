import { test, expect } from "@playwright/test";

function completion(longSummary = false) {
  const nodes = ["Variables", "Functions", "Testing"].map((label, index) => ({
    id: label.toLowerCase(),
    label,
    level: "Beginner",
    summary:
      longSummary && index === 0
        ? "A detailed explanation of variables and their uses. ".repeat(100)
        : `${label} summary.`,
    why: `${label} helps explain how the program behaves.`,
  }));
  return {
    nodes,
    edges: [
      {
        source: "variables",
        target: "functions",
        relationship: "Functions use variable bindings.",
      },
      {
        source: "functions",
        target: "testing",
        relationship: "Tests check function behavior.",
      },
    ],
    Beginner: nodes.map((node) => ({
      name: node.label,
      summary: node.summary,
      why: node.why,
      connection: "Related concepts and their dependencies. ".repeat(80),
    })),
    Intermediate: [],
    Advanced: [],
  };
}

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

async function openGenerated(page, longSummary = false) {
  await page.route("**/v1/lp/**", (route) =>
    route.fulfill({ json: { completion: completion(longSummary) } }),
  );
  await page.goto("/learningpath?term=UI%20review");
  await expect(page.locator(".graph-node")).toHaveCount(3);
}

test("home removes the AI copy and keeps the count in the subtitle", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("New topics are generated with AI.")).toHaveCount(
    0,
  );
  await expect(page.locator(".home-intro")).toContainText(
    "42 paths have been generated.",
  );
});

test("long concept details scroll without changing the graph window", async ({
  page,
}) => {
  await openGenerated(page, true);
  const graph = page.locator(".graph-workspace");
  const before = await graph.boundingBox();
  const viewportBefore = await page.locator(".graph-viewport").boundingBox();
  await page.locator('[data-node-id="variables"]').click();
  const after = await graph.boundingBox();
  const viewportAfter = await page.locator(".graph-viewport").boundingBox();
  expect(after.height).toBeCloseTo(before.height, 0);
  expect(viewportAfter.height).toBeCloseTo(viewportBefore.height, 0);
  const panel = page.locator(".graph-inspector");
  expect(await panel.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  await panel.evaluate((el) => {
    el.scrollTop = 200;
  });
  expect(await panel.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
});

test("mobile details stay scrollable without shrinking the graph viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openGenerated(page, true);
  const before = await page.locator(".graph-viewport").boundingBox();
  await page.locator('[data-node-id="variables"]').click();
  const after = await page.locator(".graph-viewport").boundingBox();
  expect(after.height).toBeCloseTo(before.height, 0);
  expect(after.width).toBeCloseTo(before.width, 0);
  const panel = page.locator(".graph-inspector");
  expect((await panel.boundingBox()).height).toBeLessThanOrEqual(360);
  expect(await panel.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(
    true,
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
});

test("the preparing progress bar stays active until the path is ready", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  await page.route("**/v1/lp/**", async (route) => {
    await pending;
    await route.fulfill({ json: { completion: completion() } });
  });
  await page.goto("/learningpath?term=Loading%20review");
  const progress = page.getByRole("progressbar", {
    name: "Preparing your learning path",
  });
  await expect(progress).toBeVisible();
  await expect(
    page.getByText("Preparing your learning path...", { exact: true }),
  ).toBeVisible();
  await expect(progress).not.toHaveAttribute("aria-valuenow", /.+/);
  const fill = progress.locator(".preparing-progress-fill");
  const first = await fill.evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(180);
  const later = await fill.evaluate((el) => getComputedStyle(el).transform);
  expect(later).not.toBe(first);
  expect(
    await fill.evaluate((el) => getComputedStyle(el).animationIterationCount),
  ).toBe("infinite");
  finish();
  await expect(progress).toHaveCount(0);
});

test("only concept headings drag; summaries show details without reordering", async ({
  page,
}) => {
  await openGenerated(page);
  await page.getByRole("button", { name: "List", exact: true }).click();
  const first = page.locator(".concept-summary").first();
  await first.hover();
  await expect(page.locator(".concept-tooltip")).toContainText(
    "Variables helps explain",
  );
  const summaryBounds = await first.boundingBox();
  await page.mouse.move(
    summaryBounds.x + 12,
    summaryBounds.y + summaryBounds.height + 2,
    { steps: 12 },
  );
  const popup = page.locator(".concept-tooltip");
  await expect(popup).toBeVisible();
  await popup.hover();
  await page.mouse.wheel(0, 160);
  await expect
    .poll(() => popup.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0);
  const before = await page.locator(".concept-drag-handle").allTextContents();
  const rect = await first.boundingBox();
  await page.mouse.move(rect.x + 10, rect.y + 10);
  await page.mouse.down();
  await page.mouse.move(rect.x + 10, rect.y + 90, { steps: 8 });
  await page.mouse.up();
  expect(await page.locator(".concept-drag-handle").allTextContents()).toEqual(
    before,
  );
  const handle = page.locator(".concept-drag-handle").first();
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[role="status"]')).toContainText("Functions");
  await page.keyboard.press("Space");
  await expect(page.locator(".concept-drag-handle").first()).toContainText(
    "Functions",
  );
});

test("share action stays compact and the share link opens a new tab", async ({
  page,
}) => {
  await openGenerated(page);
  await page.route("**/v1/shares", (route) =>
    route.fulfill({ json: { share_id: "abcdefghijklmnopqrstuv" } }),
  );
  const button = page.getByRole("button", { name: "Share path", exact: true });
  expect((await button.boundingBox()).width).toBeLessThan(200);
  await button.click();
  const link = page.getByRole("link", { name: /Open share link/ });
  await expect(link).toHaveAttribute("target", "_blank");
  const original = page.url();
  const popupPromise = page.waitForEvent("popup");
  await link.click();
  const popup = await popupPromise;
  await expect(popup).toHaveURL(/\/share\/abcdefghijklmnopqrstuv/);
  expect(page.url()).toBe(original);
  await popup.close();
});
