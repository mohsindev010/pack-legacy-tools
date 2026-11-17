import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PATH = "/tools/barcode-generator/";
const result = (page: Page) => page.locator('[aria-live="polite"]').first();

test("default barcode, size table and FAQ are in the HTML without JavaScript", async ({
  request,
}) => {
  const html = await (await request.get(PATH)).text();
  for (const text of [
    "UPC-A 036000291452",
    "37.29 mm x 25.93 mm",
    "UPC-A and EAN-13 size by magnification",
    "29.83", // 80% width
    "74.58", // 200% width
    "Which barcode for which use",
    "Why do red barcodes not scan?",
  ]) {
    expect(html, text).toContain(text);
  }
});

test("check digit, magnification and URL state update live", async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveURL(/s=upca&d=03600029145/);
  await page.getByLabel("Data to encode").fill("036000291453");
  await expect(page.getByText("Wrong check digit: expected 2")).toBeVisible();
  await page.getByLabel("Data to encode").fill("036000291452");
  await page.getByLabel("Magnification").fill("80");
  await expect(result(page)).toContainText("29.83 mm x 20.74 mm");
  await expect(page).toHaveURL(/d=036000291452&m=80/);
  await page.getByLabel("Magnification").fill("70");
  await expect(page.getByText("Below the 80% minimum")).toBeVisible();
});

test("switching type loads a valid example; ITF-14 shows bearer bars", async ({ page }) => {
  await page.goto(PATH);
  await page.getByLabel("Barcode type").selectOption("itf14");
  await expect(result(page)).toContainText("ITF-14 15400141288763");
  await expect(page.getByLabel("Bearer bars (4.8 mm frame)")).toBeChecked();
  await page.getByLabel("Barcode type").selectOption("gs1datamatrix");
  await expect(result(page)).toContainText("GS1 DataMatrix");
  await expect(page.locator("figure img").first()).toBeVisible();
});

test("red bars warn; downloads have exact-size files", async ({ page, request }) => {
  await page.goto(PATH);
  await expect(page).toHaveURL(/s=upca/); // hydrated
  await page.getByLabel("Bar colour").fill("#e00000");
  await expect(result(page)).toContainText("look like white to a red-light scanner");
  const svg = await (await request.get(`/api${PATH}?s=upca&d=03600029145&format=svg`)).text();
  expect(svg).toContain('width="37.29mm" height="25.93mm"');
  const json = await (await request.get(`/api${PATH}?s=ean13&d=400638133393`)).json();
  expect(json.value.encoded).toBe("4006381333931");
  const bad = await request.get(`/api${PATH}?s=upca&d=036000291453`);
  expect(bad.status()).toBe(400);
  expect((await bad.json()).errors[0].message).toBe("Wrong check digit: expected 2");
  await page.getByLabel("Bar colour").fill("#000000");
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download PDF (exact size)" }).click(),
  ]);
  expect(dl.suggestedFilename()).toBe("upca-036000291452.pdf");
});

test("quote button sends the barcode spec", async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveURL(/s=upca/);
  await page.getByRole("link", { name: "Quote printed packaging" }).click();
  await expect(page.getByTestId("prefill-status")).toHaveText("Pre-filled by barcode-generator");
  const payload = JSON.parse((await page.getByTestId("prefill-payload").textContent())!);
  expect(payload.details).toContain("UPC-A barcode (036000291452) at 37.29 mm x 25.93 mm");
});

test("no serious accessibility violations", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole("heading", { name: "How this result was calculated" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([]);
});
