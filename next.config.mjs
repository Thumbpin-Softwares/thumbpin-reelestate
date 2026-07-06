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
    "@rspack/core",
    "@rspack/binding",
    "esbuild",
  ],

  // @remotion/bundler now bundles via rspack under the hood, which loads its
  // native binding (@rspack/binding-linux-x64-gnu on Vercel) through a dynamic
  // require that Vercel's output file tracing can't statically follow — so it
  // gets dropped from every render-remotion function's deployment bundle
  // unless explicitly included here.
  outputFileTracingIncludes: {
    "/api/**": [
      "./node_modules/@rspack/**",
      "./node_modules/.pnpm/@rspack+**/**",
    ],
  },

  turbopack: {},
};

export default nextConfig;
