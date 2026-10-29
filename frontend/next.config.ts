import type { NextConfig } from "next";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8017/api/v1").replace(/\/$/, "");

const API_ORIGIN = new URL(API).origin;

const nextConfig: NextConfig = {
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
      { source: "/api/v1/:path*/", destination: `${API}/:path*/` },
      { source: "/api/v1/:path*", destination: `${API}/:path*` },
      // Same-origin media for canvas reads (see mediaSrc in lib/api.ts).
      { source: "/media/:path*", destination: `${API_ORIGIN}/media/:path*` },
      { source: "/tickets/:slug/", destination: `${API_ORIGIN}/tickets/:slug/` },
      { source: "/tickets/:slug", destination: `${API_ORIGIN}/tickets/:slug/` },
      { source: "/static/ticketing/:path*", destination: `${API_ORIGIN}/static/ticketing/:path*` },
    ];
  },
};

export default nextConfig;
