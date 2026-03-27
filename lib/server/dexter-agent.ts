import { existsSync, readFileSync } from "fs";
import path from "path";
import { spawn } from "child_process";

import { getServerEnv } from "@/lib/env";

export type DexterAgentMode = "read_only" | "paper" | "simulate" | "live";
export type DexterAgentNetwork = "devnet" | "mainnet";

type DexterCliResult = {
  exitCode: number | null;
  stderr: string;
  stdout: string;
};

type DexterAgentStatus = {
  actionNames: string[];
  blockedActionNames: string[];
  cliEntrypointPresent: boolean;
  cliReady: boolean;
  defaultMode: DexterAgentMode;
  defaultNetwork: DexterAgentNetwork;
  enabled: boolean;
  pythonPresent: boolean;
  repoPresent: boolean;
  version: string | null;
};

const AGENT_ONLY_DEXTER_ACTIONS = [
  "dexter.doctor",
  "dexter.dashboard",
  "dexter.export",
  "dexter.backtest",
  "dexter.replay",
  "dexter.run.trade",
  "dexter.run.collector",
  "dexter.run.analyze",
  "dexter.control.pause",
  "dexter.control.resume",
  "dexter.control.blacklist",
  "dexter.control.whitelist",
  "dexter.control.watchlist-add",
  "dexter.control.watchlist-remove",
  "dexter.control.force-sell",
] as const;

const BLOCKED_HUMAN_FACING_DEXTER_ACTIONS = [
  "dexter.menu",
  "dexter.interactive",
  "dexter.create.onchain",
  "dexter.live-public",
] as const;

let cachedProbe:
  | {
      ready: boolean;
      checkedAtMs: number;
      note: string | null;
    }
  | null = null;

function resolveDexterRepoPath() {
  const env = getServerEnv();
  return path.resolve(process.cwd(), env.TIANSHI_DEXTER_PATH);
}

function resolveDexterPythonBin(repoPath: string) {
  const env = getServerEnv();
  if (env.TIANSHI_DEXTER_PYTHON_BIN.trim()) {
    return env.TIANSHI_DEXTER_PYTHON_BIN.trim();
  }

  const venvPython = path.join(
    repoPath,
    ".venv",
    process.platform === "win32" ? "Scripts" : "bin",
    process.platform === "win32" ? "python.exe" : "python",
  );

  return existsSync(venvPython) ? venvPython : "python";
}

function inferWsUrl(httpUrl: string) {
  if (!httpUrl.trim()) {
    return "";
  }

  if (httpUrl.startsWith("https://")) {
    return `wss://${httpUrl.slice("https://".length)}`;
  }

  if (httpUrl.startsWith("http://")) {
    return `ws://${httpUrl.slice("http://".length)}`;
  }

  return httpUrl;
}

function readDexterVersion(repoPath: string) {
  try {
    const pyprojectPath = path.join(repoPath, "pyproject.toml");
    if (!existsSync(pyprojectPath)) {
      return null;
    }

    const contents = readFileSync(pyprojectPath, "utf8");
    const match = contents.match(/version\s*=\s*"([^"]+)"/);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export function getDexterAgentStatus(): DexterAgentStatus {
  const env = getServerEnv();
  const repoPath = resolveDexterRepoPath();
  const repoPresent = existsSync(repoPath);
  const cliEntrypointPresent =
    repoPresent && existsSync(path.join(repoPath, "dexter_cli.py"));
  const pythonBin = resolveDexterPythonBin(repoPath);
  const pythonPresent =
    pythonBin === "python" ||
    pythonBin === "python3" ||
    existsSync(pythonBin);
  const cliReady =
    cliEntrypointPresent &&
    pythonPresent &&
    existsSync(
      path.join(
        repoPath,
        ".venv",
        process.platform === "win32" ? "Scripts" : "bin",
        process.platform === "win32" ? "python.exe" : "python",
      ),
    );

  return {
    actionNames:
      env.TIANSHI_DEXTER_ENABLED === "true" && cliEntrypointPresent
        ? [...AGENT_ONLY_DEXTER_ACTIONS]
        : [],
    blockedActionNames: [...BLOCKED_HUMAN_FACING_DEXTER_ACTIONS],
    cliEntrypointPresent,
    cliReady,
    defaultMode: env.TIANSHI_DEXTER_DEFAULT_MODE,
    defaultNetwork: env.TIANSHI_DEXTER_NETWORK,
    enabled: env.TIANSHI_DEXTER_ENABLED === "true",
    pythonPresent,
    repoPresent,
    version: readDexterVersion(repoPath),
  };
}

function buildDexterProcessEnv(args: {
  mode: DexterAgentMode;
  network: DexterAgentNetwork;
}) {
  const env = getServerEnv();
  const httpUrl = env.TIANSHI_DEXTER_HTTP_URL.trim() || env.SOLANA_RPC_URL;
  const wsUrl = env.TIANSHI_DEXTER_WS_URL.trim() || inferWsUrl(httpUrl);

  return {
    ...process.env,
    DATABASE_URL:
      process.env.DATABASE_URL ||
      env.TIANSHI_DEXTER_DATABASE_URL.trim() ||
      process.env.PAYLOAD_DATABASE_URL ||
      "",
    DEXTER_ALLOW_MAINNET_LIVE: env.TIANSHI_DEXTER_ALLOW_LIVE,
    DEXTER_MAINNET_DRY_RUN: env.TIANSHI_DEXTER_MAINNET_DRY_RUN,
    DEXTER_NETWORK: args.network,
    DEXTER_RUNTIME_MODE: args.mode,
    DEXTER_TRADING_PRIVATE_KEY:
      process.env.DEXTER_TRADING_PRIVATE_KEY ||
      env.TIANSHI_AGENT_WALLET_SECRET,
    HTTP_URL: httpUrl,
    PRIVATE_KEY: process.env.PRIVATE_KEY || env.TIANSHI_AGENT_WALLET_SECRET,
    WS_URL: wsUrl,
  };
}

function assertDexterExecutionAllowed(mode: DexterAgentMode) {
  const env = getServerEnv();
  if (mode === "live" && env.TIANSHI_DEXTER_ALLOW_LIVE !== "true") {
    throw new Error(
      "Dexter live execution is blocked for agent use. Set TIANSHI_DEXTER_ALLOW_LIVE=true to allow it.",
    );
  }
}

async function runDexterCli(args: {
  argv: string[];
  mode?: DexterAgentMode;
  network?: DexterAgentNetwork;
  timeoutMs?: number;
}) {
  const status = getDexterAgentStatus();
  const repoPath = resolveDexterRepoPath();
  if (!status.enabled) {
    throw new Error("Dexter agent ability is disabled.");
  }
  if (!status.repoPresent || !status.cliEntrypointPresent) {
    throw new Error("Dexter upstream checkout is missing from the configured vendor path.");
  }
  if (!status.pythonPresent) {
    throw new Error("Dexter Python runtime is not available.");
  }

  const mode = args.mode || status.defaultMode;
  const network = args.network || status.defaultNetwork;
  assertDexterExecutionAllowed(mode);

  const pythonBin = resolveDexterPythonBin(repoPath);
  const timeoutMs = args.timeoutMs ?? 60_000;

  return new Promise<DexterCliResult>((resolve, reject) => {
    const child = spawn(pythonBin, ["dexter_cli.py", ...args.argv], {
      cwd: repoPath,
      env: buildDexterProcessEnv({ mode, network }),
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(
        new Error(`Dexter command timed out after ${timeoutMs}ms: ${args.argv.join(" ")}`),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (exitCode) => {
      clearTimeout(timer);
      resolve({ exitCode, stderr, stdout });
    });
  });
}

export async function probeDexterAgentAbility() {
  if (cachedProbe && Date.now() - cachedProbe.checkedAtMs < 5 * 60_000) {
    return cachedProbe;
  }

  try {
    const result = await runDexterCli({
      argv: ["help"],
      timeoutMs: 20_000,
    });

    cachedProbe = {
      checkedAtMs: Date.now(),
      note: result.exitCode === 0 ? null : result.stderr.trim() || result.stdout.trim() || null,
      ready: result.exitCode === 0,
    };
  } catch (error) {
    cachedProbe = {
      checkedAtMs: Date.now(),
      note: error instanceof Error ? error.message : "Dexter probe failed.",
      ready: false,
    };
  }

  return cachedProbe;
}

export async function warmDexterAgentAbility() {
  const status = getDexterAgentStatus();
  if (!status.enabled) {
    return {
      ...status,
      note: "Dexter ability disabled.",
      ready: false,
    };
  }

  const probe = await probeDexterAgentAbility();
  return {
    ...status,
    note: probe.note,
    ready: probe.ready,
  };
}

export async function runDexterDoctor(args?: {
  component?: "all" | "collector" | "trader";
  mode?: DexterAgentMode;
  network?: DexterAgentNetwork;
}) {
  const argv = ["doctor"];
  const mode = args?.mode || getDexterAgentStatus().defaultMode;
  const network = args?.network || getDexterAgentStatus().defaultNetwork;

  argv.push("--mode", mode, "--network", network);
  if (args?.component) {
    argv.push("--component", args.component);
  }

  return runDexterCli({
    argv,
    mode,
    network,
    timeoutMs: 90_000,
  });
}

export async function runDexterDashboard(args?: {
  intervalSeconds?: number;
  limit?: number;
  mode?: DexterAgentMode;
  network?: DexterAgentNetwork;
}) {
  const argv = ["dashboard", "--json"];
  const mode = args?.mode || getDexterAgentStatus().defaultMode;
  const network = args?.network || getDexterAgentStatus().defaultNetwork;

  argv.push("--mode", mode, "--network", network);
  if (args?.limit) {
    argv.push("--limit", String(args.limit));
  }
  if (args?.intervalSeconds) {
    argv.push("--interval", String(args.intervalSeconds));
  }

  const result = await runDexterCli({
    argv,
    mode,
    network,
    timeoutMs: 90_000,
  });

  return {
    ...result,
    parsedJson: (() => {
      try {
        return JSON.parse(result.stdout);
      } catch {
        return null;
      }
    })(),
  };
}

export async function runDexterExport(args: {
  kind:
    | "sessions"
    | "raw_events"
    | "leaderboard"
    | "positions"
    | "risk_events"
    | "strategy_profiles";
  limit?: number;
  mintId?: string;
  mode?: DexterAgentMode;
  network?: DexterAgentNetwork;
}) {
  const argv = ["export", "--kind", args.kind];
  const mode = args.mode || getDexterAgentStatus().defaultMode;
  const network = args.network || getDexterAgentStatus().defaultNetwork;

  argv.push("--mode", mode, "--network", network);
  if (args.limit) {
    argv.push("--limit", String(args.limit));
  }
  if (args.mintId?.trim()) {
    argv.push("--mint-id", args.mintId.trim());
  }

  return runDexterCli({
    argv,
    mode,
    network,
    timeoutMs: 90_000,
  });
}

export async function runDexterBacktest(args?: {
  inputPath?: string;
  limit?: number;
  mode?: DexterAgentMode;
  network?: DexterAgentNetwork;
  strategy?: "aggressive" | "balanced" | "conservative";
}) {
  const argv = ["backtest", "--json"];
  const mode = args?.mode || getDexterAgentStatus().defaultMode;
  const network = args?.network || getDexterAgentStatus().defaultNetwork;

  argv.push("--mode", mode, "--network", network);
  if (args?.strategy) {
    argv.push("--strategy", args.strategy);
  }
  if (args?.limit) {
    argv.push("--limit", String(args.limit));
  }
  if (args?.inputPath?.trim()) {
    argv.push("--input", args.inputPath.trim());
  }

  const result = await runDexterCli({
    argv,
    mode,
    network,
    timeoutMs: 120_000,
  });

  return {
    ...result,
    parsedJson: (() => {
      try {
        return JSON.parse(result.stdout);
      } catch {
        return null;
      }
    })(),
  };
}
