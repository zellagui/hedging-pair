import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /** Use this app folder as the Turbopack root when a parent directory has another lockfile. */
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
