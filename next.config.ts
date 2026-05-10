import type { NextConfig } from "next";

const r2PublicHostname = process.env.NEXT_PUBLIC_R2_PUBLIC_HOSTNAME?.trim();

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  poweredByHeader: false,
  compress: true,
  // Cookie-backed protected pages still use request-time auth helpers.
  // Keep Cache Components off until those routes are fully migrated behind
  // compliant Suspense/private-cache boundaries; otherwise production can 500
  // with DYNAMIC_SERVER_USAGE on authenticated page loads.
  cacheComponents: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "origin-ai.vercel.app" },
      ...(r2PublicHostname ? [{ protocol: "https" as const, hostname: r2PublicHostname }] : []),
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
