import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Shipped as TypeScript source with no build step of its own.
  transpilePackages: ["@gigly/shared"],
  images: {
    // Skiddle serve event artwork and artist photos from these CloudFront
    // buckets. They are referenced, not copied: the images belong to the
    // promoters and to Skiddle, and their API is non-commercial use only.
    remotePatterns: [
      { protocol: "https", hostname: "d31fr2pwly4c4s.cloudfront.net" },
      { protocol: "https", hostname: "d1mdxzfl9p8pzo.cloudfront.net" },
      { protocol: "https", hostname: "d1plawd8huk6hh.cloudfront.net" },
    ],
  },
};

export default nextConfig;
