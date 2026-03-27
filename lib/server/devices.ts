import { AutoblowDevice, HandyDevice } from "ive-connect";

import { assertSafeRestEndpointUrl } from "@/lib/server/request-security";
import { DeviceCredentials, DeviceProfile, FunscriptPayload, LiveCommand } from "@/lib/types";

const AUTOBLOW_LATENCY_API = "https://latency.autoblowapi.com";
const AUTOBLOW_TIMEOUT_MS = 10_000;

async function requestDevice(
  input: string,
  init: RequestInit,
  failureMessage: string,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AUTOBLOW_TIMEOUT_MS);
  const response = await fetch(input, {
    ...init,
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout));
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(body || `${failureMessage} (${response.status})`);
  }
  return response;
}

function normalizeAutoblowClusterBase(cluster: string) {
  const trimmed = cluster.trim();
  if (!trimmed) {
    return null;
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function buildAutoblowClusterUrl(cluster: string, routePath: string) {
  const baseUrl = normalizeAutoblowClusterBase(cluster);
  if (!baseUrl) {
    throw new Error("Autoblow device cluster unavailable");
  }

  return new URL(routePath, `${baseUrl}/`).toString();
}

export interface RuntimeAdapter {
  readonly id: string;
  readonly type: string;
  readonly supportsLive: boolean;
  readonly supportsScript: boolean;
  connect(): Promise<void>;
  stop(): Promise<void>;
  getStatus(): Promise<Record<string, unknown>>;
  startLive?(command: LiveCommand, points?: Array<{ t: number; x: number }>): Promise<void>;
  updateLive?(command: LiveCommand, points?: Array<{ t: number; x: number }>): Promise<void>;
  startScript?(script: FunscriptPayload, resumeAtMs: number): Promise<void>;
}

async function getAutoblowCluster(deviceToken: string) {
  const response = await requestDevice(
    `${AUTOBLOW_LATENCY_API}/autoblow/connected`,
    {
      method: "GET",
      headers: { "x-device-token": deviceToken },
    },
    "Autoblow device not connected",
  );
  const payload = (await response.json()) as { connected: boolean; cluster: string };
  if (!payload.connected || !payload.cluster) {
    throw new Error("Autoblow device cluster unavailable");
  }
  const baseUrl = normalizeAutoblowClusterBase(payload.cluster);
  if (!baseUrl) {
    throw new Error("Autoblow device cluster unavailable");
  }

  return baseUrl;
}

class AutoblowRuntimeAdapter implements RuntimeAdapter {
  readonly type = "autoblow";
  readonly supportsLive = true;
  readonly supportsScript = true;
  private readonly device: AutoblowDevice;
  private clusterUrl: string | null = null;
  private connected = false;

  constructor(public readonly id: string, private readonly credentials: DeviceCredentials) {
    this.device = new AutoblowDevice({
      deviceToken: credentials.deviceToken ?? "",
    });
  }

  async connect() {
    if (this.connected) return;
    this.clusterUrl = await getAutoblowCluster(this.credentials.deviceToken ?? "");
    this.connected = true;
  }

  async stop() {
    if (this.clusterUrl) {
      await requestDevice(
        buildAutoblowClusterUrl(this.clusterUrl, "autoblow/oscillate/stop"),
        {
          method: "PUT",
          headers: { "x-device-token": this.credentials.deviceToken ?? "" },
        },
        "Failed to stop Autoblow device",
      ).catch(() => null);
    }
    await this.device.stop().catch(() => false);
  }

  async getStatus() {
    await this.connect();
    return {
      connected: this.connected,
      clusterUrl: this.clusterUrl,
    };
  }

  async startLive(command: LiveCommand) {
    await this.updateLive(command);
  }

  async updateLive(command: LiveCommand) {
    await this.connect();
    if (!this.clusterUrl) throw new Error("Autoblow cluster unavailable");
    await requestDevice(
      buildAutoblowClusterUrl(this.clusterUrl, "autoblow/oscillate"),
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-device-token": this.credentials.deviceToken ?? "",
        },
        body: JSON.stringify({
          speed: command.speed,
          minY: command.minY,
          maxY: command.maxY,
        }),
      },
      "Failed to update Autoblow live motion",
    );
  }

  async startScript(script: FunscriptPayload, resumeAtMs: number) {
    const connected = await this.device.connect();
    if (!connected) {
      throw new Error("Failed to connect Autoblow device for script playback");
    }
    const result = await this.device.prepareScript(script);
    if (!result.success) {
      throw new Error(result.error ?? "Failed to prepare Autoblow script");
    }
    const started = await this.device.play(resumeAtMs, 1, true);
    if (!started) throw new Error("Failed to start Autoblow script playback");
  }
}

class HandyRuntimeAdapter implements RuntimeAdapter {
  readonly type = "handy";
  readonly supportsLive = true;
  readonly supportsScript = true;
  private readonly device: HandyDevice;
  private connected = false;
  private hspReady = false;

  constructor(public readonly id: string, private readonly credentials: DeviceCredentials) {
    this.device = new HandyDevice({
      connectionKey: credentials.connectionKey ?? "",
      applicationId: "Tianshi",
    });
  }

  async connect() {
    if (this.connected) return;
    const ok = await this.device.connect();
    if (!ok) throw new Error("Failed to connect Handy device");
    this.connected = true;
  }

  async stop() {
    await this.connect();
    await this.device.hspStop().catch(() => null);
    await this.device.stop().catch(() => false);
    this.hspReady = false;
  }

  async getStatus() {
    await this.connect();
    return {
      connected: this.connected,
      info: this.device.getDeviceInfo(),
      hspState: this.device.hspState,
    };
  }

  async startLive(command: LiveCommand, points?: Array<{ t: number; x: number }>) {
    await this.connect();
    if (!this.hspReady) {
      await this.device.hspSetup();
      this.hspReady = true;
    }
    await this.device.hspAddPoints(points ?? [], true);
    await this.device.hspPlay(0, { pauseOnStarving: true, loop: false });
    await this.device.hspSetPlaybackRate(Math.max(command.speed / 60, 0.2));
  }

  async updateLive(command: LiveCommand, points?: Array<{ t: number; x: number }>) {
    await this.connect();
    if (!this.hspReady) {
      await this.startLive(command, points);
      return;
    }
    await this.device.hspAddPoints(points ?? [], false);
    await this.device.hspSetPlaybackRate(Math.max(command.speed / 60, 0.2));
  }

  async startScript(script: FunscriptPayload, resumeAtMs: number) {
    await this.connect();
    const result = await this.device.prepareScript(script);
    if (!result.success) {
      throw new Error(result.error ?? "Failed to prepare Handy script");
    }
    const ok = await this.device.play(resumeAtMs, 1, true);
    if (!ok) throw new Error("Failed to start Handy script");
  }
}

class RestRuntimeAdapter implements RuntimeAdapter {
  readonly type = "rest";
  readonly supportsLive = true;
  readonly supportsScript = false;
  private endpointUrl: string | null = null;

  constructor(public readonly id: string, private readonly credentials: DeviceCredentials) {}

  async connect() {
    if (!this.credentials.endpointUrl) {
      throw new Error("REST device endpoint URL is required");
    }

    this.endpointUrl = await assertSafeRestEndpointUrl(this.credentials.endpointUrl);
  }

  private buildHeaders() {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.credentials.extraHeaders ?? {}),
    };
    if (this.credentials.authToken) {
      headers[this.credentials.authHeaderName || "Authorization"] =
        this.credentials.authHeaderName === "Authorization"
          ? `Bearer ${this.credentials.authToken}`
          : this.credentials.authToken;
    }
    return headers;
  }

  async stop() {
    await this.connect();
    await requestDevice(
      this.endpointUrl!,
      {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          action: "stop",
          timestamp: new Date().toISOString(),
        }),
      },
      "Failed to stop REST device",
    );
  }

  async getStatus() {
    await this.connect();
    const response = await fetch(this.endpointUrl!, {
      method: "OPTIONS",
      headers: this.buildHeaders(),
    });
    if (!response.ok && response.status !== 405) {
      const body = await response.text().catch(() => "");
      throw new Error(body || `REST endpoint probe failed (${response.status})`);
    }

    return {
      connected: true,
      endpointUrl: this.endpointUrl,
      status: response.status,
    };
  }

  async startLive(command: LiveCommand) {
    await this.updateLive(command);
  }

  async updateLive(command: LiveCommand) {
    await this.connect();
    await requestDevice(
      this.endpointUrl!,
      {
        method: "POST",
        headers: this.buildHeaders(),
        body: JSON.stringify({
          action: "live",
          mode: "live",
          speed: command.speed,
          amplitude: command.amplitude,
          minY: command.minY,
          maxY: command.maxY,
          position: command.position,
          timestamp: new Date().toISOString(),
        }),
      },
      "Failed to update REST live motion",
    );
  }
}

export function createRuntimeAdapter(profile: DeviceProfile, credentials: DeviceCredentials): RuntimeAdapter {
  switch (profile.type) {
    case "autoblow":
      return new AutoblowRuntimeAdapter(profile.id, credentials);
    case "handy":
      return new HandyRuntimeAdapter(profile.id, credentials);
    case "rest":
      return new RestRuntimeAdapter(profile.id, credentials);
    default:
      throw new Error(`Unsupported device type: ${profile.type}`);
  }
}
