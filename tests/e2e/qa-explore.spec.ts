import { expect, test, type Page } from "@playwright/test";

// QA exploratory checks, kept as regression tests (17 Nov 2026).
const TOOLS = [
  "dimensional-weight-calculator",
  "standard-box-sizes",
  "paper-weight-converter",
  "qr-code-generator",
  "barcode-generator",
  "box-volume-calculator",
  "pallet-calculator",
  "mylar-bag-size-finder",
  "oxygen-absorber-calculator",
];

function watchConsole(page: Page) {
  const problems: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" || /hydration|did not match/i.test(m.text()))
      problems.push(`${m.type()}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
  return problems;
}

for (const slug of TOOLS) {
  test(`${slug}: loads with no console errors and no sideways scroll on a phone`, async ({
    page,
  }) => {
    const problems = watchConsole(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/tools/${slug}/`);
    await expect(
      page.getByRole("heading", { name: "How this result was calculated" }),
    ).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "horizontal overflow (px)").toBeLessThanOrEqual(0);
    expect(problems).toEqual([]);
  });

  test(`${slug}: a garbage shared link falls back safely`, async ({ page }) => {
    const problems = watchConsole(page);
    await page.goto(
      `/tools/${slug}/?l=abc&w=-5&h=&u=zz&wt=NaN&v=1e999&c=bogus&p=%3Cb%3E&t=x&s=zz&d=&q=0`,
    );
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.locator('[aria-live="polite"]').first()).not.toContainText(
      /NaN|undefined|Infinity/,
    );
    expect(problems).toEqual([]);
  });
}

const roundTrips: [string, string, string, string[]][] = [
  ["dimensional-weight-calculator", "cm / kg", "in / lb", ["Length", "Width", "Height"]],
  [
    "standard-box-sizes",
    "cm / kg",
    "in / lb",
    ["Product length", "Product width", "Product height"],
  ],
  ["box-volume-calculator", "cm / kg", "in / lb", ["Length", "Width", "Height"]],
  ["pallet-calculator", "cm / kg", "in / lb", ["Length", "Width", "Height"]],
];
for (const [slug, metric, imperial, labels] of roundTrips) {
  test(`${slug}: switching units and back keeps the values and the answer`, async ({ page }) => {
    await page.goto(`/tools/${slug}/`);
    const result = page.locator('[aria-live="polite"]').first();
    const field = (l: string) => page.getByRole("spinbutton", { name: l, exact: true });
    await expect(field(labels[0]!)).not.toHaveValue("");
    const before = await Promise.all(labels.map((l) => field(l).inputValue()));
    const answer = await result.textContent();
    await page.getByRole("radio", { name: metric }).check();
    await page.getByRole("radio", { name: imperial }).check();
    expect(await Promise.all(labels.map((l) => field(l).inputValue()))).toEqual(before);
    await expect(result).toHaveText(answer!);
  });

  test(`${slug}: clearing a required field shows an error and keeps the last answer`, async ({
    page,
  }) => {
    await page.goto(`/tools/${slug}/`);
    const result = page.locator('[aria-live="polite"]').first();
    await page.getByRole("spinbutton", { name: labels[0]!, exact: true }).fill("");
    await expect(result).toContainText("showing last result");
    await expect(
      page.getByText(/must be a number|greater than 0|Required|expected number/i).first(),
    ).toBeVisible();
  });
}
