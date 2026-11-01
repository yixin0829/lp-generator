import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("learnanything.onboarding.hidden.v1", "true"),
  );
  await page.route("**/v1/stats", (route) =>
    route.fulfill({ json: { learning_paths_generated: 42 } }),
  );
  await page.route("https://**", (route) => route.abort());
});

for (const path of ["/doesnotexist", "/learn/not-a-real-topic"]) {
  test(`${path} shows the not-found page with navigation and no canonical URL`, async ({
    page,
  }) => {
    await page.goto(path);
    await expect(
      page.getByRole("heading", { level: 1, name: "Page not found." }),
    ).toBeVisible();
    await expect(page.locator(".navbar-container")).toBeVisible();
    const robots = page.locator('meta[name="robots"]');
    await expect(robots).toHaveCount(1);
    await expect(robots).toHaveAttribute("content", "noindex,follow");
    // A not-found page has no canonical URL; pointing one at the home page
    // would tell crawlers this URL is a copy of it.
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });
}
