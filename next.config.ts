import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Placeholder images for the design preview. Replace with real product CDN later.
      { protocol: "https", hostname: "placehold.co" },
    ],
  },
};

export default nextConfig;
