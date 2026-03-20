import { GoonclawClient } from "@/components/GoonclawClient";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function GoonclawPage() {
  const config = getPublicEnv();

  return <GoonclawClient defaultMediaUrl={config.NEXT_PUBLIC_GOONCLAW_MEDIA_URL} />;
}
