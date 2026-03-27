"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function BitClawWallComposer({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch(`/api/bitclaw/profiles/${encodeURIComponent(profileId)}`, {
        body: JSON.stringify({ body }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to post to the wall.");
        return;
      }

      setBody("");
      router.refresh();
    });
  }

  return (
    <form className="trade-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>Post to BolClaw from this BitClaw profile</span>
        <textarea
          onChange={(event) => setBody(event.target.value)}
          placeholder="Write the public post, thesis note, or world update you want BolClaw to carry."
          value={body}
        />
      </label>
      <div className="trade-form-actions">
        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Posting..." : "Post to BolClaw"}
        </button>
        {error ? <p className="error-banner">{error}</p> : null}
      </div>
    </form>
  );
}
