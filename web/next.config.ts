import type { NextConfig } from "next";

const config: NextConfig = {
  poweredByHeader: false,
  agentRules: false,
  devIndicators: false,
  logging: { incomingRequests: { ignore: [/^\/api\/auth(?:\/|\?|$)/, /^\/reset(?:\?|$)/] } },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ...(process.env.VERCEL_ENV === "production" && process.env.PUBLIC_INDEXING === "1"
          ? [] : [{ key: "X-Robots-Tag", value: "noindex, nofollow" }]),
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default config;
