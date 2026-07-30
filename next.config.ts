import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The invest model runs onnxruntime-node in the /api/analyze route. @vercel/nft
  // can't statically detect either of these, so without explicit tracing they're
  // missing from the Vercel function and the verdict silently degrades to
  // "unavailable":
  //   - lib/invest/model.onnx is passed to a native addon, not read via fs.
  //   - libonnxruntime.so.1 is dlopen'd by onnxruntime_binding.node at runtime.
  // Include both explicitly (Vercel runs linux; skip the win/mac binaries).
  outputFileTracingIncludes: {
    "/api/analyze": [
      "./lib/invest/model.onnx",
      "./node_modules/onnxruntime-node/bin/napi-v6/linux/**",
    ],
  },
};

export default nextConfig;
