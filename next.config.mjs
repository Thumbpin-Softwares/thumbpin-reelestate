/** @type {import('next').NextConfig} */
const nextConfig = {
  reactCompiler: true,

  experimental: {
    serverActions: {
      bodySizeLimit: "20mb",
    },
  },

  // Tell Turbopack NOT to bundle these packages — they contain native binaries
  // and platform-specific dynamic requires that must be require()'d at runtime.
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/compositor-linux-x64-gnu",
    "esbuild",
  ],

  turbopack: {},
};

export default nextConfig;
