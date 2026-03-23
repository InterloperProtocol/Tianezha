import { getServerEnv } from "@/lib/env";
import { syncLivestreamQueue } from "@/lib/server/livestream";

declare global {
  var __goonclawLivestreamRuntimeStarted: boolean | undefined;
  var __goonclawLivestreamRuntimeTicking: boolean | undefined;
}

export function startLivestreamRuntimeLoop() {
  if (global.__goonclawLivestreamRuntimeStarted) {
    return false;
  }

  const env = getServerEnv();
  if (!env.PUBLIC_AUTOBLOW_DEVICE_TOKEN) {
    return false;
  }

  global.__goonclawLivestreamRuntimeStarted = true;

  const intervalMs = 10_000;

  console.log(
    `[goonclaw-livestream] runtime bootstrap at ${new Date().toISOString()} intervalMs=${intervalMs}`,
  );

  const runCycle = async (reason: string) => {
    if (global.__goonclawLivestreamRuntimeTicking) {
      return;
    }

    global.__goonclawLivestreamRuntimeTicking = true;
    try {
      await syncLivestreamQueue();
    } catch (error) {
      console.warn(`[goonclaw-livestream] sync failed reason=${reason}`, error);
    } finally {
      global.__goonclawLivestreamRuntimeTicking = false;
    }
  };

  void runCycle("server bootstrap");
  setInterval(() => {
    void runCycle("public chartsync heartbeat");
  }, intervalMs);

  return true;
}
