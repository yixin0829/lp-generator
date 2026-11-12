import { test, expect } from "@playwright/test";

import {
  animationLog,
  collectErrors,
  expectSettled,
  hideOnboarding,
  longestAnimation,
  mockApi,
  recordAnimations,
  recordViewTransitions,
  removeViewTransitions,
  setAnimationRate,
  viewTransitionLog,
  waitForMotion,
} from "./motion-helpers.js";

// Routes, theme and toasts (PLAN 5.3, package B).

let errors;
let api;

test.beforeEach(async ({ page }) => {
  errors = collectErrors(page);
  // Generation stays pending, so the learning path page holds still on its loading state.
  api = await mockApi(page, { holdGeneration: true });
  await recordAnimations(page);
  await recordViewTransitions(page);
  // Clipboard writes succeed headless, so Copy path raises its toast.
  await page.addInitScript(() => {
    navigator.clipboard.writeText = () => Promise.resolve();
  });
});

test.afterEach(async () => {
  api.release();
  expect(errors()).toEqual([]);
});

async function open(page, path, { reduce = false, guide = false } = {}) {
  if (!guide) await hideOnboarding(page);
  if (reduce) await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(path);
  await waitForMotion(page);
}

const names = (snapshot) =>
  Object.fromEntries(
    (snapshot ?? []).map(({ name, target }) => [
      name,
      `${target.tag}.${target.classes.join(".")}`,
    ]),
  );

// Under reduced motion only opacity changes, and nothing lasts longer than 150 ms.
function expectReducedLog(log) {
  for (const { target, keyframes, options } of log) {
    if (target.classes.includes("preparing-progress-fill")) continue;
    if ((options.delay ?? 0) + (options.duration ?? 0) <= 0) continue;
    const text = JSON.stringify(keyframes);
    expect(text, `${target.tag}.${target.classes.join(".")}`).not.toMatch(
      /translate|scale|transform|filter|clipPath/,
    );
  }
}

const navLink = (page, name) =>
  page.locator(".navbar-container").getByRole("link", { name, exact: true });

// The page swaps a microtask after the URL changes; wait for the nth transition to end.
async function settleTransition(page, count) {
  await page.waitForFunction(
    (count) => (window.__motionViewTransitions ?? []).length >= count,
    count,
  );
  await waitForMotion(page);
}

async function generate(page, topic) {
  await page.locator("form.topic-search input").fill(topic);
  await page.getByRole("button", { name: "Generate" }).click();
}

// notistack's own module instance, as the app loaded it.
function closeAllSnackbars(page) {
  return page.evaluate(async () => {
    const url = performance
      .getEntriesByType("resource")
      .map((entry) => entry.name)
      .find((name) => name.includes("/deps/notistack.js"));
    const { closeSnackbar } = await import(url);
    closeSnackbar();
  });
}

test.describe("route transitions", () => {
  test("Generate flies the typed topic into the heading", async ({ page }) => {
    await open(page, "/");
    const input = page.locator("form.topic-search input");
    const textBox = await input.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        left:
          rect.left +
          parseFloat(style.borderLeftWidth) +
          parseFloat(style.paddingLeft),
        centre: rect.top + rect.height / 2,
      };
    });
    await generate(page, "Machine learning");
    await expect(page).toHaveURL(/\/learningpath\?term=Machine/);
    await settleTransition(page, 1);

    const log = await viewTransitionLog(page);
    expect(log).toHaveLength(1);
    const [entry] = log;
    expect(entry.classes).toContain("vt-route");
    const proxy = entry.before.find(({ name }) => name === "la-topic");
    expect(proxy.target.tag).toBe("span");
    expect(Math.abs(proxy.rect.left - textBox.left)).toBeLessThanOrEqual(1);
    expect(
      Math.abs(proxy.rect.top + proxy.rect.height / 2 - textBox.centre),
    ).toBeLessThanOrEqual(2);
    expect(names(entry.after)).toEqual({
      "la-nav": "header.navbar-container",
      "la-topic": "span.title-topic",
      "la-title-rest": "span.title-rest",
    });
    expect(entry.finished).toBe(true);

    await expect(page.locator("#main-content")).toBeFocused();
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expectSettled(page);
  });

  test("a chip morphs into its topic page; an alias and a nav link crossfade", async ({
    page,
  }) => {
    await open(page, "/");
    await page.locator(".recommended-prompt", { hasText: "JavaScript" }).click();
    await expect(page).toHaveURL(/\/learn\/javascript$/);
    await settleTransition(page, 1);
    let log = await viewTransitionLog(page);
    expect(log.at(-1).before.map(({ name }) => name)).toContain("la-topic");
    expect(names(log.at(-1).after)["la-topic"]).toBe("span.title-topic");
    await expectSettled(page);

    await navLink(page, "Home").click();
    await settleTransition(page, 2);
    // "js" is an alias: the heading reads "JavaScript", so the topic cannot fly.
    await generate(page, "js");
    await expect(page).toHaveURL(/\/learn\/javascript$/);
    await settleTransition(page, 3);
    log = await viewTransitionLog(page);
    expect(log.at(-1).classes).toContain("vt-route");
    expect(names(log.at(-1).after)["la-topic"]).toBeUndefined();

    await navLink(page, "Topics").click();
    await expect(page).toHaveURL(/\/topics$/);
    await settleTransition(page, 4);
    log = await viewTransitionLog(page);
    expect(log.at(-1).classes).toContain("vt-route");
    expect(log.at(-1).before.map(({ name }) => name)).toEqual(["la-nav"]);
    expect(names(log.at(-1).after)).toEqual({ "la-nav": "header.navbar-container" });
    await expectSettled(page);
  });

  test("Back and Forward each run one route transition", async ({ page }) => {
    await open(page, "/");
    await navLink(page, "Topics").click();
    await settleTransition(page, 1);
    await page.goBack();
    await settleTransition(page, 2);
    await expect(page.locator("main.home-page")).toBeVisible();
    await page.goForward();
    await expect(page).toHaveURL(/\/topics$/);
    await settleTransition(page, 3);
    const log = await viewTransitionLog(page);
    expect(log.map(({ classes }) => classes.includes("vt-route"))).toEqual([
      true,
      true,
      true,
    ]);
    expect(log.every(({ finished }) => finished)).toBe(true);
    await expectSettled(page);
  });

  test("Back during the Generate transition settles on Home", async ({ page }) => {
    await open(page, "/");
    await generate(page, "Machine learning");
    await page.waitForFunction(() =>
      document.documentElement.classList.contains("vt-route"),
    );
    await page.goBack();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator("main.home-page")).toBeVisible();
    await expectSettled(page);
  });

  test("the result page's search flies its topic into the next heading", async ({
    page,
  }) => {
    api.release();
    await open(page, "/learningpath?term=Machine%20learning");
    await page.locator(".graph-node").first().waitFor();
    await waitForMotion(page);
    await page.locator("form.search-more input").fill("Deep learning");
    await page.locator("form.search-more input").press("Enter");
    await expect(page).toHaveURL(/\/learningpath\?term=Deep/);
    await settleTransition(page, 1);
    const [entry] = await viewTransitionLog(page);
    expect(entry.before.map(({ name }) => name)).toContain("la-topic");
    expect(names(entry.after)["la-topic"]).toBe("span.title-topic");
    await expect(page.locator(".title-topic")).toHaveText("Deep learning");
    await page.locator(".graph-node").first().waitFor();
    await expectSettled(page);
  });

  test("a theme toggle and Back during the reveal finish everything", async ({
    page,
  }) => {
    api.release();
    await open(page, "/");
    await generate(page, "Machine learning");
    await page.waitForFunction(
      () => document.querySelector(".view-swap.is-opening"),
      null,
      { polling: "raf" },
    );
    await page.locator(".theme-toggle").click();
    await page.goBack();
    await expect(page.locator("main.home-page")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectSettled(page);
  });

  test("two navigations within one frame run one transition to the latest page", async ({
    page,
  }) => {
    await open(page, "/");
    await page.evaluate(() => {
      const nav = document.querySelector(".navbar-container");
      const link = (name) =>
        [...nav.querySelectorAll("a")].find((a) => a.textContent.trim() === name);
      link("Topics").click();
      setTimeout(() => link("About").click(), 0);
    });
    await expect(page).toHaveURL(/\/about$/);
    await settleTransition(page, 1);
    // Give a wrongly queued second transition time to show up.
    await page.waitForTimeout(300);
    expect(await viewTransitionLog(page)).toHaveLength(1);
    await expect(page.locator("#main-content")).toHaveCount(1);
    await expectSettled(page);
  });

  test("a theme toggle during a route transition finishes both", async ({ page }) => {
    await open(page, "/");
    await page.evaluate(async () => {
      document.querySelector('.navbar-container a[href="/topics"]').click();
      const html = document.documentElement;
      while (!html.classList.contains("vt-route")) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      document.querySelector(".theme-toggle").click();
    });
    await expect(page).toHaveURL(/\/topics$/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectSettled(page);
    const log = await viewTransitionLog(page);
    expect(log.map(({ classes }) => classes.filter((c) => c.startsWith("vt-")))).toEqual([
      ["vt-route"],
      ["vt-theme"],
    ]);
  });

  test("a route change during a pending theme transition finishes both", async ({
    page,
  }) => {
    await open(page, "/");
    await page.evaluate(() => {
      document.querySelector(".theme-toggle").click();
      document.querySelector('.navbar-container a[href="/topics"]').click();
    });
    await expect(page).toHaveURL(/\/topics$/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expectSettled(page);
  });

  test("without View Transitions the new page fades in", async ({ page }) => {
    await removeViewTransitions(page);
    await open(page, "/");
    await navLink(page, "Topics").click();
    await expect(page).toHaveURL(/\/topics$/);
    await page.waitForFunction(() =>
      window.__motionAnimations.some(({ target }) => target.id === "main-content"),
    );
    const fade = (await animationLog(page)).find(
      ({ target }) => target.id === "main-content",
    );
    expect(fade.keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(fade.options).toMatchObject({
      duration: 220,
      delay: 40,
      easing: "ease",
      fill: "backwards",
    });
    await expectSettled(page);
  });

  test("closing the guide after a client-side arrival focuses the page", async ({
    page,
  }) => {
    await open(page, "/feedback", { guide: true });
    await page.getByRole("link", { name: "Generate a learning path on Home" }).click();
    const guide = page.getByRole("dialog");
    await expect(guide).toBeVisible();
    await guide.getByRole("button", { name: "Close guide" }).click();
    await expect(guide).not.toBeVisible();
    await expect(page.locator("#main-content")).toBeFocused();
    expect(
      await page.evaluate(() => document.activeElement.isConnected),
    ).toBe(true);
    await expectSettled(page);
  });

  test("reduced motion crossfades routes in 120 ms", async ({ page }) => {
    await open(page, "/", { reduce: true });
    const longest = await longestAnimation(page, async () => {
      await generate(page, "Machine learning");
      await expect(page).toHaveURL(/\/learningpath/);
    });
    expect(longest).toBeLessThanOrEqual(150);
    const [entry] = await viewTransitionLog(page);
    expect(entry.classes).toContain("vt-route-fade");
    expect(entry.before).toEqual([]);
    expect(entry.after).toEqual([]);
    expectReducedLog(await animationLog(page));
    await expectSettled(page);
  });
});

test.describe("theme", () => {
  test("the new theme opens as a circle from the click, and the icon turns", async ({
    page,
  }) => {
    await open(page, "/");
    const toggle = page.locator(".theme-toggle");
    const box = await toggle.boundingBox();
    await toggle.click({ position: { x: 5, y: 7 } });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await waitForMotion(page);
    const log = await animationLog(page);
    const circle = log.find(({ keyframes }) => keyframes?.clipPath);
    expect(circle.target.tag).toBe("html");
    expect(circle.target.pseudoElement).toBe("::view-transition-new(root)");
    expect(circle.options).toMatchObject({ duration: 450 });
    const [x, y] = circle.keyframes.clipPath[0]
      .match(/at ([\d.]+)px ([\d.]+)px/)
      .slice(1)
      .map(Number);
    expect(Math.abs(x - (box.x + 5))).toBeLessThanOrEqual(1);
    expect(Math.abs(y - (box.y + 7))).toBeLessThanOrEqual(1);
    const icon = log.find(({ target }) =>
      target.classes.includes("theme-toggle-icon"),
    );
    expect(icon.options.duration).toBe(600);
    expect(icon.keyframes[0].transform).toBe("rotate(-90deg) scale(0.55)");
    expect((await viewTransitionLog(page))[0].classes).toContain("vt-theme");
    await expectSettled(page);
  });

  test("a keyboard toggle opens the circle from the button's centre", async ({
    page,
  }) => {
    await open(page, "/");
    const toggle = page.locator(".theme-toggle");
    const box = await toggle.boundingBox();
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await waitForMotion(page);
    const circle = (await animationLog(page)).find(
      ({ keyframes }) => keyframes?.clipPath,
    );
    const [x, y] = circle.keyframes.clipPath[0]
      .match(/at ([\d.]+)px ([\d.]+)px/)
      .slice(1)
      .map(Number);
    expect(Math.abs(x - (box.x + box.width / 2))).toBeLessThanOrEqual(1);
    expect(Math.abs(y - (box.y + box.height / 2))).toBeLessThanOrEqual(1);
    await expectSettled(page);
  });

  test("four rapid toggles settle on the right theme", async ({ page }) => {
    await open(page, "/");
    await page.evaluate(async () => {
      for (let i = 0; i < 4; i++) {
        document.querySelector(".theme-toggle").click();
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
    });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(
      await page.evaluate(() =>
        localStorage.getItem("learnanything.theme.choice.v1"),
      ),
    ).toBe("light");
    await expectSettled(page);
  });

  test("follows the system theme until the toggle picks one", async ({
    page,
  }) => {
    const html = page.locator("html");
    const savedThemes = () =>
      page.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.includes("theme")),
      );
    await page.emulateMedia({ colorScheme: "dark" });
    await open(page, "/");
    await expect(html).toHaveAttribute("data-theme", "dark");
    // Nothing was picked, so nothing is saved and the system still leads.
    expect(await savedThemes()).toEqual([]);
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html).toHaveAttribute("data-theme", "light");
    expect(await savedThemes()).toEqual([]);

    await page.locator(".theme-toggle").click();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await waitForMotion(page);
    expect(await savedThemes()).toEqual(["learnanything.theme.choice.v1"]);
    // A pick outlives system changes and reloads.
    await page.emulateMedia({ colorScheme: "dark" });
    await page.emulateMedia({ colorScheme: "light" });
    await expect(html).toHaveAttribute("data-theme", "dark");
    await page.reload();
    await expect(html).toHaveAttribute("data-theme", "dark");
    await waitForMotion(page);
    await expectSettled(page);
  });

  test("without View Transitions the colours fade for 300 ms", async ({ page }) => {
    await removeViewTransitions(page);
    await open(page, "/");
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveClass(/theme-fading/);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.locator("html")).not.toHaveClass(/theme-fading/, {
      timeout: 1000,
    });
    await expectSettled(page);
  });

  test("reduced motion crossfades the theme in 150 ms", async ({ page }) => {
    await open(page, "/", { reduce: true });
    const longest = await longestAnimation(page, () =>
      page.locator(".theme-toggle").click(),
    );
    expect(longest).toBeLessThanOrEqual(150);
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect((await viewTransitionLog(page))[0].classes).toContain(
      "vt-theme-fade",
    );
    expectReducedLog(await animationLog(page));
    await expectSettled(page);
  });

  test("reduced motion without View Transitions switches at once", async ({
    page,
  }) => {
    await removeViewTransitions(page);
    await open(page, "/", { reduce: true });
    await page.evaluate(() => (window.__motionAnimations.length = 0));
    await page.locator(".theme-toggle").click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(
      await page.evaluate(() =>
        document.documentElement.classList.contains("theme-fading"),
      ),
    ).toBe(false);
    expect(await animationLog(page)).toEqual([]);
    await expectSettled(page);
  });
});

test.describe("snackbar", () => {
  const snacks = (page) => page.locator(".notistack-MuiContent");

  async function openPath(page, options) {
    await open(page, "/learningpath?term=Machine%20learning", options);
    api.release();
    await expect(page.getByRole("button", { name: "Copy path" })).toBeVisible();
    await waitForMotion(page);
  }

  test("a toast rises on the spring and leaves faster", async ({ page }) => {
    await openPath(page);
    await page.getByRole("button", { name: "Copy path" }).click();
    await expect(snacks(page)).toHaveCount(1);
    await waitForMotion(page);
    const log = (await animationLog(page)).filter(({ target }) =>
      target.classes.includes("notistack-MuiContent"),
    );
    expect(log).toHaveLength(2);
    expect(log[0].keyframes[0].transform).toBe("translateY(calc(100% + 24px))");
    expect(log[0].options.duration).toBe(600);
    expect(log[1].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(log[1].options.duration).toBe(180);

    await closeAllSnackbars(page);
    // The exit, notistack's 125 ms pause, then its 175 ms collapse.
    await page.waitForTimeout(180 + 125 + 175 + 150);
    await expect(snacks(page)).toHaveCount(0);
    await expectSettled(page);
  });

  test("a fourth toast pushes the oldest out from where it is", async ({ page }) => {
    await openPath(page);
    // Slowed down, so the oldest is still rising when the fourth arrives.
    const rate = await setAnimationRate(page, 0.1);
    const clickCopy = () =>
      page.evaluate(() =>
        document.querySelector('[aria-label="Copy path"]').click(),
      );
    for (let i = 0; i < 3; i++) await clickCopy();
    await expect(snacks(page)).toHaveCount(3);
    // Samples every toast until one starts leaving; its last sample is where it was.
    const exit = await page.evaluate(async () => {
      const translateY = (element) =>
        new DOMMatrixReadOnly(getComputedStyle(element).transform).f;
      const shown = [...document.querySelectorAll(".notistack-MuiContent")];
      const sampled = new Map();
      document.querySelector('[aria-label="Copy path"]').click();
      for (;;) {
        for (const element of shown) {
          const leaving = element
            .getAnimations()
            .find((animation) => animation.effect.getTiming().fill === "forwards");
          if (leaving) {
            const [from, to] = leaving.effect.getKeyframes();
            return { sampled: sampled.get(element), from, to };
          }
          sampled.set(element, translateY(element));
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    });
    await rate.send("Animation.setPlaybackRate", { playbackRate: 1 });
    const fromY = parseFloat(exit.from.transform.match(/-?[\d.]+/)[0]);
    const toY = parseFloat(exit.to.transform.match(/-?[\d.]+/)[0]);
    // It leaves from where it was, not from rest or from below.
    expect(exit.sampled).toBeGreaterThan(1);
    expect(Math.abs(fromY - exit.sampled)).toBeLessThanOrEqual(3);
    expect(fromY).toBeLessThan(toY);
    expect(Number(exit.from.opacity)).toBeGreaterThan(0);
    expect(Number(exit.to.opacity)).toBe(0);
    await waitForMotion(page);

    for (let i = 0; i < 6; i++) await clickCopy();
    await page.waitForTimeout(1000);
    // Exits reach notistack's onExited, so the pushed-out toasts unmount.
    await expect(snacks(page)).toHaveCount(3);
    // Closing shows the queued toasts next; keep closing until the queue is empty.
    await expect
      .poll(async () => {
        await closeAllSnackbars(page);
        return snacks(page).count();
      }, { intervals: [700], timeout: 10000 })
      .toBe(0);
    await expectSettled(page);
  });

  test("a toast closed during its entrance still closes", async ({ page }) => {
    await openPath(page);
    await page.getByRole("button", { name: "Copy path" }).click();
    await expect(snacks(page)).toHaveCount(1);
    await closeAllSnackbars(page);
    await page.waitForTimeout(600 + 180 + 125 + 175 + 200);
    await expect(snacks(page)).toHaveCount(0);
    await expectSettled(page);
  });

  test("reduced motion fades toasts in 150 ms and out in 100 ms", async ({
    page,
  }) => {
    await openPath(page, { reduce: true });
    await page.getByRole("button", { name: "Copy path" }).click();
    await expect(snacks(page)).toHaveCount(1);
    await waitForMotion(page);
    await closeAllSnackbars(page);
    await page.waitForTimeout(100 + 125 + 175 + 150);
    await expect(snacks(page)).toHaveCount(0);
    const log = (await animationLog(page)).filter(({ target }) =>
      target.classes.includes("notistack-MuiContent"),
    );
    expect(log.map(({ options }) => options.duration)).toEqual([150, 100]);
    expectReducedLog(log);
    await expectSettled(page);
  });
});
