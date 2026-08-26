import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel handles deployments natively. standalone mode breaks Vercel routing, causing 404 DEPLOYMENT_NOT_FOUND.
  output: process.env.VERCEL ? undefined : "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
