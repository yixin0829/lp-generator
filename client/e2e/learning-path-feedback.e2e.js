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
  // dnd-kit attaches its arrow-key listener in a setTimeout(0) after pickup;
  // equal-delay timers run in order, so one zero-delay timer here runs after it.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[role="status"]')).toContainText("Functions");
  await expect(page.locator(".concept-tooltip")).toHaveCount(0);
  await page.keyboard.press("Space");
  await expect(page.locator(".concept-drag-handle").first()).toContainText(
    "Functions",
  );
});

test("share leads as a compact filled action and its link opens a new tab", async ({
  page,
}) => {
  await openGenerated(page);
  await page.route("**/v1/shares", (route) =>
    route.fulfill({ json: { share_id: "abcdefghijklmnopqrstuv" } }),
  );
  const button = page.getByRole("button", { name: "Share path", exact: true });
  const copy = page.getByRole("button", { name: "Copy path", exact: true });
  await expect(button).toHaveClass(/primary-button/);
  await expect(copy).toHaveClass(/secondary-button/);
  const shareBox = await button.boundingBox();
  expect(shareBox.width).toBeLessThan(200);
  expect(shareBox.x).toBeLessThan((await copy.boundingBox()).x);
  await expect(button).toHaveAccessibleDescription(
    "Anyone with the link can view a copy of this path.",
  );
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

test("a rejected share explains itself instead of showing raw errors", async ({
  page,
}) => {
  await openGenerated(page);
  await page.route("**/v1/shares", (route) =>
    route.fulfill({
      status: 422,
      json: {
        detail: [{ loc: ["body", "graph"], msg: "Invalid", type: "value_error" }],
      },
    }),
  );
  await page.getByRole("button", { name: "Share path", exact: true }).click();
  await expect(
    page.getByText("This path can't be shared. Use Copy to save it instead."),
  ).toBeVisible();
  await expect(page.getByText("[object Object]")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Share path", exact: true }),
  ).toBeEnabled();
});

for (const width of [320, 375, 390]) {
  test(`nav and path controls each fit one row on a ${width}px phone`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 800 });
    await openGenerated(page);
    const rowCount = (selector) =>
      page
        .locator(selector)
        .evaluateAll((elements) => {
          const centers = elements.map((el) => {
            const r = el.getBoundingClientRect();
            return r.top + r.height / 2;
          });
          return Math.max(...centers) - Math.min(...centers);
        });
    // Items on one row share a vertical center.
    expect(
      await rowCount(".navbar-container nav > a, .navbar-tools > button"),
    ).toBeLessThan(4);
    expect(
      await rowCount(".view-toggle, .copy-action, .share-action"),
    ).toBeLessThan(4);
    await expect(
      page.getByRole("button", { name: "How to use", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Share path", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);

    // The row still fits while the share link is being created.
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    await page.route("**/v1/shares", async (route) => {
      await held;
      await route.fulfill({ json: { share_id: "abcdefghijklmnopqrstuv" } });
    });
    await page.getByRole("button", { name: "Share path", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Creating link...", exact: true }),
    ).toBeDisabled();
    expect(
      await rowCount(".view-toggle, .copy-action, .share-action"),
    ).toBeLessThan(4);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width);
    release();
    await expect(
      page.getByRole("link", { name: /Open share link/ }),
    ).toBeVisible();
  });
}

test("a click shuts a pinned concept card while the pointer stays on it", async ({
  page,
}) => {
  await openGenerated(page);
  await page.getByRole("button", { name: "List", exact: true }).click();
  const summary = page.locator(".concept-summary").first();
  const card = page.locator(".concept-tooltip");
  await summary.hover();
  await expect(card).toBeVisible();
  // Pinned: it stays open when the pointer leaves.
  await summary.click();
  await page.mouse.move(5, 5);
  await expect(card).toBeVisible();
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  // Shut by a click, with the pointer still over the concept.
  await summary.click();
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await expect(card).toHaveCount(0);
  // It peeks again only after the pointer has left and come back.
  const box = await summary.boundingBox();
  await page.mouse.move(box.x + 6, box.y + 6);
  await expect(card).toHaveCount(0);
  await page.mouse.move(5, 5);
  await summary.hover();
  await expect(card).toBeVisible();
});

test("Escape shuts an open concept card", async ({ page }) => {
  await openGenerated(page);
  await page.getByRole("button", { name: "List", exact: true }).click();
  const summary = page.locator(".concept-summary").first();
  await summary.click();
  await expect(page.locator(".concept-tooltip")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".concept-tooltip")).toHaveCount(0);
  await expect(summary).toHaveAttribute("aria-expanded", "false");
});

test.describe("touch", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });

  test("a tap opens a concept card and the next tap shuts it", async ({
    page,
  }) => {
    await openGenerated(page);
    await page.getByRole("button", { name: "List", exact: true }).tap();
    const summary = page.locator(".concept-summary").first();
    const card = page.locator(".concept-tooltip");
    await summary.tap();
    await expect(card).toBeVisible();
    await summary.tap();
    await expect(card).toHaveCount(0);
    await summary.tap();
    await expect(card).toBeVisible();
  });
});

async function countClipboardWrites(page) {
  await page.addInitScript(() => {
    window.clipboardWrites = [];
    navigator.clipboard.writeText = (text) => {
      window.clipboardWrites.push(text);
      return Promise.resolve();
    };
  });
}

test("sharing an unchanged path again copies the link without a new request", async ({
  page,
}) => {
  await countClipboardWrites(page);
  await openGenerated(page);
  let posts = 0;
  await page.route("**/v1/shares", (route) => {
    posts += 1;
    return route.fulfill({ json: { share_id: "abcdefghijklmnopqrstuv" } });
  });
  const share = page.getByRole("button", { name: "Share path", exact: true });
  await share.click();
  await expect(page.locator(".share-url")).toContainText(
    "/share/abcdefghijklmnopqrstuv",
  );
  await share.click();
  // Switching the view is not a change to the path.
  await page.getByRole("button", { name: "List", exact: true }).click();
  await share.click();
  await expect
    .poll(() => page.evaluate(() => window.clipboardWrites.length))
    .toBe(3);
  expect(
    new Set(await page.evaluate(() => window.clipboardWrites)).size,
  ).toBe(1);
  expect(posts).toBe(1);
  await expect(page.locator(".share-url")).toBeVisible();
});

test("reordering marks the share link as the earlier order until it is shared again", async ({
  page,
}) => {
  await countClipboardWrites(page);
  await openGenerated(page);
  const ids = ["aaaaaaaaaaaaaaaaaaaaaa", "bbbbbbbbbbbbbbbbbbbbbb"];
  const posts = [];
  await page.route("**/v1/shares", (route) => {
    posts.push(route.request().postDataJSON());
    return route.fulfill({ json: { share_id: ids[posts.length - 1] } });
  });
  await page.getByRole("button", { name: "List", exact: true }).click();
  const share = page.getByRole("button", { name: "Share path", exact: true });
  const link = page.getByRole("link", { name: /Open share link/ });
  await share.click();
  await expect(page.locator(".share-url")).toContainText(ids[0]);

  const handle = page.locator(".concept-drag-handle").first();
  await handle.focus();
  await page.keyboard.press("Space");
  await expect(handle).toHaveAttribute("aria-pressed", "true");
  // dnd-kit attaches its arrow-key listener in a setTimeout(0) after pickup.
  await page.evaluate(() => new Promise((resolve) => setTimeout(resolve, 0)));
  await page.keyboard.press("ArrowDown");
  await expect(page.locator('[role="status"]')).toContainText("Functions");
  await page.keyboard.press("Space");
  await expect(page.locator(".concept-drag-handle").first()).toContainText(
    "Functions",
  );

  await expect(page.locator(".share-result")).toContainText(
    "Shows the earlier order. Share again for a new link.",
  );
  await expect(page.locator(".share-url")).toHaveCount(0);
  await expect(link).toHaveAttribute("href", new RegExp(ids[0]));

  await share.click();
  await expect(page.locator(".share-url")).toContainText(ids[1]);
  await expect(link).toHaveAttribute("href", new RegExp(ids[1]));
  expect(posts).toHaveLength(2);
  expect(posts[0].levels.Beginner[0]).toBe("Variables");
  expect(posts[1].levels.Beginner[0]).toBe("Functions");
});
