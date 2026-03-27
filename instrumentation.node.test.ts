import { beforeEach, describe, expect, it, vi } from "vitest";

const envModule = vi.hoisted(() => ({
  allowInProcessWorker: vi.fn(() => true),
}));

const autonomousRuntimeModule = vi.hoisted(() => ({
  startAutonomousRuntimeLoop: vi.fn(),
}));

const livestreamRuntimeModule = vi.hoisted(() => ({
  startLivestreamRuntimeLoop: vi.fn(),
}));

const workerRuntimeModule = vi.hoisted(() => ({
  rehydrateRuntimeSessions: vi.fn(async () => ({
    recovered: [],
    skipped: [],
  })),
}));

vi.mock("@/lib/env", () => envModule);
vi.mock("@/lib/server/autonomous-runtime", () => autonomousRuntimeModule);
vi.mock("@/lib/server/livestream-runtime", () => livestreamRuntimeModule);
vi.mock("@/lib/server/worker-runtime", () => workerRuntimeModule);

import { registerNodeInstrumentation } from "@/instrumentation.node";

describe("registerNodeInstrumentation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envModule.allowInProcessWorker.mockReturnValue(true);
    workerRuntimeModule.rehydrateRuntimeSessions.mockResolvedValue({
      recovered: [],
      skipped: [],
    });
    (globalThis as { __tianshiNodeInstrumentationRegistered?: boolean })
      .__tianshiNodeInstrumentationRegistered = undefined;
  });

  it("rehydrates in-process sessions before starting runtime loops", async () => {
    const sequence: string[] = [];

    workerRuntimeModule.rehydrateRuntimeSessions.mockImplementation(async () => {
      sequence.push("rehydrate");
      return { recovered: [], skipped: [] };
    });
    autonomousRuntimeModule.startAutonomousRuntimeLoop.mockImplementation(() => {
      sequence.push("autonomous");
      return true;
    });
    livestreamRuntimeModule.startLivestreamRuntimeLoop.mockImplementation(() => {
      sequence.push("livestream");
      return true;
    });

    await registerNodeInstrumentation();

    expect(sequence).toEqual(["rehydrate", "autonomous", "livestream"]);
  });

  it("skips runtime recovery when the in-process worker is disabled", async () => {
    envModule.allowInProcessWorker.mockReturnValue(false);

    await registerNodeInstrumentation();

    expect(workerRuntimeModule.rehydrateRuntimeSessions).not.toHaveBeenCalled();
    expect(autonomousRuntimeModule.startAutonomousRuntimeLoop).toHaveBeenCalledTimes(1);
    expect(livestreamRuntimeModule.startLivestreamRuntimeLoop).toHaveBeenCalledTimes(1);
  });

  it("boots only once per process", async () => {
    await registerNodeInstrumentation();
    await registerNodeInstrumentation();

    expect(workerRuntimeModule.rehydrateRuntimeSessions).toHaveBeenCalledTimes(1);
    expect(autonomousRuntimeModule.startAutonomousRuntimeLoop).toHaveBeenCalledTimes(1);
    expect(livestreamRuntimeModule.startLivestreamRuntimeLoop).toHaveBeenCalledTimes(1);
  });
});
