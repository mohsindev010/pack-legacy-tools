import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Phase 0 exit criteria: /tools/ renders nine cards from the registry and every
// lab route carries the noindex header.

test("hub lists nine tools and is noindex", async ({ page }) => {
  const res = await page.goto("/tools/");
  expect(res?.status()).toBe(200);
  expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Free Packaging Tools");
  await expect(page.getByTestId("tool-card")).toHaveCount(9);
});

test("root redirects to the hub", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/tools\/$/);
});

test("a tool page renders its template server-side", async ({ page }) => {
  const res = await page.goto("/tools/dimensional-weight-calculator/");
  expect(res?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Dimensional Weight & Shipping Surcharge Calculator",
  );
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toBeVisible();
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});

test("unknown tool returns 404", async ({ page }) => {
  const res = await page.goto("/tools/not-a-tool/");
  expect(res?.status()).toBe(404);
});

test("robots disallows all and llms.txt lists the tools", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /");
  const llms = await (await request.get("/llms.txt")).text();
  expect(llms).toContain("/tools/pallet-calculator/");
});

test("API answers 501 for tools without an engine, 404 for unknown tools", async ({ request }) => {
  expect((await request.get("/api/tools/pallet-calculator/")).status()).toBe(501);
  expect((await request.get("/api/tools/not-a-tool/")).status()).toBe(404);
});

test("hub and tool pages have no serious accessibility violations", async ({ page }) => {
  for (const path of ["/tools/", "/tools/dimensional-weight-calculator/"]) {
    await page.goto(path);
    const { violations } = await new AxeBuilder({ page }).analyze();
    const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  }
});
