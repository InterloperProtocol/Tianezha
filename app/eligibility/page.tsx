import { Suspense } from "react";

import { LaunchonomicsClient } from "@/components/LaunchonomicsClient";
import { getPublicEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function EligibilityPage() {
  const config = getPublicEnv();

  return (
    <Suspense fallback={null}>
      <LaunchonomicsClient
        accessTokenSymbol={config.NEXT_PUBLIC_ACCESS_TOKEN_SYMBOL}
        freeAccessUntil={config.NEXT_PUBLIC_FREE_ACCESS_UNTIL}
        launchAt={config.NEXT_PUBLIC_LAUNCHONOMICS_LAUNCH_AT}
      />
    </Suspense>
  );
}
