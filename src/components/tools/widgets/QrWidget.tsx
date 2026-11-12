"use client";

import { useEffect, useMemo, useState } from "react";
import jsQR from "jsqr";
import { generateQr, type QrValue } from "@core/tools/qr";
import {
  EC_LEVELS,
  QR_TYPES,
  qrFromQuery,
  qrInputSchema,
  qrToQuery,
  type QrInput,
  type QrType,
} from "@core/schemas/qr";
import { roundDisplay } from "@core/lib/round";
import type { Drawing } from "@core/lib/drawing";
import type { ToolResult } from "@core/lib/result";
import { NumberField } from "../NumberField";
import { TextField, SelectField, ColorPair } from "../TextField";
import { ToolForm } from "../ToolForm";
import { ResultCard } from "../ResultCard";
import { ExplainSteps } from "../ExplainSteps";
import { QuoteCTA } from "../QuoteCTA";
import { CodePreview, DownloadButtons, drawToCanvas } from "../CodePreview";
import { hashInputs, track } from "../analytics";
import { readQuery, writeQuery } from "../urlState";
import type { WidgetProps } from "./index";
import f from "../form.module.css";
import s from "../tools.module.css";

const SLUG = "qr-code-generator";

const TYPE_LABEL: Record<QrType, string> = {
  url: "Website (URL)",
  text: "Plain text",
  email: "Email",
  phone: "Phone call",
  sms: "Text message (SMS)",
  wifi: "Wi-Fi network",
  vcard: "Contact card (vCard)",
  gs1: "GS1 Digital Link (product GTIN)",
};
const EC_LABEL: Record<QrInput["ec"], string> = {
  L: "L: 7% recovery (smallest code)",
  M: "M: 15% recovery (recommended)",
  Q: "Q: 25% recovery",
  H: "H: 30% recovery (needed for a logo)",
};

type TextKeys =
  | "url"
  | "utmSource"
  | "utmMedium"
  | "utmCampaign"
  | "text"
  | "email"
  | "subject"
  | "phone"
  | "smsBody"
  | "ssid"
  | "password"
  | "firstName"
  | "lastName"
  | "org"
  | "title"
  | "vPhone"
  | "vEmail"
  | "vUrl"
  | "domain"
  | "gtin"
  | "lot"
  | "serial"
  | "expiry"
  | "fg"
  | "bg"
  | "sizeCm"
  | "distanceCm"
  | "quietZone";
type Fields = Record<TextKeys, string> & {
  type: QrType;
  security: QrInput["security"];
  hidden: boolean;
  ec: QrInput["ec"];
};

const DEFAULT: Fields = {
  type: "url",
  url: "https://packlegacy.com/",
  utmSource: "",
  utmMedium: "",
  utmCampaign: "",
  text: "",
  email: "",
  subject: "",
  phone: "",
  smsBody: "",
  ssid: "",
  password: "",
  security: "WPA",
  hidden: false,
  firstName: "",
  lastName: "",
  org: "",
  title: "",
  vPhone: "",
  vEmail: "",
  vUrl: "",
  domain: "https://id.gs1.org",
  gtin: "",
  lot: "",
  serial: "",
  expiry: "",
  ec: "M",
  fg: "#000000",
  bg: "#ffffff",
  sizeCm: "3",
  distanceCm: "30",
  quietZone: "4",
};

function fromInput(i: QrInput): Fields {
  const out = { ...DEFAULT };
  for (const k of Object.keys(DEFAULT) as (keyof Fields)[]) {
    const v = i[k as keyof QrInput];
    if (v === undefined) continue;
    (out as Record<string, unknown>)[k] = typeof v === "number" ? String(v) : v;
  }
  out.fg = out.fg.toLowerCase();
  out.bg = out.bg.toLowerCase();
  return out;
}

type Scan = { state: "checking" | "ok" | "fail"; key: string };

/** Decode the code as drawn (logo included) and compare with the payload. */
async function scanCheck(d: Drawing, moduleMm: number, payload: string): Promise<boolean> {
  const c = await drawToCanvas(d, 6 / moduleMm);
  const ctx = c.getContext("2d")!;
  const img = ctx.getImageData(0, 0, c.width, c.height);
  return jsQR(img.data, img.width, img.height)?.data === payload;
}

export function QrWidget({ slug }: WidgetProps) {
  if (slug !== SLUG) throw new Error(`QrWidget mounted for ${slug}`);
  const [fields, setFields] = useState<Fields>(DEFAULT);
  const [logo, setLogo] = useState<{ href: string; name: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const set = <K extends keyof Fields>(k: K, v: Fields[K]) =>
    setFields((cur) => ({ ...cur, [k]: v }));

  useEffect(() => {
    const q = readQuery();
    if (!q.t) return;
    const parsed = qrInputSchema.safeParse(qrFromQuery(q));
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of the URL on mount
    if (parsed.success) setFields(fromInput(parsed.data));
  }, []);

  const raw = useMemo(() => ({ ...fields, logo: !!logo }), [fields, logo]);
  const parsed = useMemo(() => qrInputSchema.safeParse(raw), [raw]);
  const current = useMemo(
    () => (parsed.success ? { input: parsed.data, result: generateQr(parsed.data) } : null),
    [parsed],
  );
  const [lastGood, setLastGood] = useState<{
    input: QrInput;
    result: ToolResult<QrValue | null>;
  } | null>(current);
  if (current && current !== lastGood) setLastGood(current);
  const shown = current ?? lastGood;

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) e[i.path.join(".")] ??= i.message;
    return e;
  }, [parsed]);

  useEffect(() => {
    if (!current) return;
    const t = setTimeout(() => {
      writeQuery(qrToQuery(current.input));
      track({ name: "tool_calculated", slug: SLUG, inputsHash: hashInputs(current.input) });
    }, 600);
    return () => clearTimeout(t);
  }, [current]);

  const v = shown?.result.value ?? null;
  const drawing: Drawing | null = useMemo(
    () =>
      v
        ? v.logoBox && logo
          ? { ...v.drawing, image: { ...v.logoBox, href: logo.href } }
          : v.drawing
        : null,
    [v, logo],
  );

  // 7. Scan check: decode what will be downloaded; block downloads if it fails.
  const scanKey =
    v && drawing
      ? `${v.payload}|${v.ec}|${drawing.fg}|${drawing.bg}|${logo?.href.length ?? 0}|${v.modules}`
      : "";
  useEffect(() => {
    if (!v || !drawing) return;
    let cancelled = false;
    scanCheck(drawing, v.moduleMm, v.payload)
      .then((ok) => !cancelled && setScan({ state: ok ? "ok" : "fail", key: scanKey }))
      .catch(() => !cancelled && setScan({ state: "fail", key: scanKey }));
    return () => {
      cancelled = true;
    };
  }, [v, drawing, scanKey]);
  const scanState = scan && scan.key === scanKey ? scan.state : "checking";

  function onLogo(file: File | undefined) {
    setLogoError(null);
    if (!file) return;
    if (!/^image\/(png|jpeg)$/.test(file.type)) {
      setLogoError("Use a PNG or JPG image.");
      return;
    }
    if (file.size > 2_000_000) {
      setLogoError("Use an image under 2 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo({ href: String(reader.result), name: file.name });
    reader.readAsDataURL(file);
  }

  const flags = shown?.result.flags ?? [];
  const blocking =
    flags.find((x) => x.level === "error")?.message ??
    (scanState === "fail"
      ? "the scan check could not read this code. Remove the logo, raise the contrast or print it larger."
      : scanState === "checking"
        ? "checking that the code scans…"
        : null);
  const t = fields.type;
  /** Safe description: web links are named; other payloads (Wi-Fi passwords, contacts) never leave the code itself. */
  const what = v
    ? /^https?:\/\//.test(v.payload)
      ? v.payload
      : TYPE_LABEL[shown!.input.type].toLowerCase()
    : "";
  const tf = (k: TextKeys, label: string, extra: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField
      label={label}
      value={fields[k]}
      onChange={(x) => set(k, x)}
      error={errors[k]}
      {...extra}
    />
  );

  return (
    <div className={f.widget}>
      <ToolForm label="QR code settings">
        <SelectField
          label="What the code opens"
          value={t}
          onChange={(x) => set("type", x)}
          options={QR_TYPES.map((id) => ({ value: id, label: TYPE_LABEL[id] }))}
        />
        {t === "url" && (
          <>
            {tf("url", "Web address", { type: "url", inputMode: "url" })}
            <details className={f.more}>
              <summary>Add UTM tracking (see scans in Google Analytics)</summary>
              <div>
                {tf("utmSource", "utm_source", { placeholder: "packaging" })}
                {tf("utmMedium", "utm_medium", { placeholder: "qr" })}
                {tf("utmCampaign", "utm_campaign", { placeholder: "spring-launch" })}
              </div>
            </details>
          </>
        )}
        {t === "text" && tf("text", "Text")}
        {t === "email" && (
          <>
            {tf("email", "Email address", { type: "email", inputMode: "email" })}
            {tf("subject", "Subject (optional)")}
          </>
        )}
        {(t === "phone" || t === "sms") &&
          tf("phone", "Phone number", { type: "tel", inputMode: "tel" })}
        {t === "sms" && tf("smsBody", "Message (optional)")}
        {t === "wifi" && (
          <>
            {tf("ssid", "Network name (SSID)")}
            <SelectField
              label="Security"
              value={fields.security}
              onChange={(x) => set("security", x)}
              options={[
                { value: "WPA", label: "WPA / WPA2 / WPA3" },
                { value: "WEP", label: "WEP" },
                { value: "nopass", label: "None (open network)" },
              ]}
            />
            {fields.security !== "nopass" &&
              tf("password", "Password", {
                type: "password",
                hint: "Stays in your browser; it is never added to the page link.",
              })}
            <label className={f.checks}>
              <input
                type="checkbox"
                checked={fields.hidden}
                onChange={(e) => set("hidden", e.target.checked)}
              />{" "}
              Hidden network
            </label>
          </>
        )}
        {t === "vcard" && (
          <>
            <div className={f.fieldRow}>
              {tf("firstName", "First name")}
              {tf("lastName", "Last name")}
            </div>
            {tf("org", "Company")}
            {tf("title", "Job title")}
            {tf("vPhone", "Phone", { type: "tel" })}
            {tf("vEmail", "Email", { type: "email" })}
            {tf("vUrl", "Website", { type: "url" })}
          </>
        )}
        {t === "gs1" && (
          <>
            {tf("domain", "Resolver domain", {
              type: "url",
              hint: "Your brand domain, or GS1's resolver https://id.gs1.org",
            })}
            {tf("gtin", "GTIN", {
              inputMode: "numeric",
              hint: "8, 12, 13 or 14 digits; padded to 14 in the link",
            })}
            <div className={f.fieldRow}>
              {tf("lot", "Batch / lot (optional)")}
              {tf("serial", "Serial (optional)")}
            </div>
            {tf("expiry", "Expiry YYMMDD (optional)", { inputMode: "numeric" })}
          </>
        )}
        <div className={f.fieldRow}>
          <NumberField
            label="Printed size"
            unit="cm"
            value={fields.sizeCm}
            onChange={(x) => set("sizeCm", x)}
            error={errors.sizeCm}
            hint="Width of the code, quiet zone included"
          />
          <NumberField
            label="Scan distance"
            unit="cm"
            value={fields.distanceCm}
            onChange={(x) => set("distanceCm", x)}
            error={errors.distanceCm}
          />
        </div>
        <SelectField
          label="Error correction"
          value={logo ? "H" : fields.ec}
          onChange={(x) => set("ec", x)}
          options={EC_LEVELS.map((l) => ({ value: l, label: EC_LABEL[l] }))}
          hint={logo ? "Set to H because a logo is added." : undefined}
        />
        <ColorPair
          fg={fields.fg}
          bg={fields.bg}
          onFg={(x) => set("fg", x)}
          onBg={(x) => set("bg", x)}
        />
        <details className={f.more}>
          <summary>More options: logo, quiet zone</summary>
          <div>
            <div className={f.field}>
              <label className={f.label} htmlFor="qr-logo">
                Logo in the centre (optional)
              </label>
              <input
                id="qr-logo"
                type="file"
                accept="image/png,image/jpeg"
                onChange={(e) => onLogo(e.target.files?.[0])}
              />
              <p className={f.hint}>PNG or JPG. It stays in your browser and is never uploaded.</p>
              {logoError && <p className={f.error}>{logoError}</p>}
              {logo && (
                <button type="button" className={s.buttonSecondary} onClick={() => setLogo(null)}>
                  Remove logo ({logo.name})
                </button>
              )}
            </div>
            <NumberField
              label="Quiet zone"
              unit="modules"
              value={fields.quietZone}
              onChange={(x) => set("quietZone", x)}
              error={errors.quietZone}
              hint="Blank margin on every side; 4 is the minimum"
              step={1}
            />
          </div>
        </details>
      </ToolForm>

      <div className={`${f.results} ${current ? "" : f.stale}`}>
        <ResultCard
          label={current ? "Your QR code" : "Fix the highlighted fields (showing last result)"}
          headline={
            v
              ? `${roundDisplay(v.sizeMm / 10, 2)} cm (${roundDisplay(v.sizeMm / 25.4, 2)} in) square`
              : "Cannot encode"
          }
          values={
            v
              ? [
                  { label: "Module size", value: `${roundDisplay(v.moduleMm, 3)} mm` },
                  {
                    label: "Smallest for this distance",
                    value: `${roundDisplay(v.minSizeMm / 10, 2)} cm`,
                  },
                  {
                    label: "Version / level",
                    value: `${v.version} (${v.modules} x ${v.modules}) / ${v.ec}`,
                  },
                  {
                    label: "Scan check",
                    value:
                      scanState === "ok"
                        ? "Decodes correctly"
                        : scanState === "fail"
                          ? "Failed"
                          : "Checking…",
                  },
                ]
              : []
          }
          flags={flags.filter((x) => x.level !== "info" || x.code === "LOGO_FORCES_H")}
        />
        {v && drawing && (
          <>
            <CodePreview drawing={drawing} title={`QR code: ${what}`} />
            <DownloadButtons
              drawing={drawing}
              title={`QR code: ${what}`}
              filename="qr-code"
              slug={SLUG}
              disabled={blocking}
            />
            <h3>Then quote the box it goes on</h3>
            <div className={s.ctaRow}>
              <QuoteCTA
                label="Quote printed packaging"
                prefill={{
                  tool: SLUG,
                  details: `Print a QR code at ${roundDisplay(v.sizeMm / 10, 2)} x ${roundDisplay(v.sizeMm / 10, 2)} cm (version ${v.version}, level ${v.ec}) for ${what.slice(0, 120)}.`,
                }}
              />
            </div>
          </>
        )}
        {shown && (
          <details className={f.more}>
            <summary>Show the working ({shown.result.explain.length} steps)</summary>
            <ExplainSteps steps={shown.result.explain} title="Step by step" />
          </details>
        )}
      </div>
    </div>
  );
}
