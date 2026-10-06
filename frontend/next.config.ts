import type { NextConfig } from "next";

const API = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8017/api/v1").replace(/\/$/, "");

const nextConfig: NextConfig = {
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
    ];
  },
};

export default nextConfig;
