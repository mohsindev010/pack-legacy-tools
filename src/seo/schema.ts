// JSON-LD builders (section 13.2).
import type { ToolMeta } from "@core/registry";
import { toolPath } from "@core/registry";
import { absoluteUrl, ORG_NAME, SITE_URL } from "./site";

type JsonLd = Record<string, unknown>;

export function organization(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: ORG_NAME,
    url: SITE_URL,
    // logo, sameAs and contact are added once Pack Legacy supplies them (section 22.1).
  };
}

export function webApplication(tool: ToolMeta): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: tool.h1,
    url: absoluteUrl(toolPath(tool.slug)),
    description: tool.description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@type": "Organization", name: ORG_NAME, url: SITE_URL },
    author: { "@type": "Person", name: tool.author.name, url: absoluteUrl(tool.author.url) },
    dateModified: tool.updated,
  };
}

export function breadcrumbs(items: { name: string; path: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

export function toolBreadcrumbs(tool: ToolMeta): JsonLd {
  return breadcrumbs([
    { name: "Home", path: "/" },
    { name: "Tools", path: "/tools/" },
    { name: tool.name, path: toolPath(tool.slug) },
  ]);
}

export function faqPage(items: { q: string; a: string }[]): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** Serialize for a <script type="application/ld+json">, escaping "<" to block tag injection. */
export function serializeJsonLd(data: JsonLd | JsonLd[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
