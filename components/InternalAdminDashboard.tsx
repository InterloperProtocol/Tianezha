"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AdminUser = {
  displayName: string | null;
  id: string;
  username: string;
};

type AdminSession = {
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

export function InternalAdminDashboard() {
  const [dashboard, setDashboard] = useState<AdminSession | null>(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
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

    const payload = (await response.json()) as AdminSession & { error?: string };
    if (!response.ok) {
      throw new Error(payload.error || "Couldn't load the hidden admin dashboard.");
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
            : "Couldn't load the hidden admin dashboard.",
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
      setNotice("Hidden admin dashboard unlocked.");
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
      setNotice("Hidden admin dashboard locked.");
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
      setNotice("Stream stopped.");
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
          payload.error ||
            `Couldn't ${disable ? "disable" : "enable"} that user.`,
        );
      }

      await loadDashboard();
      setNotice(
        disable
          ? "User disabled and any live stream was stopped."
          : "User enabled again.",
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

  if (!dashboard) {
    return (
      <div className="app-shell">
        <section className="route-header">
          <div className="route-header-main">
            <p className="eyebrow">Hidden Admin</p>
            <h1>Internal control room</h1>
            <p className="route-summary">
              Private moderation access for stopping live streams and disabling
              guest users. This route is intentionally not linked anywhere in
              the public product.
            </p>
          </div>
        </section>

        {notice ? <p className="toast-banner">{notice}</p> : null}
        {error ? <p className="error-banner">{error}</p> : null}

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Login</p>
              <h2>Unlock the hidden admin dashboard</h2>
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
          <p className="eyebrow">Hidden Admin</p>
          <h1>Internal control room</h1>
          <p className="route-summary">
            Stop any live stream, disable a guest user, and watch which public
            profiles are active without exposing moderation controls in the
            public site navigation.
          </p>
          <div className="route-badges">
            <span className="status-badge status-badge-accent">
              Signed in as {dashboard.currentAdmin.username}
            </span>
            <span className="status-badge status-badge-warning">
              {dashboard.activeSessions.length} live or starting
            </span>
            <span className="status-badge status-badge-danger">
              {disabledCount} disabled
            </span>
          </div>
        </div>

        <div className="route-actions">
          <button
            className="button button-ghost"
            disabled={loading === "logout"}
            onClick={() => void handleLogout()}
          >
            {loading === "logout" ? "Locking..." : "Lock dashboard"}
          </button>
        </div>
      </section>

      {notice ? <p className="toast-banner">{notice}</p> : null}
      {error ? <p className="error-banner">{error}</p> : null}

      <section className="dashboard-grid">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Streams</p>
              <h2>Live session control</h2>
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
                      {session.mode} · {session.deviceType} · {session.status}
                    </span>
                  </div>
                  <div className="admin-history-actions">
                    <span>
                      {new Date(session.updatedAt).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <div className="button-row">
                      <button
                        className="button button-danger small"
                        disabled={loading === `stop:${session.id}`}
                        onClick={() => void handleStopSession(session.id)}
                      >
                        Kill stream
                      </button>
                      <button
                        className="button button-secondary small"
                        disabled={
                          session.isDisabled || loading === `disable:${session.wallet}`
                        }
                        onClick={() => void handleToggleUser(session.wallet, true)}
                      >
                        Disable user
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-state">No active or starting streams right now.</p>
          )}
        </section>

        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Users</p>
              <h2>Guest user moderation</h2>
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
                      {user.hasPublicProfile ? "Public profile" : "No public profile"} ·{" "}
                      {user.hasActiveSession ? "Live session" : "Idle"} ·{" "}
                      {user.isDisabled ? "Disabled" : "Enabled"}
                    </span>
                    {user.reason ? <span>{user.reason}</span> : null}
                  </div>
                  <div className="admin-history-actions">
                    <span>
                      {user.disabledAt
                        ? `Disabled ${new Date(user.disabledAt).toLocaleString("en-US", {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}`
                        : "Available"}
                    </span>
                    <div className="button-row">
                      {user.isDisabled ? (
                        <button
                          className="button button-primary small"
                          disabled={loading === `enable:${user.guestId}`}
                          onClick={() => void handleToggleUser(user.guestId, false)}
                        >
                          Enable user
                        </button>
                      ) : (
                        <button
                          className="button button-danger small"
                          disabled={loading === `disable:${user.guestId}`}
                          onClick={() => void handleToggleUser(user.guestId, true)}
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
    </div>
  );
}
