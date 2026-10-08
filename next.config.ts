import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This repo is often checked out as a git worktree alongside the main clone
  // (e.g. under .claude/worktrees/<name>), and each has its own package-lock.json.
  // Without this, Turbopack's root auto-detection sees both lockfiles and can
  // pick the wrong one as the project root — then it resolves some files (like
  // middleware) from that other checkout while resolving `@/...` imports against
  // this one, mixing two different trees together. Pinning it here removes the
  // guesswork.
  turbopack: {
    root: __dirname,
  },

  // The invest model runs onnxruntime-node in the /api/analyze route. @vercel/nft
  // can't statically detect either of these, so without explicit tracing they're
  // missing from the Vercel function and the verdict silently degrades to
  // "unavailable":
  //   - lib/invest/model.onnx is passed to a native addon, not read via fs.
  //   - libonnxruntime.so.1 is dlopen'd by onnxruntime_binding.node at runtime.
  //   - the sample deck is read with a path built at runtime from process.cwd(),
  //     and files under public/ aren't in the function bundle by default, so
  //     without this the sample run 500s on Vercel while working fine locally.
  // Include all three explicitly (Vercel runs linux; skip the win/mac binaries).
  outputFileTracingIncludes: {
    "/api/analyze": [
      "./lib/invest/model.onnx",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/**",
      "./public/sample-decks/**",
    ],
    // The MCP server runs the same pipeline (no sample decks: Claude sends text).
    "/mcp": [
      "./lib/invest/model.onnx",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/**",
      "./docs/playbook.md",
    ],
  },

  async rewrites() {
    return [
      // The metadata URL the MCP server's 401 points at (RFC 9728's
      // path-suffixed form) serves the same document as the bare one. A rewrite
      // rather than its own route: include keys match anywhere in a route path,
      // so a route ending in /mcp would get the ~56 MB above bundled in too —
      // and Turbopack's outputFileTracingExcludes can't take included files out.
      {
        source: "/.well-known/oauth-protected-resource/mcp",
        destination: "/.well-known/oauth-protected-resource",
      },
    ];
  },
};

export default nextConfig;
