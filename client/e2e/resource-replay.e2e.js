import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";

const smoke = JSON.parse(readFileSync("../evidence/resource-benchmark-smoke.json", "utf8"));
const recorded = smoke.observations.find((row) => row.temperature === "cold" && row.status === "measured");
const graph = { topic: "React", completion: { nodes: [{ id: "state", label: "State", level: "Beginner", summary: "Remember a value", why: "Interactive UI" }], edges: [], Beginner: [{ name: "State", summary: "Remember a value", why: "Interactive UI", connection: "" }], Intermediate: [], Advanced: [] } };
const response = { provider: "web_search", resources: recorded.source_urls.map((url, index) => ({
  url, title: `Recorded source ${index + 1}: ${new URL(url).pathname.split("/").pop().replaceAll("-", " ")}`,
  publisher: "React", format: "Cited web guide", level: "Beginner",
  why: "URL replayed from the successful user-run React/State search; display label reconstructed from its URL.",
  provenance: "web_search", retrieved_at: "2026-10-04",
})) };

for (const [name, width] of [["desktop", 1440], ["mobile", 390]]) {
  test(`recorded-source replay screenshot: ${name}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1100 });
    await page.addInitScript(() => localStorage.setItem("learnanything.onboarding.hidden.v1", "true"));
    await page.route("https://**", (route) => route.abort());
    await page.route("**/v1/lp/**", (route) => route.fulfill({ json: graph }));
    await page.route("**/v1/resources", (route) => route.fulfill({ json: response }));
    await page.goto("/learningpath?term=React");
    await page.getByRole("button", { name: "Find resources" }).click();
    await expect(page.locator(".resource-cards > li")).toHaveCount(recorded.source_urls.length);
    await page.evaluate(() => {
      const label = document.createElement("p");
      label.textContent = "Recorded live-source URL replay · labels reconstructed · local mocked endpoint";
      label.style.cssText = "padding:12px;background:#fff1c2;color:#222;font-weight:600;";
      document.querySelector(".concept-resources").prepend(label);
    });
    await page.evaluate(() => window.scrollTo(0, document.querySelector(".concept-resources").getBoundingClientRect().top + window.scrollY - 140));
    await page.screenshot({ path: `../evidence/resources-recorded-${name}.png` });
    for (const resource of response.resources) {
      await expect(page.locator(`.resource-cards a[href="${resource.url}"]`)).toHaveCount(1);
    }
  });
}
