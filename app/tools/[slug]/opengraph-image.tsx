import { ImageResponse } from "next/og";
import { getTool } from "@core/registry";
import { getContent } from "@/content/tools";

export const alt = "Pack Legacy free packaging tool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Per-tool OG image: tool name, the question it answers and one example result
// computed by the engine (content ogLine).
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = getTool(slug);
  const name = tool?.h1 ?? "Free Packaging Tools";
  const question = tool?.question ?? "";
  const example = getContent(slug)?.ogLine;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        background: "#1d5c45",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 30, color: "#f3b07a", letterSpacing: 2 }}>
        PACK LEGACY · FREE TOOL
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>{name}</div>
        <div style={{ fontSize: 34, opacity: 0.9 }}>{question}</div>
        {example && <div style={{ fontSize: 32, color: "#f3b07a" }}>{example}</div>}
      </div>
      <div style={{ fontSize: 26, opacity: 0.8 }}>packlegacy.com/tools</div>
    </div>,
    size,
  );
}
