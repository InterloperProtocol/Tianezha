import { GoonclawClient } from "@/components/GoonclawClient";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function GoonclawPage() {
  const config = getPublicEnv();

  return (
    <GoonclawClient
      freeAccessUntil={config.NEXT_PUBLIC_FREE_ACCESS_UNTIL}
      accessTokenSymbol={config.NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL}
      defaultMediaUrl={config.NEXT_PUBLIC_GOONCLAW_MEDIA_URL}
    />
  );
}
