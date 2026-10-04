import { test, expect } from "@playwright/test";

const graph = { topic: "React", completion: { nodes: [
  { id: "state", label: "State", level: "Beginner", summary: "Remember a value", why: "Interactive UI" },
  { id: "hooks", label: "Hooks", level: "Intermediate", summary: "React features", why: "Reusable logic" },
], edges: [{ source: "state", target: "hooks", relationship: "State is used in hooks" }], Beginner: [{ name: "State", summary: "Remember a value", why: "Interactive UI", connection: "Hooks" }], Intermediate: [{ name: "Hooks", summary: "React features", why: "Reusable logic", connection: "State" }], Advanced: [] } };
const resources = { provider: "catalogue", resources: [
  { title: "React: managing state", url: "https://react.dev/learn/managing-state", publisher: "React", format: "Guide", level: "Beginner", why: "Try the examples for State", provenance: "catalogue", retrieved_at: "2026-10-04" },
  { title: "React: adding interactivity", url: "https://react.dev/learn/adding-interactivity", publisher: "React", format: "Guide", level: "Beginner", why: "Practice with a small interactive component", provenance: "catalogue", retrieved_at: "2026-10-04" },
] };

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("learnanything.onboarding.hidden.v1", "true"));
  await page.route("**/v1/lp/**", (route) => route.fulfill({ json: graph }));
  await page.route("https://**", (route) => route.abort());
});

for (const [name, width, theme] of [["desktop", 1440, "light"], ["mobile", 390, "light"], ["dark-mobile", 390, "dark"]]) {
  test(`${name}: resources are on demand, safe, and independent of the graph`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
    let requests = 0;
    await page.route("**/v1/resources", async (route) => { requests++; await route.fulfill({ json: resources }); });
    await page.goto("/learningpath?term=React");
    await expect(page.getByRole("heading", { name: "Learn one concept" })).toBeVisible();
    expect(requests).toBe(0);
    await page.getByRole("button", { name: "Find resources" }).click();
    await expect(page.getByRole("link", { name: "React: managing state", exact: false })).toBeVisible();
    expect(requests).toBe(1);
    await expect(page.locator(".resource-cards script")).toHaveCount(0);
    await page.locator(".concept-resources").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `../evidence/resources-${name}.png` });
    await page.getByRole("combobox").selectOption("Hooks");
    await expect(page.locator(".resource-cards")).toHaveCount(0);
    await expect(page.locator(".network-graph-svg")).toBeVisible();
  });
}

test("failure and empty results allow retry while the path remains usable", async ({ page }) => {
  let attempt = 0;
  await page.route("**/v1/resources", async (route) => {
    attempt++;
    if (attempt === 1) await route.fulfill({ status: 503, json: { detail: "unavailable" } });
    else await route.fulfill({ json: { resources: [], message: "No reviewed resources for this concept yet." } });
  });
  await page.goto("/learningpath?term=React");
  await page.getByRole("button", { name: "Find resources" }).click();
  await expect(page.getByRole("alert")).toContainText("Your path is still here");
  await page.getByRole("button", { name: "List", exact: true }).click();
  await expect(page.getByRole("button", { name: "Find resources" })).toBeEnabled();
  await page.getByRole("button", { name: "Find resources" }).click();
  await expect(page.getByText("No reviewed resources for this concept yet.")).toBeVisible();
});

test("source titles remain literal text and dangerous links are omitted", async ({ page }) => {
  await page.route("**/v1/resources", (route) => route.fulfill({ json: { resources: [
    { ...resources.resources[0], title: "<script>Untrusted title</script>" },
    { ...resources.resources[1], title: "Unsafe", url: "javascript:alert(1)" },
  ] } }));
  await page.goto("/learningpath?term=React");
  await page.getByRole("button", { name: "Find resources" }).click();
  await expect(page.getByText("<script>Untrusted title</script>", { exact: false })).toBeVisible();
  await expect(page.locator(".resource-cards script")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Unsafe", exact: false })).toHaveCount(0);
});

test("changing concept during loading prevents a stale response from replacing the new selection", async ({ page }) => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  await page.route("**/v1/resources", async (route) => { await gate; await route.fulfill({ json: resources }).catch(() => {}); });
  await page.goto("/learningpath?term=React");
  await page.getByRole("button", { name: "Find resources" }).click();
  await expect(page.getByRole("button", { name: "Finding resources…" })).toBeDisabled();
  await page.getByRole("combobox").selectOption("Hooks");
  release();
  await expect(page.getByRole("button", { name: "Find resources" })).toBeEnabled();
  await expect(page.locator(".resource-cards")).toHaveCount(0);
});
