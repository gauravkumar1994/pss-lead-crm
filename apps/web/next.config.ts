import type { NextConfig } from "next";

/** Server-side proxy to API (avoids browser CORS + wrong localhost CORS on API). */
const apiTarget = (
  process.env.API_PROXY_TARGET ??
  process.env.NEXT_PUBLIC_API_URL ??
  "https://pss-crm-api.onrender.com"
).replace(/\/$/, "");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/:path*`,
      },
    ];
  },
};

export default nextConfig;
