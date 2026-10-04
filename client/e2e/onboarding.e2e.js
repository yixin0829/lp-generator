import { test, expect } from "@playwright/test";

const key = "learnanything.onboarding.hidden.v1";

test.beforeEach(async ({ page }) => {
  // Keep browser checks independent of external analytics and backend availability.
  await page.route("**/v1/stats", (route) => route.fulfill({ json: { learning_paths_generated: 42 } }));
  await page.route("https://**", (route) => route.abort());
});

test("new visitors complete a three-step guide; unchecked choice returns on reload", async ({ page }) => {
  await page.goto("/");
  const guide = page.getByRole("dialog");
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("checkbox")).not.toBeChecked();
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await expect(guide.getByRole("heading")).toHaveText("Find your starting point");
  await guide.getByRole("button", { name: "Back", exact: true }).click();
  await expect(guide.getByRole("heading")).toHaveText("Start with something you want to learn");
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await guide.getByRole("button", { name: "Start learning" }).click();
  await expect(guide).not.toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  await page.getByRole("link", { name: "Topics", exact: true }).click();
  await expect(guide).not.toBeVisible();
  await page.locator(".navbar-container").getByRole("link", { name: "Home", exact: true }).click();
  await expect(guide).not.toBeVisible();
  await page.reload();
  await expect(guide).toBeVisible();
});

test("explicit opt-out survives reload and a new tab; replay can re-enable future display", async ({ page, context }) => {
  await page.goto("/");
  const guide = page.getByRole("dialog");
  await guide.getByRole("checkbox").check();
  await guide.getByRole("button", { name: "Skip for now" }).click();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe("true");
  await page.reload();
  await expect(guide).not.toBeVisible();
  const returning = await context.newPage();
  await returning.goto("/");
  await expect(returning.getByRole("dialog")).not.toBeVisible();
  await returning.close();
  await page.getByRole("button", { name: "How to use", exact: true }).click();
  await expect(guide).toBeVisible();
  await expect(guide.getByRole("checkbox")).toBeChecked();
  await guide.getByRole("checkbox").uncheck();
  await guide.getByRole("button", { name: "Close guide" }).click();
  await expect(page.getByRole("button", { name: "How to use", exact: true })).toBeFocused();
  await page.reload();
  await expect(guide).toBeVisible();
});

test("Escape dismisses without implicitly opting out, and replay restarts at step one", async ({ page }) => {
  await page.goto("/");
  const guide = page.getByRole("dialog");
  await guide.getByRole("button", { name: "Next", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(guide).not.toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
  await page.getByRole("button", { name: "How to use", exact: true }).click();
  await expect(guide.getByRole("heading")).toHaveText("Start with something you want to learn");
  for (let n = 0; n < 10; n++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("dialog"))).toBe(true);
  }
});

test("feedback routes topic seekers to Home, where the guide appears once", async ({ page }) => {
  await page.goto("/feedback");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByText("report a problem, suggest a feature", { exact: false })).toBeVisible();
  await page.getByRole("link", { name: "Generate a learning path on Home" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close guide" }).click();
  await page.getByRole("link", { name: "Feedback", exact: true }).click();
  await page.getByRole("link", { name: "Generate a learning path on Home" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});

test("blocked storage cannot silently claim opt-out was saved", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw new Error("Storage unavailable"); };
    Storage.prototype.setItem = () => { throw new Error("Storage unavailable"); };
    Storage.prototype.removeItem = () => { throw new Error("Storage unavailable"); };
  });
  await page.goto("/");
  const guide = page.getByRole("dialog");
  await guide.getByRole("checkbox").check();
  await guide.getByRole("button", { name: "Skip for now" }).click();
  await expect(guide.getByRole("alert")).toContainText("could not save");
  await expect(guide).toBeVisible();
  await guide.getByRole("checkbox").uncheck();
  await guide.getByRole("button", { name: "Skip for now" }).click();
  await expect(guide).not.toBeVisible();
});

test("failed opt-out removal reports an unsaved re-enable and can retry", async ({ page }) => {
  await page.addInitScript((preferenceKey) => {
    localStorage.setItem(preferenceKey, "true");
    const remove = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function (name) {
      if (name === preferenceKey) throw new Error("Removal blocked");
      return remove.call(this, name);
    };
    window.restorePreferenceRemoval = () => { Storage.prototype.removeItem = remove; };
  }, key);
  await page.goto("/");
  const guide = page.getByRole("dialog");
  await expect(guide).not.toBeVisible();
  await page.getByRole("button", { name: "How to use", exact: true }).click();
  await guide.getByRole("checkbox").uncheck();
  await guide.getByRole("button", { name: "Skip for now" }).click();
  await expect(guide.getByRole("alert")).toContainText("could not save");
  await expect(guide).toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe("true");
  await page.evaluate(() => window.restorePreferenceRemoval());
  await guide.getByRole("button", { name: "Skip for now" }).click();
  await expect(guide).not.toBeVisible();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBeNull();
});

for (const [name, viewport, theme] of [
  ["desktop", { width: 1440, height: 1000 }, "light"],
  ["mobile", { width: 390, height: 844 }, "light"],
  ["dark-mobile", { width: 390, height: 844 }, "dark"],
]) {
  test(`${name}: guide, replay, and opted-out page fit the viewport`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    await page.goto("/");
    const guide = page.getByRole("dialog");
    await expect(guide).toBeVisible();
    const box = await guide.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    await page.screenshot({ path: `../evidence/onboarding-${name}-initial.png` });
    await guide.getByRole("checkbox").check();
    await page.screenshot({ path: `../evidence/onboarding-${name}-optout.png` });
    await guide.getByRole("button", { name: "Skip for now" }).click();
    await page.reload();
    await expect(guide).not.toBeVisible();
    await page.screenshot({ path: `../evidence/onboarding-${name}-returning.png` });
    await page.getByRole("button", { name: "How to use", exact: true }).click();
    await guide.getByRole("button", { name: "Next", exact: true }).click();
    await page.screenshot({ path: `../evidence/onboarding-${name}-replay.png` });
    await expect(guide).toBeVisible();
  });
}
