import { type NextRequest } from "next/server";
import { getTool } from "@core/registry";
import { getEngine, parseInput } from "@core/engines";
import { rulesVersion } from "@core/rules";
import { toSvg } from "@core/lib/drawing";
import { toPdf } from "@core/lib/pdf";

// Public JSON API (section 15): same engine and zod schema as the UI.
// GET only, open CORS (headers in next.config.ts), deterministic and cacheable.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status: number, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { ...CORS, ...extra } });
}

export async function GET(request: NextRequest, ctx: RouteContext<"/api/tools/[slug]">) {
  const { slug } = await ctx.params;
  const tool = getTool(slug);
  if (!tool) return json({ ok: false, errors: [{ path: "slug", message: "Unknown tool" }] }, 404);

  const engine = getEngine(slug);
  if (!engine) {
    return json(
      {
        ok: false,
        tool: slug,
        errors: [{ path: "", message: "This tool's engine is not built yet" }],
      },
      501,
    );
  }

  const raw = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = parseInput(engine, engine.fromQuery(raw));
  if (!parsed.ok) return json({ ok: false, tool: slug, errors: parsed.errors }, 400);

  const result = engine.run(parsed.input);
  const version =
    tool.rulesFiles
      .map((f) => rulesVersion(f) ?? "")
      .sort()
      .at(-1) ?? "";

  // Code tools return the file itself with ?format=svg|pdf (section 15). PNG is
  // made in the browser (it needs a canvas).
  const format = raw.format;
  if (format !== undefined) {
    const art = engine.drawing?.(result.value);
    if (!engine.drawing || (format !== "svg" && format !== "pdf")) {
      return json(
        {
          ok: false,
          tool: slug,
          errors: [{ path: "format", message: "Use format=svg or format=pdf" }],
        },
        400,
      );
    }
    if (!art || !result.ok) {
      return json({ ok: false, tool: slug, flags: result.flags, errors: [] }, 422);
    }
    const headers = {
      ...CORS,
      "Cache-Control": "public, max-age=86400",
      "Content-Disposition": `inline; filename="${art.filename}.${format}"`,
    };
    if (format === "svg") {
      return new Response(toSvg(art.drawing, { title: art.title }), {
        headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8" },
      });
    }
    const pdf = await toPdf(art.drawing, art.title);
    return new Response(pdf as BodyInit, {
      headers: { ...headers, "Content-Type": "application/pdf" },
    });
  }
  return json(
    {
      ok: result.ok,
      tool: slug,
      rulesVersion: version,
      value: result.value,
      explain: result.explain,
      flags: result.flags,
      rules: result.rules,
    },
    200,
    { "Cache-Control": "public, max-age=86400", ETag: `"${slug}@${version}"` },
  );
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
