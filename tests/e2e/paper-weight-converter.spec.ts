import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PATH = "/tools/paper-weight-converter/";
const result = (page: import("@playwright/test").Page) =>
  page.locator('[aria-live="polite"]').first();

test("default answer, charts and FAQ are in the HTML without JavaScript", async ({ request }) => {
  const html = await (await request.get(PATH)).text();
  for (const text of [
    "336 GSM", // 24 pt uncoated (Custom Box Makers example)
    "How it works",
    "GSM ≈ PT × 1400 / 100",
    "PT to GSM chart by stock type",
    "Text and cover weight (lb) to GSM",
    "What is 300 GSM in lb and pt?",
  ]) {
    expect(html, text).toContain(text);
  }
});

test("converts live by stock type and keeps state in the URL", async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveURL(/v=24&f=pt&s=uncoated/); // hydrated
  await expect(result(page)).toContainText("336 GSM");
  await page.getByLabel("Stock type").selectOption("c1s");
  await expect(result(page)).toContainText("360 GSM");
  await page.getByLabel("Stock type").selectOption("c2s");
  await page.getByRole("spinbutton", { name: "Value" }).fill("8");
  await expect(result(page)).toContainText("132 GSM");
  await expect(page).toHaveURL(/v=8&f=pt&s=c2s/);
});

test("300 GSM uncoated gives 110.7 lb cover and 21.4 pt", async ({ page }) => {
  await page.goto(`${PATH}?v=300&f=gsm&s=uncoated`);
  await expect(result(page)).toContainText("110.7 lb cover");
  await expect(result(page)).toContainText("21.4 pt");
  await expect(result(page)).toContainText("0.544 mm");
});

test("lb text and lb cover use different factors", async ({ page }) => {
  await page.goto(`${PATH}?v=54&f=lb&s=text`);
  await expect(result(page)).toContainText("79.9 GSM");
  await page.getByLabel("Stock type").selectOption("uncoated");
  await expect(result(page)).toContainText("146.3 GSM");
});

test("quote button sends the board spec", async ({ page }) => {
  await page.goto(`${PATH}?v=16&f=pt&s=c2s`);
  await expect(result(page)).toContainText("264 GSM");
  await page.getByRole("link", { name: "Quote packaging in this board" }).click();
  await expect(page).toHaveURL(/\/quote-test\/$/);
  await expect(page.getByTestId("prefill-status")).toHaveText(
    "Pre-filled by paper-weight-converter",
  );
  const payload = JSON.parse((await page.getByTestId("prefill-payload").textContent())!);
  expect(payload).toMatchObject({
    material: "Folding Paperboard",
    tool_source: "paper-weight-converter",
  });
  expect(payload.details).toContain("C2S coated (both sides), 16 pt ≈ 264 GSM");
});

test("API converts and rejects bad input", async ({ request }) => {
  const ok = await request.get(`/api${PATH}?v=24&f=pt&s=c1s`);
  expect(ok.status()).toBe(200);
  expect((await ok.json()).value.gsm).toBe(360);
  const bad = await request.get(`/api${PATH}?v=-1`);
  expect(bad.status()).toBe(400);
  expect((await bad.json()).errors[0].path).toBe("value");
});

test("no serious accessibility violations", async ({ page }) => {
  await page.goto(PATH);
  await expect(page.getByRole("heading", { name: "How this result was calculated" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([]);
});
