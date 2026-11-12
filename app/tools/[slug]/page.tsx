import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { allTools, getTool, toolPath } from "@core/registry";
import { getEngine } from "@core/engines";
import { getContent } from "@/content/tools";
import { ToolShell, Section } from "@/src/components/tools/ToolShell";
import { ExplainSteps } from "@/src/components/tools/ExplainSteps";
import { LinkToTool } from "@/src/components/tools/LinkToTool";
import { Byline } from "@/src/components/tools/Byline";
import { RulesEffective } from "@/src/components/tools/RulesEffective";
import { Sources } from "@/src/components/tools/Sources";
import { FAQ } from "@/src/components/tools/FAQ";
import { RelatedProducts, RelatedTools } from "@/src/components/tools/RelatedTools";
import { JsonLd } from "@/src/components/tools/JsonLd";
import { PlaceholderWidget } from "@/src/components/tools/widgets/PlaceholderWidget";
import { renderWidget } from "@/src/components/tools/widgets";
import { faqPage, toolBreadcrumbs, webApplication } from "@/src/seo/schema";
import { absoluteUrl } from "@/src/seo/site";
import s from "@/src/components/tools/tools.module.css";

// Every tool page is prerendered from the registry. Unknown slugs 404
// (dynamicParams is not allowed with cacheComponents, so notFound() does it).
export function generateStaticParams() {
  return allTools().map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: PageProps<"/tools/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) return {};
  return {
    title: { absolute: tool.title },
    description: tool.description,
    alternates: { canonical: toolPath(tool.slug) },
    openGraph: {
      title: tool.title,
      description: tool.description,
      url: toolPath(tool.slug),
      type: "website",
    },
  };
}

function Pending({ step }: { step: string }) {
  return <p className={s.muted}>Pending: written in pipeline step {step}.</p>;
}

export default async function ToolPage({ params }: PageProps<"/tools/[slug]">) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) notFound();

  // Principle 6: run the engine at build time with the default input and print
  // the result + working into the HTML.
  const engine = getEngine(slug);
  const defaultResult = engine ? engine.run(engine.defaultInput) : null;
  const widget = defaultResult ? renderWidget({ slug, initialResult: defaultResult }) : null;
  const content = getContent(slug);
  const url = absoluteUrl(toolPath(slug));

  const jsonLd = [webApplication(tool), toolBreadcrumbs(tool)];
  if (content?.faq.length) jsonLd.push(faqPage(content.faq));

  return (
    <ToolShell
      tool={tool}
      answer={content?.answer ?? tool.description}
      widget={widget ?? <PlaceholderWidget tool={tool} />}
    >
      <JsonLd data={jsonLd} />

      {/* 4. Result + explain steps for the default input (server-rendered) */}
      {defaultResult && (
        <Section id="working" title="Worked answer for the default example">
          <ExplainSteps steps={defaultResult.explain} />
        </Section>
      )}

      {/* 5. Quote CTA lives in the widget (it needs the live result); Link to this tool here */}
      <div className={s.ctaRow}>
        <LinkToTool slug={slug} name={tool.h1} url={url} />
      </div>

      {/* 6-11. Editorial content (step G) */}
      <Section id="key-takeaway" title="Key takeaway">
        {content ? <div className={s.takeaway}>{content.keyTakeaway}</div> : <Pending step="G" />}
      </Section>
      <Section id="how-it-works" title="How it works">
        {content ? content.methodology : <Pending step="G" />}
      </Section>
      <Section id="examples" title="Worked examples">
        {content ? content.workedExamples : <Pending step="G" />}
      </Section>
      {content?.referenceTables && (
        <Section id="reference" title="Reference tables">
          {content.referenceTables}
        </Section>
      )}
      <Section id="common-mistakes" title="Common mistakes">
        {content ? content.commonMistakes : <Pending step="G" />}
      </Section>
      <Section id="faq" title="Frequently asked questions">
        {content?.faq.length ? <FAQ items={content.faq} /> : <Pending step="G" />}
      </Section>

      {/* 12. Related products and tools (from the registry) */}
      {tool.relatedProducts.length > 0 && (
        <Section id="related-products" title="Related Pack Legacy products">
          <RelatedProducts slug={slug} />
        </Section>
      )}
      <Section id="related-tools" title="More free tools">
        <RelatedTools slug={slug} />
      </Section>

      {/* 13. E-E-A-T: byline, rules effective date, sources */}
      <Section id="sources" title="About this tool and sources">
        <div className={s.eeat}>
          <Byline tool={tool} />
          <RulesEffective rulesFiles={tool.rulesFiles} />
        </div>
        <Sources rulesFiles={tool.rulesFiles} extra={content?.extraSources} />
      </Section>
    </ToolShell>
  );
}
