import { describe, expect, it } from "vitest";
import {
  allTools,
  getTool,
  isToolSlug,
  relatedTools,
  relatedProducts,
  toolPath,
} from "@core/registry";
import { rulesFiles, ruleEntries, rulesSummary } from "@core/rules";

describe("registry", () => {
  const tools = allTools();

  it("lists the nine tools with unique slugs", () => {
    expect(tools).toHaveLength(9);
    expect(new Set(tools.map((t) => t.slug)).size).toBe(9);
  });

  it.each(tools.map((t) => [t.slug, t] as const))("%s follows the URL and SEO rules", (slug, t) => {
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slug).not.toContain("custom"); // Pack Legacy URL rule (section 3)
    expect(toolPath(slug)).toBe(`/tools/${slug}/`);
    expect(t.title.length).toBeLessThanOrEqual(60);
    expect(t.description.length).toBeLessThanOrEqual(155);
    expect(t.question.endsWith("?")).toBe(true);
  });

  it("links only to tools that exist, never to itself", () => {
    for (const t of tools) {
      for (const r of t.relatedTools) {
        expect(isToolSlug(r), `${t.slug} -> ${r}`).toBe(true);
        expect(r).not.toBe(t.slug);
      }
      expect(relatedTools(t.slug)).toHaveLength(t.relatedTools.length);
      expect(relatedProducts(t.slug)).toEqual(t.relatedProducts);
    }
  });

  it("references only rules files that exist", () => {
    for (const t of tools)
      for (const f of t.rulesFiles) expect(Object.keys(rulesFiles), `${t.slug}: ${f}`).toContain(f);
  });

  it("returns undefined for unknown slugs", () => {
    expect(getTool("nope")).toBeUndefined();
    expect(relatedTools("nope")).toEqual([]);
    expect(relatedProducts("nope")).toEqual([]);
  });
});

describe("rules files (principle 1)", () => {
  it.each(Object.keys(rulesFiles))("%s has a version", (file) => {
    expect((rulesFiles as Record<string, { version?: string }>)[file]?.version).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    );
  });

  it("every rule entry carries source, sourceUrl, effectiveFrom and verifiedOn", () => {
    const entries = Object.keys(rulesFiles).flatMap(ruleEntries);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.source, `${e.file}:${e.path}`).toBeTruthy();
      expect(typeof e.sourceUrl).toBe("string");
      expect(e.effectiveFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(e.verifiedOn === null || /^\d{4}-\d{2}-\d{2}$/.test(e.verifiedOn)).toBe(true);
    }
  });

  it("carries the 2026 seed values the golden cases depend on", () => {
    const c = rulesFiles["carriers.json"].carriers;
    expect(c.ups.dimDivisorIn).toBe(139);
    expect(c.usps.dimDivisorIn).toBe(139);
    expect(c.usps.dimAppliesAboveIn3).toBe(1728);
    expect(c.fedex.surcharges.additionalHandling.volumeGtIn3).toBe(10368);
    expect(c.ups.surcharges.largePackage.volumeGtIn3).toBe(17280);
  });

  it("summarises effective dates and verification status", () => {
    const sum = rulesSummary(["carriers.json"]);
    expect(sum.entries).toHaveLength(4);
    expect(sum.latestEffectiveFrom).toBe("2026-07-12");
    expect(sum.allVerified).toBe(false);
    expect(sum.sources.length).toBe(4);
    expect(rulesSummary(["missing.json"]).entries).toEqual([]);
  });
});
