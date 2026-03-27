import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' https: data:",
  "style-src 'self' 'unsafe-inline' https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https://www.youtube.com https://youtube.com https://player.vimeo.com https://dexscreener.com https://kick.com https://player.kick.com",
].join("; ");

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy,
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
        source: "/:path*",
      },
    ];
  },
  outputFileTracingIncludes: {
    "/api/media/resolve": ["./runtime-tools/**/*"],
    "/api/agent/status": ["./services/tianshi-automaton/**/*"],
    "/api/agent/feed": ["./services/tianshi-automaton/**/*"],
    "/api/internal-admin/autonomous/status": [
      "./services/tianshi-automaton/**/*",
    ],
    "/api/internal-admin/autonomous/control": [
      "./services/tianshi-automaton/**/*",
    ],
  },
};

export default withPayload(nextConfig);
