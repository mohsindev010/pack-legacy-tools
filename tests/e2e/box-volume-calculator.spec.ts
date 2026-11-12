import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PATH = "/tools/box-volume-calculator/";
const result = (page: import("@playwright/test").Page) =>
  page.locator('[aria-live="polite"]').first();

test("default answer, tables and FAQ are in the HTML without JavaScript", async ({ request }) => {
  const html = await (await request.get(PATH)).text();
  for (const text of [
    "3 ft³ · 0.085 CBM", // golden case 1
    "Shipping container dimensions (Evergreen Line)",
    "5,898 × 2,352 × 2,393", // 20 ft inside
    "Common carton sizes: volume and cartons per container",
    "How many boxes fit in a 40 ft container?",
    "fits 665 in a 40 ft standard and 780 in a 40 ft high cube", // golden case 4
  ]) {
    expect(html, text).toContain(text);
  }
});

test("calculates live and keeps state in the URL", async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveURL(/l=24&w=18&h=12&u=in/); // hydrated
  await page.getByRole("spinbutton", { name: "Quantity" }).fill("1000");
  await expect(result(page)).toContainText("3,000 ft³ · 84.9505 CBM");
  await expect(page.getByRole("table").first()).toContainText("4 (last holds 55)");
  await expect(page).toHaveURL(/q=1000/);
});

test("switching to cm converts the sides and keeps the volume", async ({ page }) => {
  await page.goto(`${PATH}?l=60&w=40&h=30&u=cm&wt=120`);
  await expect(result(page)).toContainText("0.072 CBM");
  await expect(page.getByRole("table").first()).toContainText("236");
  await expect(result(page)).toContainText("weight, not space");
  await page.getByRole("radio", { name: "mm / kg" }).check();
  await expect(page.getByLabel("Length")).toHaveValue("600");
  await expect(result(page)).toContainText("0.072 CBM");
});

test("quote button sends the carton size", async ({ page }) => {
  await page.goto(`${PATH}?l=24&w=18&h=12&u=in&q=1000`);
  await expect(result(page)).toContainText("3,000 ft³");
  await page.getByRole("link", { name: "Quote cartons at this size" }).click();
  await expect(page).toHaveURL(/\/quote-test\/$/);
  await expect(page.getByTestId("prefill-status")).toHaveText(
    "Pre-filled by box-volume-calculator",
  );
  const payload = JSON.parse((await page.getByTestId("prefill-payload").textContent())!);
  expect(payload).toMatchObject({
    length: "24",
    width: "18",
    height: "12",
    unit: "inches",
    tool_source: "box-volume-calculator",
  });
  expect(payload.details).toContain("Fits 780 per 40 ft high cube (2 containers)");
});

test("API calculates and rejects bad input", async ({ request }) => {
  const ok = await request.get(`/api${PATH}?l=24&w=18&h=12&u=in&c=20ft`);
  expect(ok.status()).toBe(200);
  const body = await ok.json();
  expect(body.value.perCarton.ft3).toBe(3);
  expect(body.value.containers[0].fit).toBe(315);
  const bad = await request.get(`/api${PATH}?l=0&w=18&h=12`);
  expect(bad.status()).toBe(400);
  expect((await bad.json()).errors[0].path).toBe("l");
});

test("no serious accessibility violations", async ({ page }) => {
  await page.goto(PATH);
  await page.getByText(/Show the working/).click();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([]);
});
