import { getServerEnv } from "@/lib/env";
import { tickAutonomousHeartbeat } from "@/lib/server/autonomous-agent";
import { warmDexterAgentAbility } from "@/lib/server/dexter-agent";
import { warmGodmodeAgentAbility } from "@/lib/server/godmode-agent";
import { warmHyperliquidAgentAbility } from "@/lib/server/hyperliquid-agent";
import { warmPolymarketAgentAbility } from "@/lib/server/polymarket-agent";
import { bootstrapTianshiTelegramBot } from "@/lib/server/tianshi-telegram";

declare global {
  var __tianshiAutonomousRuntimeStarted: boolean | undefined;
  var __tianshiAutonomousRuntimeTicking: boolean | undefined;
}

export function startAutonomousRuntimeLoop() {
  if (global.__tianshiAutonomousRuntimeStarted) {
    return false;
  }

  const env = getServerEnv();
  if (env.TIANSHI_AUTONOMOUS_ENABLED !== "true") {
    return false;
  }

  global.__tianshiAutonomousRuntimeStarted = true;

  const intervalMinutes = Math.max(
    1,
    Number(env.TIANSHI_SETTLEMENT_INTERVAL_MINUTES) || 1,
  );
  const intervalMs = intervalMinutes * 60_000;

  console.log(
    `[tianshi-automaton] runtime bootstrap at ${new Date().toISOString()} interval=${intervalMinutes}m`,
  );

  void bootstrapTianshiTelegramBot()
    .then((enabled) => {
      if (enabled) {
        console.log("[tianshi-automaton] telegram relay ready");
      }
    })
    .catch((error) => {
      console.warn("[tianshi-automaton] telegram bootstrap failed", error);
    });

  void warmDexterAgentAbility()
    .then((status) => {
      if (!status.enabled) {
        return;
      }

      const readiness = status.ready ? "ready" : "not-ready";
      const note = status.note ? ` note="${status.note}"` : "";
      console.log(
        `[tianshi-automaton] dexter agent ability ${readiness} mode=${status.defaultMode} network=${status.defaultNetwork}${note}`,
      );
    })
    .catch((error) => {
      console.warn("[tianshi-automaton] dexter bootstrap failed", error);
    });

  void warmGodmodeAgentAbility()
    .then((status) => {
      if (!status.ready) {
        return;
      }

      const note = status.note ? ` note="${status.note}"` : "";
      console.log(`[tianshi-automaton] g0dm0d3 agent ability ready${note}`);
    })
    .catch((error) => {
      console.warn("[tianshi-automaton] g0dm0d3 bootstrap failed", error);
    });

  void warmPolymarketAgentAbility()
    .then((status) => {
      if (!status.ready) {
        return;
      }

      const note = status.note ? ` note="${status.note}"` : "";
      console.log(`[tianshi-automaton] polymarket agent ability ready${note}`);
    })
    .catch((error) => {
      console.warn("[tianshi-automaton] polymarket bootstrap failed", error);
    });

  void warmHyperliquidAgentAbility()
    .then((status) => {
      if (!status.ready) {
        return;
      }

      const note = status.note ? ` note="${status.note}"` : "";
      console.log(`[tianshi-automaton] hyperliquid agent ability ready${note}`);
    })
    .catch((error) => {
      console.warn("[tianshi-automaton] hyperliquid bootstrap failed", error);
    });

  const runCycle = async (reason: string) => {
    if (global.__tianshiAutonomousRuntimeTicking) {
      console.warn(`[tianshi-automaton] skipped overlapping cycle reason=${reason}`);
      return;
    }

    global.__tianshiAutonomousRuntimeTicking = true;
    try {
      const snapshot = await tickAutonomousHeartbeat(reason);
      console.log(
        `[tianshi-automaton] heartbeat ${snapshot.heartbeatAt} phase=${snapshot.runtimePhase} decision="${snapshot.latestPolicyDecision}"`,
      );
    } catch (error) {
      console.warn(`[tianshi-automaton] heartbeat failed reason=${reason}`, error);
    } finally {
      global.__tianshiAutonomousRuntimeTicking = false;
    }
  };

  void runCycle("server bootstrap");
  setInterval(() => {
    void runCycle("cloud run heartbeat");
  }, intervalMs);

  return true;
}
