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
    await expect(page.getByText("Usually 5–15 seconds")).toBeVisible();
    const fill = page.locator(".preparing-progress-fill");
    await page.clock.fastForward(5000);
    const first = await fill.evaluate((el) => parseFloat(el.style.width));
    await page.clock.fastForward(5000);
    const later = await fill.evaluate((el) => parseFloat(el.style.width));
    expect(later).toBeGreaterThan(first);
    await page.clock.fastForward(6000);
    await expect(page.getByText("Taking longer than usual...")).toBeVisible();
    const overdue = await fill.evaluate((el) => parseFloat(el.style.width));
    await page.clock.fastForward(60000);
    expect(await fill.evaluate((el) => parseFloat(el.style.width))).toBe(
      overdue,
    );
    expect(overdue).toBeLessThan(100);
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
