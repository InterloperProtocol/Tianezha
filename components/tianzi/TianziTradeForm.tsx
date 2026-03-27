"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function TianziTradeForm({ questionId }: { questionId: string }) {
  const router = useRouter();
  const [selection, setSelection] = useState<"yes" | "no">("yes");
  const [stake, setStake] = useState("25");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/tianzi", {
        body: JSON.stringify({
          questionId,
          selection,
          stake: Number(stake),
        }),
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Unable to place prediction position.");
        return;
      }

      router.refresh();
    });
  }

  return (
    <form className="trade-form" onSubmit={handleSubmit}>
      <div className="field-grid">
        <label className="field">
          <span>Side</span>
          <select onChange={(event) => setSelection(event.target.value as "yes" | "no")} value={selection}>
            <option value="yes">YES</option>
            <option value="no">NO</option>
          </select>
        </label>
        <label className="field">
          <span>Stake</span>
          <input min="1" onChange={(event) => setStake(event.target.value)} type="number" value={stake} />
        </label>
      </div>
      <div className="trade-form-actions">
        <button className="button button-primary" disabled={isPending} type="submit">
          {isPending ? "Placing..." : "Place Tianzi position"}
        </button>
        {error ? <p className="error-banner">{error}</p> : null}
      </div>
    </form>
  );
}
