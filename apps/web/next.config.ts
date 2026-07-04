import type { NextConfig } from "next";

const allowedDevOrigins =
  process.env.NEXT_ALLOWED_DEV_ORIGINS?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean) ?? [];

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  output: "standalone",
  async rewrites() {
    if (process.env.NODE_ENV !== "development") {
      return [];
    }

    return [
      {
        source: "/api/:path*",
        destination:
          process.env.DEV_API_PROXY_TARGET ?? "http://localhost:4000/api/:path*",
      },
      {
        source: "/uploads/community/:path*",
        destination: "http://localhost:4000/uploads/community/:path*",
      },
    ];
  },
};

export default nextConfig;
