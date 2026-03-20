"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";

type Props = {
  slug: string;
  defaultContractAddress: string;
  isPublic: boolean;
  saving: boolean;
  publicUrl: string | null;
  onSlugChange: (value: string) => void;
  onDefaultContractAddressChange: (value: string) => void;
  onSave: () => void;
  onMakePrivate: () => void;
};

export function PublicStreamSettingsPanel({
  slug,
  defaultContractAddress,
  isPublic,
  saving,
  publicUrl,
  onSlugChange,
  onDefaultContractAddressChange,
  onSave,
  onMakePrivate,
}: Props) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Public stream</p>
          <h2>Turn your personal panel into a public stream page</h2>
        </div>
        <StatusBadge tone={isPublic ? "success" : "warning"}>
          {isPublic ? "Public now" : "Private draft"}
        </StatusBadge>
      </div>

      <p className="panel-lead">
        Use the same guest-session setup you already control here. Pick a stream
        tag, lock in the default token, and your current chart, media, and live
        session state become viewable to anyone at a shareable page.
      </p>

      <div className="rail-grid">
        <article className="faq-item">
          <strong>1. Claim your stream tag</strong>
          <p>
            Pick a clean lowercase tag so people can open your public page fast.
          </p>
        </article>
        <article className="faq-item">
          <strong>2. Set the default token</strong>
          <p>
            This becomes the fallback chart whenever your page loads before a
            live session takes over.
          </p>
        </article>
        <article className="faq-item">
          <strong>3. Keep your media live</strong>
          <p>
            Whatever YouTube, Kick, or direct stream link you load in Personal
            is what guests will see on the public page.
          </p>
        </article>
      </div>

      <div className="device-form">
        <div className="field-grid">
          <label className="field">
            <span>Stream tag / username</span>
            <input
              value={slug}
              onChange={(event) => onSlugChange(event.target.value.toLowerCase())}
              placeholder="your-stream-name"
            />
          </label>
          <label className="field">
            <span>Default token mint</span>
            <input
              value={defaultContractAddress}
              onChange={(event) => onDefaultContractAddressChange(event.target.value)}
              placeholder="Pump.fun token mint"
            />
          </label>
        </div>

        <div className="button-row">
          <button
            className="button button-primary"
            disabled={saving || !slug.trim() || !defaultContractAddress.trim()}
            onClick={onSave}
            type="button"
          >
            {saving
              ? "Saving..."
              : isPublic
                ? "Update public stream"
                : "Create public stream"}
          </button>
          {isPublic ? (
            <button
              className="button button-ghost"
              disabled={saving}
              onClick={onMakePrivate}
              type="button"
            >
              Make private
            </button>
          ) : null}
        </div>

        {publicUrl ? (
          <dl className="detail-list">
            <div className="detail">
              <dt>Public page</dt>
              <dd>{publicUrl}</dd>
            </div>
            <div className="detail">
              <dt>Status</dt>
              <dd>{isPublic ? "Anyone can view it now." : "Saved, but not public yet."}</dd>
            </div>
            <div className="detail">
              <dt>What goes live</dt>
              <dd>Your chart focus, current media embed, and live session state.</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
