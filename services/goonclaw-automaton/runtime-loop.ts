import { getServerEnv } from "@/lib/env";
import { tickAutonomousHeartbeat } from "@/lib/server/autonomous-agent";
import { bootstrapGoonclawTelegramBot } from "@/lib/server/goonclaw-telegram";

const env = getServerEnv();
const intervalMinutes = Number(env.GOONCLAW_SETTLEMENT_INTERVAL_MINUTES) || 15;
const intervalMs = Math.max(intervalMinutes, 1) * 60_000;

console.log(
  `[goonclaw-automaton] starting runtime loop at ${new Date().toISOString()} with ${intervalMinutes} minute interval`,
);

void bootstrapGoonclawTelegramBot()
  .then((enabled) => {
    if (enabled) {
      console.log("[goonclaw-automaton] telegram read-only bot bootstrap complete");
    }
  })
  .catch(() => null);

tickAutonomousHeartbeat("service boot");

setInterval(() => {
  const snapshot = tickAutonomousHeartbeat("systemd service heartbeat");
  console.log(
    `[goonclaw-automaton] heartbeat ${snapshot.heartbeatAt} phase=${snapshot.runtimePhase} decision="${snapshot.latestPolicyDecision}"`,
  );
}, intervalMs);
