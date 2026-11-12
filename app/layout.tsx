import type { Metadata } from "next";
import Link from "next/link";
import "@/src/styles/tokens.css";
import { LAB_MODE, SITE_URL } from "@/src/seo/site";
import s from "./lab.module.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "Free Packaging Tools | Pack Legacy", template: "%s | Pack Legacy" },
  description: "Free packaging calculators and generators from Pack Legacy.",
  // Belt and braces with the X-Robots-Tag header in next.config.ts.
  robots: LAB_MODE ? { index: false, follow: false } : undefined,
};

// Lab-only shell (section 5). At merge the Pack Legacy root layout replaces it.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-US">
      <body className={s.body}>
        <a href="#main" className={s.skip}>
          Skip to content
        </a>
        <header className={s.header}>
          <div className={s.headerInner}>
            <Link href="/tools/" className={s.brand}>
              Pack Legacy Tools
            </Link>
            {LAB_MODE && <span className={s.labBadge}>Lab</span>}
          </div>
        </header>
        <div id="main">{children}</div>
        <footer className={s.footer}>
          <div className={s.footerInner}>
            Pack Legacy free packaging tools. Results are estimates; contract rates and carrier
            measurements can differ.
          </div>
        </footer>
      </body>
    </html>
  );
}
