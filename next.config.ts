import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** Derive image remotePattern host from `PAPERBASE_API_URL` (strip `/api/v1` path). */
function parseRemoteOrigin(apiUrl: string) {
  try {
    const trimmed = apiUrl.trim().replace(/\/+$/, "");
    const originOnly = trimmed.replace(/\/api\/v1\/?$/, "");
    const parsed = new URL(originOnly || trimmed);
    return {
      protocol: parsed.protocol.replace(":", "") as "http" | "https",
      hostname: parsed.hostname,
      port: parsed.port || undefined,
      pathname: "/**",
    };
  } catch {
    return null;
  }
}

function buildRemotePatterns() {
  const patterns: Array<{
    protocol: "http" | "https";
    hostname: string;
    port?: string;
    pathname: string;
  }> = [
    {
      protocol: "https",
      hostname: "storage.paperbase.me",
      pathname: "/**",
    },
    {
      protocol: "http",
      hostname: "localhost",
      port: "8000",
      pathname: "/**",
    },
    {
      protocol: "http",
      hostname: "127.0.0.1",
      port: "8000",
      pathname: "/**",
    },
  ];

  const apiUrl = process.env.PAPERBASE_API_URL ?? "";
  const backendPattern = parseRemoteOrigin(apiUrl);
  if (backendPattern) patterns.push(backendPattern);

  return patterns;
}

const nextConfig: NextConfig = {
  typedRoutes: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "radix-ui", "next-intl"],
  },
  images: {
    remotePatterns: buildRemotePatterns(),
  },
  async headers() {
    return [
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store, must-revalidate",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=86400, stale-while-revalidate=31536000",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
