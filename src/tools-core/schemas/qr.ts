// Input schema for tool 4 (QR code generator). Same schema for widget, API and tests.
import { z } from "zod";
import { parseHex } from "../lib/color";
import { gs1CheckDigit } from "../lib/gs1";

export const QR_TYPES = ["url", "text", "email", "phone", "sms", "wifi", "vcard", "gs1"] as const;
export type QrType = (typeof QR_TYPES)[number];
export const EC_LEVELS = ["L", "M", "Q", "H"] as const;

const str = (max: number) => z.string().trim().max(max, `${max} characters at most`).default("");
const flag = z.preprocess((v) => (v === "0" || v === "false" ? false : v), z.coerce.boolean());
const hex = z
  .string()
  .trim()
  .refine((s) => parseHex(s) !== null, "Use a hex colour such as #000000");

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return (u.protocol === "http:" || u.protocol === "https:") && !!u.hostname.includes(".");
  } catch {
    return false;
  }
}

export const qrInputSchema = z
  .object({
    type: z.enum(QR_TYPES).default("url"),
    url: str(1500),
    utmSource: str(100),
    utmMedium: str(100),
    utmCampaign: str(100),
    text: str(1500),
    email: str(254),
    subject: str(200),
    phone: str(30),
    smsBody: str(300),
    ssid: str(32),
    /** Never written to the URL (shareable links must not leak Wi-Fi passwords). */
    password: str(63),
    security: z.enum(["WPA", "WEP", "nopass"]).default("WPA"),
    hidden: flag.default(false),
    firstName: str(60),
    lastName: str(60),
    org: str(100),
    title: str(100),
    vPhone: str(30),
    vEmail: str(254),
    vUrl: str(300),
    domain: str(200),
    gtin: str(14),
    lot: str(20),
    serial: str(20),
    expiry: str(6),
    ec: z.enum(EC_LEVELS).default("M"),
    fg: hex.default("#000000"),
    bg: hex.default("#FFFFFF"),
    /** A logo image is placed in the centre (the image itself stays in the browser). */
    logo: flag.default(false),
    /** Printed size of the code, quiet zone included. */
    sizeCm: z.coerce
      .number({ error: "Size must be a number" })
      .positive("Size must be greater than 0")
      .max(100, "100 cm at most")
      .default(3),
    /** Typical scan distance, for the 10:1 rule. */
    distanceCm: z.coerce.number().positive("Distance must be greater than 0").max(1000).default(30),
    quietZone: z.coerce
      .number()
      .int()
      .min(4, "The quiet zone cannot be under 4 modules")
      .max(20)
      .default(4),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });
    switch (v.type) {
      case "url":
        if (!isHttpUrl(v.url)) issue("url", "Enter a full web address starting with https://");
        break;
      case "text":
        if (!v.text) issue("text", "Enter some text");
        break;
      case "email":
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email))
          issue("email", "Enter a valid email address");
        break;
      case "phone":
      case "sms":
        if (!/^\+?[\d\s().-]{5,}$/.test(v.phone))
          issue("phone", "Enter a phone number, e.g. +1 555 123 4567");
        break;
      case "wifi":
        if (!v.ssid) issue("ssid", "Enter the network name");
        if (v.security !== "nopass" && !v.password) issue("password", "Enter the password");
        break;
      case "vcard":
        if (!v.firstName && !v.lastName && !v.org) issue("firstName", "Enter a name or company");
        if (v.vUrl && !isHttpUrl(v.vUrl))
          issue("vUrl", "Enter a full web address starting with https://");
        break;
      case "gs1": {
        if (!isHttpUrl(v.domain))
          issue("domain", "Enter your resolver domain, e.g. https://id.gs1.org");
        const g = v.gtin.replace(/\s/g, "");
        if (!/^\d+$/.test(g) || ![8, 12, 13, 14].includes(g.length)) {
          issue("gtin", "GTIN must be 8, 12, 13 or 14 digits");
        } else if (gs1CheckDigit(g.slice(0, -1)) !== Number(g.at(-1))) {
          issue("gtin", `Wrong GTIN check digit: expected ${gs1CheckDigit(g.slice(0, -1))}`);
        }
        if (v.expiry && !/^\d{2}(0[1-9]|1[0-2])(0\d|[12]\d|3[01])$/.test(v.expiry))
          issue("expiry", "Expiry is YYMMDD, e.g. 271231");
        break;
      }
    }
  });

export type QrInput = z.output<typeof qrInputSchema>;

// URL keys. The Wi-Fi password is deliberately absent.
const KEYS: [keyof QrInput, string][] = [
  ["type", "t"],
  ["url", "u"],
  ["utmSource", "us"],
  ["utmMedium", "um"],
  ["utmCampaign", "uc"],
  ["text", "x"],
  ["email", "e"],
  ["subject", "es"],
  ["phone", "p"],
  ["smsBody", "sb"],
  ["ssid", "ws"],
  ["security", "wt"],
  ["hidden", "wh"],
  ["firstName", "vf"],
  ["lastName", "vl"],
  ["org", "vo"],
  ["title", "vt"],
  ["vPhone", "vp"],
  ["vEmail", "ve"],
  ["vUrl", "vu"],
  ["domain", "gd"],
  ["gtin", "gg"],
  ["lot", "gl"],
  ["serial", "gs"],
  ["expiry", "gx"],
  ["ec", "ec"],
  ["fg", "fg"],
  ["bg", "bg"],
  ["sizeCm", "sz"],
  ["distanceCm", "dist"],
  ["quietZone", "qz"],
];
/** Settings left out of the URL when they hold their default. */
const QUIET_DEFAULTS: Partial<Record<keyof QrInput, unknown>> = {
  ec: "M",
  fg: "#000000",
  bg: "#FFFFFF",
  sizeCm: 3,
  distanceCm: 30,
  quietZone: 4,
  security: "WPA",
};

export function qrFromQuery(q: Record<string, string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, short] of KEYS) {
    const v = q[short];
    if (v === undefined || v === "") continue;
    out[k] = (k === "fg" || k === "bg") && !v.startsWith("#") ? `#${v}` : v;
  }
  return out;
}

export function qrToQuery(i: QrInput): Record<string, string> {
  const q: Record<string, string> = {};
  for (const [k, short] of KEYS) {
    const v = i[k];
    if (v === "" || v === false) continue;
    const d = QUIET_DEFAULTS[k];
    if (d !== undefined && (typeof v === "string" ? v.toUpperCase() === d : v === d)) continue;
    q[short] =
      typeof v === "string" && (k === "fg" || k === "bg") ? v.replace(/^#/, "") : String(v);
  }
  return q;
}
