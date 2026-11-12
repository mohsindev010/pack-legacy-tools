import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import jsQR from "jsqr";

const PATH = "/tools/qr-code-generator/";
const result = (page: Page) => page.locator('[aria-live="polite"]').first();

/** Decode the on-screen preview image, as a phone would. */
async function decodePreview(page: Page): Promise<string | null> {
  const px = await page
    .locator("figure img")
    .first()
    .evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      const c = document.createElement("canvas");
      c.width = 400;
      c.height = 400;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0, 400, 400);
      return Array.from(ctx.getImageData(0, 0, 400, 400).data);
    });
  return jsQR(Uint8ClampedArray.from(px), 400, 400)?.data ?? null;
}

test("default code, size tables and FAQ are in the HTML without JavaScript", async ({
  request,
}) => {
  const html = await (await request.get(PATH)).text();
  for (const text of [
    "3 cm (1.18 in) square",
    "QR code size by scanning distance",
    "Error correction levels",
    "What size should a QR code be on packaging?",
    "What is a GS1 Digital Link QR code?",
    "0.909 mm",
  ]) {
    expect(html, text).toContain(text);
  }
});

test("the preview decodes, and changes live with the URL", async ({ page }) => {
  await page.goto(PATH);
  await expect(result(page)).toContainText("Decodes correctly");
  expect(await decodePreview(page)).toBe("https://packlegacy.com/");
  await page.getByLabel("Web address").fill("https://example.com/box?id=7");
  await expect(page).toHaveURL(/u=https%3A%2F%2Fexample\.com%2Fbox%3Fid%3D7/);
  await expect(result(page)).toContainText("Decodes correctly");
  expect(await decodePreview(page)).toBe("https://example.com/box?id=7");
});

test("GS1 Digital Link from a shared link; bad check digit shows a field error", async ({
  page,
}) => {
  await page.goto(`${PATH}?t=gs1&gd=https%3A%2F%2Fid.gs1.org&gg=9520123456788&gl=ABC1&gx=271231`);
  await expect(result(page)).toContainText("Decodes correctly");
  expect(await decodePreview(page)).toBe("https://id.gs1.org/01/09520123456788/10/ABC1?17=271231");
  await page.getByLabel("GTIN").fill("9520123456789");
  await expect(page.getByText("Wrong GTIN check digit: expected 8")).toBeVisible();
});

test("Wi-Fi password never reaches the URL; inverted colours block downloads", async ({ page }) => {
  await page.goto(PATH);
  await page.getByLabel("What the code opens").selectOption("wifi");
  await page.getByLabel("Network name (SSID)").fill("Warehouse");
  await page.getByLabel("Password").fill("s3cret-pass");
  await expect(page).toHaveURL(/ws=Warehouse/);
  expect(page.url()).not.toContain("s3cret");
  await expect(result(page)).toContainText("Decodes correctly");
  await page.getByLabel("Code colour").fill("#ffffff");
  await page.getByLabel("Background colour").fill("#000000");
  await expect(page.getByRole("button", { name: "Download SVG" })).toBeDisabled();
});

test("SVG download is exact size; API serves SVG and PDF", async ({ page, request }) => {
  await page.goto(PATH);
  await expect(page.getByRole("button", { name: "Download SVG" })).toBeEnabled();
  const [dl] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Download SVG" }).click(),
  ]);
  expect(dl.suggestedFilename()).toBe("qr-code.svg");
  const svg = await (
    await request.get(`/api${PATH}?t=url&u=https://packlegacy.com/&format=svg`)
  ).text();
  expect(svg).toContain('width="30mm" height="30mm"');
  const pdf = await request.get(`/api${PATH}?t=url&u=https://packlegacy.com/&format=pdf`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  const bad = await request.get(`/api${PATH}?t=url&u=nope`);
  expect(bad.status()).toBe(400);
});

test("no serious accessibility violations", async ({ page }) => {
  await page.goto(PATH);
  await page.getByText("More options: logo, quiet zone").click();
  await page.getByText("Add UTM tracking").click();
  const { violations } = await new AxeBuilder({ page }).analyze();
  const serious = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(serious, JSON.stringify(serious.map((v) => [v.id, v.nodes[0]?.target]))).toEqual([]);
});
