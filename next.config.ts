import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `sharp` is a native module (image watermarking in the AI studio + jersey
  // maker). Keep it external, and force its platform binaries + libvips shared
  // lib into the two functions that use it - the turbopack build otherwise
  // externalizes sharp but doesn't trace the `.so`, so it fails at runtime with
  // "Could not load the sharp module / libvips-cpp.so: cannot open".
  serverExternalPackages: ["sharp"],
  outputFileTracingIncludes: {
    "/api/design-request/\\[token\\]/ai-design": ["./node_modules/@img/**/*"],
    "/api/design-lab/generate": ["./node_modules/@img/**/*"],
  },
  // The individual-item shop is retired (zero orders; the business is team
  // orders). Old URLs 301 to the team hub; /product/* and /drops stay live.
  async redirects() {
    return [
      { source: "/shop", destination: "/team-uniforms", permanent: true },
      { source: "/shop/:category", destination: "/team-uniforms", permanent: true },
      { source: "/drops", destination: "/team-uniforms", permanent: true },
      { source: "/design-lab", destination: "/custom-jersey-maker", permanent: true },
      { source: "/jersey-maker", destination: "/custom-jersey-maker", permanent: true },
    ];
  },
  // Baseline security headers (Lighthouse best-practices + clickjacking / MIME
  // hardening). Deliberately no Content-Security-Policy yet - a CSP would need
  // careful allow-listing of Stripe/Twilio/chat before it's safe to enforce.
  // SAMEORIGIN (not DENY) so our own pages can still be framed if ever needed;
  // Stripe checkout is a redirect flow, so this doesn't affect payments.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(self), geolocation=(), interest-cohort=()" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      // Placeholder images for the design preview. Replace with real product CDN later.
      { protocol: "https", hostname: "placehold.co" },
      {
        protocol: "https",
        hostname: "wnbdipjkyfozqxrj.public.blob.vercel-storage.com",
        pathname: "/design-proofs/mamba-store-full-button-blood-qJytaaZ0JQ9VwzKHJZ9Tmd9fvVLZ4M.png",
        search: "",
      },
      {
        protocol: "https",
        hostname: "wnbdipjkyfozqxrj.public.blob.vercel-storage.com",
        pathname: "/design-studio/DR-0YPBP5-2026-08-11T15-10-58-265Z-9uJsQ7aq2OSF7SLxLzcXgfxy2BPeAv.png",
        search: "",
      },
    ],
  },
};

export default nextConfig;
