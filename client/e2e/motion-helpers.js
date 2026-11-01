// Shared Playwright helpers for the motion suites (not a test file: testMatch is *.e2e.js).
//
// mockApi(page, { stats, completion, share, holdGeneration }) -> { release }
//   Mocks /v1/stats, /v1/lp/** and /v1/shares and aborts https://**. stats is the
//   stats JSON, or false to abort the request. holdGeneration keeps /v1/lp/** open
//   until release() is called.
// hideOnboarding(page): init script that sets the guide's opt-out key.
// recordAnimations(page) / animationLog(page)
//   Logs every element.animate() call as { target, keyframes, options }; target is
//   { tag, id, classes, pseudoElement }.
// recordViewTransitions(page) / viewTransitionLog(page)
//   Logs every document.startViewTransition() call as { classes, before, after,
//   finished }: the html classes and the named elements (name, target, rect) at the
//   call, the named elements after the update, and whether finished resolved.
// removeViewTransitions(page): init script that deletes the View Transitions API.
// setAnimationRate(page, rate): slows or speeds every animation through CDP.
// waitForMotion(page): until no finite animation runs and no vt-* or theme-fading
//   class is on html. Home's idle placeholder swaps are ambient and ignored.
// longestAnimation(page, action): runs action, waits for motion, and returns the
//   longest delay + duration of the finite animations seen meanwhile, sampled every
//   frame (::view-transition-* included).
// expectSettled(page, { phone }): asserts nothing transient is left (SPEC section 8).
// collectErrors(page) -> () => string[]: console errors and page errors so far.

import { expect } from "@playwright/test";

export const onboardingKey = "learnanything.onboarding.hidden.v1";

export function defaultCompletion() {
  const nodes = ["Variables", "Functions", "Testing"].map((label) => ({
    id: label.toLowerCase(),
    label,
    level: "Beginner",
    summary: `${label} summary.`,
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
      connection: `${node.label} connects to the next concept.`,
    })),
    Intermediate: [],
    Advanced: [],
  };
}

export async function mockApi(
  page,
  {
    stats = { learning_paths_generated: 42 },
    completion = defaultCompletion(),
    share = { share_id: "abcdefghijklmnopqrstuv" },
    holdGeneration = false,
  } = {},
) {
  let release = () => {};
  const held = holdGeneration
    ? new Promise((resolve) => {
        release = resolve;
      })
    : null;
  await page.route("https://**", (route) => route.abort());
  await page.route("**/v1/stats", (route) =>
    stats === false ? route.abort() : route.fulfill({ json: stats }),
  );
  await page.route("**/v1/lp/**", async (route) => {
    if (held) await held;
    await route.fulfill({ json: { completion } }).catch(() => {});
  });
  await page.route("**/v1/shares", (route) => route.fulfill({ json: share }));
  return { release: () => release() };
}

export async function hideOnboarding(page) {
  await page.addInitScript(
    (key) => localStorage.setItem(key, "true"),
    onboardingKey,
  );
}

export async function recordAnimations(page) {
  await page.addInitScript(() => {
    const log = [];
    window.__motionAnimations = log;
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      const timing =
        typeof options === "number" ? { duration: options } : { ...options };
      log.push({
        target: {
          tag: this.tagName.toLowerCase(),
          id: this.id,
          classes: [...this.classList],
          pseudoElement: timing.pseudoElement ?? null,
        },
        keyframes: JSON.parse(JSON.stringify(keyframes ?? null)),
        options: JSON.parse(JSON.stringify(timing)),
      });
      return animate.call(this, keyframes, options);
    };
  });
}

export function animationLog(page) {
  return page.evaluate(() => window.__motionAnimations ?? []);
}

export async function recordViewTransitions(page) {
  await page.addInitScript(() => {
    const start = Document.prototype.startViewTransition;
    if (!start) return;
    const log = [];
    window.__motionViewTransitions = log;
    const named = () =>
      [...document.querySelectorAll("*")].flatMap((element) => {
        const name = getComputedStyle(element).viewTransitionName;
        if (!name || name === "none" || element === document.documentElement) {
          return [];
        }
        const { left, top, width, height } = element.getBoundingClientRect();
        return [
          {
            name,
            target: {
              tag: element.tagName.toLowerCase(),
              id: element.id,
              classes: [...element.classList],
            },
            rect: { left, top, width, height },
          },
        ];
      });
    Document.prototype.startViewTransition = function (callbackOrOptions) {
      const entry = {
        classes: [...document.documentElement.classList],
        before: named(),
        after: null,
        finished: null,
      };
      log.push(entry);
      const isOptions =
        callbackOrOptions && typeof callbackOrOptions === "object";
      const update = isOptions ? callbackOrOptions.update : callbackOrOptions;
      const wrapped = () => {
        const result = update?.();
        if (result && typeof result.then === "function") {
          return result.then((value) => {
            entry.after = named();
            return value;
          });
        }
        entry.after = named();
        return result;
      };
      const transition = start.call(
        this,
        isOptions ? { ...callbackOrOptions, update: wrapped } : wrapped,
      );
      transition.finished.then(
        () => (entry.finished = true),
        () => (entry.finished = false),
      );
      return transition;
    };
  });
}

export function viewTransitionLog(page) {
  return page.evaluate(() => window.__motionViewTransitions ?? []);
}

export async function removeViewTransitions(page) {
  await page.addInitScript(() => {
    delete Document.prototype.startViewTransition;
  });
}

export async function setAnimationRate(page, rate) {
  const session = await page.context().newCDPSession(page);
  await session.send("Animation.enable");
  await session.send("Animation.setPlaybackRate", { playbackRate: rate });
  return session;
}

export async function waitForMotion(page, { timeout = 10000 } = {}) {
  await page.waitForFunction(
    () => {
      const html = document.documentElement;
      if (
        [...html.classList].some(
          (name) => name.startsWith("vt-") || name === "theme-fading",
        )
      ) {
        return false;
      }
      return document
        .getAnimations()
        .every(
          (animation) =>
            animation.playState !== "running" ||
            !Number.isFinite(animation.effect?.getComputedTiming().iterations) ||
            // Home's placeholder swaps every 3 s while idle; it never settles.
            animation.effect.target?.closest(".search-placeholder") != null,
        );
    },
    null,
    { timeout },
  );
}

export async function longestAnimation(page, action) {
  await page.evaluate(() => {
    const sample = { longest: 0, frame: 0 };
    window.__motionLongest = sample;
    const tick = () => {
      for (const animation of document.getAnimations()) {
        const timing = animation.effect?.getComputedTiming();
        if (!timing || !Number.isFinite(timing.activeDuration)) continue;
        sample.longest = Math.max(
          sample.longest,
          (timing.delay ?? 0) + timing.activeDuration,
        );
      }
      sample.frame = requestAnimationFrame(tick);
    };
    tick();
  });
  await action();
  await waitForMotion(page);
  return page.evaluate(() => {
    const sample = window.__motionLongest;
    cancelAnimationFrame(sample.frame);
    return sample.longest;
  });
}

export async function expectSettled(page, { phone = false } = {}) {
  // Whatever is still moving after the wait is reported below.
  await waitForMotion(page, { timeout: 5000 }).catch(() => {});
  const problems = await page.evaluate((phone) => {
    const found = [];
    const describe = (element) =>
      `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[
        ...element.classList,
      ]
        .map((name) => `.${name}`)
        .join("")}`;

    const pages = document.querySelectorAll("#main-content");
    if (pages.length !== 1) found.push(`${pages.length} #main-content`);
    for (const selector of [
      ".topic-proxy",
      ".bar-ghost",
      ".is-opening",
      ".is-leaving",
      ".is-closing",
    ]) {
      const count = document.querySelectorAll(selector).length;
      if (count) found.push(`${count} ${selector} left`);
    }
    for (const name of document.documentElement.classList) {
      if (name.startsWith("vt-") || name === "theme-fading") {
        found.push(`html.${name}`);
      }
    }
    for (const element of document.querySelectorAll("[style]")) {
      if (element.style.viewTransitionName) {
        found.push(`inline view-transition-name on ${describe(element)}`);
      }
    }

    // Inline residue inside the page, with the styles that stay on purpose.
    const main = pages[0];
    for (const element of main?.querySelectorAll("[style]") ?? []) {
      // dnd-kit's visually hidden live regions.
      if (element.id.startsWith("Dnd")) continue;
      const { style } = element;
      const stray = [];
      if (style.translate && style.translate !== "none") stray.push("translate");
      if (
        style.transform &&
        style.transform !== "none" &&
        !element.matches(".preparing-progress-fill")
      ) {
        stray.push("transform");
      }
      if (
        style.clipPath &&
        style.clipPath !== "none" &&
        !element.matches(".view-toggle-pill-surface, .view-toggle-pill-labels")
      ) {
        stray.push("clip-path");
      }
      if (style.filter && style.filter !== "none") stray.push("filter");
      if (style.position === "absolute") stray.push("position: absolute");
      if (style.color === "transparent") stray.push("color: transparent");
      if (
        style.opacity !== "" &&
        style.opacity !== "1" &&
        !element.closest(".copy-label")
      ) {
        stray.push(`opacity ${style.opacity}`);
      }
      if (stray.length) {
        found.push(`inline ${stray.join(", ")} on ${describe(element)}`);
      }
    }

    for (const animation of document.getAnimations()) {
      const timing = animation.effect?.getComputedTiming();
      const iterations = timing?.iterations;
      const target = animation.effect?.target;
      if (target?.closest(".search-placeholder")) continue;
      // The reduced-motion rule's 0.01 ms transitions end on the next frame, which
      // a busy machine can hold back past the wait above.
      if (timing && timing.activeDuration < 1 && !timing.delay) continue;
      if (animation.playState === "running" && Number.isFinite(iterations)) {
        found.push(
          `running animation on ${target ? describe(target) : "unknown"}`,
        );
      }
    }

    // The pill's clip window sits on the pressed button (M15).
    for (const toggle of document.querySelectorAll(".view-toggle.has-pill")) {
      const active = toggle.querySelector(':scope > button[aria-pressed="true"]');
      const surface = toggle.querySelector(".view-toggle-pill-surface");
      if (!active || !surface) continue;
      const match = getComputedStyle(surface).clipPath.match(
        /inset\(([^)]*?)(?:\s+round[^)]*)?\)/,
      );
      const values = match ? match[1].trim().split(/\s+/).map(parseFloat) : [];
      const [top, right = top, bottom = top, left = right] = values;
      const expected = [
        active.offsetTop,
        toggle.clientWidth - active.offsetLeft - active.offsetWidth,
        toggle.clientHeight - active.offsetTop - active.offsetHeight,
        active.offsetLeft,
      ];
      if (
        values.length === 0 ||
        [top, right, bottom, left].some(
          (value, index) => Math.abs(value - expected[index]) > 0.5,
        )
      ) {
        found.push(`pill clip ${match?.[0]} misses the pressed button`);
      }
    }

    if (phone && document.documentElement.scrollWidth !== window.innerWidth) {
      found.push(
        `horizontal scroll: ${document.documentElement.scrollWidth} > ${window.innerWidth}`,
      );
    }
    return found;
  }, phone);
  expect(problems).toEqual([]);
}

export function collectErrors(page) {
  const errors = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  return () => [...errors];
}
