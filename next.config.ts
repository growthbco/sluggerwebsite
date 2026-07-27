import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The individual-item shop is retired (zero orders; the business is team
  // orders). Old URLs 301 to the team hub; /product/* and /drops stay live.
  async redirects() {
    return [
      { source: "/shop", destination: "/team-uniforms", permanent: true },
      { source: "/shop/:category", destination: "/team-uniforms", permanent: true },
      { source: "/drops", destination: "/team-uniforms", permanent: true },
      { source: "/design-lab", destination: "/jersey-maker", permanent: true },
    ];
  },
  images: {
    remotePatterns: [
      // Placeholder images for the design preview. Replace with real product CDN later.
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default nextConfig;
