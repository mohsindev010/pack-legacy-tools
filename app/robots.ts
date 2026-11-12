import type { MetadataRoute } from "next";
import { absoluteUrl, LAB_MODE } from "@/src/seo/site";

// Lab: disallow everything. Production: allow and point to the sitemap.
export default function robots(): MetadataRoute.Robots {
  if (LAB_MODE) return { rules: { userAgent: "*", disallow: "/" } };
  return { rules: { userAgent: "*", allow: "/" }, sitemap: absoluteUrl("/sitemap.xml") };
}
