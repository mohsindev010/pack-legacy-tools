// Site-level settings read from the environment (section 18.1).

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://packlegacy.com").replace(
  /\/$/,
  "",
);
export const QUOTE_URL = process.env.NEXT_PUBLIC_QUOTE_URL ?? "/quote-test/";
export const LAB_MODE = process.env.LAB_MODE !== "false";
export const ORG_NAME = "Pack Legacy";

/** Absolute canonical URL on the production domain. */
export const absoluteUrl = (path: string) =>
  `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
