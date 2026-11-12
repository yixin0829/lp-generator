import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("learnanything.onboarding.hidden.v1", "true"),
  );
  await page.route("https://**", (route) => route.abort());
});

async function prepare(page, estimate) {
  await page.route("**/v1/stats", (route) =>
    route.fulfill({
      json: {
        learning_paths_generated: 42,
        generation_estimate: estimate,
      },
    }),
  );
  let finish;
  const pending = new Promise((resolve) => {
    finish = resolve;
  });
  await page.route("**/v1/lp/**", async (route) => {
    await pending;
    await route.fulfill({
      json: {
        cached: true,
        completion: {
          Beginner: [{ name: "Variables" }],
          Intermediate: [],
          Advanced: [],
        },
      },
    });
  });
  await page.clock.install();
  await page.goto("/learningpath?term=Progress%20fixture");
  await expect(page.getByRole("progressbar")).toBeVisible();
  return finish;
}

for (const reducedMotion of ["reduce", "no-preference"]) {
  test(`estimated bar advances, handles overruns and finishes (${reducedMotion})`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion });
    const finish = await prepare(page, {
      model: "test",
      sample_count: 12,
      median_seconds: 10,
      lower_seconds: 5,
      upper_seconds: 15,
    });
    await expect(page.locator(".preparing-progress")).toHaveClass(
      /is-estimated/,
    );
    await expect(page.getByText(/Usually/)).toHaveCount(0);
    const fill = page.locator(".preparing-progress-fill");
    await page.clock.fastForward(5000);
    const first = await fill.evaluate((el) =>
      Number(el.style.transform.match(/scaleX\(([^)]+)\)/)[1]),
    );
    await page.clock.fastForward(5000);
    const later = await fill.evaluate((el) =>
      Number(el.style.transform.match(/scaleX\(([^)]+)\)/)[1]),
    );
    expect(later).toBeGreaterThan(first);
    await page.clock.fastForward(6000);
    await expect(page.getByText("Taking longer than usual...")).toBeVisible();
    const overdue = await fill.evaluate((el) =>
      Number(el.style.transform.match(/scaleX\(([^)]+)\)/)[1]),
    );
    await page.clock.fastForward(60000);
    expect(
      await fill.evaluate((el) =>
        Number(el.style.transform.match(/scaleX\(([^)]+)\)/)[1]),
      ),
    ).toBe(overdue);
    expect(overdue).toBeLessThan(1);
    await expect(page.getByRole("progressbar")).not.toHaveAttribute(
      "aria-valuenow",
      /.+/,
    );
    if (reducedMotion === "reduce") {
      expect(
        await fill.evaluate((el) => getComputedStyle(el).animationName),
      ).toBe("none");
    }
    finish();
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Copy path" })).toBeVisible();
  });
}

test("missing history leaves the bar indeterminate without invented times", async ({
  page,
}) => {
  const finish = await prepare(page, null);
  await page.clock.fastForward(30000);
  await expect(page.locator(".preparing-estimate")).toHaveCount(0);
  await expect(page.locator(".preparing-progress")).not.toHaveClass(
    /is-estimated/,
  );
  finish();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});

test("unavailable timing stats do not block the learning path", async ({
  page,
}) => {
  await page.route("**/v1/stats", (route) => route.abort());
  await page.route("**/v1/lp/**", (route) =>
    route.fulfill({ json: { completion: { Beginner: [] } } }),
  );
  await page.goto("/learningpath?term=Cached%20fixture");
  await expect(page.getByRole("button", { name: "Copy path" })).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
});

test("a fast result fills the bar before revealing the path", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const finish = await prepare(page, {
    model: "test",
    sample_count: 8,
    median_seconds: 30,
    lower_seconds: 20,
    upper_seconds: 40,
  });
  await expect(page.locator(".preparing-progress")).toHaveClass(/is-estimated/);
  await page.evaluate(() => {
    window.progressFrames = [];
    const sample = () => {
      const fill = document.querySelector(".preparing-progress-fill");
      const revealed = Boolean(document.querySelector(".copy-action"));
      window.progressFrames.push({
        ratio: fill
          ? fill.getBoundingClientRect().width /
            fill.parentElement.getBoundingClientRect().width
          : null,
        revealed,
      });
      if (!revealed) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  finish();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Complete",
  );
  await page.waitForTimeout(500);
  await expect(page.getByRole("progressbar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy path" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copy path" })).toBeVisible();
  const frames = await page.evaluate(() => window.progressFrames);
  expect(frames.some((frame) => frame.ratio >= 0.999 && !frame.revealed)).toBe(
    true,
  );
  expect(
    frames.some(
      (frame) => frame.ratio > 0.1 && frame.ratio < 0.95 && !frame.revealed,
    ),
  ).toBe(true);
  await expect(page.getByText(/Usually/)).toHaveCount(0);
});

test("failed generation shows an error without a success sweep and can retry", async ({
  page,
}) => {
  await page.route("**/v1/stats", (route) =>
    route.fulfill({ json: { learning_paths_generated: 42 } }),
  );
  let attempts = 0;
  await page.route("**/v1/lp/**", (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({ status: 503, json: { detail: "Unavailable" } })
      : route.fulfill({
          json: { completion: { Beginner: [{ name: "Retry concept" }] } },
        });
  });
  await page.goto("/learningpath?term=Retry%20fixture");
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("button", { name: "Copy path" })).toBeVisible();
});

test("switching topics during completion resets the next loading bar", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const finish = await prepare(page, null);
  // Pause only the finish sweep to deterministically navigate during it.
  await page.evaluate(() => {
    const animate = Element.prototype.animate;
    Element.prototype.animate = function (...args) {
      const animation = animate.apply(this, args);
      if (this.classList.contains("preparing-progress-fill")) animation.pause();
      return animation;
    };
  });
  finish();
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "Complete",
  );
  let finishNext;
  const pending = new Promise((resolve) => {
    finishNext = resolve;
  });
  await page.route("**/v1/lp/Next*", async (route) => {
    await pending;
    await route.fulfill({ status: 503, json: { detail: "Unavailable" } });
  });
  await page.evaluate(() => {
    history.pushState({}, "", "/learningpath?term=Next");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(page.getByRole("progressbar")).toHaveAttribute(
    "aria-valuetext",
    "In progress",
  );
  const fill = page.locator(".preparing-progress-fill");
  expect(await fill.evaluate((el) => getComputedStyle(el).animationName)).toBe(
    "preparing-progress-travel",
  );
  await expect(page.getByRole("button", { name: "Copy path" })).toHaveCount(0);
  finishNext();
  await expect(page.getByRole("alert")).toBeVisible();
});

function mockStats(page) {
  return page.route("**/v1/stats", (route) =>
    route.fulfill({ json: { learning_paths_generated: 42 } }),
  );
}

const retryButton = (page) =>
  page.getByRole("button", { name: "Try again", exact: true });

test("a direct link's first frame is the loading bar", async ({ page }) => {
  await mockStats(page);
  // Generation never answers, so the page stays on its first state.
  await page.route("**/v1/lp/**", () => new Promise(() => {}));
  await page.addInitScript(() => {
    window.pageFrames = [];
    new MutationObserver(() => {
      const main = document.querySelector("main.learning-path-page");
      if (!main) return;
      window.pageFrames.push(
        main.querySelector('[role="progressbar"]') ? "bar" : "empty",
      );
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto("/learningpath?term=First%20frame");
  await expect(page.getByRole("progressbar")).toBeVisible();
  const frames = await page.evaluate(() => window.pageFrames);
  expect(frames.length).toBeGreaterThan(0);
  expect(frames).not.toContain("empty");
});

for (const failure of [
  {
    name: "a moderated topic is known by its code, not its wording",
    status: 400,
    json: { detail: "This topic breaks our usage rules.", code: "moderated" },
    text: "flagged by content moderation",
    retry: false,
  },
  {
    name: "a request the AI service refuses is not blamed on the topic's length",
    status: 400,
    json: { detail: "Invalid request to AI service.", code: "upstream_rejected" },
    text: "Something is wrong on our side",
    retry: false,
  },
  {
    name: "a misconfigured server offers no retry",
    status: 502,
    json: {
      detail: "Service configuration error. Please contact support.",
      code: "misconfigured",
    },
    text: "trying again won't help right now",
    retry: false,
  },
  {
    name: "a proxy timeout says so and can retry",
    status: 504,
    body: "An error occurred with your deployment",
    text: "The request timed out. Please try again.",
    retry: true,
  },
  {
    name: "an unknown code falls back to the status",
    status: 503,
    json: { detail: "Unavailable", code: "not_known_to_this_client" },
    text: "Try again with the same topic, or enter something else.",
    retry: true,
  },
]) {
  test(failure.name, async ({ page }) => {
    await mockStats(page);
    await page.route("**/v1/lp/**", (route) =>
      route.fulfill(
        failure.json
          ? { status: failure.status, json: failure.json }
          : {
              status: failure.status,
              contentType: "text/plain",
              body: failure.body,
            },
      ),
    );
    await page.goto("/learningpath?term=Failure%20fixture");
    await expect(page.getByRole("alert")).toContainText(failure.text);
    await expect(retryButton(page)).toHaveCount(failure.retry ? 1 : 0);
    await expect(page.getByRole("progressbar")).toHaveCount(0);
  });
}

test("a lost connection says so and can retry", async ({ page }) => {
  await mockStats(page);
  await page.route("**/v1/lp/**", (route) => route.abort());
  await page.goto("/learningpath?term=Offline%20fixture");
  await expect(page.getByRole("alert")).toContainText(
    "Couldn't reach the server. Check your connection and try again.",
  );
  await expect(retryButton(page)).toBeEnabled();
});

test("a rate-limited request waits out the window before it can retry", async ({
  page,
}) => {
  await mockStats(page);
  let attempts = 0;
  await page.route("**/v1/lp/**", (route) => {
    attempts += 1;
    return attempts === 1
      ? route.fulfill({
          status: 429,
          json: { error: "Rate limit exceeded: 15 per 1 minute" },
        })
      : route.fulfill({
          json: { completion: { Beginner: [{ name: "Retry concept" }] } },
        });
  });
  await page.clock.install();
  await page.goto("/learningpath?term=Busy%20fixture");
  await expect(page.getByRole("alert")).toContainText(
    "Wait a minute, then try again.",
  );
  const retry = retryButton(page);
  await expect(retry).toBeDisabled();
  await expect(retry).toHaveText(/^Try again in \d+ s$/);
  await page.clock.fastForward(30_000);
  await expect(retry).toBeDisabled();
  expect(attempts).toBe(1);
  await page.clock.fastForward(31_000);
  await expect(retry).toBeEnabled();
  await expect(retry).toHaveText("Try again");
  await retry.click();
  await expect(page.getByRole("button", { name: "Copy path" })).toBeVisible();
  expect(attempts).toBe(2);
});
