import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control",  value: "on" },
  { key: "X-Frame-Options",         value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options",  value: "nosniff" },
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
  {
    key:   "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js requires unsafe-eval in dev for HMR; tighten in prod if no inline scripts
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      // Allow any HTTPS images/videos (users can paste external instruction media URLs)
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self'",
      "connect-src 'self' https:",
      "frame-src 'self' blob:",
      "frame-ancestors 'self'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  turbopack: {},

  images: {
    remotePatterns: [
      // Supabase Storage
      { protocol: "https", hostname: "**.supabase.co" },
      // AWS S3 (legacy)
      { protocol: "https", hostname: "**.amazonaws.com" },
      // Google OAuth avatars
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      // GitHub OAuth avatars
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },

  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
