import type { NextConfig } from "next";

// LAB_MODE defaults to ON. Only an explicit LAB_MODE=false (production, after
// the merge into the Pack Legacy site) removes the noindex header.
const labMode = process.env.LAB_MODE !== "false";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // Section 13.1: every tool URL ends with a trailing slash.
  trailingSlash: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: labMode
          ? [...securityHeaders, { key: "X-Robots-Tag", value: "noindex, nofollow" }]
          : securityHeaders,
      },
      {
        // Section 15: public GET API, open CORS, no cookies.
        source: "/api/tools/:slug*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
        ],
      },
    ];
  },
};

export default nextConfig;
