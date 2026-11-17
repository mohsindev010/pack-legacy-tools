import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// CI runs on Linux, whose fonts are wider than Windows/macOS fonts. A table that
// fits locally can overflow there and become a scroll box (axe:
// scrollable-region-focusable). Check every built tool with a wide font and at
// phone width so layout-dependent issues fail locally too.
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
const WIDE_FONT = "*{font-family: Verdana, 'DejaVu Sans', sans-serif !important}";

for (const slug of TOOLS) {
  for (const layout of ["wide font", "phone width"] as const) {
    test(`${slug}: no serious accessibility violations (${layout})`, async ({ page }) => {
      if (layout === "phone width") await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(`/tools/${slug}/`);
      await page.addStyleTag({ content: WIDE_FONT });
      await expect(
        page.getByRole("heading", { name: "How this result was calculated" }),
      ).toBeVisible();
      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
      expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([]);
    });
  }
}
