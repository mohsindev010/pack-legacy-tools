import { NextResponse, type NextRequest } from "next/server";
import { isToolSlug } from "@core/registry";

// With cacheComponents the prerendered shell starts streaming with 200 before
// the page can call notFound(), so unknown /tools/<slug>/ URLs would be soft
// 404s. Check the slug here, before rendering, and rewrite unknown ones to a
// path no route matches so Next serves its not-found page with a real 404.
export function proxy(request: NextRequest) {
  const slug = request.nextUrl.pathname.split("/")[2];
  if (slug && !isToolSlug(slug)) {
    return NextResponse.rewrite(new URL("/__not-found__/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/tools/:slug/:path*",
};
