import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The invest model reads lib/invest/model.onnx via onnxruntime-node's native
  // addon, which @vercel/nft can't statically detect — so without this the file
  // isn't copied into the /api/analyze serverless function on Vercel and the
  // verdict silently degrades to "unavailable". Trace it in explicitly.
  outputFileTracingIncludes: {
    "/api/analyze": ["./lib/invest/model.onnx"],
  },
};

export default nextConfig;
