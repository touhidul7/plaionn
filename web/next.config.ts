import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@electric-sql/pglite"],
  experimental: {
    agentUpgrade: "security",
  } as any,
};

export default nextConfig;
