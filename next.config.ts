import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: process.env.NEXT_PUBLIC_APP_BASEPATH ?? "",
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
