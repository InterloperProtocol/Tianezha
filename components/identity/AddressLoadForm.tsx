"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type AddressLoadFormProps = {
  ctaLabel?: string;
  defaultValue?: string;
  helperText?: string;
  redirectPath?: string;
  redirectToLoadedProfile?: boolean;
};

export function AddressLoadForm({
  ctaLabel = "Load Profile",
  defaultValue = "",
  helperText = "Paste any address, ENS, SNS, or .bnb name.",
  redirectPath,
  redirectToLoadedProfile = false,
}: AddressLoadFormProps) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/identity/load", {
        body: JSON.stringify({ input: value }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as {
        error?: string;
        loadedIdentity?: {
          profile?: {
            bitClawProfileId?: string;
          };
        };
      };
      if (!response.ok) {
        setError(payload.error || "Unable to load profile.");
        return;
      }

      const bitClawProfileId = payload.loadedIdentity?.profile?.bitClawProfileId?.trim();
      if (redirectToLoadedProfile && bitClawProfileId) {
        router.push(`/bitclaw/${encodeURIComponent(bitClawProfileId)}`);
        router.refresh();
        return;
      }

      if (redirectPath) {
        router.push(redirectPath);
        router.refresh();
        return;
      }

      router.refresh();
    });
  }

  return (
    <form className="identity-load-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Identity input</span>
        <input
          onChange={(event) => setValue(event.target.value)}
          placeholder="sol: 7KxQ... or atlas.eth"
          value={value}
        />
      </label>
      <div className="identity-load-actions">
        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Loading..." : ctaLabel}
        </button>
        <p className="inline-note">{helperText}</p>
      </div>
      {error ? <p className="error-banner">{error}</p> : null}
    </form>
  );
}
