import { expect, test } from "@playwright/test";

const MYLAR = "/tools/mylar-bag-size-finder/";
const O2 = "/tools/oxygen-absorber-calculator/";
const result = (page: import("@playwright/test").Page) =>
  page.locator('[aria-live="polite"]').first();

test("mylar: default answer and chart are in the HTML", async ({ request }) => {
  const html = await (await request.get(MYLAR)).text();
  for (const text of [
    "1 gallon stand-up (zip)",
    "Mylar bag size chart",
    "How much rice fits in a 1 gallon mylar bag?",
    "How this result was calculated",
  ])
    expect(html, text).toContain(text);
});

test("mylar: recommends by weight and product, splits big fills", async ({ page }) => {
  await page.goto(MYLAR);
  await expect(page).toHaveURL(/wt=4&u=lb&p=rice/);
  await expect(result(page)).toContainText("1 gallon stand-up (zip)");
  await page.getByLabel("Product", { exact: true }).selectOption("flour");
  await page.getByRole("spinbutton", { name: "Fill weight per bag" }).fill("1");
  await expect(result(page)).toContainText("1 quart stand-up (zip)");
  await page.getByLabel("Product", { exact: true }).selectOption("rice");
  await page.getByRole("spinbutton", { name: "Fill weight per bag" }).fill("30");
  await expect(result(page)).toContainText("2 × 5 gallon flat (open end)");
});

test("mylar links to the oxygen calculator with the bag and weight", async ({ page }) => {
  await page.goto(`${MYLAR}?wt=4&u=lb&p=rice`);
  await page.getByRole("link", { name: "oxygen absorber calculator" }).first().click();
  await expect(page).toHaveURL(/oxygen-absorber-calculator\/\?c=gallon-zip&wt=4&wu=lb/);
  await expect(result(page)).toContainText("500 cc");
});

test("oxygen: default answer and chart are in the HTML", async ({ request }) => {
  const html = await (await request.get(O2)).text();
  for (const text of [
    "500 cc", // 1 gallon bag + 4 lb rice
    "Oxygen absorber chart (empty container, the most you need)",
    "What size oxygen absorber for a 5 gallon bucket?",
  ])
    expect(html, text).toContain(text);
});

test("oxygen: Sorbent Systems example and custom containers", async ({ page }) => {
  await page.goto(`${O2}?c=pail5&wt=35&wu=lb`);
  await expect(result(page)).toContainText("750 cc");
  await expect(result(page)).toContainText("643.9 cc");
  await page.getByLabel("Container", { exact: true }).selectOption("custom");
  await page.getByRole("spinbutton", { name: "Container volume" }).fill("20");
  await page.getByRole("spinbutton", { name: "Product weight in it" }).fill("");
  await expect(result(page)).toContainText("4,200 cc");
  await page.getByRole("spinbutton", { name: "Number of containers" }).fill("3");
  await expect(result(page)).toContainText("For 3 containers");
});

test("APIs answer and validate", async ({ request }) => {
  const m = await (await request.get(`/api${MYLAR}?wt=4&u=lb&p=rice`)).json();
  expect(m.value.recommended).toBe("gallon-zip");
  const o = await (await request.get(`/api${O2}?c=pail5&wt=35&wu=lb`)).json();
  expect(o.value.perContainer.sizes).toEqual([750]);
  expect((await request.get(`/api${O2}?c=custom`)).status()).toBe(400);
});
