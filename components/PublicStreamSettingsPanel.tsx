"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";

type Props = {
  slug: string;
  defaultContractAddress: string;
  isPublic: boolean;
  saving: boolean;
  publicUrl: string | null;
  embedded?: boolean;
  onSlugChange: (value: string) => void;
  onSave: () => void;
  onMakePrivate: () => void;
};

export function PublicStreamSettingsPanel({
  slug,
  defaultContractAddress,
  isPublic,
  saving,
  publicUrl,
  embedded = false,
  onSlugChange,
  onSave,
  onMakePrivate,
}: Props) {
  return (
    <section className={embedded ? "public-stream-settings embedded" : "panel public-stream-settings"}>
      <div className="panel-header">
        <div>
          <p className="eyebrow">Register username</p>
          <h2>Claim your public streamer name</h2>
        </div>
        <StatusBadge tone={isPublic ? "success" : "warning"}>
          {isPublic ? "Public now" : "Private draft"}
        </StatusBadge>
      </div>

      <p className="panel-lead">
        Save a clean username for your guest-facing page. Your current chart,
        stream, and live session state can be published to a shareable page when
        you are ready.
      </p>

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
          <div className="summary-card">
            <span>Current shared token focus</span>
            <strong>{defaultContractAddress}</strong>
            <p>This token stays ready for guests unless an active live session overrides it.</p>
          </div>
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
              <dd>Your chart focus, current stream, and live session state on BolClaw.</dd>
            </div>
          </dl>
        ) : null}
      </div>
    </section>
  );
}
