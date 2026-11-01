import { test, expect } from "@playwright/test";
import {
  animationLog,
  collectErrors,
  defaultCompletion,
  expectSettled,
  hideOnboarding,
  mockApi,
  recordAnimations,
  waitForMotion,
} from "./motion-helpers.js";

const PATH = "/learningpath?term=UI%20review";
const MOVING = ["translate", "scale", "transform", "filter", "clipPath"];

let errors;

test.beforeEach(async ({ page }) => {
  errors = collectErrors(page);
  await hideOnboarding(page);
  await recordAnimations(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
});

test.afterEach(async ({ page }) => {
  expect(errors()).toEqual([]);
});

function on(log, className) {
  return log.filter((entry) => entry.target.classes.includes(className));
}

function stubClipboard(page, ok = true) {
  return page.addInitScript((ok) => {
    navigator.clipboard.writeText = () =>
      ok ? Promise.resolve() : Promise.reject(new Error("denied"));
  }, ok);
}

// Under reduce nothing may move: only opacity fades of 150 ms or less.
async function expectReducedLog(page) {
  for (const { target, keyframes, options } of await animationLog(page)) {
    if (target.classes.includes("preparing-progress-fill")) continue;
    if ((options.delay ?? 0) + (options.duration ?? 0) === 0) continue;
    expect((options.delay ?? 0) + options.duration).toBeLessThanOrEqual(150);
    for (const frame of [keyframes].flat()) {
      for (const key of MOVING) expect(frame).not.toHaveProperty(key);
    }
  }
}

async function openGraph(page) {
  await mockApi(page);
  await page.goto(PATH);
  await expect(page.locator(".graph-node")).toHaveCount(3);
  await waitForMotion(page);
}

async function openList(page) {
  await openGraph(page);
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.locator(".concept-summary")).toHaveCount(3);
  await waitForMotion(page);
}

test.describe("direct link entrance", () => {
  test("the title and loading bar rise 60 ms apart", async ({ page }) => {
    const { release } = await mockApi(page, { holdGeneration: true });
    await page.goto(PATH);
    await expect(page.getByRole("progressbar")).toBeVisible();
    const log = await animationLog(page);
    const [title] = on(log, "title-container");
    const [bar] = on(log, "loading-progress-container");
    for (const entry of [title, bar]) {
      expect(entry.options).toMatchObject({ duration: 400, fill: "backwards" });
      expect(entry.keyframes[0]).toMatchObject({
        opacity: 0,
        translate: "0 6px",
        filter: "blur(4px)",
      });
    }
    expect(title.options.delay ?? 0).toBe(0);
    // Loading starts a render after mount; the delay keeps the 60 ms stagger.
    expect(bar.options.delay).toBeGreaterThan(0);
    expect(bar.options.delay).toBeLessThanOrEqual(60);
    release();
    await expect(page.locator(".graph-node")).toHaveCount(3);
    await expectSettled(page);
  });

  test("arriving through Generate plays no entrance", async ({ page }) => {
    await mockApi(page);
    await page.goto("/");
    await page.getByRole("textbox").first().fill("UI review");
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.locator(".graph-node")).toHaveCount(3);
    const log = await animationLog(page);
    expect(on(log, "title-container")).toEqual([]);
    expect(on(log, "loading-progress-container")).toEqual([]);
    await expectSettled(page);
  });

  test("a prerendered load plays no entrance", async ({ page }) => {
    await mockApi(page);
    await page.route("**/learningpath?*", async (route) => {
      if (route.request().resourceType() !== "document") return route.continue();
      const response = await route.fetch();
      const body = (await response.text()).replace(
        '<div id="root"></div>',
        '<div id="root"><div data-prerendered="true"><main><h1>UI review learning path</h1></main></div></div>',
      );
      await route.fulfill({ response, body });
    });
    await page.goto(PATH);
    await expect(page.locator(".graph-node")).toHaveCount(3);
    const log = await animationLog(page);
    expect(on(log, "title-container")).toEqual([]);
    expect(on(log, "loading-progress-container")).toEqual([]);
    await expectSettled(page);
  });

  test("a fast result opens from the bar's settled rect", async ({ page }) => {
    const { release } = await mockApi(page, { holdGeneration: true });
    await page.goto(PATH);
    await expect(page.getByRole("progressbar")).toBeVisible();
    // The layout rect, without the entrance's rise.
    const settledTop = await page
      .locator(".preparing-progress")
      .evaluate((bar) => {
        const container = bar.closest(".loading-progress-container");
        const rise = parseFloat(
          getComputedStyle(container).translate.split(" ")[1] ?? "0",
        );
        return bar.getBoundingClientRect().top - (rise || 0) + scrollY;
      });
    await page.waitForTimeout(100);
    release();
    await expect(page.locator(".graph-node")).toHaveCount(3);
    await waitForMotion(page);
    const [opening] = on(await animationLog(page), "view-swap");
    const dy = parseFloat(opening.keyframes[0].translate.split(" ")[1]);
    const card = await page
      .locator(".view-swap")
      .evaluate((view) => view.getBoundingClientRect().top + scrollY);
    expect(Math.abs(card + dy - settledTop)).toBeLessThan(0.5);
    await expectSettled(page);
  });
});

test.describe("loading", () => {
  test("the sheen sweeps the fill; reduce hides it", async ({ page }) => {
    const { release } = await mockApi(page, { holdGeneration: true });
    await page.goto(PATH);
    const fill = page.locator(".preparing-progress-fill");
    const sheen = () =>
      fill.evaluate((el) => {
        const style = getComputedStyle(el, "::after");
        return [style.animationName, style.animationIterationCount, style.display];
      });
    expect(await sheen()).toEqual(["progress-sheen", "infinite", "block"]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect((await sheen())[2]).toBe("none");
    release();
    await expect(page.locator(".graph-node")).toHaveCount(3);
    await expectSettled(page);
  });

  for (const reducedMotion of ["no-preference", "reduce"]) {
    test(`the overdue note plays in once (${reducedMotion})`, async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion });
      const { release } = await mockApi(page, {
        holdGeneration: true,
        stats: {
          learning_paths_generated: 42,
          generation_estimate: {
            model: "test",
            sample_count: 12,
            median_seconds: 2,
            lower_seconds: 1,
            upper_seconds: 3,
          },
        },
      });
      await page.clock.install();
      await page.goto(PATH);
      await expect(page.locator(".preparing-progress")).toHaveClass(
        /is-estimated/,
      );
      await page.clock.fastForward(4000);
      const note = page.locator(".preparing-estimate");
      await expect(note).toBeVisible();
      expect(
        await note.evaluate((el) => [
          getComputedStyle(el).animationName,
          getComputedStyle(el).animationIterationCount,
        ]),
      ).toEqual([
        reducedMotion === "reduce" ? "estimate-fade" : "estimate-in",
        "1",
      ]);
      release();
      await expect(page.getByRole("button", { name: "Copy path" })).toBeVisible();
    });
  }
});

test.describe("completion handoff", () => {
  test("the bar opens into the card while the controls rise", async ({
    page,
  }) => {
    const { release } = await mockApi(page, { holdGeneration: true });
    await page.goto(PATH);
    await expect(page.getByRole("progressbar")).toBeVisible();
    await waitForMotion(page);
    const bar = await page
      .locator(".preparing-progress")
      .evaluate((el) => el.getBoundingClientRect().toJSON());
    // The ghost lives for 200 ms, so note it the moment it is inserted.
    await page.evaluate(() => {
      const main = document.querySelector("main");
      new MutationObserver((records, observer) => {
        const ghost = main.querySelector(":scope > .bar-ghost");
        if (!ghost) return;
        observer.disconnect();
        window.__ghost = {
          at: performance.now(),
          position: getComputedStyle(ghost).position,
          hidden: ghost.getAttribute("aria-hidden"),
          role: ghost.getAttribute("role"),
          opening: document
            .querySelector(".view-swap")
            .classList.contains("is-opening"),
        };
      }).observe(main, { childList: true });
    });
    release();
    await expect(page.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "Complete",
    );
    const completed = await page.evaluate(() => performance.now());
    await page.waitForFunction(() => window.__ghost);
    const ghost = await page.evaluate(() => window.__ghost);
    expect(ghost.at - completed).toBeGreaterThan(900);
    expect(ghost.at - completed).toBeLessThan(1300);
    expect(ghost).toMatchObject({
      position: "fixed",
      hidden: "true",
      role: null,
      opening: true,
    });
    await expect(page.getByRole("progressbar")).toHaveCount(0);

    const log = await animationLog(page);
    const [opening] = on(log, "view-swap");
    expect(opening.options).toMatchObject({ duration: 600, fill: "backwards" });
    await waitForMotion(page);
    const card = await page
      .locator(".view-swap")
      .evaluate((el) => el.getBoundingClientRect().toJSON());
    const side = (card.width - bar.width) / 2;
    const bottom = card.height - bar.height;
    const clip = opening.keyframes[0].clipPath.match(
      /inset\(0px ([\d.]+)px ([\d.]+)px ([\d.]+)px round 3px\)/,
    );
    expect(Number(clip[1])).toBeCloseTo(side, 0);
    expect(Number(clip[2])).toBeCloseTo(bottom, 0);
    const [dx, dy] = opening.keyframes[0].translate.split(" ").map(parseFloat);
    expect(dx).toBeCloseTo(bar.left + bar.width / 2 - (card.left + card.width / 2), 0);
    expect(dy).toBeCloseTo(bar.top - card.top, 0);
    expect(opening.keyframes[1]).toEqual({
      translate: "0px 0px",
      clipPath: "inset(0px 0px 0px 0px round 16px)",
    });

    const delays = ["path-helper", "search-more", "learning-path-controls", "share-hint"].map(
      (name) => on(log, name)[0]?.options.delay,
    );
    expect(delays).toEqual([80, 120, 160, 200]);
    await expectSettled(page);
  });

  test("reduce fades the result in without a ghost or clip", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openGraph(page);
    await expect(page.locator(".bar-ghost")).toHaveCount(0);
    const log = await animationLog(page);
    expect(on(log, "view-swap")[0]).toMatchObject({
      keyframes: [{ opacity: 0 }, { opacity: 1 }],
      options: { duration: 150 },
    });
    await expectReducedLog(page);
    await expectSettled(page);
  });

  test("a list-only result rises instead of opening", async ({ page }) => {
    const completion = { ...defaultCompletion(), nodes: [], edges: [] };
    await mockApi(page, { completion });
    await page.goto(PATH);
    await expect(page.locator(".concept-summary")).toHaveCount(3);
    await expect(page.locator(".bar-ghost")).toHaveCount(0);
    const [rise] = on(await animationLog(page), "view-swap");
    expect(rise.keyframes[0]).toEqual({ opacity: 0, translate: "0 12px" });
    expect(rise.options).toMatchObject({ duration: 450, delay: 120 });
    await expectSettled(page);
  });

  test("a toggle mid-handoff settles", async ({ page }) => {
    await mockApi(page);
    await page.goto(PATH);
    await page.waitForFunction(
      () => document.querySelector(".view-swap.is-opening"),
      null,
      { polling: "raf" },
    );
    await page.getByRole("button", { name: "List", exact: true }).click();
    await expect(page.locator(".concept-summary")).toHaveCount(3);
    await expectSettled(page);
  });
});

test.describe("list tooltip", () => {
  test("opens from its trigger and leaves on the same element", async ({
    page,
  }) => {
    await openList(page);
    const summary = page.locator(".concept-summary").first();
    const tooltip = page.locator(".concept-tooltip");
    await summary.hover();
    await expect(tooltip).toHaveCount(1);
    const [open] = on(await animationLog(page), "concept-tooltip");
    expect(open.keyframes).toEqual([
      { opacity: 0, scale: "0.96" },
      { opacity: 1, scale: "1" },
    ]);
    expect(open.options.duration).toBe(150);
    await waitForMotion(page);

    await page.mouse.move(5, 5);
    await expect(tooltip).toHaveClass(/is-closing/);
    await expect(tooltip).toHaveAttribute("aria-hidden", "true");
    await expect(tooltip).toHaveCount(0);

    // Closing mid-entrance leaves from the sampled opacity; reopening keeps one element.
    await summary.hover();
    await page.waitForTimeout(60);
    await page.mouse.move(5, 5);
    await summary.hover();
    await expect(tooltip).toHaveCount(1);
    await expect(tooltip).not.toHaveClass(/is-closing/);
    const exits = on(await animationLog(page), "concept-tooltip").filter(
      (entry) => entry.keyframes[1].opacity === 0,
    );
    const midExit = exits.at(-1);
    expect(midExit.keyframes[0].opacity).toBeGreaterThan(0);
    expect(midExit.keyframes[0].opacity).toBeLessThan(1);
    await expectSettled(page);
  });

  test("reopening as the exit finishes shows the tooltip", async ({ page }) => {
    await openList(page);
    await page.mouse.move(5, 5);
    // The exit has finished but the tooltip has not unmounted yet: reopen right then.
    const reopened = await page.evaluate(async () => {
      const summary = document.querySelector(".concept-summary");
      summary.click();
      await new Promise((resolve) => setTimeout(resolve, 400));
      summary.click();
      return new Promise((resolve) => {
        const tick = () => {
          const tooltip = document.querySelector(".concept-tooltip");
          if (!tooltip) return resolve(false);
          if (tooltip.getAnimations().some((a) => a.playState === "finished")) {
            summary.click();
            return resolve(true);
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
    });
    expect(reopened).toBe(true);
    await waitForMotion(page);
    const tooltip = page.locator(".concept-tooltip");
    await expect(tooltip).not.toHaveClass(/is-closing/);
    await expect(tooltip).toHaveCSS("opacity", "1");
    await expectSettled(page);
  });

  test("reduce fades it in and out", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await openList(page);
    await page.locator(".concept-summary").first().hover();
    await expect(page.locator(".concept-tooltip")).toHaveCount(1);
    await page.mouse.move(5, 5);
    await expect(page.locator(".concept-tooltip")).toHaveCount(0);
    await expectReducedLog(page);
    await expectSettled(page);
  });
});

test.describe("copy", () => {
  test("draws a check and shows Copied for 1.5 s", async ({ page }) => {
    await stubClipboard(page);
    await openGraph(page);
    const copy = page.getByRole("button", { name: "Copy path" });
    const done = page.locator(".copy-label-done");
    const width = await copy.evaluate((el) => el.offsetWidth);
    for (let i = 0; i < 5; i++) await copy.click();
    await expect.poll(() => done.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    expect(await copy.evaluate((el) => el.offsetWidth)).toBe(width);
    const log = await animationLog(page);
    const checks = log.filter(
      (entry) => entry.keyframes[0]?.strokeDashoffset === 14,
    );
    expect(checks).toHaveLength(1);
    expect(checks[0].keyframes).toEqual([
      { strokeDashoffset: 14 },
      { strokeDashoffset: 0 },
    ]);
    await page.waitForTimeout(1700);
    await expect.poll(() => done.evaluate((el) => getComputedStyle(el).opacity)).toBe("0");
    await expectSettled(page);
  });

  test("phones show the check only, at the same width", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await stubClipboard(page);
    await openGraph(page);
    const copy = page.getByRole("button", { name: "Copy path" });
    const width = await copy.evaluate((el) => el.offsetWidth);
    await copy.click();
    await expect(page.locator(".copy-label-done")).toHaveCSS("opacity", "1");
    await expect(page.locator(".copy-done-text")).toBeHidden();
    expect(await copy.evaluate((el) => el.offsetWidth)).toBe(width);
    await expectSettled(page, { phone: true });
  });

  test("a denied clipboard shows no Copied state", async ({ page }) => {
    await stubClipboard(page, false);
    await openGraph(page);
    await page.getByRole("button", { name: "Copy path" }).click();
    await expect(page.getByText(/Could not copy/)).toBeVisible();
    await expect(page.locator(".copy-label-done")).toHaveCSS("opacity", "0");
    await expectSettled(page);
  });

  test("reduce swaps the label instantly", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubClipboard(page);
    await openGraph(page);
    await page.getByRole("button", { name: "Copy path" }).click();
    await expect(page.locator(".copy-label-done")).toHaveCSS("opacity", "1");
    expect(
      (await animationLog(page)).filter((entry) =>
        entry.target.classes.some((name) => name.startsWith("copy-")),
      ),
    ).toEqual([]);
    await expectReducedLog(page);
    await expectSettled(page);
  });
});

test.describe("share", () => {
  test("the row rises and the view glides down once", async ({ page }) => {
    await stubClipboard(page);
    await openGraph(page);
    const view = page.locator(".view-swap");
    const before = await view.evaluate((el) => el.getBoundingClientRect().top);
    const share = page.getByRole("button", { name: "Share path" });
    await share.click();
    await expect(page.locator(".share-result")).toBeVisible();
    await waitForMotion(page);
    const after = await view.evaluate((el) => el.getBoundingClientRect().top);
    let log = await animationLog(page);
    expect(on(log, "share-result")[0]).toMatchObject({
      keyframes: [
        { opacity: 0, translate: "0 -4px" },
        { opacity: 1, translate: "0 0" },
      ],
      options: { duration: 240 },
    });
    const glides = on(log, "view-swap").filter(
      (entry) => entry.options.duration === 600 && !entry.keyframes[0].clipPath,
    );
    expect(glides).toHaveLength(1);
    const shift = parseFloat(glides[0].keyframes[0].translate.split(" ")[1]);
    expect(Math.abs(shift - (before - after))).toBeLessThanOrEqual(1);

    await share.click();
    await expect(page.getByText(/Share link copied/).first()).toBeVisible();
    await waitForMotion(page);
    log = await animationLog(page);
    expect(
      on(log, "view-swap").filter(
        (entry) => entry.options.duration === 600 && !entry.keyframes[0].clipPath,
      ),
    ).toHaveLength(1);
    await expectSettled(page);
  });

  test("reduce fades the row without a glide", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await stubClipboard(page);
    await openGraph(page);
    await page.getByRole("button", { name: "Share path" }).click();
    await expect(page.locator(".share-result")).toBeVisible();
    await expectReducedLog(page);
    await expectSettled(page);
  });
});

test("the heading keeps its accessible name", async ({ page }) => {
  await openGraph(page);
  await expect(
    page.getByRole("heading", { name: "UI review learning path" }),
  ).toBeVisible();
  await expect(page.locator("h1 .title-topic")).toHaveText("UI review");
  await expectSettled(page);
});
