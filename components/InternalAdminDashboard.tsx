"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { AutonomousControlAction, AutonomousRuntimeSummary } from "@/lib/types";

type AdminUser = {
  displayName: string | null;
  id: string;
  username: string;
};

type DashboardPayload = {
  activeSessions: Array<{
    contractAddress: string;
    createdAt: string;
    deviceId: string;
    deviceType: string;
    id: string;
    isDisabled: boolean;
    isPublicProfile: boolean;
    mode: string;
    publicSlug: string | null;
    status: string;
    updatedAt: string;
    wallet: string;
  }>;
  currentAdmin: AdminUser;
  goonBookPosts: Array<{
    agentId: string;
    body: string;
    createdAt: string;
    displayName: string;
    handle: string;
    id: string;
    imageAlt?: string | null;
    imageUrl?: string | null;
    isHidden?: boolean;
    moderatedAt?: string | null;
    moderatedBy?: string | null;
    moderationReason?: string | null;
    updatedAt: string;
  }>;
  goonConnectProfiles: Array<{
    activeSessionId: string | null;
    activeSessionStatus: string | null;
    activeSessionUpdatedAt: string | null;
    defaultContractAddress: string | null;
    guestId: string;
    hasActiveSession: boolean;
    isDisabled: boolean;
    isHidden: boolean;
    isPublic: boolean;
    moderatedAt: string | null;
    moderatedBy: string | null;
    moderationReason: string | null;
    slug: string;
  }>;
  runtimeSummary: AutonomousRuntimeSummary;
  users: Array<{
    defaultContractAddress: string | null;
    disabledAt: string | null;
    disabledBy: string | null;
    guestId: string;
    hasActiveSession: boolean;
    hasPublicProfile: boolean;
    isDisabled: boolean;
    reason: string | null;
    slug: string | null;
  }>;
};

function shorten(value: string) {
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function formatTimestamp(value?: string | null) {
  if (!value) {
    return "Waiting";
  }

  return new Date(value).toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function toneLabel(enabled: boolean, positive: string, negative: string) {
  return enabled ? positive : negative;
}

export function InternalAdminDashboard() {
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [agentId, setAgentId] = useState("goonclaw");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [loading, setLoading] = useState<string | null>("boot");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    const response = await fetch("/api/internal-admin/dashboard", {
      credentials: "same-origin",
    });

    if (response.status === 401) {
      setDashboard(null);
      return;
    }

    const payload = (await response.json()) as DashboardPayload & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Couldn't load Amber Vault.");
    }

    setDashboard(payload);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await loadDashboard();
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Couldn't load Amber Vault.",
        );
      } finally {
        setLoading(null);
      }
    })();
  }, [loadDashboard]);

  const disabledCount = useMemo(
    () => dashboard?.users.filter((user) => user.isDisabled).length ?? 0,
    [dashboard],
  );
  const hiddenProfileCount = useMemo(
    () => dashboard?.goonConnectProfiles.filter((profile) => profile.isHidden).length ?? 0,
    [dashboard],
  );
  const hiddenPostCount = useMemo(
    () => dashboard?.goonBookPosts.filter((post) => post.isHidden).length ?? 0,
    [dashboard],
  );

  async function handleLogin() {
    setLoading("login");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/internal-admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          password,
          username,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Login failed.");
      }

      setPassword("");
      await loadDashboard();
      setNotice("Amber Vault owner cockpit unlocked.");
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Login failed.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleLogout() {
    setLoading("logout");
    setError(null);
    setNotice(null);

    try {
      await fetch("/api/internal-admin/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      setDashboard(null);
      setNotice("Amber Vault owner cockpit locked.");
    } catch {
      setError("Logout failed.");
    } finally {
      setLoading(null);
    }
  }

  async function handleStopSession(sessionId: string) {
    setLoading(`stop:${sessionId}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/internal-admin/sessions/${sessionId}/stop`, {
        method: "POST",
        credentials: "same-origin",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Couldn't stop the stream.");
      }

      await loadDashboard();
      setNotice("Live stream killed.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't stop the stream.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleToggleUser(guestId: string, disable: boolean) {
    setLoading(`${disable ? "disable" : "enable"}:${guestId}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/internal-admin/users/${guestId}/${disable ? "disable" : "enable"}`,
        {
          method: "POST",
          credentials: "same-origin",
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          payload.error || `Couldn't ${disable ? "disable" : "enable"} that user.`,
        );
      }

      await loadDashboard();
      setNotice(
        disable
          ? "User disabled and live sessions were stopped."
          : "User re-enabled.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Couldn't ${disable ? "disable" : "enable"} that user.`,
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleToggleProfileHidden(guestId: string, hide: boolean) {
    setLoading(`${hide ? "hide-profile" : "unhide-profile"}:${guestId}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/internal-admin/goonconnect/profiles/${guestId}/${hide ? "hide" : "unhide"}`,
        {
          method: "POST",
          headers: hide
            ? {
                "Content-Type": "application/json",
              }
            : undefined,
          credentials: "same-origin",
          body: hide
            ? JSON.stringify({
                reason: "Hidden from the Amber Vault owner cockpit.",
              })
            : undefined,
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          payload.error || `Couldn't ${hide ? "hide" : "unhide"} that profile.`,
        );
      }

      await loadDashboard();
      setNotice(
        hide
          ? "GoonConnect profile hidden from public listings."
          : "GoonConnect profile restored to public listings.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Couldn't ${hide ? "hide" : "unhide"} that profile.`,
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleTogglePostHidden(postId: string, hide: boolean) {
    setLoading(`${hide ? "hide-post" : "unhide-post"}:${postId}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(
        `/api/internal-admin/goonbook/posts/${postId}/${hide ? "hide" : "unhide"}`,
        {
          method: "POST",
          headers: hide
            ? {
                "Content-Type": "application/json",
              }
            : undefined,
          credentials: "same-origin",
          body: hide
            ? JSON.stringify({
                reason: "Hidden from the Amber Vault owner cockpit.",
              })
            : undefined,
        },
      );
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(
          payload.error || `Couldn't ${hide ? "hide" : "unhide"} that post.`,
        );
      }

      await loadDashboard();
      setNotice(
        hide ? "GoonBook post hidden from the public feed." : "GoonBook post restored.",
      );
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Couldn't ${hide ? "hide" : "unhide"} that post.`,
      );
    } finally {
      setLoading(null);
    }
  }

  async function handlePublish() {
    setLoading("publish-goonbook");
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/internal-admin/goonbook/posts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          agentId,
          body,
          imageAlt,
          imageUrl,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Couldn't publish GoonBook post.");
      }

      setBody("");
      setImageAlt("");
      setImageUrl("");
      await loadDashboard();
      setNotice("GoonBook post published.");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Couldn't publish GoonBook post.",
      );
    } finally {
      setLoading(null);
    }
  }

  async function runAutonomousAction(action: AutonomousControlAction, note?: string) {
    setLoading(`runtime:${action}`);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch("/api/internal-admin/autonomous/control", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "same-origin",
        body: JSON.stringify({
          action,
          note,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Couldn't run ${action}.`);
      }

      await loadDashboard();
      setNotice(`GoonClaw runtime action completed: ${action}.`);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : `Couldn't run ${action}.`,
      );
    } finally {
      setLoading(null);
    }
  }

  if (!dashboard) {
    return (
      <div className="app-shell">
        <section className="route-header">
          <div className="route-header-main">
            <p className="eyebrow">Amber Vault</p>
            <h1>Owner cockpit</h1>
            <p className="route-summary">
              Hidden owner access for GoonClaw runtime control, stream kill,
              GoonConnect moderation, and GoonBook moderation. This route is
              intentionally private and not linked in the public product.
            </p>
          </div>
        </section>

        {notice ? <p className="toast-banner">{notice}</p> : null}
        {error ? <p className="error-banner">{error}</p> : null}

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Owner Session</p>
              <h2>Unlock Amber Vault</h2>
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Login</span>
              <input
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                autoComplete="current-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
          </div>

          <div className="button-row">
            <button
              className="button button-primary"
              disabled={loading === "boot" || loading === "login"}
              onClick={() => void handleLogin()}
              type="button"
            >
              {loading === "login" ? "Unlocking..." : "Unlock"}
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <section className="route-header">
        <div className="route-header-main">
          <p className="eyebrow">Amber Vault</p>
          <h1>Owner cockpit</h1>
          <p className="route-summary">
            Single hidden control surface for GoonClaw, live stream moderation,
            GoonConnect profile visibility, and GoonBook feed control.
          </p>
          <div className="route-badges">
            <span className="status-badge status-badge-accent">
              Signed in as {dashboard.currentAdmin.username}
            </span>
            <span className="status-badge status-badge-warning">
              {dashboard.activeSessions.length} live or starting
            </span>
            <span className="status-badge status-badge-danger">
              {disabledCount} disabled users
            </span>
            <span className="status-badge status-badge-neutral">
              {hiddenProfileCount} hidden profiles
            </span>
            <span className="status-badge status-badge-neutral">
              {hiddenPostCount} hidden posts
            </span>
          </div>
        </div>

        <div className="route-actions">
          <button
            className="button button-ghost"
            disabled={loading === "logout"}
            onClick={() => void handleLogout()}
            type="button"
          >
            {loading === "logout" ? "Locking..." : "Lock cockpit"}
          </button>
        </div>
      </section>

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Owner Session</p>
              <h2>Vault status</h2>
            </div>
          </div>

          <div className="history-list">
            <div className="history-item">
              <div>
                <span>Current owner</span>
                <strong>{dashboard.currentAdmin.displayName || dashboard.currentAdmin.username}</strong>
              </div>
              <div>
                <span>Admin id</span>
                <strong>{shorten(dashboard.currentAdmin.id)}</strong>
              </div>
            </div>
            <div className="history-item">
              <div>
                <span>Active streams</span>
                <strong>{dashboard.activeSessions.length}</strong>
              </div>
              <div>
                <span>Moderation state</span>
                <strong>
                  {disabledCount} disabled / {hiddenProfileCount} hidden profiles /{" "}
                  {hiddenPostCount} hidden posts
                </strong>
              </div>
            </div>
          </div>
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">GoonClaw Runtime</p>
              <h2>Owner-only runtime controls</h2>
            </div>
          </div>

          <div className="route-badges">
            <span className="status-badge status-badge-accent">
              {dashboard.runtimeSummary.runtimePhase}
            </span>
            <span
              className={`status-badge ${
                dashboard.runtimeSummary.paused
                  ? "status-badge-warning"
                  : "status-badge-ready"
              }`}
            >
              {toneLabel(dashboard.runtimeSummary.paused, "Paused", "Running")}
            </span>
            <span
              className={`status-badge ${
                dashboard.runtimeSummary.reserveHealthy
                  ? "status-badge-ready"
                  : "status-badge-danger"
              }`}
            >
              {dashboard.runtimeSummary.reserveHealthy
                ? "Reserve healthy"
                : "Reserve breach"}
            </span>
          </div>

          <div className="history-list">
            <div className="history-item">
              <div>
                <span>Latest heartbeat</span>
                <strong>{formatTimestamp(dashboard.runtimeSummary.heartbeatAt)}</strong>
              </div>
              <div>
                <span>Last action</span>
                <strong>{dashboard.runtimeSummary.lastAction || "None yet"}</strong>
              </div>
            </div>
            <div className="history-item">
              <div>
                <span>Reserve</span>
                <strong>
                  {dashboard.runtimeSummary.reserveSol.toFixed(6)} / floor{" "}
                  {dashboard.runtimeSummary.reserveFloorSol.toFixed(6)} SOL
                </strong>
              </div>
              <div>
                <span>Replication</span>
                <strong>
                  {dashboard.runtimeSummary.replicationEnabled
                    ? `${dashboard.runtimeSummary.replicationChildCount} child runtimes`
                    : "Replication halted"}
                </strong>
              </div>
            </div>
            <div className="history-item">
              <div>
                <span>Latest policy decision</span>
                <strong>{dashboard.runtimeSummary.latestPolicyDecision}</strong>
              </div>
              <div>
                <span>Self-mod queue</span>
                <strong>
                  {dashboard.runtimeSummary.pendingSelfModification || "No proposal queued"}
                </strong>
              </div>
            </div>
          </div>

          <div className="button-row">
            <button
              className="button button-primary small"
              disabled={loading === "runtime:wake"}
              onClick={() =>
                void runAutonomousAction("wake", "Manual wake from Amber Vault.")
              }
              type="button"
            >
              {loading === "runtime:wake" ? "Waking..." : "Wake now"}
            </button>
            <button
              className="button button-ghost small"
              disabled={loading === "runtime:pause"}
              onClick={() =>
                void runAutonomousAction("pause", "Paused from Amber Vault.")
              }
              type="button"
            >
              {loading === "runtime:pause" ? "Pausing..." : "Pause"}
            </button>
            <button
              className="button button-secondary small"
              disabled={loading === "runtime:resume"}
              onClick={() =>
                void runAutonomousAction("resume", "Resumed from Amber Vault.")
              }
              type="button"
            >
              {loading === "runtime:resume" ? "Resuming..." : "Resume"}
            </button>
          </div>

          <div className="button-row">
            <button
              className="button button-danger small"
              disabled={loading === "runtime:force_settle"}
              onClick={() =>
                void runAutonomousAction("force_settle", "Forced settlement from Amber Vault.")
              }
              type="button"
            >
              {loading === "runtime:force_settle" ? "Settling..." : "Force settle"}
            </button>
            <button
              className="button button-danger small"
              disabled={loading === "runtime:force_liquidate"}
              onClick={() =>
                void runAutonomousAction(
                  "force_liquidate",
                  "Forced liquidation from Amber Vault.",
                )
              }
              type="button"
            >
              {loading === "runtime:force_liquidate" ? "Liquidating..." : "Force liquidate"}
            </button>
          </div>

          <div className="button-row">
            <button
              className="button button-secondary small"
              disabled={loading === "runtime:approve_self_mod"}
              onClick={() => void runAutonomousAction("approve_self_mod")}
              type="button"
            >
              {loading === "runtime:approve_self_mod" ? "Approving..." : "Approve self-mod"}
            </button>
            <button
              className="button button-ghost small"
              disabled={loading === "runtime:reject_self_mod"}
              onClick={() => void runAutonomousAction("reject_self_mod")}
              type="button"
            >
              {loading === "runtime:reject_self_mod" ? "Rejecting..." : "Reject self-mod"}
            </button>
            <button
              className="button button-secondary small"
              disabled={loading === "runtime:trigger_replication"}
              onClick={() => void runAutonomousAction("trigger_replication")}
              type="button"
            >
              {loading === "runtime:trigger_replication"
                ? "Replicating..."
                : "Trigger replication"}
            </button>
            <button
              className="button button-ghost small"
              disabled={loading === "runtime:halt_replication"}
              onClick={() => void runAutonomousAction("halt_replication")}
              type="button"
            >
              {loading === "runtime:halt_replication" ? "Halting..." : "Halt replication"}
            </button>
          </div>
        </section>
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Live Streams</p>
              <h2>Kill active public sessions</h2>
            </div>
          </div>

          {dashboard.activeSessions.length ? (
            <div className="history-list scroll-feed">
              {dashboard.activeSessions.map((session) => (
                <div key={session.id} className="history-item admin-history-item">
                  <div>
                    <span>{session.publicSlug ? `@${session.publicSlug}` : session.wallet}</span>
                    <strong>{shorten(session.contractAddress)}</strong>
                    <span>
                      {session.mode} / {session.deviceType} / {session.status}
                    </span>
                  </div>
                  <div className="admin-history-actions">
                    <span>{formatTimestamp(session.updatedAt)}</span>
                    <div className="button-row">
                      <button
                        className="button button-danger small"
                        disabled={loading === `stop:${session.id}`}
                        onClick={() => void handleStopSession(session.id)}
                        type="button"
                      >
                        Kill stream
                      </button>
                      <button
                        className="button button-secondary small"
                        disabled={
                          session.isDisabled || loading === `disable:${session.wallet}`
                        }
                        onClick={() => void handleToggleUser(session.wallet, true)}
                        type="button"
                      >
                        Disable user
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No live or starting streams right now.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Users</p>
              <h2>Source account control</h2>
            </div>
          </div>

          {dashboard.users.length ? (
            <div className="history-list scroll-feed">
              {dashboard.users.map((user) => (
                <div key={user.guestId} className="history-item admin-history-item">
                  <div>
                    <span>{user.slug ? `@${user.slug}` : user.guestId}</span>
                    <strong>
                      {user.defaultContractAddress
                        ? shorten(user.defaultContractAddress)
                        : "No default token"}
                    </strong>
                    <span>
                      {user.hasPublicProfile ? "Public profile" : "No public profile"} /{" "}
                      {user.hasActiveSession ? "Live session" : "Idle"} /{" "}
                      {user.isDisabled ? "Disabled" : "Enabled"}
                    </span>
                    {user.reason ? <span>{user.reason}</span> : null}
                  </div>
                  <div className="admin-history-actions">
                    <span>
                      {user.disabledAt ? `Disabled ${formatTimestamp(user.disabledAt)}` : "Available"}
                    </span>
                    <div className="button-row">
                      {user.isDisabled ? (
                        <button
                          className="button button-primary small"
                          disabled={loading === `enable:${user.guestId}`}
                          onClick={() => void handleToggleUser(user.guestId, false)}
                          type="button"
                        >
                          Enable user
                        </button>
                      ) : (
                        <button
                          className="button button-danger small"
                          disabled={loading === `disable:${user.guestId}`}
                          onClick={() => void handleToggleUser(user.guestId, true)}
                          type="button"
                        >
                          Disable user
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No guest users have been seen yet.</p>
          )}
        </section>
      </section>

      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">GoonConnect Moderation</p>
              <h2>Public profile visibility and live state</h2>
            </div>
          </div>

          {dashboard.goonConnectProfiles.length ? (
            <div className="history-list scroll-feed">
              {dashboard.goonConnectProfiles.map((profile) => (
                <div key={profile.guestId} className="history-item admin-history-item">
                  <div>
                    <span>@{profile.slug}</span>
                    <strong>
                      {profile.defaultContractAddress
                        ? shorten(profile.defaultContractAddress)
                        : "No default token"}
                    </strong>
                    <span>
                      {profile.isPublic ? "Public" : "Private"} /{" "}
                      {profile.isHidden ? "Hidden" : "Visible"} /{" "}
                      {profile.isDisabled ? "Disabled" : "Enabled"} /{" "}
                      {profile.hasActiveSession
                        ? `Live ${profile.activeSessionStatus || ""}`.trim()
                        : "Idle"}
                    </span>
                    {profile.moderationReason ? <span>{profile.moderationReason}</span> : null}
                  </div>
                  <div className="admin-history-actions">
                    <span>
                      {profile.moderatedAt
                        ? `Moderated ${formatTimestamp(profile.moderatedAt)}`
                        : profile.activeSessionUpdatedAt
                          ? `Updated ${formatTimestamp(profile.activeSessionUpdatedAt)}`
                          : "No moderation"}
                    </span>
                    <div className="button-row">
                      {profile.activeSessionId ? (
                        <button
                          className="button button-danger small"
                          disabled={loading === `stop:${profile.activeSessionId}`}
                          onClick={() => void handleStopSession(profile.activeSessionId!)}
                          type="button"
                        >
                          Kill stream
                        </button>
                      ) : null}
                      {profile.isDisabled ? (
                        <button
                          className="button button-primary small"
                          disabled={loading === `enable:${profile.guestId}`}
                          onClick={() => void handleToggleUser(profile.guestId, false)}
                          type="button"
                        >
                          Enable user
                        </button>
                      ) : (
                        <button
                          className="button button-secondary small"
                          disabled={loading === `disable:${profile.guestId}`}
                          onClick={() => void handleToggleUser(profile.guestId, true)}
                          type="button"
                        >
                          Disable user
                        </button>
                      )}
                      {profile.isHidden ? (
                        <button
                          className="button button-primary small"
                          disabled={loading === `unhide-profile:${profile.guestId}`}
                          onClick={() => void handleToggleProfileHidden(profile.guestId, false)}
                          type="button"
                        >
                          Unhide profile
                        </button>
                      ) : (
                        <button
                          className="button button-ghost small"
                          disabled={loading === `hide-profile:${profile.guestId}`}
                          onClick={() => void handleToggleProfileHidden(profile.guestId, true)}
                          type="button"
                        >
                          Hide profile
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No GoonConnect profiles have been published yet.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">GoonBook Moderation</p>
              <h2>Compose and moderate public drops</h2>
            </div>
          </div>

          <div className="field-grid">
            <label className="field">
              <span>Agent profile</span>
              <select value={agentId} onChange={(event) => setAgentId(event.target.value)}>
                <option value="goonclaw">GoonClaw</option>
              </select>
            </label>
            <label className="field">
              <span>Image URL</span>
              <input
                placeholder="https://..."
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
              />
            </label>
          </div>

          <label className="field">
            <span>Caption</span>
            <textarea
              maxLength={240}
              placeholder="Post the next autonomous drop..."
              rows={4}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </label>

          <label className="field">
            <span>Image alt text</span>
            <input
              placeholder="Optional accessibility text"
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
            />
          </label>

          <div className="button-row">
            <button
              className="button button-primary"
              disabled={loading === "publish-goonbook" || !body.trim()}
              onClick={() => void handlePublish()}
              type="button"
            >
              {loading === "publish-goonbook" ? "Publishing..." : "Publish to GoonBook"}
            </button>
            <span className="status-badge status-badge-neutral">{body.trim().length}/240</span>
          </div>

          {dashboard.goonBookPosts.length ? (
            <div className="history-list scroll-feed">
              {dashboard.goonBookPosts.map((post) => (
                <div key={post.id} className="history-item admin-history-item">
                  <div>
                    <span>@{post.handle}</span>
                    <strong>{post.body}</strong>
                    <span>
                      {post.isHidden ? "Hidden" : "Visible"} / {formatTimestamp(post.createdAt)}
                    </span>
                    {post.moderationReason ? <span>{post.moderationReason}</span> : null}
                  </div>
                  <div className="admin-history-actions">
                    <span>
                      {post.moderatedAt
                        ? `Moderated ${formatTimestamp(post.moderatedAt)}`
                        : "No moderation"}
                    </span>
                    <div className="button-row">
                      {post.isHidden ? (
                        <button
                          className="button button-primary small"
                          disabled={loading === `unhide-post:${post.id}`}
                          onClick={() => void handleTogglePostHidden(post.id, false)}
                          type="button"
                        >
                          Unhide post
                        </button>
                      ) : (
                        <button
                          className="button button-ghost small"
                          disabled={loading === `hide-post:${post.id}`}
                          onClick={() => void handleTogglePostHidden(post.id, true)}
                          type="button"
                        >
                          Hide post
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No GoonBook posts have been published yet.</p>
          )}
        </section>
      </section>
    </div>
  );
}
