import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PATH = "/tools/standard-box-sizes/";
const result = (page: import("@playwright/test").Page) =>
  page.locator('[aria-live="polite"]').first();

test("default answer, charts and FAQ are in the HTML without JavaScript", async ({ request }) => {
  const html = await (await request.get(PATH)).text();
  for (const text of [
    "Required inside size",
    "9.5 x 6.5 x 3 in", // required size for the 9 x 6 x 2.5 default
    "Box made to your exact size",
    "USPS Priority Mail Flat Rate boxes",
    "12 x 11.75 x 5.5 in", // USPS Large, inside (Notice 123)
    "Shipping box (RSC) sizes",
    "Are box sizes inside or outside dimensions?",
    "Uline",
  ]) {
    expect(html, text).toContain(text);
  }
});

test("finds boxes live and keeps state in the URL", async ({ page }) => {
  await page.goto(PATH);
  await page.getByLabel("Product length").fill("11.5");
  await page.getByLabel("Product width").fill("11.5");
  await page.getByLabel("Product height").fill("5");
  await expect(result(page)).toContainText("12 x 12 x 5.5 in");
  await page.getByLabel("Box type").selectOption("usps-flat-rate");
  await expect(result(page)).toContainText("No stock box fits");
  await expect(page).toHaveURL(/l=11\.5&w=11\.5&h=5&u=in.*f=usps-flat-rate/);
});

test("this side up changes the matches; a shared link restores it", async ({ page }) => {
  await page.goto(`${PATH}?l=4&w=4&h=9&u=in&o=upright`);
  await expect(
    page.getByRole("radio", { name: "This side up (keep height vertical)" }),
  ).toBeChecked();
  const table = page.getByRole("table", { name: /fitting boxes/ });
  await expect(table).toBeVisible();
  for (const cell of await table.locator("tbody tr td:nth-child(2)").allTextContents()) {
    const h = parseFloat(cell.split(" x ")[2]!);
    expect(h).toBeGreaterThanOrEqual(9.5);
  }
});

test("quote button sends the exact-fit size", async ({ page }) => {
  await page.goto(PATH);
  // The widget writes its state to the URL once hydrated; only then is the click handler attached.
  await expect(page).toHaveURL(/l=9&w=6&h=2.5/);
  await page.getByRole("link", { name: "Quote the exact-fit box" }).click();
  await expect(page).toHaveURL(/\/quote-test\/$/);
  await expect(page.getByTestId("prefill-status")).toHaveText("Pre-filled by standard-box-sizes");
  const payload = JSON.parse((await page.getByTestId("prefill-payload").textContent())!);
  expect(payload).toMatchObject({
    length: "9.5",
    width: "6.5",
    height: "3",
    unit: "inches",
    material: "Kraft corrugated",
    tool_source: "standard-box-sizes",
  });
});

test("API returns ranked boxes and 400 with field paths", async ({ request }) => {
  const ok = await request.get(`/api${PATH}?l=8&w=5&h=1.25&cl=0.125&f=usps-flat-rate`);
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body.value.matches[0].id).toBe("usps-fr-small");
  const bad = await request.get(`/api${PATH}?l=0&w=5&h=1`);
  expect(bad.status()).toBe(400);
  expect((await bad.json()).errors[0].path).toBe("l");
});

test("no serious accessibility violations", async ({ page }) => {
  await page.goto(PATH);
  await page.getByText("More options: insert").click();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([]);
});
