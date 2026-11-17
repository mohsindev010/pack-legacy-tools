import { expect, test } from "@playwright/test";

const PATH = "/tools/pallet-calculator/";
const result = (page: import("@playwright/test").Page) =>
  page.locator('[aria-live="polite"]').first();

test("default answer, diagram, tables and FAQ are in the HTML without JavaScript", async ({
  request,
}) => {
  const html = await (await request.get(PATH)).text();
  for (const text of [
    "100 cartons", // 12 x 10 x 8 in on GMA (golden case 1)
    "Top view of one layer",
    "How this result was calculated",
    "Pallets per container (single tier, floor only)",
    "How many pallets fit in a 20 ft container?",
  ]) {
    expect(html, text).toContain(text);
  }
});

test("calculates live, with weight limits, and keeps state in the URL", async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveURL(/l=12&w=10&h=8&u=in&p=gma-48x40/);
  await expect(result(page)).toContainText("100 cartons");
  await page.getByRole("spinbutton", { name: "Weight per carton" }).fill("40");
  await expect(result(page)).toContainText("62 cartons");
  await expect(result(page)).toContainText("2,520 lb");
  await page.getByLabel("This side up").check();
  await page.getByRole("spinbutton", { name: "Weight per carton" }).fill("");
  await expect(result(page)).toContainText("96 cartons");
  await expect(page).toHaveURL(/up=1/);
});

test("EPAL pallets in cm, with containers", async ({ page }) => {
  await page.goto(`${PATH}?l=40&w=30&h=25&u=cm&p=epal-1&up=1`);
  await expect(result(page)).toContainText("40 cartons");
  const table = page.getByRole("table", { name: /Pallets per container/ });
  await expect(table).toContainText("11");
  await expect(table).toContainText("25");
});

test("API calculates and rejects bad input", async ({ request }) => {
  const ok = await request.get(`/api${PATH}?l=12&w=10&h=8&u=in`);
  expect(ok.status()).toBe(200);
  expect((await ok.json()).value.perPallet).toBe(100);
  const bad = await request.get(`/api${PATH}?l=0&w=10&h=8`);
  expect(bad.status()).toBe(400);
});
