import { withPayload } from "@payloadcms/next/withPayload";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/media/resolve": ["./runtime-tools/**/*"],
  },
};

export default withPayload(nextConfig);
