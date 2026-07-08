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
  // Marking them external (rather than manually listing files via
  // outputFileTracingIncludes) lets Next's own file tracer follow their real
  // require graph and resolve pnpm's symlinked node_modules structure itself —
  // hand-picking globs into node_modules/.pnpm ends up including the symlinked
  // directories verbatim, which Vercel's packaging step rejects outright.
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/compositor-linux-x64-gnu",
    "@rspack/core",
    "@rspack/binding",
    "esbuild",
  ],

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "content.thumbpin.in",
      },
    ],
  },
  turbopack: {},
};

export default nextConfig;
