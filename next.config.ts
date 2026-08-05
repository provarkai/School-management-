import type { NextConfig } from "next";

// Report-only for now: nothing in this codebase uses
// dangerouslySetInnerHTML, so this isn't closing a known hole, but a
// report-only CSP with no enforcement is free to add and gives real data
// (via the report-uri, once one is wired up) before ever flipping to
// enforced and risking a false positive breaking a real page.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Content-Security-Policy-Report-Only", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  experimental: {
    // Default is 1MB — the "scan attendance/marks from a photo" AI actions
    // (src/lib/imageCapture.ts resizes to ~1600px JPEG first, but that can
    // still land past 1MB once base64-encoded) send a photo straight to a
    // Server Action rather than through Supabase Storage, since it's a
    // one-shot OCR read, not something that needs to be kept.
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
