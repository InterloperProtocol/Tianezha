"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type BotBindingView = {
  displayName?: string | null;
  externalUserId: string;
  id: string;
  platform: "telegram" | "wechat";
  status: "bound" | "disabled";
  updatedAt: string;
};

export function BotBindingClient({
  bindings,
}: {
  bindings: BotBindingView[];
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<"telegram" | "wechat">("telegram");
  const [externalUserId, setExternalUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submitBinding() {
    setError(null);
    startTransition(async () => {
      const response = await fetch("/api/bot-bindings", {
        body: JSON.stringify({
          displayName,
          externalUserId,
          platform,
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to bind that bot identity.");
        return;
      }

      setDisplayName("");
      setExternalUserId("");
      router.refresh();
    });
  }

  return (
    <div className="governance-action-stack">
      <div className="mini-list">
        {bindings.length ? (
          bindings.map((binding) => (
            <article key={binding.id} className="mini-item-card">
              <div>
                <span>{binding.platform}</span>
                <strong>{binding.displayName || binding.externalUserId}</strong>
              </div>
              <p className="route-summary compact">
                {binding.externalUserId} / {binding.status} / updated {binding.updatedAt}
              </p>
            </article>
          ))
        ) : (
          <article className="mini-item-card">
            <div>
              <span>No bot bindings</span>
              <strong>Telegram and WeChat are still unbound</strong>
            </div>
            <p className="route-summary compact">
              Bind a messaging identity to this loaded profile so the same wall and reward state
              follows into bot surfaces.
            </p>
          </article>
        )}
      </div>

      <form
        className="trade-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submitBinding();
        }}
      >
        <div className="field-grid">
          <label className="field">
            <span>Platform</span>
            <select
              onChange={(event) =>
                setPlatform(event.target.value as "telegram" | "wechat")
              }
              value={platform}
            >
              <option value="telegram">Telegram</option>
              <option value="wechat">WeChat</option>
            </select>
          </label>

          <label className="field">
            <span>External user id</span>
            <input
              onChange={(event) => setExternalUserId(event.target.value)}
              placeholder="@handle or platform user id"
              value={externalUserId}
            />
          </label>
        </div>

        <label className="field">
          <span>Display name</span>
          <input
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Optional label for this binding"
            value={displayName}
          />
        </label>

        <div className="trade-form-actions">
          <button
            className="button button-secondary"
            disabled={isPending || !externalUserId.trim()}
            type="submit"
          >
            {isPending ? "Binding..." : "Bind bot identity"}
          </button>
        </div>
      </form>

      {error ? <p className="error-banner">{error}</p> : null}
    </div>
  );
}
