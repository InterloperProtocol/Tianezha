import { allowInProcessWorker } from "@/lib/env";
import { startAutonomousRuntimeLoop } from "@/lib/server/autonomous-runtime";
import { startLivestreamRuntimeLoop } from "@/lib/server/livestream-runtime";
import { rehydrateRuntimeSessions } from "@/lib/server/worker-runtime";

declare global {
  var __tianshiNodeInstrumentationRegistered: boolean | undefined;
}

async function bootstrapInProcessRuntimeSessions() {
  if (!allowInProcessWorker()) {
    return;
  }

  try {
    const { recovered, skipped } = await rehydrateRuntimeSessions();
    console.log(
      `[tianshi-runtime] recovered=${recovered.length} skipped=${skipped.length}`,
    );
  } catch (error) {
    console.warn("[tianshi-runtime] failed to recover in-process sessions", error);
  }
}

export async function registerNodeInstrumentation() {
  if (global.__tianshiNodeInstrumentationRegistered) {
    return;
  }

  global.__tianshiNodeInstrumentationRegistered = true;
  await bootstrapInProcessRuntimeSessions();
  startAutonomousRuntimeLoop();
  startLivestreamRuntimeLoop();
}
