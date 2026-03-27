import { getServerEnv } from "@/lib/env";
import { syncLivestreamQueue } from "@/lib/server/livestream";

declare global {
  var __tianshiLivestreamRuntimeStarted: boolean | undefined;
  var __tianshiLivestreamRuntimeTicking: boolean | undefined;
}

export function startLivestreamRuntimeLoop() {
  if (global.__tianshiLivestreamRuntimeStarted) {
    return false;
  }

  const env = getServerEnv();
  if (!env.PUBLIC_AUTOBLOW_DEVICE_TOKEN) {
    return false;
  }

  global.__tianshiLivestreamRuntimeStarted = true;

  const intervalMs = 10_000;

  console.log(
    `[tianshi-livestream] runtime bootstrap at ${new Date().toISOString()} intervalMs=${intervalMs}`,
  );

  const runCycle = async (reason: string) => {
    if (global.__tianshiLivestreamRuntimeTicking) {
      return;
    }

    global.__tianshiLivestreamRuntimeTicking = true;
    try {
      await syncLivestreamQueue();
    } catch (error) {
      console.warn(`[tianshi-livestream] sync failed reason=${reason}`, error);
    } finally {
      global.__tianshiLivestreamRuntimeTicking = false;
    }
  };

  void runCycle("server bootstrap");
  setInterval(() => {
    void runCycle("public chartsync heartbeat");
  }, intervalMs);

  return true;
}
