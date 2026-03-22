"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { HomeEligibilityCta } from "@/components/HomeEligibilityCta";
import { NewsPanel } from "@/components/NewsPanel";
import { PriceChart } from "@/components/PriceChart";
import { PublicChatPanel } from "@/components/PublicChatPanel";
import { AutonomousStatusPreviewPanel } from "@/components/AutonomousStatusPreviewPanel";
import { PublicStreamSettingsPanel } from "@/components/PublicStreamSettingsPanel";
import { SimpleStreamEmbedPanel } from "@/components/SimpleStreamEmbedPanel";
import { SiteNav } from "@/components/SiteNav";
import { TrenchesPanel } from "@/components/TrenchesPanel";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DEFAULT_PUMP_TOKEN_MINT } from "@/lib/token-defaults";
import {
  DeviceCredentials,
  DeviceType,
  LivestreamTier,
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

type LivestreamRequestView = {
  id: string;
  contractAddress: string;
  memo: string;
  tier: LivestreamTier;
  amountLamports: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  expiresAt?: string;
  completedAt?: string;
  payerWallet?: string;
  sessionId?: string;
  error?: string;
};

type LivestreamState = {
  current: LivestreamRequestView | null;
  queue: LivestreamRequestView[];
  recentRequests: LivestreamRequestView[];
  deviceAvailable: boolean;
  treasuryWallet: string;
  standardPriceSol: string;
  priorityPriceSol: string;
  sessionSeconds: number;
  requesterCooldownSeconds: number;
  contractCooldownSeconds: number;
  paymentWindowSeconds: number;
  embedUrl: string;
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

function shortenValue(value?: string | null) {
  if (!value) return "Waiting";
  if (value.length < 10) return value;
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function lamportsToSol(value: string) {
  const sol = Number(BigInt(value)) / 1_000_000_000;
  return sol.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
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
  const [tier, setTier] = useState<LivestreamTier>("standard");
  const [signature, setSignature] = useState("");
  const [checkout, setCheckout] = useState<LivestreamRequestView | null>(null);
  const [mode, setMode] = useState<SessionMode>("live");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [loading, setLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isUserWorkspace = !isTokenControlPage;

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
  const checkoutPriceSol = useMemo(
    () => (checkout ? lamportsToSol(checkout.amountLamports) : ""),
    [checkout],
  );
  const sessionMinutes = useMemo(
    () =>
      livestreamState?.sessionSeconds
        ? Math.max(1, Math.round(livestreamState.sessionSeconds / 60))
        : 2,
    [livestreamState?.sessionSeconds],
  );
  const pageFaqItems = useMemo(
    () =>
      isTokenControlPage
        ? [
            {
              question: "What is GoonClaw for?",
              answer:
                "GoonClaw is the live room page. You can watch it here.",
            },
            {
              question: "Which token is shown here?",
              answer:
                "This page shows the current room token.",
            },
            {
              question: "Can I control this page?",
              answer:
                "No. This page is view-only.",
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
                "MyGoonClaw is your workspace for devices, sessions, media, and your public page.",
            },
            {
              question: "What is my streamer status?",
              answer: publicStream?.isPublic
                ? `Your public streamer page is live at @${publicStream.slug}.`
                : "Your page is private until you publish it.",
            },
            {
              question: "What mode am I in?",
              answer:
                mode === "live"
                  ? "Live mode is on."
                  : "Pattern mode is on.",
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
    setCheckout((current) =>
      current
        ? payload.recentRequests.find((item) => item.id === current.id) ?? current
        : payload.recentRequests.find(
            (item) => item.status === "pending" && !item.payerWallet,
          ) ?? null,
    );
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
    void refreshLivestreamState();
    if (isUserWorkspace) {
      void refreshDevices();
      void refreshSessions();
      void refreshPublicStream();
    } else {
      setPublicStream(null);
      setPublicStreamUrl(null);
      setPublicStreamSlug("");
      setPublicMediaUrl(defaultMediaUrl);
      setContractAddress(DEFAULT_CONTRACT_ADDRESS);
    }
    const interval = window.setInterval(() => {
      void refreshLivestreamState();
      if (isUserWorkspace) {
        void refreshSessions();
      }
    }, 4_000);
    return () => window.clearInterval(interval);
  }, [defaultMediaUrl, isUserWorkspace, refreshPublicStream]);

  useEffect(() => {
    if (!isUserWorkspace || typeof window === "undefined") {
      return;
    }

    const nextContractAddress =
      contractAddress.trim() || DEFAULT_CONTRACT_ADDRESS;
    window.localStorage.setItem(
      SHARED_CONTRACT_ADDRESS_STORAGE_KEY,
      nextContractAddress,
    );
  }, [contractAddress, isUserWorkspace]);

  useEffect(() => {
    if (!isUserWorkspace || !publicStream?.isPublic) {
      return;
    }

    const nextContractAddress =
      contractAddress.trim() || DEFAULT_CONTRACT_ADDRESS;
    const nextMediaUrl = publicMediaUrl.trim();
    if (
      publicStream?.defaultContractAddress === nextContractAddress &&
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
  }, [contractAddress, isUserWorkspace, publicMediaUrl, publicStream]);

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

  async function createLivestreamCheckout() {
    setLoading("livestream-request");
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/livestream/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress: activeChartAddress,
          tier,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        item?: LivestreamRequestView;
        state?: LivestreamState;
      };
      if (!response.ok || !payload.item || !payload.state) {
        throw new Error(payload.error || "Couldn't create payment details");
      }

      setCheckout(payload.item);
      setLivestreamState(payload.state);
      setSignature("");
      setNotice("Payment memo ready. Send the transfer, then confirm the signature.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't create payment details",
      );
    } finally {
      setLoading(null);
    }
  }

  async function verifyLivestreamCheckout() {
    if (!checkout || !signature.trim()) {
      return;
    }

    setLoading("livestream-verify");
    setNotice(null);
    setError(null);

    try {
      const response = await fetch("/api/livestream/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId: checkout.id,
          signature: signature.trim(),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        item?: LivestreamRequestView | null;
        state?: LivestreamState;
      };
      if (!response.ok || !payload.state) {
        throw new Error(payload.error || "Couldn't confirm payment");
      }

      setLivestreamState(payload.state);
      setCheckout(payload.item ?? checkout);
      setNotice("Payment confirmed. Your chart job is now in the session queue.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't confirm payment",
      );
    } finally {
      setLoading(null);
    }
  }

  const savedDevicesSection = isUserWorkspace ? (
    <div className="go-live-subsection">
      <div className="panel-header go-live-subheader">
        <div>
          <p className="eyebrow">Saved devices</p>
          <h2>Manage devices</h2>
        </div>
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
          No saved device yet. Add one below when you are ready.
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
          {loading === "device" ? "Saving..." : "Save device"}
        </button>
      </div>
    </div>
  ) : null;

  return (
    <div className="app-shell">
      <SiteNav />

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="dashboard-grid dashboard-grid-primary-row">
        <PriceChart contractAddress={activeChartAddress} />
        <SimpleStreamEmbedPanel
          title={isTokenControlPage ? "Live stream" : "Your stream"}
          description={
            isTokenControlPage
              ? "Simple Kick embed for the public room."
              : "Simple stream player for your page."
          }
          url={publicStream?.mediaUrl || publicMediaUrl || defaultMediaUrl}
        />
      </section>

      <section className="dashboard-grid dashboard-grid-primary-row">
        {isTokenControlPage ? (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Public room</p>
                <h2>Chart payment</h2>
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
                <p>Pay to put this chart on GoonClaw.</p>
              </div>
            </div>

            <p className="panel-lead">
              Session state is purchasable. Revenue routes to the GoonClaw wallet.
            </p>

            <div className="button-row">
              <button
                className="button button-ghost small"
                onClick={() => setChartLookupAddress("")}
                type="button"
              >
                Follow session chart
              </button>
            </div>

            <div className="route-badges">
              <StatusBadge tone={livestreamState?.deviceAvailable ? "success" : "danger"}>
                {livestreamState?.deviceAvailable ? "Session purchasable" : "Room busy"}
              </StatusBadge>
              <StatusBadge tone="accent">
                {livestreamState?.standardPriceSol || "0.0069"} SOL / {sessionMinutes} min
              </StatusBadge>
              <StatusBadge tone="warning">
                {livestreamState?.priorityPriceSol || "0.01"} SOL priority
              </StatusBadge>
            </div>

            <div className="field-grid">
              <button
                className={
                  tier === "standard"
                    ? "button button-primary"
                    : "button button-ghost"
                }
                onClick={() => setTier("standard")}
                type="button"
              >
                Standard job
              </button>
              <button
                className={
                  tier === "priority"
                    ? "button button-danger"
                    : "button button-ghost"
                }
                onClick={() => setTier("priority")}
                type="button"
              >
                Priority job
              </button>
            </div>

            <div className="button-row">
              <button
                className="button button-secondary"
                disabled={loading === "livestream-request" || !activeChartAddress.trim()}
                onClick={() => void createLivestreamCheckout()}
                type="button"
              >
                {loading === "livestream-request"
                  ? "Creating memo..."
                  : "Create chart payment"}
              </button>
            </div>

            {checkout ? (
              <div className="checkout-card">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Current job</p>
                    <h2>{checkout.tier === "priority" ? "Priority" : "Standard"} request</h2>
                  </div>
                  <div className="source-pill">{checkout.status}</div>
                </div>

                <div className="history-list">
                  <div className="history-item">
                    <div>
                      <span>Chart</span>
                      <strong>{shortenValue(checkout.contractAddress)}</strong>
                    </div>
                    <div>
                      <span>Amount</span>
                      <strong>{checkoutPriceSol} SOL</strong>
                    </div>
                  </div>
                  <div className="history-item">
                    <div>
                      <span>Memo</span>
                      <strong>{checkout.memo}</strong>
                    </div>
                    <div>
                      <span>Revenue wallet</span>
                      <strong>{shortenValue(livestreamState?.treasuryWallet)}</strong>
                    </div>
                  </div>
                  <div className="history-item">
                    <div>
                      <span>Session time</span>
                      <strong>{sessionMinutes} minutes</strong>
                    </div>
                    <div>
                      <span>Payment window</span>
                      <strong>{livestreamState?.paymentWindowSeconds || 900} sec</strong>
                    </div>
                  </div>
                </div>

                <label className="field">
                  <span>Transaction signature</span>
                  <input
                    value={signature}
                    onChange={(event) => setSignature(event.target.value)}
                    placeholder="Paste the Solana signature after payment"
                  />
                </label>

                <button
                  className="button button-primary"
                  disabled={loading === "livestream-verify" || !signature.trim()}
                  onClick={() => void verifyLivestreamCheckout()}
                  type="button"
                >
                  {loading === "livestream-verify" ? "Confirming..." : "Confirm payment"}
                </button>
              </div>
            ) : null}
          </section>
        ) : (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">Chart focus</p>
                <h2>Current token</h2>
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
                <p>Chart opens first. Trade controls stay below.</p>
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

            <dl className="detail-list compact">
              <div className="detail">
                <dt>Selected device</dt>
                <dd>{selectedDevice?.label || "Pick a saved device below before starting."}</dd>
              </div>
              <div className="detail">
                <dt>Page status</dt>
                <dd>
                  {publicStream?.isPublic
                    ? `Public page live at @${publicStream.slug}.`
                    : "Private until you publish it."}
                </dd>
              </div>
              <div className="detail">
                <dt>Stream</dt>
                <dd>{publicStream?.mediaUrl || publicMediaUrl || defaultMediaUrl}</dd>
              </div>
            </dl>
          </section>
        )}

        {isTokenControlPage ? (
          <AutonomousStatusPreviewPanel
            eyebrow="Agent status"
            title="GoonClaw status"
            description="Live status only."
          />
        ) : (
          <PublicChatPanel
            eyebrow="MyGoonClaw chat"
            title="Chat"
            description="Ask quick questions while you use the page."
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
                {isTokenControlPage ? "Room status" : "Your session"}
              </h2>
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Playback mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as SessionMode)}
                disabled={isTokenControlPage}
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
                  if (isTokenControlPage) {
                    return;
                  }
                  setContractAddress(event.target.value);
                }}
                placeholder={
                  isTokenControlPage
                    ? "Live room token"
                    : "Same token as GoonClaw"
                }
                readOnly={isTokenControlPage}
              />
            </label>
          </div>

          <p className="inline-note">
            {isTokenControlPage
              ? "This page shows the live room."
              : "MyGoonClaw follows the same token as GoonClaw."}
          </p>

          {!isTokenControlPage ? (
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
          ) : null}

          {isTokenControlPage && livestreamState?.current ? (
            <div className="session-card">
              <div>
                <span>Status</span>
                <strong>{livestreamState.current.status}</strong>
              </div>
              <div>
                <span>Tier</span>
                <strong>{livestreamState.current.tier}</strong>
              </div>
              <div>
                <span>Device</span>
                <strong>Autoblow relay</strong>
              </div>
              <div>
                <span>Contract</span>
                <strong>
                  {livestreamState.current.contractAddress.slice(0, 4)}...
                  {livestreamState.current.contractAddress.slice(-4)}
                </strong>
              </div>
            </div>
          ) : activeSession ? (
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
              {isTokenControlPage
                ? "No live session right now."
                : "No session yet. Save a setup and start when ready."}
            </p>
          )}

          <div className="route-badges">
            <StatusBadge
              tone={isTokenControlPage ? (livestreamState?.current ? "success" : "warning") : activeSession ? "success" : "warning"}
            >
              {isTokenControlPage
                ? livestreamState?.current
                  ? "Public session live"
                  : "Standby"
                : activeSession
                ? "Session live"
                : "Ready to start"}
            </StatusBadge>
            <StatusBadge tone="neutral">
              {isTokenControlPage
                ? "Revenue -> GoonClaw wallet"
                : selectedDevice
                  ? `${selectedDevice.type} selected`
                  : "No setup selected"}
            </StatusBadge>
          </div>

          {savedDevicesSection}

          {isTokenControlPage ? (
            <>
              <p className="panel-lead go-live-subsection">
                Technical session state for the public chart queue.
              </p>

              {livestreamState ? (
                <dl className="detail-list compact">
                  <div className="detail">
                    <dt>Session state</dt>
                    <dd>
                      {livestreamState.current
                        ? `${livestreamState.current.tier} job live on ${livestreamState.current.contractAddress}`
                        : "No paid chart job is active right now."}
                    </dd>
                  </div>
                  <div className="detail">
                    <dt>Pricing</dt>
                    <dd>
                      {livestreamState.standardPriceSol} SOL for {sessionMinutes} minutes.
                      Priority is {livestreamState.priorityPriceSol} SOL.
                    </dd>
                  </div>
                  <div className="detail">
                    <dt>Revenue wallet</dt>
                    <dd>{livestreamState.treasuryWallet}</dd>
                  </div>
                </dl>
              ) : null}

              <dl className="detail-list compact">
                <div className="detail">
                  <dt>Current token</dt>
                  <dd>{focusContractAddress}</dd>
                </div>
                <div className="detail">
                  <dt>Queue depth</dt>
                  <dd>{livestreamState?.queue.length || 0} waiting jobs.</dd>
                </div>
              </dl>
            </>
          ) : null}

          <div className="go-live-subsection">
            <div className="panel-header go-live-subheader">
              <div>
                <p className="eyebrow">{isTokenControlPage ? "Session jobs" : "Recent sessions"}</p>
                <h2>{isTokenControlPage ? "Queue and memos" : "Recent activity"}</h2>
              </div>
            </div>

            {isTokenControlPage ? (
              livestreamState?.queue.length || livestreamState?.recentRequests.length ? (
                <div className="history-list scroll-feed">
                  {livestreamState?.queue.map((item, index) => (
                    <div key={item.id} className="history-item">
                      <div>
                        <span>Queue #{index + 1}</span>
                        <strong>{shortenValue(item.contractAddress)}</strong>
                      </div>
                      <div>
                        <span>Tier</span>
                        <strong>{item.tier}</strong>
                      </div>
                      <div>
                        <span>Memo</span>
                        <strong>{item.memo}</strong>
                      </div>
                    </div>
                  ))}
                  {livestreamState?.recentRequests.map((item) => (
                    <div key={`recent-${item.id}`} className="history-item">
                      <div>
                        <span>{item.status}</span>
                        <strong>{shortenValue(item.contractAddress)}</strong>
                      </div>
                      <div>
                        <span>Tier</span>
                        <strong>{item.tier}</strong>
                      </div>
                      <div>
                        <span>Memo</span>
                        <strong>{item.memo}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="empty-state">
                  Job memos and queue items will appear here after the first chart payment.
                </p>
              )
            ) : sessions.length ? (
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
        {!isTokenControlPage ? (
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
        ) : (
          <AutonomousStatusPreviewPanel
            eyebrow="Public visibility"
            title="Read-only room"
            description="Watch the live room here."
          />
        )}
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
          Quick answers for this page.
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
