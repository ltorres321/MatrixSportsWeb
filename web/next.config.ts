import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lets the dev server's JS/HMR bundle load when this box is reached
  // over the LAN by IP (e.g. from another device) instead of
  // localhost -- without this, only the static HTML shell loads and
  // everything client-side (the rain canvas, the nav, the Google
  // button) silently fails.
  allowedDevOrigins: ["192.168.1.101"],
};

export default nextConfig;
