import type { NextConfig } from "next";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8017/api/v1").replace(/\/$/, "");
// Where the rewrites below forward visitors' requests. On Railway it's the api's private address:
// through its public domain, Railway's edge would replace the visitor's address with ours, and
// rate limits and gallery stats would count every visitor as one.
const PROXY = (process.env.API_PROXY_URL || API).replace(/\/$/, "");

const PROXY_ORIGIN = new URL(PROXY).origin;

// The API and Studio already send these from Django; the site's own pages need them too.
const SECURITY_HEADERS = [
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // A second build (e.g. for Lighthouse) can go to its own folder without disturbing a running one.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  cacheComponents: true,
  partialPrefetching: true,
  // DRF URLs end in a slash; keep it (Next would otherwise redirect it away).
  skipTrailingSlashRedirect: true,
  // The browser calls /api/v1/* on our own origin; this forwards it to the Django API,
  // so the forms and city switches need no CORS.
  async rewrites() {
    return [
      { source: "/api/v1/:path*/", destination: `${PROXY}/:path*/` },
      { source: "/api/v1/:path*", destination: `${PROXY}/:path*` },
      // Same-origin media for canvas reads (see mediaSrc in lib/api.ts).
      { source: "/media/:path*", destination: `${PROXY_ORIGIN}/media/:path*` },
      { source: "/tickets/:slug/", destination: `${PROXY_ORIGIN}/tickets/:slug/` },
      { source: "/tickets/:slug", destination: `${PROXY_ORIGIN}/tickets/:slug/` },
      { source: "/static/ticketing/:path*", destination: `${PROXY_ORIGIN}/static/ticketing/:path*` },
    ];
  },
};

export default nextConfig;
