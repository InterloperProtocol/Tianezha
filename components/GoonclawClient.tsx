"use client";

import { useEffect, useMemo, useState } from "react";

import { MediaEmbedPanel } from "@/components/MediaEmbedPanel";
import { NewsPanel } from "@/components/NewsPanel";
import { PriceChart } from "@/components/PriceChart";
import { SiteNav } from "@/components/SiteNav";
import { DEFAULT_PUMP_TOKEN_MINT } from "@/lib/token-defaults";
import {
  ChartSnapshot,
  DeviceCredentials,
  DeviceType,
  SanitizedDeviceProfile,
  SessionMode,
  SessionRecord,
} from "@/lib/types";

type Props = {
  defaultMediaUrl: string;
};

type DeviceFormState = {
  type: DeviceType;
  label: string;
  deviceToken: string;
  connectionKey: string;
  endpointUrl: string;
  authToken: string;
  authHeaderName: string;
};

const DEFAULT_CONTRACT_ADDRESS = DEFAULT_PUMP_TOKEN_MINT;

const initialDeviceState: DeviceFormState = {
  type: "autoblow",
  label: "",
  deviceToken: "",
  connectionKey: "",
  endpointUrl: "",
  authToken: "",
  authHeaderName: "Authorization",
};

export function GoonclawClient({ defaultMediaUrl }: Props) {
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(initialDeviceState);
  const [devices, setDevices] = useState<SanitizedDeviceProfile[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [chartSnapshot, setChartSnapshot] = useState<ChartSnapshot | null>(null);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [mode, setMode] = useState<SessionMode>("live");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeSession = useMemo(
    () =>
      sessions.find(
        (session) => session.status === "active" || session.status === "starting",
      ) ?? null,
    [sessions],
  );

  const selectedDevice = useMemo(
    () => devices.find((device) => device.id === selectedDeviceId) ?? null,
    [devices, selectedDeviceId],
  );

  async function refreshDevices() {
    const response = await fetch("/api/devices");
    if (!response.ok) return;

    const payload = (await response.json()) as {
      items: SanitizedDeviceProfile[];
    };
    setDevices(payload.items);
    setSelectedDeviceId((current) => current || payload.items[0]?.id || "");
  }

  async function refreshSessions() {
    const response = await fetch("/api/sessions");
    if (!response.ok) return;

    const payload = (await response.json()) as { items: SessionRecord[] };
    setSessions(payload.items);
  }

  useEffect(() => {
    void refreshDevices();
    void refreshSessions();
    const interval = window.setInterval(() => {
      void refreshSessions();
    }, 4_000);
    return () => window.clearInterval(interval);
  }, []);

  function updateDeviceForm<K extends keyof DeviceFormState>(
    key: K,
    value: DeviceFormState[K],
  ) {
    setDeviceForm((current) => ({ ...current, [key]: value }));
  }

  function buildCredentials(): DeviceCredentials {
    if (deviceForm.type === "autoblow") {
      return { deviceToken: deviceForm.deviceToken.trim() };
    }

    if (deviceForm.type === "handy") {
      return { connectionKey: deviceForm.connectionKey.trim() };
    }

    return {
      endpointUrl: deviceForm.endpointUrl.trim(),
      authToken: deviceForm.authToken.trim() || undefined,
      authHeaderName: deviceForm.authHeaderName.trim() || "Authorization",
    };
  }

  async function createDevice() {
    setLoading("device");
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: deviceForm.type,
          label: deviceForm.label.trim(),
          credentials: buildCredentials(),
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save device");
      }

      setDeviceForm(initialDeviceState);
      setNotice("Device saved. It is ready for direct GoonClaw control.");
      await refreshDevices();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to save device",
      );
    } finally {
      setLoading(null);
    }
  }

  async function testDevice(deviceId: string) {
    setLoading(`test:${deviceId}`);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/devices/${deviceId}/test`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Device test failed");
      }

      setNotice("Device responded successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Device test failed",
      );
    } finally {
      setLoading(null);
    }
  }

  async function deleteDevice(deviceId: string) {
    setLoading(`delete:${deviceId}`);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/devices/${deviceId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || "Failed to delete device");
      }

      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId("");
      }
      setNotice("Device removed.");
      await refreshDevices();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to delete device",
      );
    } finally {
      setLoading(null);
    }
  }

  async function startSession() {
    setLoading("session");
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: contractAddress.trim(),
          deviceId: selectedDeviceId,
          mode,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to start session");
      }

      setNotice("Session started. Chart motion is now driving the selected device.");
      await refreshSessions();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to start session",
      );
    } finally {
      setLoading(null);
    }
  }

  async function stopSession(sessionId: string) {
    setLoading(`stop:${sessionId}`);
    setNotice(null);
    setError(null);

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to stop session");
      }

      setNotice("Session stopped and cleanup requested.");
      await refreshSessions();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Failed to stop session",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="app-shell">
      <SiteNav />
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Personal Panel</p>
          <h1>GoonClaw private control room.</h1>
          <p className="hero-summary">
            Keep the chart, news, and video embed aligned across the top, then
            run your device session from the control surface below.
          </p>
          <div className="hero-badges">
            <span>Equal chart, news, and video panels</span>
            <span>Autoblow, Handy, and REST devices</span>
            <span>Saved device profiles</span>
          </div>
        </div>
      </section>

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="dashboard-grid dashboard-grid-triple">
        <PriceChart
          contractAddress={contractAddress.trim() || DEFAULT_CONTRACT_ADDRESS}
          onSnapshotChange={setChartSnapshot}
        />
        <NewsPanel
          title={`${chartSnapshot?.symbol ?? "Solana"} news`}
          defaultCategory="solana"
        />
        <MediaEmbedPanel
          title="Video or stream embed"
          description="Paste any YouTube, Twitch, Vimeo, direct MP4, HLS, or iframe-ready stream URL. Your last media source is stored locally in the browser."
          defaultUrl={defaultMediaUrl}
          storageKey="goonclaw-personal-media"
        />
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Device Control</p>
              <h2>Run a private session</h2>
            </div>
          </div>

          <label className="field">
            <span>Contract address</span>
            <input
              value={contractAddress}
              onChange={(event) => setContractAddress(event.target.value)}
              placeholder="Enter a Solana contract address"
            />
          </label>

          <div className="field-grid">
            <label className="field">
              <span>Motion mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as SessionMode)}
              >
                <option value="live">Live engine</option>
                <option value="script">Generated script</option>
              </select>
            </label>
            <label className="field">
              <span>Selected device</span>
              <input
                value={selectedDevice?.label || "No device selected"}
                readOnly
              />
            </label>
          </div>

          <div className="button-row">
            <button
              className="button button-primary"
              disabled={!selectedDeviceId || loading === "session"}
              onClick={() => void startSession()}
            >
              {loading === "session" ? "Starting..." : "Start sync"}
            </button>
            {activeSession ? (
              <button
                className="button button-danger"
                disabled={loading === `stop:${activeSession.id}`}
                onClick={() => void stopSession(activeSession.id)}
              >
                Stop active session
              </button>
            ) : null}
          </div>

          {activeSession ? (
            <div className="session-card">
              <div>
                <span>Status</span>
                <strong>{activeSession.status}</strong>
              </div>
              <div>
                <span>Mode</span>
                <strong>{activeSession.mode}</strong>
              </div>
              <div>
                <span>Device</span>
                <strong>{selectedDevice?.label || activeSession.deviceType}</strong>
              </div>
              <div>
                <span>5m move</span>
                <strong>
                  {activeSession.snapshot
                    ? `${activeSession.snapshot.change5mPct.toFixed(2)}%`
                    : "Waiting"}
                </strong>
              </div>
            </div>
          ) : (
            <p className="empty-state">
              No active session. Save a device and start a run to drive it from
              the chart.
            </p>
          )}
        </section>

        <div className="dashboard-column">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Saved Devices</p>
                <h2>Connectors and targets</h2>
              </div>
            </div>

            {devices.length ? (
              <div className="device-list">
                {devices.map((device) => (
                  <div
                    key={device.id}
                    className={
                      device.id === selectedDeviceId
                        ? "device-item selected"
                        : "device-item"
                    }
                  >
                    <button
                      className="device-pick"
                      onClick={() => setSelectedDeviceId(device.id)}
                    >
                      <div>
                        <span>{device.type}</span>
                        <strong>{device.label}</strong>
                      </div>
                      <div className="device-flags">
                        {device.supportsLive ? <span>Live</span> : null}
                        {device.supportsScript ? <span>Script</span> : null}
                      </div>
                    </button>
                    <div className="button-row">
                      <button
                        className="button button-secondary small"
                        disabled={loading === `test:${device.id}`}
                        onClick={() => void testDevice(device.id)}
                      >
                        Test
                      </button>
                      <button
                        className="button button-ghost small"
                        disabled={loading === `delete:${device.id}`}
                        onClick={() => void deleteDevice(device.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                No device saved yet. Add one below to unlock direct control.
              </p>
            )}

            <div className="device-form">
              <div className="field-grid">
                <label className="field">
                  <span>Device type</span>
                  <select
                    value={deviceForm.type}
                    onChange={(event) =>
                      updateDeviceForm("type", event.target.value as DeviceType)
                    }
                  >
                    <option value="autoblow">Autoblow</option>
                    <option value="handy">Handy</option>
                    <option value="rest">Generic REST</option>
                  </select>
                </label>
                <label className="field">
                  <span>Label</span>
                  <input
                    value={deviceForm.label}
                    onChange={(event) => updateDeviceForm("label", event.target.value)}
                    placeholder="Bedroom device"
                  />
                </label>
              </div>

              {deviceForm.type === "autoblow" ? (
                <label className="field">
                  <span>Device token</span>
                  <input
                    value={deviceForm.deviceToken}
                    onChange={(event) =>
                      updateDeviceForm("deviceToken", event.target.value)
                    }
                    placeholder="Autoblow API token"
                  />
                </label>
              ) : null}

              {deviceForm.type === "handy" ? (
                <label className="field">
                  <span>Connection key</span>
                  <input
                    value={deviceForm.connectionKey}
                    onChange={(event) =>
                      updateDeviceForm("connectionKey", event.target.value)
                    }
                    placeholder="Handy connection key"
                  />
                </label>
              ) : null}

              {deviceForm.type === "rest" ? (
                <div className="device-form">
                  <label className="field">
                    <span>Endpoint URL</span>
                    <input
                      value={deviceForm.endpointUrl}
                      onChange={(event) =>
                        updateDeviceForm("endpointUrl", event.target.value)
                      }
                      placeholder="https://device.example/api/live"
                    />
                  </label>
                  <div className="field-grid">
                    <label className="field">
                      <span>Auth token</span>
                      <input
                        value={deviceForm.authToken}
                        onChange={(event) =>
                          updateDeviceForm("authToken", event.target.value)
                        }
                        placeholder="Optional bearer token"
                      />
                    </label>
                    <label className="field">
                      <span>Auth header</span>
                      <input
                        value={deviceForm.authHeaderName}
                        onChange={(event) =>
                          updateDeviceForm("authHeaderName", event.target.value)
                        }
                        placeholder="Authorization"
                      />
                    </label>
                  </div>
                </div>
              ) : null}

              <button
                className="button button-primary"
                disabled={loading === "device"}
                onClick={() => void createDevice()}
              >
                {loading === "device" ? "Saving..." : "Save device"}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Recent Sessions</p>
                <h2>Worker history</h2>
              </div>
            </div>

            {sessions.length ? (
              <div className="history-list">
                {sessions.map((session) => (
                  <div key={session.id} className="history-item">
                    <div>
                      <span>{session.status}</span>
                      <strong>
                        {session.contractAddress.slice(0, 4)}...
                        {session.contractAddress.slice(-4)}
                      </strong>
                    </div>
                    <div>
                      <span>Updated</span>
                      <strong>
                        {new Date(session.updatedAt).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </strong>
                    </div>
                    <div>
                      <span>Mode</span>
                      <strong>{session.mode}</strong>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">
                Session history will appear here after your first run.
              </p>
            )}
          </section>
        </div>
      </section>
    </div>
  );
}
