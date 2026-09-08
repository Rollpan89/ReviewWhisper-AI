import type { NextConfig } from "next";

/**
 * Hosts allowed to load Next.js dev resources (HMR, RSC payloads).
 *
 * Without this, running the dev server behind a proxied preview domain makes
 * Next.js block /_next/* requests, the client never hydrates, and anything
 * that depends on hydration (e.g. next/script afterInteractive) never runs.
 */
const allowedDevOrigins = [
  "*.e2b.app",
  "*.vercel.app",
  "*.ngrok-free.app",
  "*.trycloudflare.com",
  "*.myshopify.com",
];

const nextConfig: NextConfig = {
  allowedDevOrigins,
  async headers() {
    return [
      {
        // The storefront widget is embedded on third-party Shopify domains.
        source: "/widget.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
