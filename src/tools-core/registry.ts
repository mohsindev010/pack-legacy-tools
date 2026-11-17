// The single list of tools (principle 7). Hub, sitemap, llms.txt, "More tools",
// related products and navigation are all generated from this file.

export type ToolStatus = "draft" | "preview" | "live";
export type ToolCategory = "size-and-ship" | "print-and-label" | "material" | "bags-and-storage";

export type ToolMeta = {
  slug: string;
  status: ToolStatus;
  phase: 1 | 2 | 3;
  /** Short name for cards, breadcrumbs and links. */
  name: string;
  /** <title>: keyword first, <= 60 characters (section 13.1). */
  title: string;
  h1: string;
  /** Meta description, <= 155 characters. */
  description: string;
  /** The buyer question this tool answers (hub cards, llms.txt). */
  question: string;
  category: ToolCategory;
  primaryKeyword: string; // working target; confirm in step A (SERP research)
  relatedTools: string[];
  /** Pack Legacy product URLs. VERIFY canonical (register: two URL families). */
  relatedProducts: { label: string; href: string }[];
  author: { name: string; role: string; url: string };
  rulesFiles: string[];
  updated: string;
};

// Byline person is supplied by Pack Legacy (section 22.1, item 2).
const AUTHOR_TBD = { name: "Pack Legacy Packaging Team", role: "TBD", url: "/about-us/" };
const UPDATED = "2026-11-12";

export const tools: ToolMeta[] = [
  {
    slug: "dimensional-weight-calculator",
    status: "draft",
    phase: 1,
    name: "Dimensional Weight Calculator",
    title: "Dimensional Weight Calculator (UPS, FedEx, USPS) 2026",
    h1: "Dimensional Weight & Shipping Surcharge Calculator",
    description:
      "Billable weight for every carrier with 2026 rounding rules, surcharge checks and right-size tips. Free, no signup.",
    question: "What will a carrier bill me for this box, and will it trigger a surcharge?",
    category: "size-and-ship",
    primaryKeyword: "dimensional weight calculator",
    relatedTools: ["standard-box-sizes", "box-volume-calculator", "pallet-calculator"],
    relatedProducts: [
      { label: "Corrugated mailer boxes", href: "/product/corrugated-mailer-boxes/" },
    ],
    author: AUTHOR_TBD,
    rulesFiles: ["carriers.json", "usps-cubic.json"],
    updated: UPDATED,
  },
  {
    slug: "standard-box-sizes",
    status: "draft",
    phase: 1,
    name: "Standard Box Sizes & Box Finder",
    title: "Standard Box Sizes Chart & Box Finder (2026 DIM Weights)",
    h1: "Standard Box Sizes Chart & Box Finder",
    description:
      "Find the standard box that fits your product with the least waste, see its 2026 billable weight per carrier, and compare it with an exact-fit box.",
    question: "Which standard box fits my product, and what will it cost to ship?",
    category: "size-and-ship",
    primaryKeyword: "standard box sizes",
    relatedTools: [
      "dimensional-weight-calculator",
      "box-volume-calculator",
      "paper-weight-converter",
    ],
    relatedProducts: [{ label: "Mailer boxes", href: "/mailer-boxes/" }],
    author: AUTHOR_TBD,
    rulesFiles: ["box-sizes.json", "flutes.json", "carriers.json"],
    updated: UPDATED,
  },
  {
    slug: "paper-weight-converter",
    status: "draft",
    phase: 1,
    name: "Paper Weight Converter",
    title: "Paper Weight Converter: GSM to lb, pt & mm",
    h1: "Paper Weight Converter (GSM, lb, pt, mm)",
    description:
      "Convert paper and board between GSM, lb, pt and mm for text, uncoated, C1S and C2S stock, with the formula shown for every step.",
    question: "What board weight am I actually being quoted?",
    category: "material",
    primaryKeyword: "gsm to lb converter",
    relatedTools: ["standard-box-sizes", "qr-code-generator", "barcode-generator"],
    relatedProducts: [],
    author: AUTHOR_TBD,
    rulesFiles: ["paper-conversion.json"],
    updated: UPDATED,
  },
  {
    slug: "qr-code-generator",
    status: "draft",
    phase: 1,
    name: "QR Code Generator for Packaging",
    title: "QR Code Generator for Packaging (SVG, PDF, GS1)",
    h1: "QR Code Generator for Packaging",
    description:
      "Make print-ready QR codes for packaging: SVG and exact-size PDF, GS1 Digital Link, print size and contrast checks.",
    question: "How do I make a QR code that prints and scans on my box?",
    category: "print-and-label",
    primaryKeyword: "qr code generator for packaging",
    relatedTools: ["barcode-generator", "paper-weight-converter"],
    relatedProducts: [],
    author: AUTHOR_TBD,
    rulesFiles: ["qr-specs.json"],
    updated: UPDATED,
  },
  {
    slug: "barcode-generator",
    status: "draft",
    phase: 1,
    name: "Barcode Generator",
    title: "Barcode Generator: UPC, EAN, ITF-14, GS1-128 (SVG/PDF)",
    h1: "Barcode Generator (UPC, EAN, ITF-14, GS1-128, DataMatrix)",
    description:
      "Generate exact-size UPC, EAN, ITF-14, GS1-128 and DataMatrix barcodes as SVG or PDF, with check digits, quiet zones and magnification.",
    question: "How do I get a print-ready barcode at the right size?",
    category: "print-and-label",
    primaryKeyword: "barcode generator for packaging",
    relatedTools: ["qr-code-generator", "pallet-calculator"],
    relatedProducts: [],
    author: AUTHOR_TBD,
    rulesFiles: ["barcode-specs.json"],
    updated: UPDATED,
  },
  {
    slug: "box-volume-calculator",
    status: "draft",
    phase: 2,
    name: "Box Volume & CBM Calculator",
    title: "Box Volume Calculator: Cubic Feet, CBM & Container Fit",
    h1: "Box Volume, Cubic Feet & CBM Calculator",
    description:
      "Cubic inches, cubic feet, liters and CBM for any carton, plus how many fit in a 20 ft, 40 ft or 40 ft HC container by geometry and weight.",
    question: "How much space does my order take, and how many cartons fit in a container?",
    category: "size-and-ship",
    primaryKeyword: "box volume calculator",
    relatedTools: ["pallet-calculator", "dimensional-weight-calculator"],
    relatedProducts: [],
    author: AUTHOR_TBD,
    rulesFiles: ["containers.json"],
    updated: UPDATED,
  },
  {
    slug: "pallet-calculator",
    status: "draft",
    phase: 2,
    name: "Pallet & Container Load Calculator",
    title: "Pallet Calculator: Boxes per Pallet & Container Load",
    h1: "Pallet & Container Load Calculator",
    description:
      "How many cartons fit on a pallet and how many pallets fit in a container, with two-block layer patterns, a layer diagram, weight limits and door checks.",
    question: "How many cartons fit on a pallet and in a container?",
    category: "size-and-ship",
    primaryKeyword: "pallet calculator",
    relatedTools: ["box-volume-calculator", "dimensional-weight-calculator"],
    relatedProducts: [],
    author: AUTHOR_TBD,
    rulesFiles: ["pallets.json", "containers.json"],
    updated: UPDATED,
  },
  {
    slug: "mylar-bag-size-finder",
    status: "draft",
    phase: 3,
    name: "Mylar Bag Size Finder",
    title: "Mylar Bag Size Finder: Size Chart & Calculator",
    h1: "Mylar Bag Size Finder",
    description:
      "Find the right mylar bag size from fill weight and product density, with width, height and gusset output and a preset size chart.",
    question: "Which bag size fits my product and fill weight?",
    category: "bags-and-storage",
    primaryKeyword: "mylar bag sizes",
    relatedTools: ["oxygen-absorber-calculator"],
    relatedProducts: [],
    author: AUTHOR_TBD,
    rulesFiles: ["mylar-presets.json", "bulk-density.json"],
    updated: UPDATED,
  },
  {
    slug: "oxygen-absorber-calculator",
    status: "draft",
    phase: 3,
    name: "Oxygen Absorber Calculator",
    title: "Oxygen Absorber Calculator for Mylar Bags & Buckets",
    h1: "Oxygen Absorber Calculator",
    description:
      "Work out how many cc of oxygen absorber a bag, can or bucket needs from its volume and product weight, and the fewest packets to cover it.",
    question: "How many cc of oxygen absorber does my container need?",
    category: "bags-and-storage",
    primaryKeyword: "oxygen absorber calculator",
    relatedTools: ["mylar-bag-size-finder"],
    relatedProducts: [],
    author: AUTHOR_TBD,
    rulesFiles: ["o2-absorbers.json", "mylar-presets.json"],
    updated: UPDATED,
  },
];

const bySlug = new Map(tools.map((t) => [t.slug, t]));

export const allTools = (): ToolMeta[] => tools;
export const getTool = (slug: string): ToolMeta | undefined => bySlug.get(slug);
export const isToolSlug = (slug: string): boolean => bySlug.has(slug);

export function relatedTools(slug: string): ToolMeta[] {
  return (getTool(slug)?.relatedTools ?? [])
    .map((s) => bySlug.get(s))
    .filter((t): t is ToolMeta => !!t);
}

export function relatedProducts(slug: string): ToolMeta["relatedProducts"] {
  return getTool(slug)?.relatedProducts ?? [];
}

export const toolPath = (slug: string) => `/tools/${slug}/`;
