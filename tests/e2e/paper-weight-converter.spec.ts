import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const PATH = "/tools/paper-weight-converter/";
const result = (page: import("@playwright/test").Page) =>
  page.locator('[aria-live="polite"]').first();

test("default answer, charts and FAQ are in the HTML without JavaScript", async ({ request }) => {
  const html = await (await request.get(PATH)).text();
  for (const text of [
    "110.9 lb cover", // 300 gsm default (golden case 1)
    "≈ 14.1 pt (13.6–16.2)", // SBS caliper range for 300 gsm
    "Paper weight chart (gsm to lb by grade)",
    "Paperboard caliper chart (pt to gsm)",
    "341 (297–354)", // 16 pt SBS (golden case 7)
    "2.7041",
    "How many gsm is 18 pt?",
    "Corrugated flute thickness (reference)",
  ]) {
    expect(html, text).toContain(text);
  }
});

test("converts live, switches units and keeps state in the URL", async ({ page }) => {
  await page.goto(PATH);
  await expect(page).toHaveURL(/v=300&f=gsm/); // hydrated
  await page.getByLabel("Weight or caliper").fill("16");
  await page.getByRole("radio", { name: "pt", exact: true }).check();
  // Switching the unit converts the value; set it back to 16 pt.
  await page.getByLabel("Weight or caliper").fill("16");
  await expect(result(page)).toContainText("≈ 341 gsm (297–354)");
  await page.getByLabel("Board type (for caliper)").selectOption("crb");
  await expect(page).toHaveURL(/v=16&f=pt.*b=crb/);
});

test("a shared lb link restores grade and gives exact gsm", async ({ page }) => {
  await page.goto(`${PATH}?v=100&f=lb&g=cover`);
  await expect(result(page)).toContainText("270.4 gsm");
  await expect(page.getByLabel("Paper grade (for lb)")).toHaveValue("cover");
});

test("quote button sends the board spec", async ({ page }) => {
  await page.goto(`${PATH}?v=16&f=pt&g=cover`);
  await expect(result(page)).toContainText("341");
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
  expect(payload.details).toContain("16 pt SBS");
  expect(payload.details).toContain("297–354");
});

test("API converts and flags a missing grade", async ({ request }) => {
  const ok = await request.get(`/api${PATH}?v=80&f=lb&g=text`);
  expect(ok.status()).toBe(200);
  expect((await ok.json()).value.gsm.typical).toBeCloseTo(118.41, 2);
  const noGrade = await (await request.get(`/api${PATH}?v=50&f=lb`)).json();
  expect(noGrade.ok).toBe(false);
  expect(noGrade.flags[0].code).toBe("GRADE_REQUIRED");
  const bad = await request.get(`/api${PATH}?v=-1`);
  expect(bad.status()).toBe(400);
  expect((await bad.json()).errors[0].path).toBe("value");
});

test("no serious accessibility violations", async ({ page }) => {
  await page.goto(PATH);
  await page.getByText(/Show the working/).click();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([]);
});
