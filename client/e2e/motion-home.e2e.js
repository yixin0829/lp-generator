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

// Package A of the Crafted motion port: Home (M1-M4, M6), buttons (M5) and the guide (M22).

const HERO_KEYFRAMES = [
  { opacity: 0, translate: "0 6px", filter: "blur(4px)" },
  { opacity: 1, translate: "0 0", filter: "blur(0px)" },
];

const isHero = (entry) =>
  entry.options.duration === 400 &&
  JSON.stringify(entry.keyframes) === JSON.stringify(HERO_KEYFRAMES);

const isCountClock = (entry) =>
  entry.target.tag === "strong" &&
  Array.isArray(entry.keyframes) &&
  entry.keyframes.length === 0 &&
  entry.options.duration === 900;

const isCountFade = (entry) => entry.target.classes.includes("subtitle-count");

// Under reduce nothing may move: only opacity changes with a duration.
function expectNoMovement(log) {
  for (const entry of log) {
    const timed = (entry.options.delay ?? 0) + (entry.options.duration ?? 0) > 0;
    if (!timed) continue;
    expect(JSON.stringify(entry.keyframes)).not.toMatch(
      /translate|scale|transform|filter|clipPath/,
    );
  }
}

// The placeholder rotates every 3 s while idle; a tab that reads as hidden keeps it still,
// so expectSettled never lands on a swap in tests about other moments.
async function holdPlaceholder(page) {
  await page.addInitScript(() => {
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
  });
}

// Serves "/" as production would: the prerendered body sits in #root before React renders.
async function servePrerendered(page) {
  await page.route(
    (url) => url.pathname === "/",
    async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(
        '<div id="root"></div>',
        '<div id="root"><div data-prerendered="true"><main><h1>LearnAnything</h1></main></div></div>',
      );
      await route.fulfill({ response, body: html });
    },
  );
}

test.describe("first load", () => {
  test("the hero rises in order and the count ticks up", async ({ page }) => {
    const errors = collectErrors(page);
    await mockApi(page);
    await hideOnboarding(page);
    await holdPlaceholder(page);
    await recordAnimations(page);
    await page.goto("/");
    await expect(page.locator(".subtitle-count strong")).toHaveText("42");
    await waitForMotion(page);

    const hero = (await animationLog(page)).filter(isHero);
    const delays = hero.map((entry) => [entry.target.classes[0] ?? entry.target.tag, entry.options.delay]);
    expect(delays).toEqual([
      ["home-brand", 0],
      ["home-intro", 50],
      ["topic-search", 100],
      ["section-heading", 150],
      ["recommended-prompt", 190],
      ["recommended-prompt", 220],
      ["recommended-prompt", 250],
      ["recommended-prompt", 280],
      ["recommended-prompt", 310],
    ]);
    for (const entry of hero) {
      expect(entry.options).toMatchObject({ easing: "cubic-bezier(0.23, 1, 0.32, 1)", fill: "backwards" });
    }
    expect((await animationLog(page)).some(isCountClock)).toBe(true);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("arriving client-side plays no hero and fades the count in", async ({ page }) => {
    const errors = collectErrors(page);
    await mockApi(page);
    await hideOnboarding(page);
    await holdPlaceholder(page);
    await recordAnimations(page);
    await page.goto("/about");
    await page.evaluate(() => (window.__motionAnimations.length = 0));
    await page.locator(".navbar-container").getByRole("link", { name: "Home", exact: true }).click();
    await expect(page.locator(".subtitle-count strong")).toHaveText("42");
    await waitForMotion(page);

    const log = await animationLog(page);
    expect(log.filter(isHero)).toEqual([]);
    expect(log.some(isCountClock)).toBe(false);
    const fade = log.filter(isCountFade);
    expect(fade).toHaveLength(1);
    expect(fade[0].keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(fade[0].options).toMatchObject({ duration: 220, easing: "ease" });
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("a prerendered load skips the hero but still counts up", async ({ page }) => {
    const errors = collectErrors(page);
    await mockApi(page);
    await hideOnboarding(page);
    await holdPlaceholder(page);
    await recordAnimations(page);
    await servePrerendered(page);
    await page.goto("/");
    await expect(page.locator(".subtitle-count strong")).toHaveText("42");
    await waitForMotion(page);

    const log = await animationLog(page);
    expect(log.filter(isHero)).toEqual([]);
    expect(log.some((entry) => entry.target.classes.includes("home-page"))).toBe(false);
    expect(log.some(isCountClock)).toBe(true);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("reduced motion fades the page once and the count in 120 ms", async ({ page }) => {
    const errors = collectErrors(page);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockApi(page);
    await hideOnboarding(page);
    await recordAnimations(page);
    await page.goto("/");
    await expect(page.locator(".subtitle-count strong")).toHaveText("42");
    await waitForMotion(page);

    const log = await animationLog(page);
    expect(log.filter(isHero)).toEqual([]);
    const fades = log.filter((entry) => entry.target.classes.includes("home-page"));
    expect(fades).toHaveLength(1);
    expect(fades[0].options).toMatchObject({ duration: 150, easing: "ease", fill: "backwards" });
    expect(log.some(isCountClock)).toBe(false);
    expect(log.find(isCountFade)?.options.duration).toBe(120);
    await expect(page.locator(".search-placeholder")).toHaveCount(0);
    expectNoMovement(log);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });
});

test.describe("count line", () => {
  test("a reserved line keeps the form still while stats load", async ({ page }) => {
    const errors = collectErrors(page);
    await mockApi(page);
    let releaseStats;
    const held = new Promise((resolve) => (releaseStats = resolve));
    await page.route("**/v1/stats", async (route) => {
      await held;
      await route.fulfill({ json: { learning_paths_generated: 12873 } });
    });
    await hideOnboarding(page);
    await holdPlaceholder(page);
    await page.addInitScript(() => {
      window.__layoutShift = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__layoutShift += entry.value;
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto("/");
    await waitForMotion(page);

    const measure = () =>
      page.evaluate(() => ({
        intro: document.querySelector(".home-intro").getBoundingClientRect().height,
        form: document.querySelector("form.topic-search").getBoundingClientRect().top,
      }));
    const before = await measure();
    const reserve = page.locator(".subtitle-count");
    await expect(reserve).toHaveAttribute("aria-hidden", "true");
    releaseStats();
    await expect(page.locator(".subtitle-count strong")).toHaveText("12,873");
    await waitForMotion(page);
    expect(await measure()).toEqual(before);
    await expect(reserve).not.toHaveAttribute("aria-hidden");
    expect(await page.evaluate(() => window.__layoutShift)).toBe(0);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("a failed stats request gives the line back at once", async ({ page }) => {
    await mockApi(page, { stats: false });
    await hideOnboarding(page);
    const started = Date.now();
    await page.goto("/");
    await expect(page.locator(".subtitle-count")).toHaveCount(0, { timeout: 2000 });
    expect(Date.now() - started).toBeLessThan(2000);
  });

  test("the count rises from 10 without changing width", async ({ page }) => {
    const errors = collectErrors(page);
    await mockApi(page);
    let releaseStats;
    const held = new Promise((resolve) => (releaseStats = resolve));
    await page.route("**/v1/stats", async (route) => {
      await held;
      await route.fulfill({ json: { learning_paths_generated: 42 } });
    });
    await hideOnboarding(page);
    await holdPlaceholder(page);
    await page.goto("/");
    await waitForMotion(page);
    await page.evaluate(() => {
      const samples = [];
      window.__countSamples = samples;
      const tick = () => {
        const strong = document.querySelector(".subtitle-count strong");
        if (strong) {
          samples.push({ text: strong.textContent, width: strong.getBoundingClientRect().width });
        }
        if (samples.length < 90) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    releaseStats();
    await expect(page.locator(".subtitle-count strong")).toHaveText("42");
    await page.waitForFunction(() => window.__countSamples.length >= 90);
    const samples = await page.evaluate(() => window.__countSamples);
    const values = samples.map((sample) => Number(sample.text));
    expect(values[0]).toBe(10);
    expect(values.at(-1)).toBe(42);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    const widths = new Set(samples.map((sample) => sample.width.toFixed(2)));
    expect([...widths]).toHaveLength(1);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("turning reduce on mid-count jumps to the final value", async ({ page }) => {
    const errors = collectErrors(page);
    await mockApi(page);
    await hideOnboarding(page);
    await page.goto("/");
    const midCount = await page.waitForFunction(() => {
      const strong = document.querySelector(".subtitle-count strong");
      return strong && strong.textContent !== "42" ? strong.textContent : null;
    });
    expect(Number(await midCount.jsonValue())).toBeLessThan(42);
    await page.emulateMedia({ reducedMotion: "reduce" });
    const strong = page.locator(".subtitle-count strong");
    await expect(strong).toHaveText("42");
    await expect(strong).not.toHaveAttribute("style", /\S/);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });
});

test.describe("rotating placeholder", () => {
  test("the first example is in place on the first frame", async ({ page }) => {
    await mockApi(page);
    await hideOnboarding(page);
    await page.addInitScript(() => {
      const tick = () => {
        if (!document.querySelector(".home-page")) {
          requestAnimationFrame(tick);
          return;
        }
        window.__firstFrame = document.querySelector(".search-placeholder")?.textContent ?? "";
      };
      requestAnimationFrame(tick);
    });
    await page.goto("/");
    await page.waitForFunction(() => window.__firstFrame !== undefined);
    expect(await page.evaluate(() => window.__firstFrame)).toBe("e.g. JavaScript or cooking");

    // The overlay sits exactly on the native placeholder's text box.
    const geometry = await page.evaluate(() => {
      const field = document.querySelector(".search-field");
      const input = field.querySelector(".text-input-search");
      const span = field.querySelector(".search-placeholder > span");
      const range = document.createRange();
      range.selectNodeContents(span);
      const text = range.getBoundingClientRect();
      const box = input.getBoundingClientRect();
      const style = getComputedStyle(input);
      return {
        fieldHeight: field.getBoundingClientRect().height,
        inputHeight: box.height,
        textLeft: text.left - box.left,
        contentLeft: parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
        textCenter: text.top + text.height / 2 - (box.top + box.height / 2),
        overlayFont: getComputedStyle(span).font,
        inputFont: style.font,
      };
    });
    expect(geometry.fieldHeight).toBe(geometry.inputHeight);
    expect(Math.abs(geometry.textLeft - geometry.contentLeft)).toBeLessThan(0.5);
    expect(Math.abs(geometry.textCenter)).toBeLessThan(1);
    expect(geometry.overlayFont).toBe(geometry.inputFont);
  });

  test("examples rotate only while idle, and never on the result page", async ({ page }) => {
    const errors = collectErrors(page);
    await mockApi(page);
    await hideOnboarding(page);
    await page.clock.install();
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "What do you want to learn?" });
    const layer = page.locator(".search-placeholder");
    const current = layer.locator("span").last();
    await expect(current).toHaveText("e.g. JavaScript or cooking");

    await page.clock.runFor(2400);
    await expect(current).toHaveText("e.g. Machine learning");
    await expect(layer.locator("span")).toHaveCount(1);
    await expect(input).toHaveAttribute("placeholder", "e.g. JavaScript or cooking");

    // Focus pauses the rotation; the current example stays.
    await input.focus();
    await page.clock.runFor(4500);
    await expect(current).toHaveText("e.g. Machine learning");

    // Typing hides the layer.
    await input.fill("guitar");
    await expect(layer).toBeHidden();
    await input.fill("");
    await expect(layer).toBeVisible();

    // Turning reduce on removes the overlay; the native placeholder shows again.
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(layer).toHaveCount(0);
    await expect(page.locator(".search-field.is-rotating")).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await expect(layer).toHaveText("e.g. JavaScript or cooking");
    expect(errors()).toEqual([]);
  });

  test("SearchMore on the result page has no rotating layer", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await mockApi(page);
    await hideOnboarding(page);
    await page.goto("/learningpath?term=Programming");
    await expect(page.locator(".search-more .text-input-search")).toBeVisible();
    await expect(page.locator(".search-placeholder")).toHaveCount(0);
    await expect(page.locator(".search-field.is-rotating")).toHaveCount(0);
  });
});

test.describe("controls", () => {
  test("the focus ring eases in and out around the input", async ({ page }) => {
    await mockApi(page);
    await hideOnboarding(page);
    await page.goto("/");
    const input = page.getByRole("textbox", { name: "What do you want to learn?" });
    const ring = () =>
      page.evaluate(() => {
        const field = document.querySelector(".search-field");
        return {
          opacity: getComputedStyle(field, "::after").opacity,
          outline: getComputedStyle(field.querySelector("input")).outlineStyle,
        };
      });
    await input.focus();
    await page.waitForTimeout(250);
    expect(await ring()).toEqual({ opacity: "1", outline: "none" });
    await input.blur();
    await page.waitForTimeout(250);
    expect((await ring()).opacity).toBe("0");
  });

  test("chips lift under a mouse", async ({ page }) => {
    await mockApi(page);
    await hideOnboarding(page);
    await page.goto("/");
    await waitForMotion(page);
    const chip = page.locator(".recommended-prompt").first();
    await chip.hover();
    await page.waitForTimeout(250);
    const lift = await chip.evaluate(
      (element) => new DOMMatrixReadOnly(getComputedStyle(element).transform).f,
    );
    expect(lift).toBeCloseTo(-1, 1);
  });

  test("Generate crossfades from disabled to enabled", async ({ page }) => {
    await mockApi(page);
    await hideOnboarding(page);
    await page.goto("/");
    await waitForMotion(page);
    await page.evaluate(() => {
      const button = document.querySelector(".topic-search .primary-button");
      const samples = [];
      window.__buttonOpacity = samples;
      const started = performance.now();
      const tick = () => {
        samples.push(Number(getComputedStyle(button).opacity));
        if (performance.now() - started < 1000) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.getByRole("textbox", { name: "What do you want to learn?" }).press("a");
    await expect(page.getByRole("button", { name: "Generate" })).toBeEnabled();
    await page.waitForFunction(() => window.__buttonOpacity.at(-1) === 1 && window.__buttonOpacity.length > 30);
    const samples = await page.evaluate(() => window.__buttonOpacity);
    expect(samples[0]).toBe(0.5);
    expect(samples.some((value) => value > 0.5 && value < 1)).toBe(true);
  });
});

test.describe("chips on touch", () => {
  test.use({ isMobile: true, hasTouch: true, viewport: { width: 390, height: 844 } });

  test("chips do not lift on touch screens", async ({ page }) => {
    await mockApi(page);
    await hideOnboarding(page);
    await holdPlaceholder(page);
    await page.goto("/");
    await waitForMotion(page);
    const chip = page.locator(".recommended-prompt").first();
    await chip.hover();
    await page.waitForTimeout(250);
    expect(await chip.evaluate((element) => getComputedStyle(element).transform)).toBe("none");
    await expectSettled(page, { phone: true });
  });
});

test.describe("guide dialog", () => {
  async function openGuide(page) {
    await mockApi(page);
    await holdPlaceholder(page);
    await page.addInitScript(() => {
      window.__dialogTransitions = [];
      document.addEventListener(
        "transitionrun",
        (event) => {
          if (!event.target.classList?.contains("onboarding-dialog")) return;
          window.__dialogTransitions.push({
            property: event.propertyName,
            pseudo: event.pseudoElement,
            open: event.target.open,
            duration: getComputedStyle(event.target).transitionDuration,
          });
        },
        true,
      );
    });
    await recordAnimations(page);
    await page.goto("/");
    const guide = page.getByRole("dialog");
    await expect(guide).toBeVisible();
    return guide;
  }

  test("opens in 200 ms, closes faster, and slides each step from its direction", async ({ page }) => {
    const errors = collectErrors(page);
    const guide = await openGuide(page);
    await waitForMotion(page);
    const opened = await page.evaluate(() => window.__dialogTransitions.filter((entry) => entry.open));
    expect(opened.map((entry) => entry.property)).toEqual(expect.arrayContaining(["opacity", "transform"]));
    expect(opened.find((entry) => entry.property === "opacity").duration).toMatch(/^0\.2s/);

    await guide.getByRole("button", { name: "Next", exact: true }).click();
    await guide.getByRole("button", { name: "Back", exact: true }).click();
    const steps = (await animationLog(page)).filter((entry) => entry.target.id === "onboarding-title");
    expect(steps.map((entry) => entry.keyframes[0].translate)).toEqual(["16px 0", "-16px 0"]);
    const next = (await animationLog(page)).filter((entry) => entry.keyframes[0]?.translate === "16px 0");
    expect(next.map((entry) => [entry.target.id || entry.target.classes[0], entry.options.delay])).toEqual([
      ["onboarding-title", 0],
      ["onboarding-description", 30],
      ["onboarding-example", 60],
    ]);
    expect(next[0].options).toMatchObject({ duration: 240, fill: "backwards" });

    // The exit takes 150 ms, then the dialog leaves the top layer.
    const closedAfter = await page.evaluate(
      () =>
        new Promise((resolve) => {
          const dialog = document.querySelector(".onboarding-dialog");
          const started = performance.now();
          dialog.querySelector(".onboarding-actions > .onboarding-secondary").click();
          const tick = () => {
            if (getComputedStyle(dialog).display === "none") resolve(performance.now() - started);
            else requestAnimationFrame(tick);
          };
          tick();
        }),
    );
    expect(closedAfter).toBeGreaterThan(100);
    expect(closedAfter).toBeLessThan(300);
    await expectSettled(page);
    expect(errors()).toEqual([]);
  });

  test("rapid steps replace each other instead of stacking", async ({ page }) => {
    const guide = await openGuide(page);
    await waitForMotion(page);
    for (const name of ["Next", "Back", "Next", "Back", "Next"]) {
      await guide.getByRole("button", { name, exact: true }).click();
    }
    const running = await page.evaluate(() =>
      document.querySelector(".onboarding-dialog").getAnimations({ subtree: true })
        .filter((animation) => !animation.transitionProperty && animation.playState === "running").length,
    );
    expect(running).toBeLessThanOrEqual(3);
    await expect(guide.getByRole("heading")).toHaveText("Find your starting point");
    await waitForMotion(page);
    await expectSettled(page);
  });

  test("reduced motion fades the dialog and its steps without movement", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const guide = await openGuide(page);
    await waitForMotion(page);
    const longest = await longestAnimation(page, () =>
      guide.getByRole("button", { name: "Next", exact: true }).click(),
    );
    expect(longest).toBeLessThanOrEqual(150);
    const steps = (await animationLog(page)).filter((entry) => entry.target.id === "onboarding-title");
    expect(steps.at(-1).keyframes).toEqual([{ opacity: 0 }, { opacity: 1 }]);
    expect(steps.at(-1).options).toMatchObject({ duration: 120, delay: 0 });
    expectNoMovement(await animationLog(page));
    expect(await guide.evaluate((dialog) => getComputedStyle(dialog).transform)).toBe("none");
    await guide.getByRole("button", { name: "Close guide" }).click();
    await expect(guide).toBeHidden();
    await expectSettled(page);
  });

  test("closing the guide after a client-side arrival focuses the page", async ({ page }) => {
    await mockApi(page);
    await page.goto("/feedback");
    await page.getByRole("link", { name: "Generate a learning path on Home" }).click();
    const guide = page.getByRole("dialog");
    await expect(guide).toBeVisible();
    await guide.getByRole("button", { name: "Close guide" }).click();
    await expect(guide).toBeHidden();
    expect(
      await page.evaluate(() => document.activeElement?.id === "main-content" && document.activeElement.isConnected),
    ).toBe(true);
  });
});
