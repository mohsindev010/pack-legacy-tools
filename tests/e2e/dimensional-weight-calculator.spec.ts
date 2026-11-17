import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PATH = "/tools/dimensional-weight-calculator/";
const headline = (page: import("@playwright/test").Page) =>
  page.locator('[aria-live="polite"]').first();

test("default result, working, tables and FAQ are in the HTML without JavaScript", async ({
  request,
}) => {
  const html = await (await request.get(PATH)).text();
  for (const text of [
    "3 lb with USPS", // headline for 12 x 9 x 4 in, 2.5 lb
    "432 / 139 = 3.11", // explain step
    "Key takeaway",
    "What changed in 2025 and 2026",
    "Divisors and surcharge thresholds",
    "What DIM divisor do UPS, FedEx and USPS use in 2026?",
    "Rules effective as of",
    "USPS Domestic Mail Manual",
  ]) {
    expect(html, text).toContain(text);
  }
});

test("JSON-LD describes the tool, breadcrumb and FAQ", async ({ page }) => {
  await page.goto(PATH);
  const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
  const types = (JSON.parse(raw!) as { "@type": string }[]).map((x) => x["@type"]);
  expect(types).toEqual(["WebApplication", "BreadcrumbList", "FAQPage"]);
});

test("recalculates live and mirrors inputs to the URL", async ({ page }) => {
  await page.goto(PATH);
  await page.getByLabel("Length", { exact: true }).fill("16");
  await page.getByLabel("Width", { exact: true }).fill("12");
  await page.getByLabel("Height", { exact: true }).fill("8");
  await page.getByLabel("Actual weight").fill("2");
  await expect(headline(page)).toContainText("2 lb with USPS");
  await expect(
    page.getByRole("table", { name: "Billable weight by carrier (2026 rules)" }),
  ).toContainText("12 lb");
  await expect(page).toHaveURL(/l=16&w=12&h=8&u=in&wt=2/);
});

test("a shared link opens pre-filled, with surcharges and ties", async ({ page }) => {
  await page.goto(`${PATH}?l=31&w=24&h=24&u=in&wt=20`);
  await expect(headline(page)).toContainText("129 lb with UPS, FedEx, USPS and DHL Express");
  await expect(headline(page)).toContainText("Large Package Surcharge");
  await expect(page.getByLabel("Length", { exact: true })).toHaveValue("31");
});

test("switching units converts the inputs", async ({ page }) => {
  await page.goto(PATH);
  await page.getByRole("radio", { name: "cm / kg" }).check();
  await expect(page.getByLabel("Length", { exact: true })).toHaveValue("30.48");
  await expect(page.getByLabel("Actual weight")).toHaveValue("1.13");
});

test("cm / kg uses the metric divisor and shows the working", async ({ page }) => {
  await page.goto(`${PATH}?l=50&w=40&h=30&u=cm&wt=3`);
  const table = page.getByRole("table", { name: "Billable weight by carrier (2026 rules)" });
  await expect(table).toContainText("5,000");
  await expect(table).toContainText("12 kg");
  await expect(table).toContainText("lb ("); // USPS bills in lb, shown with kg
  await expect(page.getByRole("heading", { name: "How this result was calculated" })).toBeVisible();
  await expect(page.getByText("DIM weight 60,000 / 5,000 = 12").first()).toBeVisible();
});

test("offers box, poly mailer and Mylar bag packaging", async ({ page }) => {
  await page.goto(PATH);
  for (const name of ["Box", "Poly mailer / envelope", "Mylar bag / pouch"])
    await expect(page.getByRole("radio", { name, exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "Mylar bag / pouch" }).check();
  await expect(page).toHaveURL(/p=mylar/);
});

test("invalid input shows a field error and keeps the last result", async ({ page }) => {
  await page.goto(PATH);
  await page.getByLabel("Length", { exact: true }).fill("0");
  await expect(page.getByText("Length must be greater than 0")).toBeVisible();
  await expect(headline(page)).toContainText("showing last result");
});

test("quote button pre-fills the quote form", async ({ page }) => {
  await page.goto(`${PATH}?l=12.2&w=9&h=4&u=in&wt=2.5&c=ups`);
  await expect(headline(page)).toContainText("4 lb with UPS");
  await page.getByRole("link", { name: "Quote a box at this size" }).click();
  await expect(page).toHaveURL(/\/quote-test\/$/);
  await expect(page.getByTestId("prefill-status")).toHaveText(
    "Pre-filled by dimensional-weight-calculator",
  );
  const payload = JSON.parse((await page.getByTestId("prefill-payload").textContent())!);
  expect(payload).toMatchObject({
    length: "13",
    width: "9",
    height: "4",
    unit: "inches",
    tool_source: "dimensional-weight-calculator",
  });
  expect(payload.details).toContain("UPS billable 4 lb");
});

test("API returns the same values as the engine, and 400 with field paths", async ({ request }) => {
  const ok = await request.get(
    "/api/tools/dimensional-weight-calculator/?l=16&w=12&h=8&wt=2&c=ups,usps",
  );
  expect(ok.status()).toBe(200);
  expect(ok.headers()["access-control-allow-origin"]).toBe("*");
  const body = await ok.json();
  expect(body.ok).toBe(true);
  expect(body.value.carriers.ups.billable).toBe(12);
  expect(body.value.carriers.usps.billable).toBe(2);
  expect(body.value.carriers.usps.dimWeight).toBeNull();
  expect(body.rules.map((r: { id: string }) => r.id)).toEqual(["ups", "usps", "usps-cubic"]);

  const bad = await request.get("/api/tools/dimensional-weight-calculator/?l=0&w=12&h=8&wt=2");
  expect(bad.status()).toBe(400);
  expect((await bad.json()).errors[0].path).toBe("l");
});

test("no serious accessibility violations with the widget open", async ({ page }) => {
  await page.goto(PATH);
  await page.getByText("More options: contract divisor").click();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([]);
});
