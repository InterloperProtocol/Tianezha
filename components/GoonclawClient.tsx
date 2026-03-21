"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HomeEligibilityCta } from "@/components/HomeEligibilityCta";
import { MediaEmbedPanel } from "@/components/MediaEmbedPanel";
import { NewsPanel } from "@/components/NewsPanel";
import { PriceChart } from "@/components/PriceChart";
import { PublicChatPanel } from "@/components/PublicChatPanel";
import { AutonomousStatusPreviewPanel } from "@/components/AutonomousStatusPreviewPanel";
import { PublicStreamSettingsPanel } from "@/components/PublicStreamSettingsPanel";
import { SiteNav } from "@/components/SiteNav";
import { TrenchesPanel } from "@/components/TrenchesPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEFAULT_PUMP_TOKEN_MINT } from "@/lib/token-defaults";
import {
  DeviceCredentials,
  DeviceType,
  PublicStreamProfile,
  SanitizedDeviceProfile,
  SessionMode,
  SessionRecord,
} from "@/lib/types";

type Props = {
  defaultMediaUrl: string;
  variant: "goonclaw" | "my-goonclaw";
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

type PublicStreamResponse = {
  item: PublicStreamProfile | null;
  publicUrl: string | null;
};

type LivestreamState = {
  current: {
    contractAddress: string;
    tier: "standard" | "priority";
    status: string;
    expiresAt?: string;
    payerWallet?: string;
  } | null;
  queue: Array<{ id: string }>;
  deviceAvailable: boolean;
  standardPriceSol: string;
  priorityPriceSol: string;
};

const DEFAULT_CONTRACT_ADDRESS = DEFAULT_PUMP_TOKEN_MINT;
const SHARED_CONTRACT_ADDRESS_STORAGE_KEY = "goonclaw-shared-contract-address";

const initialDeviceState: DeviceFormState = {
  type: "autoblow",
  label: "",
  deviceToken: "",
  connectionKey: "",
  endpointUrl: "",
  authToken: "",
  authHeaderName: "Authorization",
};

function readStoredContractAddress() {
  if (typeof window === "undefined") {
    return "";
  }

  return window.localStorage.getItem(SHARED_CONTRACT_ADDRESS_STORAGE_KEY)?.trim() || "";
}

export function GoonclawClient({ defaultMediaUrl, variant }: Props) {
  const isTokenControlPage = variant === "goonclaw";
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(initialDeviceState);
  const [devices, setDevices] = useState<SanitizedDeviceProfile[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [livestreamState, setLivestreamState] = useState<LivestreamState | null>(null);
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [publicStream, setPublicStream] = useState<PublicStreamProfile | null>(null);
  const [publicStreamUrl, setPublicStreamUrl] = useState<string | null>(null);
  const [publicStreamSlug, setPublicStreamSlug] = useState("");
  const [publicMediaUrl, setPublicMediaUrl] = useState(defaultMediaUrl);
  const [chartLookupAddress, setChartLookupAddress] = useState("");
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
  const hasSyncedDevice = devices.length > 0;
  const purchasedSession = livestreamState?.current ?? null;
  const focusContractAddress = useMemo(() => {
    if (activeSession?.contractAddress) {
      return activeSession.contractAddress;
    }

    if (isTokenControlPage) {
      return (
        purchasedSession?.contractAddress ||
        contractAddress.trim() ||
        DEFAULT_CONTRACT_ADDRESS
      );
    }

    if (!hasSyncedDevice && purchasedSession?.contractAddress) {
      return purchasedSession.contractAddress;
    }

    return contractAddress.trim() || DEFAULT_CONTRACT_ADDRESS;
  }, [
    activeSession?.contractAddress,
    contractAddress,
    hasSyncedDevice,
    isTokenControlPage,
    purchasedSession?.contractAddress,
  ]);

  const lastActivityLabel = useMemo(() => {
    const latest = activeSession?.updatedAt ?? sessions[0]?.updatedAt;
    if (!latest) return "No recent session";
    return new Date(latest).toLocaleString("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }, [activeSession?.updatedAt, sessions]);
  const activeChartAddress = chartLookupAddress.trim() || focusContractAddress;
  const pageFaqItems = useMemo(
    () =>
      isTokenControlPage
        ? [
            {
              question: "What is GoonClaw for?",
              answer:
                "GoonClaw controls the shared token view and pushes that focus across guest-facing sessions so the broadcast stays consistent.",
            },
            {
              question: "How does token focus work?",
              answer:
                "The current token mint stays mirrored into the shared session workspace, and your public streamer page can inherit that focus automatically.",
            },
            {
              question: "What mode am I in?",
              answer:
                mode === "live"
                  ? "Live tracking is active, so the dashboard is ready to follow the live market move."
                  : "Guided pattern mode is active, so the dashboard will run a generated pattern instead of pure live tracking.",
            },
            {
              question: "What was the latest activity?",
              answer: lastActivityLabel,
            },
          ]
        : [
            {
              question: "What is MyGoonClaw for?",
              answer:
                "MyGoonClaw runs your streamer setup and keeps the guest-facing panel in sync with your saved devices, media, and public page settings.",
            },
            {
              question: "What is my streamer status?",
              answer: publicStream?.isPublic
                ? `Your public streamer page is live at @${publicStream.slug}.`
                : "Your streamer page is still a private draft until you publish it.",
            },
            {
              question: "What mode am I in?",
              answer:
                mode === "live"
                  ? "Live tracking is active, so your setup is ready to follow the live market move."
                  : "Guided pattern mode is active, so your setup will run a generated pattern instead of pure live tracking.",
            },
            {
              question: "What was the latest activity?",
              answer: lastActivityLabel,
            },
          ],
    [
      isTokenControlPage,
      lastActivityLabel,
      mode,
      publicStream?.isPublic,
      publicStream?.slug,
    ],
  );

  async function refreshDevices(preferredDeviceId?: string) {
    const response = await fetch("/api/devices");
    if (!response.ok) return;

    const payload = (await response.json()) as {
      items: SanitizedDeviceProfile[];
    };
    setDevices(payload.items);
    setSelectedDeviceId((current) => {
      if (preferredDeviceId && payload.items.some((item) => item.id === preferredDeviceId)) {
        return preferredDeviceId;
      }

      if (current && payload.items.some((item) => item.id === current)) {
        return current;
      }

      return payload.items[0]?.id || "";
    });
  }

  async function refreshSessions() {
    const response = await fetch("/api/sessions");
    if (!response.ok) return;

    const payload = (await response.json()) as { items: SessionRecord[] };
    setSessions(payload.items);
  }

  async function refreshLivestreamState() {
    const response = await fetch("/api/livestream/status");
    if (!response.ok) return;

    const payload = (await response.json()) as LivestreamState;
    setLivestreamState(payload);
  }

  const refreshPublicStream = useCallback(async () => {
    const storedContractAddress = readStoredContractAddress();
    const response = await fetch("/api/public-stream");
    if (!response.ok) return;

    const payload = (await response.json()) as PublicStreamResponse;
    setPublicStream(payload.item);
    setPublicStreamUrl(payload.publicUrl);

    if (payload.item) {
      setPublicStreamSlug(payload.item.slug);
      setContractAddress(
        payload.item.defaultContractAddress ||
          storedContractAddress ||
          DEFAULT_CONTRACT_ADDRESS,
      );
      setPublicMediaUrl(payload.item.mediaUrl || defaultMediaUrl);
      return;
    }

    setPublicStreamSlug("");
    setContractAddress(storedContractAddress || DEFAULT_CONTRACT_ADDRESS);
    setPublicMediaUrl(defaultMediaUrl);
  }, [defaultMediaUrl]);

  useEffect(() => {
    void refreshDevices();
    void refreshSessions();
    void refreshPublicStream();
    void refreshLivestreamState();
    const interval = window.setInterval(() => {
      void refreshSessions();
      void refreshLivestreamState();
    }, 4_000);
    return () => window.clearInterval(interval);
  }, [refreshPublicStream]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const nextContractAddress =
      contractAddress.trim() || DEFAULT_CONTRACT_ADDRESS;
    window.localStorage.setItem(
      SHARED_CONTRACT_ADDRESS_STORAGE_KEY,
      nextContractAddress,
    );
  }, [contractAddress]);

  useEffect(() => {
    if (!publicStream?.isPublic) {
      return;
    }

    const nextContractAddress =
      contractAddress.trim() || DEFAULT_CONTRACT_ADDRESS;
    const nextMediaUrl = publicMediaUrl.trim();
    if (
      publicStream.defaultContractAddress === nextContractAddress &&
      (publicStream.mediaUrl || "") === nextMediaUrl
    ) {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetch("/api/public-stream", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: publicStream.slug,
          isPublic: true,
          defaultContractAddress: nextContractAddress,
          mediaUrl: nextMediaUrl,
        }),
      })
        .then(async (response) => {
          if (!response.ok) {
            return;
          }

          const payload = (await response.json()) as PublicStreamResponse;
          setPublicStream(payload.item);
          setPublicStreamUrl(payload.publicUrl);
        })
        .catch((syncError) => {
          console.warn("Failed to sync public stream state", syncError);
        });
    }, 700);

    return () => window.clearTimeout(timeout);
  }, [contractAddress, publicMediaUrl, publicStream]);

  function updateDeviceForm<K extends keyof DeviceFormState>(
    key: K,
    value: DeviceFormState[K],
  ) {
    setDeviceForm((current) => ({ ...current, [key]: value }));
  }

  function validateDeviceForm() {
    if (!deviceForm.label.trim()) {
      return "Give this device a label first.";
    }

    if (deviceForm.type === "autoblow" && !deviceForm.deviceToken.trim()) {
      return "Autoblow needs a device token.";
    }

    if (deviceForm.type === "handy" && !deviceForm.connectionKey.trim()) {
      return "Handy needs a connection key.";
    }

    if (deviceForm.type === "rest" && !deviceForm.endpointUrl.trim()) {
      return "REST devices need an endpoint URL.";
    }

    return null;
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

    const validationError = validateDeviceForm();
    if (validationError) {
      setError(validationError);
      setLoading(null);
      return;
    }

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
      const payload = (await response.json()) as {
        error?: string;
        item?: SanitizedDeviceProfile;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Couldn't save setup");
      }

      setDeviceForm(initialDeviceState);
      setNotice("Setup saved and ready to use.");
      await refreshDevices(payload.item?.id);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't save setup",
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
        throw new Error(payload.error || "Couldn't test setup");
      }

      setNotice("Setup connected successfully.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't test setup",
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
        throw new Error(payload.error || "Couldn't remove setup");
      }

      if (selectedDeviceId === deviceId) {
        setSelectedDeviceId("");
      }
      setNotice("Setup removed.");
      await refreshDevices();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't remove setup",
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
        throw new Error(payload.error || "Couldn't start session");
      }

      setNotice("Session started. Your selected setup is now following the chart.");
      await refreshSessions();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't start session",
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
        throw new Error(payload.error || "Couldn't stop session");
      }

      setNotice("Session stopped.");
      await refreshSessions();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't stop session",
      );
    } finally {
      setLoading(null);
    }
  }

  async function savePublicStreamSettings(nextIsPublic: boolean) {
    setLoading("public");
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/public-stream", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: publicStreamSlug.trim(),
          isPublic: nextIsPublic,
          defaultContractAddress:
            contractAddress.trim() || DEFAULT_CONTRACT_ADDRESS,
          mediaUrl: publicMediaUrl.trim(),
        }),
      });
      const payload = (await response.json()) as PublicStreamResponse & {
        error?: string;
      };
      if (!response.ok || !payload.item) {
        throw new Error(payload.error || "Couldn't save public stream");
      }

      setPublicStream(payload.item);
      setPublicStreamUrl(payload.publicUrl);
      setPublicStreamSlug(payload.item.slug);
      setNotice(
        nextIsPublic
          ? "Your public stream page is live."
          : "Your public stream page is now private.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't save public stream",
      );
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="app-shell">
      <SiteNav />

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="dashboard-grid dashboard-grid-primary-row">
        <PriceChart contractAddress={activeChartAddress} />
        <MediaEmbedPanel
          title="Video or stream"
          defaultUrl={publicStream?.mediaUrl || defaultMediaUrl}
          storageKey="goonclaw-personal-media"
          onActiveUrlChange={setPublicMediaUrl}
        />
      </section>

      <section className="dashboard-grid dashboard-grid-primary-row">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Device connect</p>
              <h2>Devices and chart control</h2>
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Chart lookup</span>
              <input
                value={chartLookupAddress}
                onChange={(event) => setChartLookupAddress(event.target.value)}
                placeholder={focusContractAddress}
              />
            </label>
            <div className="summary-card">
              <span>Current chart</span>
              <strong>{activeChartAddress}</strong>
              <p>Preview any token chart here even before a device is connected.</p>
            </div>
          </div>

          <div className="button-row">
            <button
              className="button button-ghost small"
              onClick={() => setChartLookupAddress("")}
              type="button"
            >
              Follow session chart
            </button>
          </div>

          {devices.length ? (
            <div className="device-list scroll-feed">
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
              No setup saved yet. Add one below to get started.
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
                  placeholder="Bedroom setup"
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
              {loading === "device" ? "Saving..." : "Save setup"}
            </button>
          </div>
        </section>

        {isTokenControlPage ? (
          <AutonomousStatusPreviewPanel
            eyebrow="Agent status"
            title="GoonClaw is autonomous"
            description="This slot mirrors the public status wall. GoonClaw stays read-only here, and only the hidden owner dashboard can intervene."
          />
        ) : (
          <PublicChatPanel
            eyebrow="MyGoonClaw chat"
            title="Use the lightweight chatbot"
            description="MyGoonClaw keeps the helper chatbot available for quick copy, planning, and general questions while your chart stays locked into row 1."
          />
        )}
      </section>

      <section className="dashboard-grid dashboard-grid-feed-row">
        <NewsPanel
          title="Monitoring the Situation"
          defaultCategory="solana"
        />
        <TrenchesPanel
          eyebrow="Monitoring the Trenches"
          title="Monitoring the Trenches"
        />
      </section>

      <section className="dashboard-grid dashboard-grid-fullwidth">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Go live</p>
              <h2>
                {isTokenControlPage ? "Control token and session" : "Run your MyGoonClaw session"}
              </h2>
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Playback mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as SessionMode)}
              >
                <option value="live">Live tracking</option>
                <option value="script">Guided pattern</option>
              </select>
            </label>
            <label className="field">
              <span>{isTokenControlPage ? "Token mint" : "Shared token focus"}</span>
              <input
                value={contractAddress}
                onChange={(event) => {
                  if (!isTokenControlPage) {
                    return;
                  }
                  setContractAddress(event.target.value);
                }}
                placeholder={
                  isTokenControlPage
                    ? "Enter a Solana contract address"
                    : "Controlled from GoonClaw"
                }
                readOnly={!isTokenControlPage}
              />
            </label>
          </div>

          <p className="inline-note">
            {isTokenControlPage
              ? "This token focus is mirrored into MyGoonClaw and any public guest session tied to your streamer profile."
              : "Token changes happen in GoonClaw. MyGoonClaw mirrors that token across your guest-facing setup."}
          </p>

          <div className="button-row">
            <button
              className="button button-primary"
              disabled={!selectedDeviceId || loading === "session"}
              onClick={() => void startSession()}
            >
              {loading === "session" ? "Starting..." : "Start session"}
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
              No active session yet. Save a setup and start whenever you&apos;re ready.
            </p>
          )}

          <div className="route-badges">
            <StatusBadge tone={activeSession ? "success" : "warning"}>
              {activeSession ? "Session live" : "Ready to start"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              {selectedDevice ? `${selectedDevice.type} selected` : "No setup selected"}
            </StatusBadge>
          </div>

          {isTokenControlPage ? (
            <>
              <p className="panel-lead go-live-subsection">
                Keep token control here. MyGoonClaw and any guest-facing stream page mirror this contract focus automatically once your streamer profile is live.
              </p>

              {livestreamState ? (
                <dl className="detail-list compact">
                  <div className="detail">
                    <dt>Purchasable sync</dt>
                    <dd>
                      {livestreamState.current
                        ? `${livestreamState.current.tier} sync live on ${livestreamState.current.contractAddress}`
                        : "No paid sync is active right now."}
                    </dd>
                  </div>
                  <div className="detail">
                    <dt>Room status</dt>
                    <dd>
                      {livestreamState.deviceAvailable
                        ? `Available. Standard ${livestreamState.standardPriceSol} SOL, priority ${livestreamState.priorityPriceSol} SOL.`
                        : "The public room is busy or offline right now."}
                    </dd>
                  </div>
                </dl>
              ) : null}

              <dl className="detail-list compact">
                <div className="detail">
                  <dt>Current token</dt>
                  <dd>{focusContractAddress}</dd>
                </div>
                <div className="detail">
                  <dt>Streamer page</dt>
                  <dd>
                    {publicStream?.isPublic
                      ? publicStreamUrl || "Public stream is live."
                      : "Create your streamer page in MyGoonClaw to publish this token to guests."}
                  </dd>
                </div>
                <div className="detail">
                  <dt>Guest sync</dt>
                  <dd>
                    {publicStream?.isPublic
                      ? "Any public MyGoonClaw guest session now follows this token focus."
                      : "Private until you sign up as a streamer in MyGoonClaw."}
                  </dd>
                </div>
              </dl>
            </>
          ) : null}

          <div className="go-live-subsection">
            <div className="panel-header go-live-subheader">
              <div>
                <p className="eyebrow">Recent sessions</p>
                <h2>Recent activity</h2>
              </div>
            </div>

            {sessions.length ? (
              <div className="history-list scroll-feed">
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
          </div>
        </section>
      </section>

      <section className="dashboard-grid dashboard-grid-secondary">
        <PublicStreamSettingsPanel
          slug={publicStreamSlug}
          defaultContractAddress={contractAddress}
          isPublic={Boolean(publicStream?.isPublic)}
          saving={loading === "public"}
          publicUrl={publicStreamUrl}
          embedded={false}
          onSlugChange={setPublicStreamSlug}
          onSave={() => void savePublicStreamSettings(true)}
          onMakePrivate={() => void savePublicStreamSettings(false)}
        />
        <HomeEligibilityCta />
      </section>

      <section className="panel dashboard-faq">
        <div className="panel-header">
          <div>
            <p className="eyebrow">FAQ</p>
            <h2>
              {isTokenControlPage ? "How GoonClaw works" : "How MyGoonClaw works"}
            </h2>
          </div>
        </div>
        <p className="panel-lead">
          The old hero details live down here now so the dashboard can stay focused on the live panels first.
        </p>
        <div className="faq-list">
          {pageFaqItems.map((item) => (
            <article key={item.question} className="faq-item">
              <strong>{item.question}</strong>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
