import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pacotes de workspace consumidos como fonte TS (sem build separado).
  transpilePackages: ["@gestarahub/contracts", "@gestarahub/core"],
};

export default nextConfig;
