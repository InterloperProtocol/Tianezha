"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBurnCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { PriceChart } from "@/components/PriceChart";
import {
  DEFAULT_ACCESS_TOKEN_SYMBOL,
  DEFAULT_PUMP_TOKEN_MINT,
} from "@/lib/token-defaults";
import {
  DeviceCredentials,
  DeviceType,
  EntitlementRecord,
  SanitizedDeviceProfile,
  SessionMode,
  SessionRecord,
} from "@/lib/types";

type PublicConfig = {
  appName: string;
  rpcUrl: string;
  treasuryWallet: string;
  accessPriceSol: string;
  accessTokenSymbol?: string;
  burnMint: string;
  burnAmountRaw: string;
  burnDecimals: string;
};

type EntitlementResponse = {
  authenticated: boolean;
  hasAccess: boolean;
  wallet?: string;
  entitlement?: EntitlementRecord | null;
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

const initialDeviceState: DeviceFormState = {
  type: "autoblow",
  label: "",
  deviceToken: "",
  connectionKey: "",
  endpointUrl: "",
  authToken: "",
  authHeaderName: "Authorization",
};

export function AppClient({ config }: { config: PublicConfig }) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const accessTokenSymbol = config.accessTokenSymbol ?? DEFAULT_ACCESS_TOKEN_SYMBOL;
  const [entitlement, setEntitlement] = useState<EntitlementResponse>({
    authenticated: false,
    hasAccess: false,
  });
  const [devices, setDevices] = useState<SanitizedDeviceProfile[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [deviceForm, setDeviceForm] = useState<DeviceFormState>(initialDeviceState);
  const [contractAddress, setContractAddress] = useState(
    DEFAULT_PUMP_TOKEN_MINT,
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [mode, setMode] = useState<SessionMode>("live");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

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

  const refreshEntitlement = useCallback(async () => {
    const response = await fetch("/api/entitlements/status");
    const payload = (await response.json()) as EntitlementResponse;
    setEntitlement(payload);
  }, []);

  const refreshDevices = useCallback(async () => {
    const response = await fetch("/api/devices");
    if (!response.ok) return;
    const payload = (await response.json()) as {
      items: SanitizedDeviceProfile[];
    };
    setDevices(payload.items);
    if (!selectedDeviceId && payload.items[0]) {
      setSelectedDeviceId(payload.items[0].id);
    }
  }, [selectedDeviceId]);

  const refreshSessions = useCallback(async () => {
    const response = await fetch("/api/sessions");
    if (!response.ok) return;
    const payload = (await response.json()) as { items: SessionRecord[] };
    setSessions(payload.items);
  }, []);

  useEffect(() => {
    void refreshEntitlement();
  }, [refreshEntitlement]);

  useEffect(() => {
    if (!entitlement.authenticated || !entitlement.hasAccess) return;
    void refreshDevices();
    void refreshSessions();
    const interval = window.setInterval(() => void refreshSessions(), 4_000);
    return () => window.clearInterval(interval);
  }, [
    entitlement.authenticated,
    entitlement.hasAccess,
    refreshDevices,
    refreshSessions,
  ]);

  async function signWalletSession() {
    if (!wallet.publicKey || !wallet.signMessage) {
      setMessage("Connect a wallet that supports signing.");
      return;
    }

    try {
      setLoading("auth");
      const nonceResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: wallet.publicKey.toBase58() }),
      });
      const noncePayload = (await nonceResponse.json()) as {
        message: string;
        error?: string;
      };
      if (!nonceResponse.ok) {
        throw new Error(
          noncePayload.error || "Failed to create sign-in challenge",
        );
      }

      const signature = await wallet.signMessage(
        new TextEncoder().encode(noncePayload.message),
      );
      const signatureBase58 = await import("bs58").then((module) =>
        module.default.encode(signature),
      );
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: wallet.publicKey.toBase58(),
          message: noncePayload.message,
          signature: signatureBase58,
        }),
      });
      const verifyPayload = (await verifyResponse.json()) as { error?: string };
      if (!verifyResponse.ok) {
        throw new Error(verifyPayload.error || "Wallet sign-in failed");
      }

      setMessage("Wallet session created.");
      await refreshEntitlement();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Wallet sign-in failed",
      );
    } finally {
      setLoading(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setEntitlement({ authenticated: false, hasAccess: false });
    setDevices([]);
    setSessions([]);
    setMessage("Signed out.");
  }

  async function handlePurchase() {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setMessage("Connect a wallet first.");
      return;
    }

    try {
      setLoading("purchase");
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: new PublicKey(config.treasuryWallet),
          lamports: Math.round(Number(config.accessPriceSol) * LAMPORTS_PER_SOL),
        }),
      );
      const signature = await wallet.sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      const response = await fetch("/api/entitlements/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Access purchase failed");
      }

      await refreshEntitlement();
      setMessage("Access cNFT minted and entitlement activated.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Access purchase failed",
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleBurnUnlock() {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      setMessage("Connect a wallet first.");
      return;
    }

    if (!config.burnMint) {
      setMessage("Burn mint is not configured.");
      return;
    }

    try {
      setLoading("burn");
      const mint = new PublicKey(config.burnMint);
      const owner = wallet.publicKey;
      const ownerAta = getAssociatedTokenAddressSync(mint, owner);
      const burnIx = createBurnCheckedInstruction(
        ownerAta,
        mint,
        owner,
        BigInt(config.burnAmountRaw),
        Number(config.burnDecimals),
      );
      const transaction = new Transaction().add(burnIx);
      const signature = await wallet.sendTransaction(transaction, connection);
      await connection.confirmTransaction(signature, "confirmed");

      const response = await fetch("/api/entitlements/burn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Burn unlock failed");
      }

      await refreshEntitlement();
      setMessage("Burn verified and permanent access unlocked.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Burn unlock failed",
      );
    } finally {
      setLoading(null);
    }
  }

  async function saveDeviceProfile() {
    try {
      setLoading("device");
      const credentials: DeviceCredentials =
        deviceForm.type === "autoblow"
          ? { deviceToken: deviceForm.deviceToken }
          : deviceForm.type === "handy"
            ? { connectionKey: deviceForm.connectionKey }
            : {
                endpointUrl: deviceForm.endpointUrl,
                authToken: deviceForm.authToken,
                authHeaderName: deviceForm.authHeaderName,
              };

      const response = await fetch("/api/devices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: deviceForm.type,
          label: deviceForm.label,
          credentials,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        item?: SanitizedDeviceProfile;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to save device");
      }

      setDeviceForm(initialDeviceState);
      setSelectedDeviceId(payload.item?.id ?? "");
      setMessage("Device profile saved.");
      await refreshDevices();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to save device",
      );
    } finally {
      setLoading(null);
    }
  }

  async function testDevice(deviceId: string) {
    try {
      setLoading(`test:${deviceId}`);
      const response = await fetch(`/api/devices/${deviceId}/test`, {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Device test failed");
      }
      setMessage("Device credentials verified.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Device test failed",
      );
    } finally {
      setLoading(null);
    }
  }

  async function startSession() {
    if (!selectedDevice) {
      setMessage("Save a device profile first.");
      return;
    }
    if (mode === "script" && !selectedDevice.supportsScript) {
      setMessage("This device only supports live mode.");
      return;
    }

    try {
      setLoading("session");
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractAddress,
          deviceId: selectedDevice.id,
          mode,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Failed to start session");
      }
      setMessage("Session started.");
      await refreshSessions();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to start session",
      );
    } finally {
      setLoading(null);
    }
  }

  async function stopSession(sessionId: string) {
    try {
      setLoading(`stop:${sessionId}`);
      await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
      await refreshSessions();
      setMessage("Session stopped.");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Failed to stop session",
      );
    } finally {
      setLoading(null);
    }
  }

  const showSignButton =
    wallet.publicKey &&
    (!entitlement.authenticated ||
      entitlement.wallet !== wallet.publicKey.toBase58());

  return (
    <main className="app-shell">
      <div className="ambient ambient-a" />
      <div className="ambient ambient-b" />

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Private Device Sync</p>
          <h1>{config.appName}</h1>
          <p className="hero-summary">
            Sync a Solana token chart to Autoblow, Handy, or any API-capable
            device with live motion or generated funscript playback. No browser
            extensions. No livestream plumbing. Just wallet-gated private
            control.
          </p>
          <div className="hero-badges">
            <span>Firebase App Hosting</span>
            <span>Google Cloud Worker</span>
            <span>Solana Gated Access</span>
          </div>
        </div>

        <div className="hero-actions">
          <WalletMultiButton />
          {showSignButton ? (
            <button
              className="button button-primary"
              onClick={signWalletSession}
              disabled={loading === "auth"}
            >
              {loading === "auth" ? "Signing..." : "Sign Wallet Session"}
            </button>
          ) : null}
          {entitlement.authenticated ? (
            <button className="button button-ghost" onClick={logout}>
              Sign Out
            </button>
          ) : null}
        </div>
      </section>

      {message ? <div className="toast-banner">{message}</div> : null}

      {!entitlement.hasAccess ? (
        <section className="gate-grid">
          <article className="panel gate-panel">
            <p className="eyebrow">Access Pass</p>
            <h2>Mint a permanent cNFT</h2>
            <p>
              Pay <strong>{config.accessPriceSol} SOL</strong> and mint a
              GoonClaw access cNFT to the connected wallet. Access stays
              active while that wallet holds the pass.
            </p>
            <button
              className="button button-primary"
              onClick={handlePurchase}
              disabled={loading === "purchase" || !entitlement.authenticated}
            >
              {loading === "purchase" ? "Minting..." : "Buy Access cNFT"}
            </button>
          </article>

          <article className="panel gate-panel secondary">
            <p className="eyebrow">Token Burn</p>
            <h2>Burn 100,000 {accessTokenSymbol}</h2>
            <p>
              Burn{" "}
              <strong>
                {Number(config.burnAmountRaw) / 10 ** Number(config.burnDecimals)}
              </strong>{" "}
              {accessTokenSymbol} from the connected wallet to unlock permanent access
              without buying the cNFT.
            </p>
            <button
              className="button button-secondary"
              onClick={handleBurnUnlock}
              disabled={
                loading === "burn" ||
                !entitlement.authenticated ||
                !config.burnMint
              }
            >
              {loading === "burn" ? "Burning..." : "Burn for Unlock"}
            </button>
          </article>
        </section>
      ) : (
        <section className="dashboard-grid">
          <div className="dashboard-column">
            <section className="panel control-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Session</p>
                  <h2>Start a sync run</h2>
                </div>
                <div className="source-pill">
                  <span className="status-dot" />
                  {entitlement.entitlement?.type === "cnft"
                    ? "cNFT access"
                    : "burn access"}
                </div>
              </div>

              <label className="field">
                <span>Contract address</span>
                <input
                  value={contractAddress}
                  onChange={(event) => setContractAddress(event.target.value)}
                />
              </label>

              <div className="field-grid">
                <label className="field">
                  <span>Device</span>
                  <select
                    value={selectedDeviceId}
                    onChange={(event) => setSelectedDeviceId(event.target.value)}
                  >
                    <option value="">Choose a device</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.label} · {device.type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Motion mode</span>
                  <select
                    value={mode}
                    onChange={(event) =>
                      setMode(event.target.value as SessionMode)
                    }
                  >
                    <option value="live">Live Engine</option>
                    <option
                      value="script"
                      disabled={selectedDevice ? !selectedDevice.supportsScript : false}
                    >
                      Generated Script
                    </option>
                  </select>
                </label>
              </div>

              <div className="button-row">
                <button
                  className="button button-primary"
                  onClick={startSession}
                  disabled={loading === "session" || !selectedDeviceId}
                >
                  {loading === "session" ? "Starting..." : "Start Session"}
                </button>
                {activeSession ? (
                  <button
                    className="button button-danger"
                    onClick={() => void stopSession(activeSession.id)}
                  >
                    Stop Active Session
                  </button>
                ) : null}
              </div>

              {activeSession ? (
                <div className="session-card">
                  <div>
                    <span>Active</span>
                    <strong>
                      {activeSession.contractAddress.slice(0, 4)}...
                      {activeSession.contractAddress.slice(-4)}
                    </strong>
                  </div>
                  <div>
                    <span>Mode</span>
                    <strong>{activeSession.mode}</strong>
                  </div>
                  <div>
                    <span>Device</span>
                    <strong>{activeSession.deviceType}</strong>
                  </div>
                  <div>
                    <span>Snapshot</span>
                    <strong>
                      {activeSession.snapshot
                        ? `${activeSession.snapshot.speed}% · ${activeSession.snapshot.amplitude}%`
                        : "warming up"}
                    </strong>
                  </div>
                </div>
              ) : null}
            </section>

            <section className="panel device-panel">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">Devices</p>
                  <h2>Saved connectors</h2>
                </div>
              </div>

              <div className="device-list">
                {devices.map((device) => (
                  <article
                    key={device.id}
                    className={`device-item ${
                      selectedDeviceId === device.id ? "selected" : ""
                    }`}
                  >
                    <button
                      className="device-pick"
                      onClick={() => setSelectedDeviceId(device.id)}
                    >
                      <div>
                        <strong>{device.label}</strong>
                        <span>{device.type}</span>
                      </div>
                      <div className="device-flags">
                        <span>{device.supportsLive ? "Live" : "No live"}</span>
                        <span>
                          {device.supportsScript ? "Script" : "Live only"}
                        </span>
                      </div>
                    </button>
                    <button
                      className="button button-ghost small"
                      onClick={() => void testDevice(device.id)}
                      disabled={loading === `test:${device.id}`}
                    >
                      {loading === `test:${device.id}` ? "Testing..." : "Test"}
                    </button>
                  </article>
                ))}
                {!devices.length ? (
                  <p className="empty-state">No device profiles yet.</p>
                ) : null}
              </div>

              <div className="device-form">
                <div className="field-grid">
                  <label className="field">
                    <span>Type</span>
                    <select
                      value={deviceForm.type}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          type: event.target.value as DeviceType,
                        }))
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
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>

                {deviceForm.type === "autoblow" ? (
                  <label className="field">
                    <span>Autoblow device token</span>
                    <input
                      value={deviceForm.deviceToken}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          deviceToken: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}

                {deviceForm.type === "handy" ? (
                  <label className="field">
                    <span>Handy connection key</span>
                    <input
                      value={deviceForm.connectionKey}
                      onChange={(event) =>
                        setDeviceForm((current) => ({
                          ...current,
                          connectionKey: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}

                {deviceForm.type === "rest" ? (
                  <>
                    <label className="field">
                      <span>Endpoint URL</span>
                      <input
                        value={deviceForm.endpointUrl}
                        onChange={(event) =>
                          setDeviceForm((current) => ({
                            ...current,
                            endpointUrl: event.target.value,
                          }))
                        }
                      />
                    </label>

                    <div className="field-grid">
                      <label className="field">
                        <span>Auth header name</span>
                        <input
                          value={deviceForm.authHeaderName}
                          onChange={(event) =>
                            setDeviceForm((current) => ({
                              ...current,
                              authHeaderName: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="field">
                        <span>Auth token</span>
                        <input
                          value={deviceForm.authToken}
                          onChange={(event) =>
                            setDeviceForm((current) => ({
                              ...current,
                              authToken: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  </>
                ) : null}

                <button
                  className="button button-secondary"
                  onClick={saveDeviceProfile}
                  disabled={loading === "device"}
                >
                  {loading === "device" ? "Saving..." : "Save Device"}
                </button>
              </div>
            </section>
          </div>

          <div className="dashboard-column wide">
            <PriceChart contractAddress={contractAddress} />

            <section className="panel session-log">
              <div className="panel-header">
                <div>
                  <p className="eyebrow">History</p>
                  <h2>Session ledger</h2>
                </div>
              </div>
              <div className="history-list">
                {sessions.map((session) => (
                  <article key={session.id} className="history-item">
                    <div>
                      <strong>
                        {session.contractAddress.slice(0, 4)}...
                        {session.contractAddress.slice(-4)}
                      </strong>
                      <span>
                        {session.mode} · {session.deviceType}
                      </span>
                    </div>
                    <div>
                      <strong>{session.status}</strong>
                      <span>{new Date(session.updatedAt).toLocaleString()}</span>
                    </div>
                  </article>
                ))}
                {!sessions.length ? (
                  <p className="empty-state">No session history yet.</p>
                ) : null}
              </div>
            </section>
          </div>
        </section>
      )}
    </main>
  );
}
